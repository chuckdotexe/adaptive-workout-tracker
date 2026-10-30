import {numericHistoryRow} from './history-values.mjs';
import {isBodyweight,isCardio} from './activity.mjs';
const historyAliases={'Lateral Raise':'DB Lateral Raise','Lat Raise':'DB Lateral Raise','Lateral Raise (Dumbbell)':'DB Lateral Raise','Chest Supported Row':'DB Chest Supported Row','Chest Supported Row (Dumbbell)':'DB Chest Supported Row','Bench Press (Barbell)':'Bench Press','Lat Pulldown (Neutral Grip)':'Neutral Grip Lat Pulldown','Bicep Curl (EZ Bar)':'EZ Bar Curl','Romanian Deadlift (Barbell)':'Romanian Deadlift'};
export const historyName = name => historyAliases[name] || name;
export function lastSetFromRows(exercise,rows,excluded=[]){
  const candidates=[];
  for(const [index,sourceRow] of rows.entries()){
    const row=numericHistoryRow(sourceRow);
    if(historyName(row[3])!==historyName(exercise.name)||excluded.includes(row[20]))continue;
    const date=typeof row[0]==='number'?new Date((row[0]-25569)*86400000).toISOString().slice(0,10):String(row[0]||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
    if(isCardio(exercise)?!(row[11]>0):!(Number.isInteger(row[6])&&Number.isFinite(row[5])&&row[5]>0))continue;
    candidates.push({row,index,date,group:date+'|'+(row[20]||row[2]||'')});
  }
  candidates.sort((a,b)=>a.date.localeCompare(b.date)||a.index-b.index);
  const latest=candidates.at(-1);if(!latest)return null;
  const last=candidates.filter(c=>c.group===latest.group).sort((a,b)=>(a.row[5]||0)-(b.row[5]||0)||a.index-b.index).at(-1);
  const row=last.row,bodyweight=isBodyweight(exercise),notes=String(row[17]||'');
  const result={date:last.date,weight:bodyweight||row[7]==null||row[7]===''?null:row[7],unit:bodyweight?'':row[8]||'',reps:row[6]??0,rir:row[19]??null,bodyweight,loadSemantics:/per hand/i.test(notes)?'per hand':/\btotal\b/i.test(notes)?'total':''};
  if(isCardio(exercise))Object.assign(result,{kind:'cardio',weight:null,rir:null,reps:0,durationMinutes:row[11],speedMph:notes.match(/Speed ([\d.]+) mph/i)?+notes.match(/Speed ([\d.]+) mph/i)[1]:null,inclinePercent:notes.match(/Incline ([\d.]+)%/i)?+notes.match(/Incline ([\d.]+)%/i)[1]:null});
  return result;
}
export function attachSheetHistory(plan,program,rows,excluded=[]){
  const result=structuredClone(plan);
  for(const workout of result.workouts)for(const target of workout.exercises){
    const last=lastSetFromRows(program.find(e=>e.id===target.exerciseId),rows,excluded);
    if(last && (!target.lastSet || last.date>=target.lastSet.date))target.lastSet=last;
  }
  return result;
}
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
