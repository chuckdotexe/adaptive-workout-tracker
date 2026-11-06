import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {validatePlan} from '../lib/online-workflow.mjs';
function csv(text){let rows=[],row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}else if(!quoted&&(c===','||c==='\n')){row.push(field.replace(/\r$/,''));field='';if(c==='\n'){rows.push(row);row=[]}}else field+=c}if(field||row.length){row.push(field);rows.push(row)}return rows;}
test('source CSV remains a readable historical reference, not an active-plan constraint',()=>{const rows=csv(fs.readFileSync(new URL('../data/source-program.csv',import.meta.url),'utf8'));const program=JSON.parse(fs.readFileSync(new URL('../data/ironledger-program.json',import.meta.url)));assert.ok(rows.some(r=>/^\d+$/.test(r[2])));assert.ok(program.length>0);for(const e of program){assert.ok(e.id&&e.name);assert.ok(Number.isInteger(e.week)&&e.week>0);assert.ok(Number.isInteger(e.day)&&e.day>0);assert.ok(Number.isInteger(e.sets)&&e.sets>0);assert.ok(Number.isInteger(e.minReps)&&e.minReps>0&&e.maxReps>=e.minReps);assert.ok(e.rirMin===null||e.rirMax>=e.rirMin);}});

test('public program notes do not embed copied workout-log evidence',()=>{const program=JSON.parse(fs.readFileSync(new URL('../data/ironledger-program.json',import.meta.url)));for(const e of program)assert.doesNotMatch(e.notes,/Starting load evidence:|Load not populated:|Workout Log \d{4}-/);});

test('active JSON defines exercise structure and upcoming workouts without fixed counts or names',()=>{
  const program=JSON.parse(fs.readFileSync(new URL('../data/ironledger-program.json',import.meta.url)));
  const plan=JSON.parse(fs.readFileSync(new URL('../next-week.json',import.meta.url)));
  const exercises=(week,day)=>program.filter(e=>e.week===week&&e.day===day);
  assert.ok(program.length>0);
  for(const key of new Set(program.map(e=>`${e.week}:${e.day}`))){
    const [week,day]=key.split(':').map(Number),session=exercises(week,day);
    assert.ok(session.length>0);
    assert.equal(new Set(session.map(e=>e.name)).size,session.length);
  }
  assert.equal(new Set(program.map(e=>e.id)).size,program.length);
  assert.doesNotThrow(()=>validatePlan(plan,program));
  for(const workout of plan.workouts){
    assert.deepEqual(workout.exercises.map(e=>e.exerciseId),exercises(workout.week,workout.day).map(e=>e.id));
  }
});
