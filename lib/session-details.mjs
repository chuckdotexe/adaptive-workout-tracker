import {numericHistoryRow} from './history-values.mjs';
import {isBodyweight,isCardio} from './activity.mjs';
const historyAliases={'Kneeling Cable Crunch':'Cable Crunch','Lateral Raise':'DB Lateral Raise','Lat Raise':'DB Lateral Raise','Lateral Raise (Dumbbell)':'DB Lateral Raise','Chest Supported Row':'DB Chest Supported Row','Chest Supported Row (Dumbbell)':'DB Chest Supported Row','Bench Press (Barbell)':'Bench Press','Lat Pulldown (Neutral Grip)':'Neutral Grip Lat Pulldown','Bicep Curl (EZ Bar)':'EZ Bar Curl','Romanian Deadlift (Barbell)':'Romanian Deadlift'};
export const historyName = name => historyAliases[name] || name;
export function userCommentFromSheet(value){const match=String(value||'').match(/User comment: ("(?:[^"\\]|\\.)*")/);if(!match)return null;try{return JSON.parse(match[1])||null;}catch{return null;}}
export function lastSetFromRows(exercise,rows,excluded=[]){
  const candidates=[];
  for(const [index,sourceRow] of rows.entries()){
    const row=numericHistoryRow(sourceRow);
    if(historyName(row[3])!==historyName(exercise.name)||excluded.includes(row[20]))continue;
    const date=normalizeHistoryDate(row[0]);
    if(!date)continue;
    if(isCardio(exercise)?!(row[11]>0):!(Number.isInteger(row[6])&&Number.isFinite(row[5])&&row[5]>0))continue;
    candidates.push({row,index,date,group:date+'|'+(row[20]||row[2]||'')});
  }
  candidates.sort((a,b)=>a.date.localeCompare(b.date)||a.index-b.index);
  const latest=candidates.at(-1);if(!latest)return null;
  const last=candidates.filter(c=>c.group===latest.group).sort((a,b)=>(a.row[5]||0)-(b.row[5]||0)||a.index-b.index).at(-1);
  const row=last.row,bodyweight=isBodyweight(exercise),notes=String(row[17]||'');
  const result={date:last.date,weight:bodyweight||row[7]==null||row[7]===''?null:row[7],unit:bodyweight?'':row[8]||'',reps:row[6]??0,rir:row[19]??null,bodyweight,loadSemantics:/per hand/i.test(notes)?'per hand':/\btotal\b/i.test(notes.replace(/Workout total:[^·]*/gi,''))?'total':''};
  if(isCardio(exercise))Object.assign(result,{kind:'cardio',weight:null,rir:null,reps:0,durationMinutes:row[11],speedMph:notes.match(/Speed ([\d.]+) mph/i)?+notes.match(/Speed ([\d.]+) mph/i)[1]:null,inclinePercent:notes.match(/Incline ([\d.]+)%/i)?+notes.match(/Incline ([\d.]+)%/i)[1]:null});
  const reminder=candidates.slice().reverse().map(c=>({text:userCommentFromSheet(c.row[17]),date:c.date})).find(c=>c.text);
  if(reminder)result.userComment=reminder;
  return result;
}
export function attachSheetHistory(plan,program,rows,excluded=[],nextOnly=false){
  const result=structuredClone(plan);
  for(const workout of (nextOnly?result.workouts.slice(0,1):result.workouts))for(const target of workout.exercises){
    const last=lastSetFromRows(program.find(e=>e.id===target.exerciseId),rows,excluded);
    const prior=normalizeHistoryRecord(target.lastSet);
    if(last && (!prior || last.date>=prior.date))target.lastSet=last;
    else if(prior)target.lastSet=prior;
    else delete target.lastSet;
  }
  return result;
}
export function lastRecordedSet(exercise, sessions, program, fallback=null) {
  fallback=normalizeHistoryRecord(fallback);
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
  const reminder=records.slice().reverse().find(r=>r.notes?.trim());
  const userComment=reminder?{text:reminder.notes.trim(),date:reminder.date}:fallback?.userComment;
  return {date,weight,reps,rir,...(userComment?{userComment}:{}),bodyweight:bodyweight===true,loadSemantics,...(kind==='cardio'?{kind,durationMinutes,speedMph,inclinePercent}:{})};
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

export function normalizeHistoryDate(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1 || value > 2958465) return null;
    return new Date((Math.floor(value) - 25569) * 86400000).toISOString().slice(0,10);
  }
  if (typeof value !== 'string') return null;
  const input = value.trim();
  const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/);
  const us = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!iso && !us) return null;
  if (input.includes('T') && !Number.isFinite(Date.parse(input))) return null;
  const date = iso ? iso[1]+'-'+iso[2]+'-'+iso[3] : us[3]+'-'+us[1].padStart(2,'0')+'-'+us[2].padStart(2,'0');
  const parsed = new Date(date+'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === date ? date : null;
}
export function normalizeHistoryRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
  const date = normalizeHistoryDate(record.date);
  if (!date) return null;
  const result = {...record, date};
  if (result.userComment) {
    const commentDate = normalizeHistoryDate(result.userComment.date);
    if (commentDate) result.userComment = {...result.userComment,date:commentDate};
    else delete result.userComment;
  }
  return result;
}
export function latestHistory(records) {
  return records.map(normalizeHistoryRecord).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
}
