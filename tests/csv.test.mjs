import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {validatePlan} from '../lib/online-workflow.mjs';
function csv(text){let rows=[],row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}else if(!quoted&&(c===','||c==='\n')){row.push(field.replace(/\r$/,''));field='';if(c==='\n'){rows.push(row);row=[]}}else field+=c}if(field||row.length){row.push(field);rows.push(row)}return rows;}
test('every CSV prescription retains exact exercise, weight text, notes, sets and rep/RIR ranges',()=>{const rows=csv(fs.readFileSync(new URL('../data/source-program.csv',import.meta.url),'utf8'));const program=JSON.parse(fs.readFileSync(new URL('../data/ironledger-program.json',import.meta.url)));assert.equal(rows.filter(r=>/^\d+$/.test(r[2])).length,program.length);for(const e of program){const r=rows[e.sourceCsvRow-1];assert.equal(e.name,r[0]);assert.equal(e.weightText,r[1]);assert.equal(e.sets,+r[2]);assert.equal(e.notes,r[5]);const reps=r[3].split('-').map(Number);assert.equal(e.minReps,reps[0]);assert.equal(e.maxReps,reps.at(-1));const rir=r[4]?r[4].split('-').map(Number):[null];assert.equal(e.rirMin,rir[0]);assert.equal(e.rirMax,rir.at(-1));}});

test('public program notes do not embed copied workout-log evidence',()=>{const program=JSON.parse(fs.readFileSync(new URL('../data/ironledger-program.json',import.meta.url)));for(const e of program)assert.doesNotMatch(e.notes,/Starting load evidence:|Load not populated:|Workout Log \d{4}-/);});

test('Adaptive 1.1 applies only from week 3 day 6 and spaces direct delt work',()=>{
  const program=JSON.parse(fs.readFileSync(new URL('../data/ironledger-program.json',import.meta.url)));
  const plan=JSON.parse(fs.readFileSync(new URL('../next-week.json',import.meta.url)));
  const exercises=(week,day)=>program.filter(e=>e.week===week&&e.day===day);
  assert.equal(program.length,307);
  assert.ok(exercises(3,5).some(e=>e.name==='DB Lateral Raise'&&e.sets===3));
  assert.ok(exercises(3,1).some(e=>e.name==='Cable Crunch'));
  for(let week=4;week<=8;week++){
    assert.ok(!exercises(week,1).some(e=>e.name==='Cable Crunch'));
    assert.ok(!exercises(week,2).some(e=>e.name==='DB Lateral Raise'));
    assert.ok(!exercises(week,5).some(e=>e.name==='DB Lateral Raise'));
    assert.equal(exercises(week,5).find(e=>e.name==='45-Degree Back Extension').sets,2);
  }
  for(let week=3;week<=8;week++){
    const saturday=exercises(week,6);
    assert.equal(saturday.find(e=>e.name==='Hammer Curl').sets,week===5?1:3);
    assert.equal(saturday.find(e=>e.name==='DB Lateral Raise').sets,week===5?2:3);
    assert.ok(!saturday.some(e=>e.name==='Bayesian Curl'||e.name==='Straight-Bar Cable Triceps Extension'));
    assert.ok(saturday.every(e=>e.rirMin===(week===5?3:2)&&e.rirMax===(week===5?4:2)));
  }
  assert.equal(new Set(program.map(e=>e.id)).size,program.length);
  assert.doesNotThrow(()=>validatePlan(plan,program));
  for(const workout of plan.workouts){
    assert.deepEqual(workout.exercises.map(e=>e.exerciseId),exercises(workout.week,workout.day).map(e=>e.id));
  }
});
