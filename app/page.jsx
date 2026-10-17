'use client';
import {useEffect, useRef, useState} from 'react';
import program from '../data/ironledger-program.json';
import {empty, start, record, setIncrement, validate} from '../lib/workout.mjs';
import {GitHubStore, DEFAULT_REPOSITORY} from '../lib/github-store.mjs';
import {currentDay, makeSubmission, ordinal, targetFromPlan} from '../lib/online-workflow.mjs';

export default function Home() {
  const [remote, setRemote] = useState(null), [draft, setDraft] = useState(empty);
  const [sessionPlan, setSessionPlan] = useState(null);
  const [token, setToken] = useState(''), [credential, setCredential] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [week, setWeek] = useState(1), [day, setDay] = useState(1), [idx, setIdx] = useState(0);
  const [weight, setWeight] = useState(''), [reps, setReps] = useState(''), [rir, setRir] = useState(''), [note, setNote] = useState('');
  const pending = useRef(null), submitting = useRef(false);
  const session = draft.sessions.find(s => s.id === draft.activeId);
  const exercises = program.filter(e => e.week === (session?.week ?? week) && e.day === (session?.day ?? day));
  const ex = exercises[idx] ?? exercises[0];
  const plan = sessionPlan ?? remote?.plan;
  const target = plan && targetFromPlan(plan, ex);
  const targetWeight = target ? target.weight : ex.weight;
  const targetReps = target?.targetReps ?? ex.minReps;
  const done = session?.sets.filter(s => s.exerciseId === ex.id) ?? [];

  function choose(w, d, revision = remote?.plan.revision ?? '') {
    setWeek(w); setDay(d); setIdx(0);
    // Only a day preference is persisted. No workouts, plans, or credentials.
    document.cookie = `awt-day=${w}-${d}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    document.cookie = `awt-plan=${encodeURIComponent(revision)}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }
  async function load(auth = token, remember = false) {
    setBusy(true); setError('');
    try {
      const snapshot = await new GitHubStore({token: auth}).snapshot(program);
      setRemote(snapshot);
      if (!session) {
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
    load('', true);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register((process.env.NEXT_PUBLIC_BASE_PATH || '') + '/sw.js').catch(() => {});
  }, []);
  useEffect(() => {
    setWeight(targetWeight ?? ''); setReps(targetReps); setRir(ex.rirMin ?? ''); setNote('');
  }, [ex.id, targetWeight, targetReps]);
  useEffect(() => {
    const warn = event => { if (session) {event.preventDefault(); event.returnValue = '';}};
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [session]);

  function change(fn) {
    try { setDraft(validate(fn(draft))); setError(''); }
    catch (e) { setError(e.message); }
  }
  async function connect(event) {
    event.preventDefault();
    const value = credential.trim();
    if (!value) {setError('Enter your GitHub repository token.'); return;}
    if (await load(value)) {setToken(value); setCredential(''); setMessage('GitHub connected for this tab.');}
  }
  function begin() {
    if (!token) {setError('Connect GitHub before starting so Finish can submit your workout.'); return;}
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    let next = start(empty(), week, day, crypto.randomUUID(), date);
    for (const e of exercises) {
      const increment = targetFromPlan(remote.plan, e)?.increment;
      if (increment != null) next = setIncrement(next, e, increment);
    }
    setDraft(next); setSessionPlan(remote.plan); pending.current = null; setMessage(''); setError('');
  }
  async function finishWorkout() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (!pending.current) pending.current = makeSubmission(session, exercises, sessionPlan);
      const result = await new GitHubStore({token}).submit(pending.current, program);
      setRemote(result); setDraft(empty()); setSessionPlan(null); pending.current = null;
      const next = currentDay(result.plan, result.queue); if (next) choose(next.week, next.day, result.plan.revision);
      setMessage('Workout saved to Git. Tell ChatGPT “Process my workouts” to update Sheets and your upcoming plan.');
    } catch (e) {setError('Workout not confirmed saved: ' + e.message + ' Keep this tab open and retry Finish workout.');}
    finally {setBusy(false); submitting.current = false;}
  }

  return <main>
    <h1>Adaptive Workout Tracker</h1>
    <p>Completed workouts and upcoming targets stored in Git</p>
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <section className="card">
      <h2>{token ? 'GitHub connected' : 'Connect GitHub'}</h2>
      {!token ? <form onSubmit={connect}>
        <label>GitHub repository token<input aria-label="GitHub repository token" type="password" autoComplete="off" value={credential} onChange={e => setCredential(e.target.value)}/></label>
        <small>Use a fine-grained token for {DEFAULT_REPOSITORY} with Contents read/write. It stays in tab memory and is sent only to GitHub. Reconnect after closing or reloading the page.</small>
        <button disabled={busy || !credential}>Connect GitHub</button>
      </form> : <p>Ready to submit. <button className="secondary" disabled={busy || !!session} onClick={() => {setToken(''); setMessage('GitHub disconnected.');}}>Disconnect</button></p>}
      <button className="secondary" disabled={busy || !!session} onClick={() => load()}>Refresh from Git</button>
      <small>No workout data is saved on this device. Keep this tab open until Finish confirms the online save. An internet connection is required.</small>
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
        <button disabled={busy || !token} onClick={begin}>Start workout</button>
      </section>}
      {session && <p>Workout {session.date} · Week {session.week}, day {session.day} · {pending.current ? 'Submission pending; retry to confirm save' : 'In progress; not yet saved online'}</p>}
      <section className="card">
        <label>Exercise<select aria-label="Exercise" value={Math.min(idx,exercises.length-1)} onChange={e=>setIdx(+e.target.value)}>{exercises.map((e,i)=><option key={e.id} value={i}>{e.name}</option>)}</select></label>
        <h2>{ex.name}</h2>
        <p data-testid="target">Target: {ex.sets} × {targetReps} reps · {targetWeight ?? 'Unspecified'} lb{ex.weightText.includes('per hand') ? ' per hand' : ''} · RIR {ex.rirMin ?? 'unspecified'}{ex.rirMax !== ex.rirMin ? '–'+ex.rirMax : ''}</p>
        <p>Program range: {ex.minReps}–{ex.maxReps} reps · Original load: {ex.weightText || 'Unspecified'} · Rest {ex.restSeconds ?? 'unspecified'} seconds</p>
        {target && <p>Upcoming target · {target.reason}</p>}
        {session && <fieldset disabled={busy || !!pending.current}>
          <div className="controls">
            <label>Load (lb)<input aria-label="Load" type="number" min="0" step="any" value={weight} onChange={e=>setWeight(e.target.value)}/></label>
            <label>Reps<input aria-label="Reps" type="number" min="0" value={reps} onChange={e=>setReps(e.target.value)}/></label>
            <label>Actual RIR<input aria-label="Actual RIR" type="number" min="0" max="10" step="any" value={rir} onChange={e=>setRir(e.target.value)} placeholder="Unknown"/></label>
          </div>
          <small>Leave load or RIR blank if unknown.</small>
          <label>Set notes<input value={note} onChange={e=>setNote(e.target.value)}/></label>
          <button className="wide" disabled={done.length >= ex.sets} onClick={()=>change(s=>{
            if (reps === '') throw Error('Reps are required');
            return record(s,ex,{id:crypto.randomUUID(),weight:weight === '' ? null : +weight,reps:+reps,rir:rir === '' ? null : +rir,notes:note,created:new Date().toISOString()});
          })}>Complete set</button>
          <label>Equipment increment (lb, optional)<input aria-label="Equipment increment" type="number" min="0" step="any" value={session.increments?.[ex.id] ?? ''} onChange={e=>change(s=>setIncrement(s,ex,+e.target.value))}/></label>
        </fieldset>}
        <p>{done.length}/{ex.sets} sets logged</p>
        {done.map((s,i)=><p key={s.id}>Set {i+1}: {s.weight ?? 'Unspecified'} lb × {s.reps} · RIR {s.rir ?? 'unknown'} {s.notes}
          <button className="secondary" disabled={busy || !!pending.current} onClick={()=>change(st=>({...st,sessions:st.sessions.map(x=>x.id===session.id ? {...x,sets:x.sets.filter(row=>row.id!==s.id)} : x)}))}>Remove set {i+1}</button>
        </p>)}
        <details><summary>Original program notes</summary><p>{ex.notes}</p></details>
      </section>
      <div className="row"><button disabled={idx===0} onClick={()=>setIdx(idx-1)}>Previous</button><button disabled={idx>=exercises.length-1} onClick={()=>setIdx(idx+1)}>Next exercise</button></div>
      {session && <button className="wide" disabled={busy} onClick={finishWorkout}>{busy ? 'Saving to Git…' : 'Finish workout'}</button>}
      <section className="card">
        <h2>Awaiting ChatGPT processing ({remote.queue.sessions.length})</h2>
        <p>Say “Process my workouts” in ChatGPT. It reads completed.json, updates Sheets, and publishes next-week.json.</p>
        {remote.queue.sessions.map(s=><details key={s.id}><summary>{s.date} · W{s.week} D{s.day} · {s.sets.length} sets</summary>
          {s.sets.map(set=><p key={set.id}>{program.find(e=>e.id===set.exerciseId)?.name} · {set.weight ?? 'unknown'} lb × {set.reps} · RIR {set.rir ?? 'unknown'}</p>)}
        </details>)}
      </section>
      <section className="card"><h2>Next six workouts</h2><p>Plan updated {new Date(remote.plan.updatedAt).toLocaleString()}</p>
        {remote.plan.workouts.map(w=><details key={`${w.week}-${w.day}`}><summary>Week {w.week}, day {w.day} · {w.dayLabel}</summary>
          {w.exercises.map(t=><p key={t.exerciseId}>{program.find(e=>e.id===t.exerciseId)?.name}: {t.weight ?? 'Unspecified'} lb × {t.targetReps} · {t.reason}</p>)}
        </details>)}
      </section>
    </>}
  </main>;
}
