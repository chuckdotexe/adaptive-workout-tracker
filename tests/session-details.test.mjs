import {test} from 'node:test';
import assert from 'node:assert/strict';
import {elapsedSeconds,stopWorkoutTimer,lastRecordedSet,lastSetFromRows,attachSheetHistory} from '../lib/session-details.mjs';
import fs from 'node:fs';
import {makeSubmission,seedPlan} from '../lib/online-workflow.mjs';
import {sheetRows} from '../lib/processing.mjs';
test('submission freezes workout total separately from cardio time and exports its meaning',()=>{
 const program=JSON.parse(fs.readFileSync(new URL('../data/ironledger-program.json',import.meta.url)));
 const ex=program[0],now='2026-10-26T12:00:00Z';
 const session={id:'timed',week:1,day:1,date:'2026-10-26',status:'active',decisions:{},elapsedSeconds:120,timerStartedAt:'2026-10-26T11:58:00Z',sets:Array.from({length:ex.sets},(_,i)=>({id:`set-${i}`,exerciseId:ex.id,weight:255,reps:5,rir:2,notes:''}))};
 const submitted=makeSubmission(session,[ex],seedPlan(program),now);
 assert.equal(submitted.durationMinutes,4);assert.equal(submitted.timerStartedAt,null);
 assert.equal(elapsedSeconds(submitted,Date.parse(now)+60000),240);
 const rows=sheetRows(submitted);assert.equal(rows[0][11],'');assert.match(rows[0][17],/Workout total: 4 min/);
});
test('workout timer preserves elapsed time through stop, resume and reload',()=>{
 const now=Date.parse('2026-10-26T12:00:00Z');
 const active={elapsedSeconds:60,timerStartedAt:new Date(now-120000).toISOString()};
 const restored=JSON.parse(JSON.stringify(active));
 assert.equal(elapsedSeconds(restored,now),180);
 const stopped=stopWorkoutTimer(restored,now);
 assert.equal(elapsedSeconds(stopped,now+60000),180);
 assert.equal(elapsedSeconds({...stopped,timerStartedAt:new Date(now).toISOString()},now+60000),240);
 assert.equal(elapsedSeconds({},now),0);
});
test('last-set history survives exercise rename and excludes machine rows',()=>{
 const ex={id:'w2d1e2',name:'DB Chest Supported Row'};
 const sessions=[{date:'2026-10-21',prescriptions:[{exerciseId:'w1d1e2',name:'Chest Supported Row',loadSemantics:'70 lb per hand'}],sets:[{exerciseId:'w1d1e2',reps:8,weight:70,rir:2},{exerciseId:'w1d1e2',reps:7,weight:70,rir:1}]},{date:'2026-10-22',prescriptions:[{exerciseId:'w1d2e1',name:'Chest Supported Machine Row'}],sets:[{exerciseId:'w1d2e1',reps:10,weight:180,rir:2}]}];
 const last=lastRecordedSet(ex,sessions,[]);
 assert.equal(last.date,'2026-10-21');assert.equal(last.reps,7);assert.equal(last.loadSemantics,'70 lb per hand');
 assert.equal(lastRecordedSet(ex,sessions,[],{date:'2026-10-26',reps:9}).reps,9);
});
test('legacy Sheets history supplies last actual set without replacing its prescription',()=>{
 const program=JSON.parse(fs.readFileSync(new URL('../data/ironledger-program.json',import.meta.url)));
 const ex=program.find(e=>e.name==='Leg Press'&&e.week===2&&e.day===2);
 const rows=[1,4,2,3].map(set=>['2026-10-17','Strength','Legs','Leg Press','',set,10,300,'lb',3000,6,'','','','','','','','',set===1?5:4]);
 rows.push(['2026-10-25','Strength','Other','Leg Press (Different Machine)','',1,20,500,'lb']);
 const last=lastSetFromRows(ex,rows);assert.equal(last.weight,300);assert.equal(last.reps,10);assert.equal(last.rir,4);
 const plan=seedPlan(program,{week:2,day:2}),updated=attachSheetHistory(plan,program,rows);
 assert.equal(updated.workouts[0].exercises[0].weight,plan.workouts[0].exercises[0].weight);
 assert.deepEqual(updated.workouts[0].exercises[0].lastSet,last);
 assert.deepEqual(lastSetFromRows(ex,[...rows,['2026-10-26','Strength','Test','Leg Press','',4,99,999,'lb','','','','','','','','','','',0,'synthetic']],['synthetic']),last);
});
