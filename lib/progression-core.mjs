/** Set-by-set assessment. Trials are conditional, never guaranteed capacity. */
export function evaluate(target, actual) {
 const base={action:'review',proposedWeight:target?.weight??null,approved:false};
 const review=reason=>({...base,reason});
 if(!target||!Number.isInteger(target.sets)||target.sets<1||!Number.isInteger(target.minReps)||!Number.isInteger(target.maxReps)||target.minReps>target.maxReps||!Number.isFinite(target.rirMin)||!Number.isFinite(target.rirMax)||target.rirMin<0||target.rirMax>10||target.rirMin>target.rirMax)return review('Invalid prescription');
 if(!Array.isArray(actual)||actual.length!==target.sets)return review('Incomplete or extra working sets');
 if(actual.some(s=>!Number.isFinite(s.rir)||!Number.isFinite(s.weight)||!Number.isInteger(s.reps)||s.reps<0||s.weight<0||s.rir<0||s.rir>10))return review('Missing or invalid set data');
 const final=actual.at(-1),mixed=new Set(actual.map(s=>s.weight)).size>1,ramp=actual.every((s,i)=>!i||s.weight>=actual[i-1].weight);
 const successful=actual.filter(s=>s.reps>=target.minReps&&s.rir>=target.rirMin);
 const heaviest=successful.length?Math.max(...successful.map(s=>s.weight)):Math.max(...actual.map(s=>s.weight));
 const atLoad=actual.filter(s=>s.weight===heaviest),hard=atLoad.some(s=>s.rir<target.rirMin||s.reps<target.minReps);
 const aim=Math.max(2,target.rirMin),capacity=Math.min(...atLoad.map(s=>s.reps+s.rir-aim));
 const goal=Math.max(target.minReps,Math.min(target.maxReps,capacity));
 const flags={finalSetRir:final.rir,weightIncreased:actual.some((s,i)=>i&&s.weight>actual[i-1].weight),reviewRequired:final.rir>2||mixed||hard};
 const hold=(reason,weight=heaviest)=>({...base,...flags,action:'hold',proposedWeight:weight,targetReps:goal,reason});
 if(actual.some(s=>s.reps<target.minReps))return hold('Below prescribed minimum reps; reassess failing load and retain successful working sets');
 if(hard)return hold('At least one set harder than prescribed RIR; use fewer reps within range if feasible, otherwise reassess a lower recorded load');
 if(actual.some(s=>s.rir<target.rirMin)&&!hard)return hold('Heavier set exceeded effort target; retain the highest successful load and reassess reps before another increase');
 if(mixed&&!ramp)return {...review('Multiple working loads include back-off sets; review each load rather than selecting the lowest'),...flags,proposedWeight:heaviest,targetReps:goal};
 const headroom=final.rir>2&&final.reps+final.rir-aim>target.minReps;
 const ceiling=actual.every(s=>s.reps>=target.maxReps&&s.rir>=target.rirMin);
 if(headroom||ceiling){
  const increment=target.increment;
  if(Number.isFinite(increment)&&increment>0&&heaviest>0&&increment/heaviest<=0.10)return {...base,...flags,action:'propose-increase',proposedWeight:heaviest+increment,targetReps:target.minReps,reason:'Latest session supports a one-step load trial; review final effort and heavier sets, start at lower reps and return to established load if reps/RIR miss'};
  return {...review('Load progression reviewed; increment unknown or too large. Retain successful heavier load and build reps where range permits'),...flags,reviewRequired:true,proposedWeight:heaviest,targetReps:goal};
 }
 return hold(mixed?'Adopt successful heavier working load, starting lower in range; ramping is not inconsistent performance':'Continue building reps at current load');
}
