import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {empty,start,record,validate} from '../lib/workout.mjs';
import {makeSubmission,seedPlan,validateQueue} from '../lib/online-workflow.mjs';
import {sheetRows} from '../lib/processing.mjs';
import {GitHubStore} from '../lib/github-store.mjs';
import {GitHubFixture} from './helpers/github-fixture.mjs';
const program=JSON.parse(fs.readFileSync(new URL('../data/ironledger-program.json',import.meta.url)));
const exercises=program.filter(e=>e.week===1&&e.day===5),cardio=exercises.at(-1);
function partial(){let state=start(empty(),1,5,'cardio-test','2026-10-22');state.sessions[0].skipped=Object.fromEntries(exercises.slice(0,-1).map(e=>[e.id,'Machine unavailable']));return state;}
const measurement={id:'walk',kind:'cardio',durationMinutes:10,speedMph:2.7,inclinePercent:10,reps:0,weight:null,rir:null,notes:'Actual walk'};
test('cardio and explicit omissions survive recovery and export as duration without strength values',()=>{
 const state=record(partial(),cardio,measurement);validate(JSON.parse(JSON.stringify(state)));
 const session=makeSubmission(state.sessions[0],exercises,seedPlan(program));
 validateQueue({version:1,sessions:[session]},program);
 const rows=sheetRows(session);assert.equal(rows.length,1);assert.equal(rows[0][1],'Cardio');assert.equal(rows[0][11],10);assert.equal(rows[0][6],'');assert.equal(rows[0][7],'');assert.equal(rows[0][10],'');assert.equal(rows[0][19],'');assert.match(rows[0][17],/2.7 mph.*10%/);
 assert.equal(Object.keys(session.skipped).length,6);
});
test('duration is required; unacknowledged missing sets and forged skips are rejected',()=>{
 assert.throws(()=>record(partial(),cardio,{...measurement,durationMinutes:0}),/duration/);
 const state=record(partial(),cardio,measurement);delete state.sessions[0].skipped[exercises[0].id];
 assert.throws(()=>makeSubmission(state.sessions[0],exercises,seedPlan(program)),/Hack Squat/);
 state.sessions[0].skipped={[exercises[0].id]:'Invented reason'};assert.throws(()=>validate(state),/Invalid/);
});
test('temporary failure while reading Git retries the whole submission without duplicate writes',async()=>{
 const fixture=new GitHubFixture(program);let first=true;
 const store=new GitHubStore({token:'test',fetchImpl:async(...args)=>{if(first){first=false;throw new TypeError('Offline');}return fixture.fetch(...args);}});
 const state=record(partial(),cardio,measurement),session=makeSubmission(state.sessions[0],exercises,seedPlan(program));
 await store.submit(session,program);await store.submit(session,program);
 assert.equal(fixture.files['completed.json'].sessions.length,1);
});
