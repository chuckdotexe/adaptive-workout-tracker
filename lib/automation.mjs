import {evaluate} from './progression-core.mjs';
import {numericHistoryRow} from './history-values.mjs';
import {historyName} from './session-details.mjs';
import {isBodyweight,isCardio} from './activity.mjs';
import {SHEET_HEADERS,sheetRows} from './processing.mjs';
import {validatePlan} from './online-workflow.mjs';

const check=(condition,message)=>{if(!condition)throw Error(message);};
const blank=value=>value??'';
export const sameRow=(a,b)=>Array.from({length:22},(_,i)=>blank(a[i])===blank(b[i])).every(Boolean);
export function reconcileRows(values,sessions){
  check(sameRow(values[0]||[],SHEET_HEADERS),'Workout log headers do not match A:V. Queue preserved.');
  const expected=sessions.flatMap(sheetRows),missing=[],verified=[];
  for(const row of expected){
    const matches=values.map((value,index)=>({value,index})).filter(x=>x.value[21]===row[21]);
    check(matches.length<=1,'Duplicate workout log set ID. Reconcile before retrying.');
    if(!matches.length){missing.push(row);continue;}
    check(sameRow(matches[0].value,row),'Workout log set ID has different values. Reconcile before retrying.');
    verified.push(matches[0].index+1);
  }
  return {missing,verified};
}

// Only explicit aliases; never infer that different machines are equivalent.
const aliases={
  'DB Chest Supported Row':['Chest Supported Row','Chest Supported Row (Dumbbell)'],
  'Bench Press':['Bench Press (Barbell)'],
  'Neutral Grip Lat Pulldown':['Lat Pulldown (Neutral Grip)'],
  'EZ Bar Curl':['Bicep Curl (EZ Bar)'],
  'Romanian Deadlift':['Romanian Deadlift (Barbell)'],
};
const dateKey=value=>typeof value==='number'?new Date((value-25569)*86400000).toISOString().slice(0,10):String(value||'');
export function historyFor(ex,rows,excluded=[]){
  const groups=new Map(),names=[ex.name,...(aliases[ex.name]||[])].map(historyName);
  for(const sourceRow of rows){
    const row=numericHistoryRow(sourceRow);
    if(!names.includes(historyName(row[3]))||excluded.includes(row[20])||!Number.isInteger(row[6])||!(row[5]>0))continue;
    // Legacy per-hand/total semantics must be explicit before supporting an increase.
    const semantics=ex.weightText.includes('per hand')?'per hand':ex.weightText.includes('total')?'total':'unspecified';
    const confirmed=semantics==='unspecified'||String(row[17]||'').toLowerCase().includes(semantics);
    const date=dateKey(row[0]),key=row[20]||date+'|'+row[2];
    if(!groups.has(key))groups.set(key,{date,sets:[],semanticsConfirmed:true,equipmentConflict:false});
    const group=groups.get(key);group.semanticsConfirmed&&=confirmed;
    // Bayesian Curl: user confirmed the recorded 90 lb machine setting on October 30; legacy 30 lb notes do not override actuals.
    group.sets.push({weight:row[7]===''||row[7]==null?null:row[7],reps:row[6],rir:row[19]===''||row[19]==null?null:row[19]});
  }
  return [...groups.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
export function decisionContext(batch,program,rows,excluded=[]){
  return batch.nextPlan.workouts.flatMap(w=>w.exercises.map(target=>{
    const ex=program.find(e=>e.id===target.exerciseId),history=historyFor(ex,rows,excluded);
    const latest=history[0];
    const recentPrescription=[...(batch.recentSessions||[])].reverse().flatMap(s=>s.prescriptions).find(p=>historyName(p.name)===historyName(ex.name)&&p.increment>0);
    const increment=recentPrescription?.increment??target.increment,neutral=isBodyweight(ex)||isCardio(ex);
    const assessment=neutral?null:latest?evaluate({...ex,weight:target.weight,sets:latest.sets.length,increment},latest.sets):null;
    const conflict=latest?.equipmentConflict||latest&&!latest.semanticsConfirmed;
    let hold=neutral?null:conflict?target.weight:assessment?.proposedWeight??target.weight;
    if(!conflict&&assessment?.action==='propose-increase')hold-=increment;
    const allowedWeights=[hold];
    if(!neutral&&!conflict&&assessment?.action==='propose-increase')allowedWeights.push(assessment.proposedWeight);
    const maxGoal=assessment?.targetReps??target.targetReps;
    return {exerciseId:ex.id,name:ex.name,sets:ex.sets,minReps:ex.minReps,maxReps:ex.maxReps,rirMin:ex.rirMin,rirMax:ex.rirMax,
      bodyweight:isBodyweight(ex),cardio:isCardio(ex),previousWeight:target.weight,previousReps:target.targetReps,
      allowedWeights,increment,minGoal:ex.minReps,maxGoal:Math.max(ex.minReps,maxGoal),assessment:assessment?{action:assessment.action,finalSetRir:assessment.finalSetRir,weightIncreased:assessment.weightIncreased,reviewRequired:assessment.reviewRequired,reason:assessment.reason}:null,equipmentConflict:!!conflict,history};
  }));
}
export function applyDecisions(batch,program,context,output){
  check(Array.isArray(output?.decisions)&&output.decisions.length===context.length,'Codex returned the wrong exercise count. Queue preserved.');
  const ids=new Set();
  const plan=structuredClone(batch.nextPlan);
  for(const decision of output.decisions){
    const rule=context.find(x=>x.exerciseId===decision.exerciseId);
    check(rule&&!ids.has(decision.exerciseId),'Codex returned an unknown or duplicate exercise.');ids.add(decision.exerciseId);
    check(rule.allowedWeights.includes(decision.weight),'Codex load exceeded verified history bounds. Queue preserved.');
    check(Number.isInteger(decision.targetReps)&&decision.targetReps>=rule.minGoal&&decision.targetReps<=rule.maxGoal,'Codex reps exceeded verified history bounds. Queue preserved.');
    check(typeof decision.reason==='string'&&decision.reason.trim().length>0&&decision.reason.length<=600,'Codex reason missing or too long.');
    const target=plan.workouts.flatMap(w=>w.exercises).find(x=>x.exerciseId===decision.exerciseId);
    Object.assign(target,{weight:decision.weight,targetReps:decision.targetReps,reason:decision.reason,increment:rule.increment});
  }
  return validatePlan(plan,program);
}

// Public Actions logs may show Codex inputs. Keep private historical set values
// in the Sheets job; transport only bounded proposed targets and evidence flags.
export function publicReviewContext(context){
  return context.map(({history,assessment,...rule})=>({...rule,assessment:assessment?{action:assessment.action,weightIncreased:assessment.weightIncreased,reviewRequired:assessment.reviewRequired,finalSetAboveTwo:assessment.finalSetRir>2}:null,evidence:history.map(h=>({
    expectedSetCount:h.sets.length===rule.sets,
    consistentLoad:new Set(h.sets.map(s=>s.weight)).size===1,
    allAtRepCeiling:h.sets.every(s=>s.reps>=rule.maxReps),
    effortInRange:h.sets.every(s=>s.rir!=null&&s.rir>=rule.rirMin&&s.rir<=rule.rirMax),
    missingEffort:h.sets.some(s=>s.rir==null),
    lowRir:h.sets.some(s=>s.rir!=null&&s.rir<rule.rirMin),
    semanticsConfirmed:h.semanticsConfirmed,
  }))}));
}
