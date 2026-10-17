import test from 'node:test';import assert from 'node:assert/strict';
import {evaluate} from '../lib/progression-core.mjs';
const t={weight:255,sets:4,minReps:4,maxReps:6,rirMin:2,rirMax:3,increment:5};
const sets=(a)=>a.map(([weight,reps,rir])=>({weight,reps,rir}));
test('Oct 15 bench: hold, last set RIR 1',()=>assert.equal(evaluate(t,sets([[255,6,2],[255,6,2],[255,5,2],[255,4,1]])).action,'hold'));
test('rep ceiling and RIR in range proposes but never approves',()=>{const d=evaluate(t,sets(Array(4).fill([255,6,2])));assert.equal(d.action,'propose-increase');assert.equal(d.proposedWeight,260);assert.equal(d.approved,false)});
test('missing RIR requires review',()=>assert.equal(evaluate(t,sets([[255,6,null],[255,6,2],[255,6,2],[255,6,2]])).action,'review'));
test('mixed loads require review',()=>assert.equal(evaluate(t,sets([[255,6,2],[260,6,2],[255,6,2],[255,6,2]])).action,'review'));
test('missing increment requires review',()=>assert.equal(evaluate({...t,increment:null},sets(Array(4).fill([255,6,2]))).action,'review'));
test('leg press 4x10 RIR 4-5 requires review, not automatic increase',()=>assert.equal(evaluate({weight:280,sets:4,minReps:6,maxReps:10,rirMin:2,rirMax:3,increment:10},sets(Array(4).fill([300,10,4]))).action,'review'));
test('below minimum reps holds',()=>assert.equal(evaluate(t,sets([[255,3,2],[255,6,2],[255,6,2],[255,6,2]])).action,'hold'));

test('lateral raise fatigue holds and mixed curl loads request review',()=>{assert.equal(evaluate({weight:25,sets:3,minReps:15,maxReps:20,rirMin:2,rirMax:3},sets([[25,20,4],[25,17,1],[25,15,1]])).action,'hold');assert.equal(evaluate({weight:140,sets:2,minReps:8,maxReps:12,rirMin:2,rirMax:3},sets([[140,9,1],[130,10,2]])).action,'review')});
