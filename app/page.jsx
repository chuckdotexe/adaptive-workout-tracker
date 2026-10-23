'use client';
import {useEffect, useRef, useState} from 'react';
import {isCardio, cardioTarget,isBodyweight} from '../lib/activity.mjs';
import program from '../data/ironledger-program.json';
import {empty, start, record, setIncrement, validate} from '../lib/workout.mjs';
import {GitHubStore, DEFAULT_REPOSITORY} from '../lib/github-store.mjs';
import {currentDay, makeSubmission, ordinal, targetFromPlan} from '../lib/online-workflow.mjs';

const REST_SECONDS = 90;
const RECOVERY = 'awt-recovery-v1', AUTH = 'awt-github-token';
function Stepper({label,value,onChange,step=1,max=Infinity}) {
 return <label className="stepper">{label}<input aria-label={label} type="number" min="0" max={max} step="any" value={value} onChange={e=>onChange(e.target.value)}/><div><button type="button" aria-label={'Decrease '+label} onClick={()=>onChange(Math.max(0,+(value||0)-step))}>−</button><button type="button" aria-label={'Increase '+label} onClick={()=>onChange(Math.min(max,+(value||0)+step))}>+</button></div></label>;
}
export default function Home() {
  const [remote, setRemote] = useState(null), [draft, setDraft] = useState(empty);
  const [sessionPlan, setSessionPlan] = useState(null);
  const [token, setToken] = useState(''), [credential, setCredential] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [week, setWeek] = useState(1), [day, setDay] = useState(1), [idx, setIdx] = useState(0);
  const [weight, setWeight] = useState(''), [reps, setReps] = useState(''), [rir, setRir] = useState(''), [note, setNote] = useState('');
  const [ready,setReady]=useState(false), [restEnd,setRestEnd]=useState(null), [clock,setClock]=useState(Date.now());
  const [showMissing,setShowMissing]=useState(false);
  const [online,setOnline]=useState(true), [sound,setSound]=useState(false), [minutes,setMinutes]=useState(''), [speed,setSpeed]=useState(''), [incline,setIncline]=useState('');
  const audio=useRef(null), scheduled=useRef([]), sounded=useRef(null);
  const recovered=useRef(false);
  const pending = useRef(null), submitting = useRef(false);
  const session = draft.sessions.find(s => s.id === draft.activeId);
  const exercises = program.filter(e => e.week === (session?.week ?? week) && e.day === (session?.day ?? day));
  const ex = exercises[idx] ?? exercises[0];
  const cardio = isCardio(ex), bodyweight=isBodyweight(ex);
  const plan = sessionPlan ?? remote?.plan;
  const target = plan && targetFromPlan(plan, ex);
  const targetWeight = target ? target.weight : ex.weight;
  const targetReps = target?.targetReps ?? ex.minReps;
  const done = session?.sets.filter(s => s.exerciseId === ex.id) ?? [];
  const nextExercise = session ? [...exercises.slice(idx+1),...exercises.slice(0,idx)].find(e=>!session.skipped?.[e.id] && session.sets.filter(s=>s.exerciseId===e.id).length<e.sets) : exercises[idx+1];
  const missing = session ? exercises.map((e,i)=>({...e,index:i,logged:session.sets.filter(s=>s.exerciseId===e.id).length})).filter(e=>e.logged<e.sets && !session.skipped?.[e.id]) : [];

  function choose(w, d, revision = remote?.plan.revision ?? '') {
    setWeek(w); setDay(d); setIdx(0);
    // Remember selection independently of the recoverable workout.
    document.cookie = `awt-day=${w}-${d}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    document.cookie = `awt-plan=${encodeURIComponent(revision)}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }
  async function load(auth = token, remember = false) {
    setBusy(!recovered.current && !session); setError('');
    try {
      const snapshot = await new GitHubStore({token: auth}).snapshot(program);
      setRemote(snapshot);
      if (!session && !recovered.current) {
        const next = currentDay(snapshot.plan, snapshot.queue);
        const cookie = remember && document.cookie.match(/(?:^|; )awt-day=([1-8])-([1-6])(?:;|$)/);
        const samePlan = document.cookie.split('; ').includes('awt-plan=' + encodeURIComponent(snapshot.plan.revision));
        if (cookie && samePlan && !snapshot.queue.sessions.length) choose(+cookie[1], +cookie[2], snapshot.plan.revision);
        else if (next) choose(next.week, next.day, snapshot.plan.revision);
      }
      return true;
    } catch (e) { setError('Could not load Git workouts: ' + e.message); return false; }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let auth='';
    try {
      auth=localStorage.getItem(AUTH)||''; setToken(auth);
      const raw=localStorage.getItem(RECOVERY);
      if(raw) {const saved=JSON.parse(raw); const state=validate(saved.draft); recovered.current=!!state.activeId; setDraft(state);setRemote(saved.remote);setSessionPlan(saved.sessionPlan);setIdx(saved.idx||0);setRestEnd(saved.restEnd||null);pending.current=saved.pending||null;}
    } catch(e) {setError('Device recovery unavailable: '+e.message);}
    setOnline(navigator.onLine);
    try {setSound(localStorage.getItem('awt-timer-sound')==='true');} catch {}
    setReady(true); load(auth,true);
    if ('serviceWorker' in navigator) {
      const hadController = !!navigator.serviceWorker.controller;
      const update = () => { if (hadController && !recovered.current) window.location.reload(); };
      navigator.serviceWorker.addEventListener('controllerchange', update);
      navigator.serviceWorker.register((process.env.NEXT_PUBLIC_BASE_PATH || '') + '/sw.js', {updateViaCache: 'none'}).then(reg => reg.update()).catch(() => {});
      return () => navigator.serviceWorker.removeEventListener('controllerchange', update);
    }
  }, []);
  useEffect(()=>{
    const update=()=>setOnline(navigator.onLine);
    window.addEventListener('online',update);window.addEventListener('offline',update);
    return ()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};
  },[]);
  function stopAlarm() { for(const node of scheduled.current) {try {node.stop();} catch {}} scheduled.current=[]; }
  function scheduleAlarm(deadline) {
    stopAlarm();
    if(!sound || !audio.current || !deadline || deadline<=Date.now()) return;
    const ctx=audio.current;
    ctx.resume().catch(()=>{});
    const when=ctx.currentTime+(deadline-Date.now())/1000;
    for(let i=0;i<3;i++) {
      const oscillator=ctx.createOscillator(),gain=ctx.createGain();
      oscillator.frequency.value=880;gain.gain.value=0.12;
      oscillator.connect(gain);gain.connect(ctx.destination);
      oscillator.start(when+i*0.3);oscillator.stop(when+i*0.3+0.15);scheduled.current.push(oscillator);
    }
  }
  function startRest() {if(sound && !audio.current){try {const Audio=window.AudioContext || window.webkitAudioContext;audio.current=new Audio();audio.current.resume().catch(()=>{});} catch {}}const end=Date.now()+REST_SECONDS*1000;setClock(Date.now());setRestEnd(end);scheduleAlarm(end);}
  function toggleSound() {
    const enabled=!sound;
    try {
      if(enabled) {const Audio=window.AudioContext || window.webkitAudioContext;if(!Audio)throw Error('Sound is unavailable in this browser.');audio.current ||= new Audio();audio.current.resume().catch(()=>setError('Tap Sound to enable timer audio.'));
        const tone=audio.current.createOscillator(),gain=audio.current.createGain();gain.gain.value=0.1;tone.connect(gain);gain.connect(audio.current.destination);tone.start();tone.stop(audio.current.currentTime+0.15);
      } else stopAlarm();
      localStorage.setItem('awt-timer-sound',String(enabled));setSound(enabled);
    } catch(e) {setError(e.message);}
  }
  useEffect(()=>{scheduleAlarm(restEnd);return stopAlarm;},[restEnd,sound]);
  useEffect(()=>{if(restEnd && clock>=restEnd && sounded.current!==restEnd){sounded.current=restEnd;if(sound)navigator.vibrate?.([200,100,200]);}},[clock,restEnd,sound]);
  useEffect(() => {
    setMinutes('');setSpeed('');setIncline('');
    setWeight(targetWeight ?? ''); setReps(targetReps); setRir(ex.rirMin ?? ''); setNote('');
  }, [ex.id, targetWeight, targetReps]);
  useEffect(() => {
    const warn = event => { if (session) {event.preventDefault(); event.returnValue = '';}};
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [session]);

  useEffect(()=>{
    if(!ready) return;
    try {localStorage.setItem(RECOVERY,JSON.stringify({draft,remote,sessionPlan,idx,restEnd,pending:pending.current}));}
    catch {setError('Device storage unavailable. Keep this page open until Git confirms your save.');}
  },[ready,draft,remote,sessionPlan,idx,restEnd]);
  useEffect(()=>{if(!restEnd)return;const id=setInterval(()=>setClock(Date.now()),250);return ()=>clearInterval(id);},[restEnd]);
  function navigate(index) {setIdx(index);setError('');setShowMissing(false);}
  function change(fn) {
    try { const next=validate(fn(draft)); localStorage.setItem(RECOVERY,JSON.stringify({draft:next,remote,sessionPlan,idx,restEnd,pending:pending.current}));setDraft(next); setError('');setMessage('');setShowMissing(false); return true; }
    catch (e) { setError(e.message); return false; }
  }
  function logEntry() {
    const logged=change(state=>{
      const base={id:crypto.randomUUID(),notes:note,created:new Date().toISOString()};
      if(cardio) return record(state,ex,{...base,kind:'cardio',durationMinutes:+minutes,speedMph:speed===''?null:+speed,inclinePercent:incline===''?null:+incline,reps:0,weight:null,rir:null});
      if(reps==='') throw Error('Reps are required');
      return record(state,ex,{...base,weight:weight===''?null:+weight,reps:+reps,rir:rir===''?null:+rir});
    });
    if(logged && !cardio) startRest();
  }
  async function connect(event) {
    event.preventDefault();
    const value = credential.trim();
    if (!value) {setError('Enter your GitHub repository token.'); return;}
    if (await load(value)) {localStorage.setItem(AUTH,value);setToken(value); setCredential(''); setMessage('GitHub connection remembered on this device.');}
  }
  function begin() {
    if (!remote) {setError('Load the program before starting.'); return;}
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    let next = start(empty(), week, day, crypto.randomUUID(), date);
    for (const e of exercises) {
      const increment = targetFromPlan(remote.plan, e)?.increment;
      if (increment != null) next = setIncrement(next, e, increment);
    }
    localStorage.setItem(RECOVERY,JSON.stringify({draft:next,remote,sessionPlan:remote.plan,idx}));recovered.current=true;setDraft(next); setSessionPlan(remote.plan); pending.current = null; setMessage(''); setError('');
  }
  async function finishWorkout() {
    if (submitting.current) return;
    setShowMissing(missing.length>0);
    submitting.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (!pending.current) pending.current = makeSubmission(session, exercises, sessionPlan);
      localStorage.setItem(RECOVERY,JSON.stringify({draft,remote,sessionPlan,idx,restEnd,pending:pending.current}));
      const auth=localStorage.getItem(AUTH)||token;
      const result = await new GitHubStore({token:auth}).submit(pending.current, program);
      localStorage.setItem(RECOVERY,JSON.stringify({draft:empty(),remote:result}));recovered.current=false;setRestEnd(null);setRemote(result); setDraft(empty()); setSessionPlan(null); pending.current = null;
      const next = currentDay(result.plan, result.queue); if (next) choose(next.week, next.day, result.plan.revision);
      setMessage('Workout saved to Git. Awaiting target processing; refresh from Git to check for an updated plan.');
    } catch (e) {setError('Workout not confirmed saved: ' + e.message + ' Your workout is retained on this device.');}
    finally {setBusy(false); submitting.current = false;}
  }

  return <main className={session ? "active-workout" : ""}>
    <h1>Adaptive Workout Tracker</h1>
    <p className="intro">Workouts recover on this device after reload.</p>
    {error && <p role="alert">{error}</p>}
    {showMissing && missing.length > 0 && <div className="missing-sets"><strong>Missing sets</strong>{missing.map(e=><button key={e.id} className="secondary" onClick={()=>{setIdx(e.index);setError('');}}>{e.name} · {e.logged}/{e.sets}</button>)}</div>}
    {message && <p role="status">{message}</p>}
    <section className={session ? "card connection compact-connection" : "card connection"}>
      <h2>{token ? 'GitHub connected' : 'Connect GitHub'}</h2>
      {!token ? <form onSubmit={connect}>
        <label>GitHub repository token<input aria-label="GitHub repository token" type="password" autoComplete="off" value={credential} onChange={e => setCredential(e.target.value)}/></label>
        <small>Use a fine-grained token for {DEFAULT_REPOSITORY} with Contents read/write. It is remembered in this browser on this device and sent only to GitHub. Disconnect removes it.</small>
        <button disabled={busy || !credential}>Connect GitHub</button>
      </form> : <p>{online ? (token ? 'Token saved · sync on Finish' : 'Connect to sync') : 'Offline · logging on device'}. <button className="secondary" disabled={busy} onClick={() => {localStorage.removeItem(AUTH);setToken(''); setMessage('GitHub disconnected.');}}>Disconnect</button></p>}
      <button className="secondary" disabled={busy || !!session} onClick={() => load()}>Refresh from Git</button>
      <small>Sets save on this device immediately. Internet is required to submit to GitHub.</small>
    </section>
    {!remote ? <p>{busy ? 'Loading workouts from Git…' : 'Connect or refresh to load the workout files.'}</p> : <>
      {!session && <section className="card">
        <div className="row">
          <label>Week<select aria-label="Week" value={week} disabled={busy} onChange={e => choose(+e.target.value, day)}>{Array.from({length:8},(_,i)=><option key={i}>{i+1}</option>)}</select></label>
          <label>Day<select aria-label="Day" value={day} disabled={busy} onChange={e => choose(week,+e.target.value)}>{Array.from({length:6},(_,i)=><option key={i}>{i+1}</option>)}</select></label>
        </div>
        <p>Program day {ordinal({week,day})} of 48 · {ex.dayLabel}</p>
        {!target && <p>This day is outside the saved upcoming plan. Original program targets are shown.</p>}
        {!currentDay(remote.plan, remote.queue) && <p>Program complete. Select a day to repeat it.</p>}
        <button disabled={busy} onClick={begin}>Start workout</button>
      </section>}
      {session && <p>Workout {session.date} · Week {session.week}, day {session.day} · {pending.current ? 'Submission pending; retry to confirm save' : 'Saved on device'}</p>}
      <section className="card">
        <label className="exercise-picker">Exercise<select aria-label="Exercise" value={Math.min(idx,exercises.length-1)} onChange={e=>navigate(+e.target.value)}>{exercises.map((e,i)=><option key={e.id} value={i}>{e.name}{session ? (session.skipped?.[e.id] ? ' · skipped' : ` · ${session.sets.filter(s=>s.exerciseId===e.id).length}/${e.sets}`) : ''}</option>)}</select></label>
        <h2>{ex.name}</h2>
        <p data-testid="target">{cardio ? `Cardio: ${cardioTarget(ex)} · conversational pace` : <>Target: {ex.sets} × {targetReps} reps · {bodyweight ? 'Bodyweight' : `${targetWeight ?? 'Unspecified'} lb${ex.weightText.includes('per hand') ? ' per hand' : ''}`} · RIR {ex.rirMin ?? 'unspecified'}{ex.rirMax !== ex.rirMin ? '–'+ex.rirMax : ''}</>}</p>
        <p className="extra">Program range: {ex.minReps}–{ex.maxReps} reps · Original load: {ex.weightText || 'Unspecified'} · Rest {REST_SECONDS} seconds</p>
        {target && <p className="extra">Upcoming target · {target.reason}</p>}
        {session && <fieldset disabled={busy || !!pending.current}>
          {cardio ? <div className="controls cardio-controls"><Stepper label="Minutes" value={minutes} onChange={setMinutes}/><Stepper label="Speed (mph)" value={speed} onChange={setSpeed} step={0.1}/><Stepper label="Incline (%)" value={incline} onChange={setIncline} max={100}/></div> : <div className="controls">
            {bodyweight ? <div className="bodyweight-label">Bodyweight</div> : <Stepper label="Load" value={weight} onChange={setWeight} step={session.increments?.[ex.id]||5}/> }
            <Stepper label="Reps" value={reps} onChange={setReps}/>
            <Stepper label="Actual RIR" value={rir} onChange={setRir} max={10}/>
          </div>}

          {cardio && <p>Minutes required · speed and incline optional</p>}
          <button className="wide" disabled={done.length >= ex.sets || !!session.skipped?.[ex.id]} onClick={logEntry}>{cardio ? 'Complete cardio' : 'Complete set'}</button>
          <details><summary>Notes & equipment</summary>{session.skipped?.[ex.id] && <button onClick={()=>change(st=>({...st,sessions:st.sessions.map(x=>{if(x.id!==session.id)return x;const skipped={...x.skipped};delete skipped[ex.id];return {...x,skipped};})}))}>Require remaining sets</button>}<label>Set notes<input value={note} onChange={e=>setNote(e.target.value)}/></label>
          {!bodyweight && <label>Equipment increment (lb, optional)<input aria-label="Equipment increment" type="number" min="0" step="any" value={session.increments?.[ex.id] ?? ''} onChange={e=>change(s=>setIncrement(s,ex,+e.target.value))}/></label>}</details>
        </fieldset>}
        {session && !cardio && <div className="timer" role="timer">{restEnd && clock>=restEnd ? 'Rest complete · ' : 'Rest '}{Math.floor(Math.max(0,Math.ceil(((restEnd||clock)-clock)/1000))/60)}:{String(Math.max(0,Math.ceil(((restEnd||clock)-clock)/1000))%60).padStart(2,'0')} <button className="secondary" onClick={startRest}>Restart</button><button className="secondary" onClick={()=>{setRestEnd(null);stopAlarm();}}>Clear</button><button className="secondary" aria-pressed={sound} onClick={toggleSound}>Sound {sound ? 'on' : 'off'}</button></div>}
        <p>{session?.skipped?.[ex.id] && <strong>Skipped: machine unavailable · </strong>}<span>{done.length}/{ex.sets} sets logged</span>{session && done.length < ex.sets && !session.skipped?.[ex.id] ? ` · ${ex.sets-done.length} sets remaining` : ''}</p><div className="logged-sets">
        {done.map((s,i)=><p key={s.id}>{s.kind==='cardio' ? `${s.durationMinutes} min · ${s.speedMph ?? '?'} mph · ${s.inclinePercent ?? '?'}% incline` : <>Set {i+1}: {s.bodyweight ? 'Bodyweight' : `${s.weight ?? 'Unspecified'} lb`} × {s.reps} · RIR {s.rir ?? 'unknown'}</>} {s.notes}
          <button className="secondary" disabled={busy || !!pending.current} onClick={()=>change(st=>({...st,sessions:st.sessions.map(x=>x.id===session.id ? {...x,sets:x.sets.filter(row=>row.id!==s.id)} : x)}))}>Remove set {i+1}</button>
        </p>)}
        </div><details className="extra"><summary>Original program notes</summary><p>{ex.notes}</p></details>
      </section>
      {session && <div className="next-up">Next up: {nextExercise?.name || 'Finish workout'}</div>}
      <div className="row"><button disabled={idx===0} onClick={()=>setIdx(idx-1)}>Previous</button><button disabled={idx>=exercises.length-1} onClick={()=>navigate(idx+1)}>Next exercise</button></div>
      {session && <button className="wide" disabled={busy} onClick={()=>finishWorkout()}>{busy ? 'Saving to Git…' : 'Finish workout'}</button>}
      <section className="card overview">
        <h2>Awaiting processing ({remote.queue.sessions.length})</h2>
        <p>Completed sessions stay queued until the processing runner verifies Sheets and publishes upcoming targets. Automation requires its one-time GitHub setup.</p>
        {remote.queue.sessions.map(s=><details key={s.id}><summary>{s.date} · W{s.week} D{s.day} · {s.sets.length} sets</summary>
          {s.sets.map(set=><p key={set.id}>{program.find(e=>e.id===set.exerciseId)?.name} · {set.kind==='cardio' ? `${set.durationMinutes} min · ${set.speedMph ?? '?'} mph · ${set.inclinePercent ?? '?'}% incline` : `${set.bodyweight ? 'Bodyweight' : `${set.weight ?? 'unknown'} lb`} × ${set.reps} · RIR ${set.rir ?? 'unknown'}`}</p>)}
        </details>)}
      </section>
      <section className="card overview"><h2>Next six workouts</h2><p>Plan updated {new Date(remote.plan.updatedAt).toLocaleString()}</p>
        {remote.plan.workouts.map(w=><details key={`${w.week}-${w.day}`}><summary>Week {w.week}, day {w.day} · {w.dayLabel}</summary>
          {w.exercises.map(t=><p key={t.exerciseId}>{program.find(e=>e.id===t.exerciseId)?.name}: {isBodyweight(program.find(e=>e.id===t.exerciseId)) ? 'Bodyweight' : `${t.weight ?? 'Unspecified'} lb`} × {t.targetReps} · {t.reason}</p>)}
        </details>)}
      </section>
    </>}
  </main>;
}
