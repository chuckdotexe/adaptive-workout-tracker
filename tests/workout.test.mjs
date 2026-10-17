import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {empty,start,record,finish,approve,read,save,targetFor} from '../lib/workout.mjs';
const program=JSON.parse(fs.readFileSync(new URL('../data/ironledger-program.json',import.meta.url)));const exercises=program.filter(e=>e.week===1&&e.day===1);
function storage(){let value=null;return {getItem:()=>value,setItem:(_,v)=>{value=v}}}
test('complete workout, repeated retries offline, approve and restart preserves sets and targets',()=>{const disk=storage();let s=start(empty(),1,1,'session1','2026-10-17');for(const e of exercises){for(let i=0;i<e.sets;i++){const set={id:e.id+i,weight:e.weight??50,reps:e.maxReps,rir:e.rirMin};s=record(s,e,set);s=record(s,e,set);save(disk,s);s=read(disk)}}const total=exercises.reduce((n,e)=>n+e.sets,0);assert.equal(s.sessions[0].sets.length,total);s=finish(s,exercises,Object.fromEntries(exercises.map(e=>[e.id,5])));s=approve(s,exercises);save(disk,s);s=read(disk);assert.equal(targetFor(s,exercises[0]).weight,260);s=start(s,1,1,'session2','2026-10-17');assert.equal(s.sessions.length,2);assert.equal(s.sessions[1].sets.length,0);assert.equal(s.sessions[0].sets.length,total)});
test('incomplete finish blocked',()=>assert.throws(()=>finish(start(empty(),1,1,'s','today'),exercises,{}),/Complete every/));
test('storage errors surfaced and corrupt storage preserved',()=>{assert.throws(()=>save({setItem(){throw Error('quota')}},empty()),/quota/);assert.throws(()=>read({getItem:()=>'{bad'}));});
test('source contains 328 prescriptions with unique source rows and hand semantics',()=>{assert.equal(program.length,328);assert.equal(new Set(program.map(e=>e.sourceCsvRow)).size,328);assert.match(program.find(e=>e.name==='Chest Supported Row').weightText,/per hand/)});

import {setIncrement, restore} from '../lib/workout.mjs';
const single = exercises[0];
function completed(ex = single, actual = Array.from({length: ex.sets}, () => ({weight: ex.weight ?? 50, reps: ex.maxReps, rir: ex.rirMin}))) {
  let s = start(empty(), ex.week, ex.day, 'workout', '2026-10-17');
  actual.forEach((set, i) => {s = record(s, ex, {id: 'set-' + i, ...set});});
  return s;
}
test('equipment increment survives restart and enables the same decision', () => {
  const disk = storage();
  let s = setIncrement(completed(), single, 5);
  save(disk, s); s = read(disk);
  s = finish(s, [single]);
  assert.equal(s.sessions[0].decisions[single.id].proposedWeight, 260);
  assert.equal(s.sessions[0].decisions[single.id].version, 'double-progression-v2');
});
test('rep goal never narrows the authoritative program range on repeated sessions', () => {
  const actual = Array.from({length: single.sets}, () => ({weight: 255, reps: 5, rir: 2}));
  let s = approve(finish(completed(single, actual), [single]), [single]);
  assert.equal(targetFor(s, single).targetReps, 6);
  assert.equal(targetFor(s, single).minReps, 4);
  s = start(s, 1, 1, 'next', '2026-10-18');
  actual.forEach((set, i) => {s = record(s, single, {id: 'next-' + i, ...set});});
  assert.equal(finish(s, [single]).sessions[1].decisions[single.id].reason, 'Continue building reps at current load');
});
test('leg press actual 300 lb is retained and becomes target only after explicit review', () => {
  const ex = program.find(e => e.week === 1 && e.name === 'Leg Press');
  const actual = [5,4,4,4].map(rir => ({weight: 300, reps: 10, rir}));
  const finished = finish(completed(ex, actual), [ex]);
  assert.equal(finished.sessions[0].decisions[ex.id].action, 'review');
  assert.deepEqual(finished.sessions[0].decisions[ex.id].actualLoads, [300]);
  const withoutReview = approve(finished, [ex]);
  assert.equal(targetFor(withoutReview, ex).weight, 280);
  const reviewed = approve(finished, [ex], {[ex.id]: {weight: 300, targetReps: 10}});
  assert.equal(targetFor(reviewed, ex).weight, 300);
  assert.equal(reviewed.sessions[0].decisions[ex.id].manual, true);
  assert.ok(reviewed.sessions[0].sets.every(s => s.weight === 300));
  assert.throws(() => approve(finished, [ex], {[ex.id]: {weight: 300, targetReps: 100}}), /within the program/);
});
test('unknown RIR stays null; observed RIR has explicitly derived RPE', () => {
  const actual = Array.from({length: single.sets}, (_, i) => ({weight: 255, reps: 6, rir: i ? 2 : null}));
  const s = completed(single, actual);
  assert.equal(s.sessions[0].sets[0].rir, null);
  assert.equal(s.sessions[0].sets[0].rpe, null);
  assert.equal(s.sessions[0].sets[0].rpeSource, 'missing');
  assert.equal(s.sessions[0].sets[1].rpe, 8);
  assert.equal(s.sessions[0].sets[1].rpeSource, 'derived');
  assert.equal(finish(s, [single]).sessions[0].decisions[single.id].action, 'review');
});
test('backup restores full records and targets exactly and does not create duplicates', () => {
  const s = approve(finish(setIncrement(completed(), single, 5), [single]), [single]);
  assert.deepEqual(restore(JSON.stringify(s)), s);
  assert.deepEqual(restore(JSON.stringify(restore(JSON.stringify(s)))), s);
});
test('invalid backup, repeated set ID, wrong workout and unknown active ID fail validation before saving', () => {
  const disk = storage(); const original = completed(); save(disk, original);
  for (const mutate of [s => s.sessions[0].sets[0].reps = -1,
    s => s.sessions[0].sets.push({...s.sessions[0].sets[0]}),
    s => s.sessions[0].sets[0].exerciseId = 'w2d1e1',
    s => s.activeId = 'missing',
    s => s.sessions[0].increments = {[single.id]: -5}]) {
    const changed = structuredClone(original); mutate(changed);
    assert.throws(() => save(disk, restore(JSON.stringify(changed))), /Invalid workout backup/);
    assert.deepEqual(read(disk), original);
  }
});
test('older v1 target goals remain readable without overriding original rep ranges', () => {
  const s = empty(); s.targets[single.id] = {weight: 255, minReps: 6, maxReps: 6};
  const target = targetFor(restore(JSON.stringify(s)), single);
  assert.equal(target.minReps, 4); assert.equal(target.targetReps, 6);
});
test('a second active workout cannot hide the current workout', () => {
  assert.throws(() => start(completed(), 1, 1, 'other', 'today'), /Close the current workout/);
});

import {completeWorkout} from '../lib/workout.mjs';
test('finish automatically saves next targets without review or approval', () => {
  const s = completeWorkout(setIncrement(completed(), single, 5), [single]);
  assert.equal(s.activeId, null);
  assert.equal(s.targets[single.id].weight, 260);
  assert.equal(s.targets[single.id].automatic, true);
  assert.deepEqual(completeWorkout(s, [single]), s);
});
test('automatic completion retains unknown load without inventing one', () => {
  const ex = {...single, weight: null, weightText: ''};
  const sets = Array.from({length: ex.sets}, () => ({weight: null, reps: 5, rir: null}));
  const s = completeWorkout(completed(ex, sets), [ex]);
  assert.equal(s.activeId, null);
  assert.equal(s.targets[ex.id].weight, null);
  assert.ok(s.sessions[0].sets.every(s => s.weight === null && s.rir === null));
  assert.deepEqual(restore(JSON.stringify(s)), s);
});
test('uncertain leg press holds actual 300 rather than nominal 280 automatically', () => {
  const ex = program.find(e => e.week === 1 && e.name === 'Leg Press');
  const sets = [5,4,4,4].map(rir => ({weight: 300, reps: 10, rir}));
  const s = completeWorkout(completed(ex, sets), [ex]);
  assert.equal(s.targets[ex.id].weight, 300);
  assert.equal(s.sessions[0].decisions[ex.id].action, 'hold');
});
test('mixed curl loads hold the lower recorded load and preserve each actual set', () => {
  const ex = program.find(e => e.week === 1 && e.name === 'Seated Leg Curl');
  const sets = [{weight:140,reps:9,rir:1},{weight:130,reps:10,rir:2}];
  const s = completeWorkout(completed(ex, sets), [ex]);
  assert.equal(s.targets[ex.id].weight, 130);
  assert.deepEqual(s.sessions[0].sets.map(s => s.weight), [140,130]);
});
