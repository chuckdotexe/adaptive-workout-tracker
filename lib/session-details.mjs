export const historyName = name => ['Chest Supported Row','Chest Supported Row (Dumbbell)'].includes(name) ? 'DB Chest Supported Row' : name;
export function lastRecordedSet(exercise, sessions, program, fallback=null) {
  const records=[];
  for(const session of sessions) {
    for(const [index,set] of session.sets.entries()) {
      const prescription=session.prescriptions?.find(p=>p.exerciseId===set.exerciseId);
      const original=program.find(e=>e.id===set.exerciseId);
      if(historyName(prescription?.name || original?.name)!==historyName(exercise.name))continue;
      records.push({...set,date:session.date,order:index,loadSemantics:prescription?.loadSemantics || original?.weightText || ''});
    }
  }
  records.sort((a,b)=>String(a.date).localeCompare(String(b.date)) || String(a.created||'').localeCompare(String(b.created||'')) || a.order-b.order);
  const latest=records.at(-1);
  if(!latest)return fallback;
  if(fallback && fallback.date>latest.date)return fallback;
  const {date,weight,reps,rir,bodyweight,kind,durationMinutes,speedMph,inclinePercent,loadSemantics}=latest;
  return {date,weight,reps,rir,bodyweight:bodyweight===true,loadSemantics,...(kind==='cardio'?{kind,durationMinutes,speedMph,inclinePercent}:{})};
}
export function elapsedSeconds(session, now=Date.now()) {
  return Math.max(0,(session?.elapsedSeconds||0)+(session?.timerStartedAt ? (now-Date.parse(session.timerStartedAt))/1000 : 0));
}
export function stopWorkoutTimer(session,now=Date.now()) {
  return {...session,elapsedSeconds:elapsedSeconds(session,now),timerStartedAt:null};
}
export function durationLabel(seconds) {
  const whole=Math.floor(seconds);
  return `${Math.floor(whole/60)}:${String(whole%60).padStart(2,'0')}`;
}
