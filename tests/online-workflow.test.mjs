import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {empty,start,record,recordOptionalTreadmill,validate} from '../lib/workout.mjs';
import {appendToQueue,digest,makeSubmission,seedPlan,validatePlan,validateQueue,currentDay} from '../lib/online-workflow.mjs';
import {GitHubStore} from '../lib/github-store.mjs';
import {prepareBatch,finalizeProcessing,sheetRows} from '../lib/processing.mjs';
import {GitHubFixture} from './helpers/github-fixture.mjs';
import {OPTIONAL_TREADMILL_ID,treadmillMetrics} from '../lib/activity.mjs';
const program=JSON.parse(fs.readFileSync(new URL('../data/ironledger-program.json',import.meta.url)));
function submission(id='one',day=1){
  const plan=seedPlan(program), exercises=program.filter(e=>e.week===1&&e.day===day);
  let state=start(empty(),1,day,id,'2026-10-17');
  for(const ex of exercises) for(let i=0;i<ex.sets;i++)state=record(state,ex,{id:`${id}-${ex.id}-${i}`,weight:ex.weight,reps:ex.minReps,rir:i ? ex.rirMin : null,notes:'Actual café = private note'});
  return makeSubmission(state.sessions[0],exercises,plan,'2026-10-17T17:00:00Z');
}
function setup(){const fixture=new GitHubFixture(program);return {fixture,store:new GitHubStore({token:'test-only',fetchImpl:fixture.fetch})};}
function receipt(batch){return {spreadsheetId:'staging-test-only',range:"'Workout Log'!A2:V100",verified:true,sessions:batch.sessions};}

test('rolling plan covers six days and handles the end of the eight-week program',()=>{
  assert.equal(seedPlan(program).workouts.length,6);
  assert.equal(seedPlan(program,{week:8,day:5}).workouts.length,2);
  assert.equal(seedPlan(program,null).workouts.length,0);
  assert.deepEqual(currentDay(seedPlan(program),{sessions:[submission()]}),{week:1,day:2});
  const bad=seedPlan(program);bad.workouts[0].exercises[0].targetReps=999;
  assert.throws(()=>validatePlan(bad,program),/Invalid upcoming target/);
});
test('incomplete sessions are rejected before any network write',()=>{
  const exercises=program.filter(e=>e.week===1&&e.day===1);
  assert.throws(()=>makeSubmission(start(empty(),1,1,'id','2026-10-17').sessions[0],exercises,seedPlan(program)),/Incomplete/);
});
test('submit saves Unicode data online and same session retries do not duplicate',async()=>{
  const {fixture,store}=setup();const session=submission();
  await store.submit(session,program);await store.submit(session,program);
  assert.deepEqual(fixture.files['completed.json'].sessions,[session]);
  assert.equal(fixture.requests.filter(r=>r.method==='PATCH').length,1);
  const changed=structuredClone(session);changed.sets[0].reps++;
  await assert.rejects(()=>store.submit(changed,program),/different data/);
});
test('a lost success response retries with the same ID',async()=>{
  const {fixture,store}=setup();fixture.failAfterPublish=true;
  await store.submit(submission(),program);
  assert.equal(fixture.files['completed.json'].sessions.length,1);
});
test('two simultaneous submissions merge without overwriting either',async()=>{
  const {fixture,store}=setup();
  await Promise.all([store.submit(submission('one'),program),store.submit(submission('two',2),program)]);
  assert.deepEqual(new Set(fixture.files['completed.json'].sessions.map(s=>s.id)),new Set(['one','two']));
});
test('Sheets rows preserve unknown values, actual loads, RIR derivation, IDs and load semantics',()=>{
  const session=submission(),rows=sheetRows(session);
  assert.equal(rows[0].length,22);assert.equal(rows[0][10],'');assert.equal(rows[0][19],'');
  assert.equal(rows[1][10],10-session.sets[1].rir);assert.equal(rows[1][19],session.sets[1].rir);
  assert.equal(rows[0][20],session.id);assert.equal(rows[0][21],session.sets[0].id);
  assert.match(rows[0][17],/café/);
  const unknown=rows.find((row,i)=>session.sets[i].weight===null);
  assert.equal(unknown[7],'');assert.equal(unknown[9],'');
});
test('optional treadmill estimates steps from distance, without daily step counts',()=>{
 const metrics=treadmillMetrics(10,2.6);
 assert.equal(Math.round(metrics.distanceMiles*1000),433);
 assert.deepEqual([metrics.stepsLow,metrics.stepsHigh],[930,1073]);
 assert.equal(treadmillMetrics(0,2.6),null);
 assert.equal(treadmillMetrics(10,0),null);
});
test('optional treadmill is independent of required exercise counts and saved as a Sheet cardio row',()=>{
 const exercises=program.filter(e=>e.week===1&&e.day===1);
 let state=start(empty(),1,1,'with-treadmill','2026-11-09');
 const bonus={id:'bonus-1',durationMinutes:20,speedMph:2.7,inclinePercent:12,notes:'After weights'};
 state=recordOptionalTreadmill(state,bonus);
 assert.equal(state.sessions[0].sets.length,1);
 assert.equal(state.sessions[0].sets[0].exerciseId,OPTIONAL_TREADMILL_ID);
 assert.throws(()=>recordOptionalTreadmill(state,{...bonus,id:'bonus-2'}),/Remove the existing/);
 assert.throws(()=>makeSubmission(state.sessions[0],exercises,seedPlan(program)),/Incomplete/);
 for(const ex of exercises)for(let i=0;i<ex.sets;i++)state=record(state,ex,{id:`bonus-${ex.id}-${i}`,weight:ex.weight,reps:ex.minReps,rir:ex.rirMin,notes:''});
 const session=makeSubmission(state.sessions[0],exercises,seedPlan(program));
 validate(JSON.parse(JSON.stringify(state)));validateQueue({version:1,sessions:[session]},program);
 const rows=sheetRows(session),row=rows.find(r=>r[21]==='bonus-1');
 assert.equal(rows.length,1+exercises.reduce((n,ex)=>n+ex.sets,0));
 assert.equal(row[3],'Optional Treadmill Walk');assert.equal(row[11],20);
 assert.equal(row[12],0.9);assert.equal(row[13],'mi');
 assert.equal(row[6],'');assert.equal(row[7],'');assert.equal(row[10],'');assert.equal(row[19],'');
 assert.match(row[17],/Optional post-workout cardio.*After weights.*Speed 2.7 mph.*Incline 12%.*Estimated steps/);
 assert.equal(session.prescriptions.length,exercises.length);
 const duplicate=structuredClone(session);duplicate.sets.push({...duplicate.sets[0],id:'duplicate-bonus'});
 assert.throws(()=>validateQueue({version:1,sessions:[duplicate]},program),/Invalid workout/);
 const unknown=structuredClone(session);unknown.sets[0].exerciseId='w2d1e1';
 assert.throws(()=>validateQueue({version:1,sessions:[unknown]},program),/Invalid workout/);
});
test('optional treadmill must be a valid recorded cardio activity',()=>{
 const state=start(empty(),1,1,'invalid-bonus','2026-11-09');
 const base={id:'bonus',durationMinutes:10,speedMph:2.6,inclinePercent:11};
 assert.throws(()=>recordOptionalTreadmill(state,{...base,durationMinutes:0}),/duration/);
 assert.throws(()=>recordOptionalTreadmill(state,{...base,speedMph:0}),/Invalid workout/);
 assert.throws(()=>recordOptionalTreadmill(state,{...base,inclinePercent:101}),/incline/);
});
test('Git queue and processing receipts retain optional treadmill set IDs safely',async()=>{
 const {fixture,store}=setup(),exercises=program.filter(e=>e.week===1&&e.day===1);
 let state=start(empty(),1,1,'bonus-processing','2026-11-09');
 for(const ex of exercises)for(let i=0;i<ex.sets;i++)state=record(state,ex,{id:`${ex.id}-${i}`,weight:ex.weight,reps:ex.minReps,rir:ex.rirMin});
 state=recordOptionalTreadmill(state,{id:'my-bonus',durationMinutes:10,speedMph:2.6,inclinePercent:11});
 const session=makeSubmission(state.sessions[0],exercises,seedPlan(program));
 await store.submit(session,program);await store.submit(session,program);
 const batch=await prepareBatch(await store.snapshot(program),program);
 assert.ok(batch.sessions[0].setIds.includes('my-bonus'));
 assert.equal(batch.rows.filter(row=>row[21]==='my-bonus').length,1);
 const short=receipt(batch);short.sessions=structuredClone(batch.sessions);short.sessions[0].setIds=short.sessions[0].setIds.filter(id=>id!=='my-bonus');
 await assert.rejects(()=>finalizeProcessing(store,batch,batch.nextPlan,short,program),/receipt/);
 const result=await finalizeProcessing(store,batch,batch.nextPlan,receipt(batch),program);
 assert.equal(result.processed,1);assert.equal(fixture.files['completed.json'].sessions.length,0);
 assert.equal(fixture.files['next-week.json'].processedSessions[0].digest,await digest(session));
});
test('processing requires a verified receipt for every set and never clears on missing receipt',async()=>{
  const {fixture,store}=setup();await store.submit(submission(),program);
  const batch=await prepareBatch(await store.snapshot(program),program);
  await assert.rejects(()=>finalizeProcessing(store,batch,batch.nextPlan,null,program),/receipt/);
  const partial=receipt(batch);partial.sessions=structuredClone(batch.sessions);partial.sessions[0].setIds.pop();
  await assert.rejects(()=>finalizeProcessing(store,batch,batch.nextPlan,partial,program),/receipt/);
  const shortened=structuredClone(batch);shortened.sessions[0].setIds.pop();
  await assert.rejects(()=>finalizeProcessing(store,shortened,shortened.nextPlan,receipt(shortened),program),/workout changed/);
  assert.equal(fixture.files['completed.json'].sessions.length,1);
});
test('processor publishes plan and clears only processed sessions atomically, retaining new arrivals',async()=>{
  const {fixture,store}=setup(),one=submission(),two=submission('two',2);
  await store.submit(one,program);
  const batch=await prepareBatch(await store.snapshot(program),program);
  assert.equal(batch.nextPlan.workouts[0].day,2);assert.equal(batch.nextPlan.workouts.at(-1).week,2);
  await store.submit(two,program);
  const plan=structuredClone(batch.nextPlan);plan.workouts[0].exercises[0].reason='Hold based on recent history';
  await finalizeProcessing(store,batch,plan,receipt(batch),program);
  assert.deepEqual(fixture.files['completed.json'].sessions,[two]);
  assert.equal(fixture.files['next-week.json'].workouts[0].exercises[0].reason,'Hold based on recent history');
  assert.equal(fixture.files['next-week.json'].processedSessions[0].digest,await digest(one));
  const head=fixture.head;await store.submit(one,program);assert.equal(fixture.head,head);
  const again=await finalizeProcessing(store,batch,plan,receipt(batch),program);assert.equal(again.alreadyProcessed,true);
});
test('failed Git publish leaves queued workouts and plan unchanged',async()=>{
  const {fixture,store}=setup();await store.submit(submission(),program);
  const batch=await prepareBatch(await store.snapshot(program),program),before=structuredClone(fixture.files);
  fixture.rejectWrite=true;
  await assert.rejects(()=>finalizeProcessing(store,batch,batch.nextPlan,receipt(batch),program),/denied/);
  assert.deepEqual(fixture.files,before);
});
test('lost processing acknowledgment is safe to retry after the atomic commit',async()=>{
  const {fixture,store}=setup();await store.submit(submission(),program);
  const batch=await prepareBatch(await store.snapshot(program),program);fixture.failAfterPublish=true;
  const result=await finalizeProcessing(store,batch,batch.nextPlan,receipt(batch),program);
  assert.equal(result.alreadyProcessed,true);assert.equal(fixture.files['completed.json'].sessions.length,0);
});
test('plan changes by another processor require fresh analysis',async()=>{
  const {store}=setup();await store.submit(submission(),program);
  const batch=await prepareBatch(await store.snapshot(program),program);
  const snapshot=await store.snapshot(program);
  await store.writeFiles(snapshot.head,{'next-week.json':{...snapshot.plan,revision:'other-processor'}},'test');
  await assert.rejects(()=>finalizeProcessing(store,batch,batch.nextPlan,receipt(batch),program),/plan changed/);
});
test('anonymous writes are rejected before network access',async()=>{
  let requests=0;const store=new GitHubStore({fetchImpl:()=>{requests++;}});
  await assert.rejects(()=>store.submit(submission(),program),/Connect GitHub/);assert.equal(requests,0);
});

test('older queued workouts cannot regress a newer plan or future processing batch',async()=>{
 const plan=seedPlan(program,{week:2,day:1}),queue={version:1,sessions:[submission()]};
 assert.deepEqual(currentDay(plan,queue),{week:2,day:1});
 const batch=await prepareBatch({head:'test',queue,plan},program);
 assert.deepEqual(batch.nextPlan.workouts.map(w=>[w.week,w.day]),[[2,1],[2,2],[2,3],[2,4],[2,5],[2,6]]);
 assert.deepEqual(currentDay(seedPlan(program),{sessions:[submission('later',5),submission('older',1)]}),{week:1,day:6});
});
