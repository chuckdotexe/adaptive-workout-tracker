/** Pure progression decision: never writes to a program or assumes equipment increments. */
export function evaluate(target, actual) {
  const base={action:'review', proposedWeight:target?.weight??null, approved:false};
  const review=reason=>({...base,reason});
  const hold=reason=>({...base,action:'hold',reason});
  if (!target || !Number.isInteger(target.sets) || target.sets<1 || !Number.isInteger(target.minReps) || !Number.isInteger(target.maxReps) || target.minReps>target.maxReps || !Number.isFinite(target.rirMin) || !Number.isFinite(target.rirMax) || target.rirMin<0 || target.rirMax>10 || target.rirMin>target.rirMax) return review('Invalid prescription');
  if (!Array.isArray(actual) || actual.length!==target.sets) return review('Incomplete or extra working sets');
  if (actual.some(s=>s.rir===null || !Number.isFinite(s.rir) || !Number.isFinite(s.weight) || !Number.isInteger(s.reps) || s.reps<0 || s.weight<0 || s.rir<0 || s.rir>10)) return review('Missing or invalid set data');
  if (new Set(actual.map(s=>s.weight)).size!==1) return review('Multiple working loads: review individually');
  const weight=actual[0].weight;
  if (actual.some(s=>s.reps<target.minReps)) return {...hold('Below prescribed minimum reps'),proposedWeight:weight};
  if (actual.some(s=>s.rir<target.rirMin)) return {...hold('At least one set harder than prescribed RIR'),proposedWeight:weight};
  if (actual.every(s=>s.reps>=target.maxReps && s.rir>=target.rirMin)) {
    if (actual.some(s=>s.rir>target.rirMax)) return {...review('Above RIR target; load increase requires review'),proposedWeight:weight};
    if (!Number.isFinite(target.increment) || target.increment<=0) return {...review('Rep ceiling achieved; equipment increment unknown'),proposedWeight:weight};
    return {...base,action:'propose-increase',proposedWeight:weight+target.increment,reason:'All working sets reached rep ceiling within RIR range; approval required'};
  }
  return {...hold('Continue building reps at current load'),proposedWeight:weight};
}
