'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import program from '../../data/ironledger-program.json';
import {GitHubStore} from '../../lib/github-store.mjs';
import {currentDay,ordinal,validatePlan,validateQueue} from '../../lib/online-workflow.mjs';
import {isBodyweight,isCardio,cardioTarget} from '../../lib/activity.mjs';

const range=(min,max)=>min===max?`${min}`:`${min}–${max}`;
export default function Upcoming(){
 const [snapshot,setSnapshot]=useState(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[cached,setCached]=useState(false);
 async function refresh(){
  setBusy(true);setError('');
  try{
   let token='';try{token=localStorage.getItem('awt-github-token')||'';}catch{}
   const latest=await new GitHubStore({token}).snapshot(program);
   setSnapshot(latest);setCached(false);
  }catch(e){setError('Could not refresh upcoming workouts: '+e.message);}
  finally{setBusy(false);}
 }
 useEffect(()=>{
  try{
   const saved=JSON.parse(localStorage.getItem('awt-recovery-v1')||'null')?.remote;
   if(saved){validatePlan(saved.plan,program);validateQueue(saved.queue,program);setSnapshot(saved);setCached(true);}
  }catch{}
  refresh();
 },[]);
 const next=snapshot&&currentDay(snapshot.plan,snapshot.queue);
 const workouts=next?snapshot.plan.workouts.filter(w=>ordinal(w)>=ordinal(next)).slice(0,5):[];
 return <main className="upcoming-page">
  <Link className="back-link" href="/">← Back to workout</Link>
  <h1>Next five workouts</h1>
  <p>Upcoming training sessions in program order.</p>
  <button className="secondary" disabled={busy} onClick={refresh}>{busy?'Refreshing…':'Refresh workouts'}</button>
  {error&&<p role="alert">{error}{snapshot?' Showing the last available plan.':''}</p>}
  {snapshot&&<>
   <p className="muted">{cached?'Saved plan':'Published plan'} · Updated {new Date(snapshot.plan.updatedAt).toLocaleString()}</p>
   {snapshot.queue.sessions.length>0&&<p>Submitted workouts are awaiting processing. They are excluded from this preview.</p>}
   {!next&&<p>Program complete. Return to the tracker to select a workout to repeat.</p>}
   {next&&workouts.length===0&&<p>The next workouts have not been published yet. Refresh after processing completes.</p>}
   {workouts.length>0&&workouts.length<5&&<p>{workouts.length} workouts currently available{ordinal(workouts.at(-1))===48?' before the end of the program.':'; more targets will appear after processing.'}</p>}
   <div className="upcoming-workouts">{workouts.map((workout,index)=><section className="card upcoming-workout" key={`${workout.week}-${workout.day}`}>
    <span className="muted">{index===0?'Next workout':`Workout ${index+1}`}</span>
    <h2>Week {workout.week}, day {workout.day}</h2>
    <p>{workout.dayLabel}</p>
    <ul className="upcoming-exercises">{workout.exercises.map(target=>{
     const ex=program.find(e=>e.id===target.exerciseId);
     return <li key={ex.id}>
      <strong>{ex.name}</strong>
      <p className="preview-target">{isCardio(ex)?`${cardioTarget(ex)} · conversational pace`:<>{ex.sets} × {range(ex.minReps,ex.maxReps)} reps · {isBodyweight(ex)?'Bodyweight':target.weight===null?'Load not set':`${target.weight} lb${ex.weightText.includes('per hand')?' per hand':''}`} · RIR {ex.rirMin===null?'unspecified':range(ex.rirMin,ex.rirMax)}</>}</p>
      {!isCardio(ex)&&<p className="muted">Rest {target.restSeconds??90} sec</p>}
      <details><summary>Why this target</summary><p>{target.reason}</p></details>
     </li>;
    })}</ul>
   </section>)}</div>
  </>}
  {!snapshot&&busy&&<p role="status">Loading upcoming workouts…</p>}
 </main>;
}
