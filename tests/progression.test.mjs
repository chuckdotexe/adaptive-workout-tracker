import test from 'node:test';import assert from 'node:assert/strict';
import {evaluate} from '../lib/progression-core.mjs';
const t={weight:255,sets:4,minReps:4,maxReps:6,rirMin:2,rirMax:3,increment:5};
const sets=(a)=>a.map(([weight,reps,rir])=>({weight,reps,rir}));
test('Oct 15 bench: hold, last set RIR 1',()=>assert.equal(evaluate(t,sets([[255,6,2],[255,6,2],[255,5,2],[255,4,1]])).action,'hold'));
test('rep ceiling and RIR in range proposes but never approves',()=>{const d=evaluate(t,sets(Array(4).fill([255,6,2])));assert.equal(d.action,'propose-increase');assert.equal(d.proposedWeight,260);assert.equal(d.approved,false)});
test('missing RIR requires review',()=>assert.equal(evaluate(t,sets([[255,6,null],[255,6,2],[255,6,2],[255,6,2]])).action,'review'));
test('mixed loads require review',()=>assert.equal(evaluate(t,sets([[255,6,2],[260,6,2],[255,6,2],[255,6,2]])).action,'review'));
test('missing increment requires review',()=>assert.equal(evaluate({...t,increment:null},sets(Array(4).fill([255,6,2]))).action,'review'));
test('high final RIR supports a conditional single-session load trial',()=>{const d=evaluate({weight:280,sets:4,minReps:6,maxReps:10,rirMin:2,rirMax:3,increment:10},sets(Array(4).fill([300,10,4])));assert.equal(d.action,'propose-increase');assert.equal(d.proposedWeight,310);assert.equal(d.approved,false)});
test('below minimum reps holds',()=>assert.equal(evaluate(t,sets([[255,3,2],[255,6,2],[255,6,2],[255,6,2]])).action,'hold'));

test('fatigue holds a demonstrated load without treating a failed heavier set as progression',()=>{assert.equal(evaluate({weight:25,sets:3,minReps:15,maxReps:20,rirMin:2,rirMax:3},sets([[25,20,4],[25,17,1],[25,15,1]])).action,'hold');assert.equal(evaluate({weight:140,sets:2,minReps:8,maxReps:12,rirMin:2,rirMax:3},sets([[140,9,1],[130,10,2]])).action,'hold')});

test('successful ramping adopts heavier load and high final RIR supports trial below ceiling',()=>{let d=evaluate({weight:60,sets:2,minReps:10,maxReps:15,rirMin:2,rirMax:3,increment:5},sets([[60,12,4],[70,12,4]]));assert.equal(d.proposedWeight,75);assert.equal(d.action,'propose-increase');assert.equal(d.weightIncreased,true);d=evaluate({weight:130,sets:3,minReps:8,maxReps:12,rirMin:2,rirMax:3},sets([[130,12,4],[140,12,3],[145,12,2]]));assert.equal(d.proposedWeight,145);assert.equal(d.action,'review')});
test('failed heavier set does not justify progression; rep headroom handles fatigue',()=>{let d=evaluate({...t,sets:2},sets([[255,6,4],[260,3,0]]));assert.equal(d.proposedWeight,255);assert.equal(d.action,'hold');d=evaluate({weight:70,sets:3,minReps:8,maxReps:12,rirMin:2,rirMax:3},sets([[75,11,1],[75,11,1],[75,10,0]]));assert.equal(d.proposedWeight,75);assert.equal(d.targetReps,8);assert.equal(d.action,'hold')});
test('unknown or oversized increment never invents an increase',()=>{for(const increment of [null,50]){const d=evaluate({...t,increment},sets(Array(4).fill([255,6,4])));assert.equal(d.action,'review');assert.equal(d.proposedWeight,255)}});
