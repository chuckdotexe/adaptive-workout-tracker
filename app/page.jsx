'use client';
import {useEffect, useState} from 'react';
import program from '../data/ironledger-program.json';
import {empty, read, save, start, record, finish, approve, targetFor, setIncrement, restore} from '../lib/workout.mjs';

export default function Home() {
  const [state, setState] = useState(empty);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [week, setWeek] = useState(1), [day, setDay] = useState(1), [idx, setIdx] = useState(0);
  const [weight, setWeight] = useState(''), [reps, setReps] = useState(''), [rir, setRir] = useState('');
  const [note, setNote] = useState('');
  const [reviews, setReviews] = useState({});
  const [pendingRestore, setPendingRestore] = useState(null);
  const session = state.sessions.find(s => s.id === state.activeId);
  const exercises = program.filter(e => e.week === (session?.week ?? week) && e.day === (session?.day ?? day));
  const ex = exercises[idx] ?? exercises[0];
  const target = targetFor(state, ex);
  const done = session?.sets.filter(s => s.exerciseId === ex.id) ?? [];

  useEffect(() => {
    try {
      const stored = read(localStorage);
      setState(stored);
      setWeek(stored.selection?.week ?? 1);
      setDay(stored.selection?.day ?? 1);
      setReady(true);
      if ('serviceWorker' in navigator) navigator.serviceWorker.register(
        (process.env.NEXT_PUBLIC_BASE_PATH || '') + '/sw.js').catch(() => {});
    } catch (e) { setError(e.message); }
  }, []);
  useEffect(() => {
    setWeight(target.weight ?? '');
    setReps(target.targetReps ?? '');
    setRir(target.rirMin ?? '');
    setNote('');
  }, [ex.id, target.weight, target.targetReps]);

  function commit(fn) {
    try {
      if (JSON.stringify(read(localStorage)) !== JSON.stringify(state)) {
        throw Error('Workout changed in another tab. Reload before continuing');
      }
      const next = fn(state);
      save(localStorage, next);
      setState(next);
      setError('');
      return true;
    } catch (e) { setError('Save failed: ' + e.message); return false; }
  }
  function backup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], {type: 'application/json'}));
    const a = document.createElement('a');
    a.href = url; a.download = 'workout-backup.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function inspectBackup(event) {
    setPendingRestore(null);
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) throw Error('Backup exceeds 10 MB');
      const candidate = restore(await file.text());
      for (const s of candidate.sessions) {
        const allowed = program.filter(e => e.week === s.week && e.day === s.day);
        if (s.sets.some(set => !allowed.some(e => e.id === set.exerciseId))) throw Error('Unknown exercise in backup');
        if (s.status === 'finished' && allowed.some(e => !s.decisions[e.id])) throw Error('Incomplete decisions in backup');
      }
      if (Object.keys(candidate.targets).some(id => !program.some(e => e.id === id))) throw Error('Unknown target in backup');
      setPendingRestore(candidate); setError('');
    } catch (e) { setError('Backup not loaded: ' + e.message); }
    event.target.value = '';
  }
  function approveTargets() {
    const confirmed = {};
    for (const [id, review] of Object.entries(reviews)) {
      if (!review.confirmed) continue;
      if (review.weight === '' || review.reps === '') { setError('Enter a reviewed load and rep goal'); return; }
      confirmed[id] = {weight: Number(review.weight), targetReps: Number(review.reps)};
    }
    if (commit(s => approve(s, exercises, confirmed))) { setReviews({}); setIdx(0); }
  }
  function updateReview(id, value) {
    setReviews(previous => ({...previous, [id]: {...previous[id], ...value}}));
  }
  function applyBackup() {
    try {
      // This button explicitly replaces device data, including corrupt storage.
      save(localStorage, pendingRestore);
      setState(pendingRestore); setReady(true); setError('');
      setWeek(pendingRestore.selection?.week ?? 1); setDay(pendingRestore.selection?.day ?? 1);
      setIdx(0); setReviews({}); setPendingRestore(null);
    } catch (e) { setError('Backup not restored: ' + e.message); }
  }

  return <main>
    <h1>Adaptive Workout Tracker</h1>
    <p>Workout data saved on this device</p>
    {error && <p role="alert">{error}</p>}
    {!ready ? <p>Storage unavailable. Existing data has not been replaced.</p> : <>
      {!session && <section className="card">
        <div className="row">
          <label>Week<select aria-label="Week" value={week} onChange={e => {setWeek(+e.target.value); setIdx(0);}}>
            {Array.from({length: 8}, (_, i) => <option key={i}>{i + 1}</option>)}
          </select></label>
          <label>Day<select aria-label="Day" value={day} onChange={e => {setDay(+e.target.value); setIdx(0);}}>
            {Array.from({length: 6}, (_, i) => <option key={i}>{i + 1}</option>)}
          </select></label>
        </div>
        <p>{ex.dayLabel}</p>
        <button onClick={() => commit(s => start(s, week, day, crypto.randomUUID(), new Date().toLocaleDateString()))}>Start workout</button>
      </section>}
      {session && <p>Workout {session.date} · Week {session.week}, day {session.day} · {session.status}</p>}
      <section className="card">
        <label>Exercise<select aria-label="Exercise" value={Math.min(idx, exercises.length - 1)} onChange={e => setIdx(+e.target.value)}>
          {exercises.map((e, i) => <option key={e.id} value={i}>{e.name}</option>)}
        </select></label>
        <h2>{ex.name}</h2>
        <p data-testid="target">Target: {ex.sets} × {target.targetReps} reps · {target.weight ?? 'Unspecified'} lb{ex.weightText.includes('per hand') ? ' per hand' : ''} · RIR {ex.rirMin ?? 'unspecified'}{ex.rirMax !== ex.rirMin ? '–' + ex.rirMax : ''}</p>
        <p>Program range: {ex.minReps}–{ex.maxReps} reps · Original load: {ex.weightText || 'Unspecified'} · Rest {ex.restSeconds ?? 'unspecified'} seconds</p>
        {state.targets[ex.id] && <p>Approved next-session target · {state.targets[ex.id].reason}</p>}
        {session?.status === 'active' && <>
          <div className="controls">
            <label>Load (lb)<input aria-label="Load" type="number" min="0" step="any" value={weight} onChange={e => setWeight(e.target.value)}/></label>
            <label>Reps<input aria-label="Reps" type="number" min="0" value={reps} onChange={e => setReps(e.target.value)}/></label>
            <label>Actual RIR<input aria-label="Actual RIR" type="number" min="0" max="10" step="any" value={rir} onChange={e => setRir(e.target.value)} placeholder="Unknown"/></label>
          </div>
          <small>Leave load or RIR blank if unknown. Unknown values require review for progression.</small>
          <label>Set notes<input value={note} onChange={e => setNote(e.target.value)}/></label>
          <button className="wide" disabled={done.length >= ex.sets} onClick={() => commit(s => {
            if (reps === '') throw Error('Reps are required');
            return record(s, ex, {id: crypto.randomUUID(), weight: weight === '' ? null : +weight,
              reps: +reps, rir: rir === '' ? null : +rir, notes: note, created: new Date().toISOString()});
          })}>Complete set</button>
          <label>Equipment increment (lb, optional)<input aria-label="Equipment increment" type="number" min="0" step="any"
            value={session.increments?.[ex.id] ?? ''} onChange={e => commit(s => setIncrement(s, ex, +e.target.value))}/></label>
        </>}
        <p>{done.length}/{ex.sets} sets logged</p>
        {done.map((s, i) => <p key={s.id}>Set {i + 1}: {s.weight ?? 'Unspecified'} lb × {s.reps} · RIR {s.rir ?? 'unknown'} {s.notes}
          {session.status === 'active' && <button className="secondary" onClick={() => commit(st => ({...st,
            sessions: st.sessions.map(x => x.id === session.id ? {...x, sets: x.sets.filter(set => set.id !== s.id)} : x),
          }))}>Remove set {i + 1}</button>}
        </p>)}
        <details><summary>Original program notes</summary><p>{ex.notes}</p></details>
      </section>
      <div className="row">
        <button disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Previous</button>
        <button disabled={idx >= exercises.length - 1} onClick={() => setIdx(idx + 1)}>Next exercise</button>
      </div>
      {session?.status === 'active' && <button className="wide" onClick={() => commit(s => finish(s, exercises))}>Finish workout</button>}
      {session?.status === 'finished' && <section className="card">
        <h2>Review next-session targets</h2>
        {exercises.map(e => {
          const d = session.decisions[e.id];
          return <div key={e.id} className="set">
            <p><strong>{e.name}</strong>: {d.action} · {d.proposedWeight ?? 'unspecified'} lb · {d.targetReps ?? e.minReps} reps · {d.reason}</p>
            <p>Actual loads: {(d.actualLoads ?? session.sets.filter(s => s.exerciseId === e.id).map(s => s.weight)).map(w => w ?? 'unknown').join(', ')} lb</p>
            {d.action === 'review' && <>
              <label>Reviewed load for {e.name}<input type="number" min="0" step="any" value={reviews[e.id]?.weight ?? ''}
                onChange={event => updateReview(e.id, {weight: event.target.value})}/></label>
              <label>Reviewed reps for {e.name}<input type="number" min={e.minReps} max={e.maxReps} step="1" value={reviews[e.id]?.reps ?? ''}
                onChange={event => updateReview(e.id, {reps: event.target.value})}/></label>
              <label><input type="checkbox" checked={reviews[e.id]?.confirmed ?? false}
                onChange={event => updateReview(e.id, {confirmed: event.target.checked})}/>Approve reviewed target for {e.name}</label>
            </>}
          </div>;
        })}
        <p>Unchecked review decisions retain the prior target. Actual logged loads are always preserved. Targets apply to this exact program week and day.</p>
        <button onClick={approveTargets}>Approve targets and close workout</button>
      </section>}
      <section className="card">
        <h2>Saved workouts ({state.sessions.length})</h2>
        {state.sessions.map(s => <details key={s.id}>
          <summary>{s.date} · W{s.week} D{s.day} · {s.sets.length} sets · {s.status}</summary>
          {s.sets.map((set, i) => <p key={set.id}>{program.find(e => e.id === set.exerciseId)?.name} · {set.weight ?? 'unknown'} lb × {set.reps} · RIR {set.rir ?? 'unknown'} · {set.notes}</p>)}
        </details>)}
      </section>
      <p>Back up regularly: clearing browser data removes local workouts. Google Sheets sync and verified iPhone installation are still pending.</p>
    </>}
      <section className="card">
        <h2>Backup and recovery</h2>
        {ready && <button onClick={backup}>Export backup</button>}
        <label>Restore workout backup<input type="file" accept="application/json,.json" onChange={inspectBackup}/></label>
        {pendingRestore && <div role="status">
          <p>Backup contains {pendingRestore.sessions.length} workouts and {Object.keys(pendingRestore.targets).length} targets. Restoring replaces the current device data.</p>
          <button onClick={applyBackup}>Replace device data with backup</button>
          <button className="secondary" onClick={() => setPendingRestore(null)}>Cancel restore</button>
        </div>}
      </section>
  </main>;
}
