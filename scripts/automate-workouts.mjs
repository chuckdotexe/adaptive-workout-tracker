import fs from 'node:fs/promises';
import {GitHubStore} from '../lib/github-store.mjs';
import {GoogleSheetStore,readWorkoutSheetState} from '../lib/google-sheet-store.mjs';
import {prepareBatch,finalizeProcessing,SHEET_HEADERS} from '../lib/processing.mjs';
import {reconcileRows,decisionContext,applyDecisions,publicReviewContext} from '../lib/automation.mjs';

const read=async path=>JSON.parse(await fs.readFile(new URL('../'+path,import.meta.url),'utf8'));
const program=await read('data/ironledger-program.json');
const config=await read('.github/workout-automation.json');
const requireValue=(value,message)=>{if(!value)throw Error(message);};
async function output(name,value){
  if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,name+'='+JSON.stringify(value)+'\n');
}
const sheetState=sheets=>readWorkoutSheetState(sheets,config,SHEET_HEADERS);
function contextFor(batch,state){
  const context=decisionContext(batch,program,[...state.historical,...state.values.slice(1)],config.excludedSessionIds);
  return publicReviewContext(context);
}
try{
  requireValue(config.version===1,'Unsupported automation configuration.');
  requireValue(config.spreadsheetId!=='1sNIsfGpvUEk_qcd5oj23vur7xdBFrBC4NfxOs6WVML4'||Number.isFinite(Date.parse(config.productionMigrationVerifiedAt)),'Production workbook migration must be verified before use.');
  requireValue(process.env.GITHUB_TOKEN,'Missing GitHub runner token.');
  const store=new GitHubStore({token:process.env.GITHUB_TOKEN});
  const snapshot=await store.snapshot(program);
  if(process.argv[2]==='prepare'){
    if(!snapshot.queue.sessions.length){await output('needed',false);console.log('No queued workouts.');process.exit(0);}
    const batch=await prepareBatch(snapshot,program),sheets=await GoogleSheetStore.connect(config);
    let state=await sheetState(sheets);
    const before=reconcileRows(state.values,batch.recentSessions);
    if(before.missing.length)await sheets.append(config.logSheet,before.missing);
    // A successful append response is not a receipt. Read every set back independently.
    state=await sheetState(sheets);
    const verified=reconcileRows(state.values,batch.recentSessions);
    requireValue(!verified.missing.length,'Workout log readback is incomplete. Queue preserved.');
    await output('reference',{revision:snapshot.plan.revision,sessions:batch.sessions});
    await output('context',contextFor(batch,state));
    await output('needed',true);
    console.log('Workout log readback verified for '+batch.sessions.length+' session(s), '+batch.rows.length+' set(s).');
  }else if(process.argv[2]==='finalize'){
    let reference,decisions;
    try{reference=JSON.parse(process.env.WORKOUT_REFERENCE);decisions=JSON.parse(process.env.CODEX_DECISIONS);}catch{throw Error('Missing or invalid runner reference / Codex JSON output. Queue preserved.');}
    requireValue(Array.isArray(reference.sessions)&&reference.sessions.length>0,'No sessions were prepared.');
    const alreadyDone=reference.sessions.every(s=>snapshot.plan.processedSessions.some(r=>r.id===s.id&&r.digest===s.digest));
    if(alreadyDone){console.log('These sessions are already acknowledged; no duplicate publication.');process.exit(0);}
    requireValue(snapshot.plan.revision===reference.revision,'Plan changed during analysis. Rerun processing against fresh data.');
    const selected=snapshot.queue.sessions.filter(s=>reference.sessions.some(r=>r.id===s.id));
    requireValue(selected.length===reference.sessions.length,'A prepared workout is missing. Queue preserved.');
    const batch=await prepareBatch({...snapshot,queue:{...snapshot.queue,sessions:selected}},program);
    requireValue(batch.sessions.every(s=>reference.sessions.some(r=>r.id===s.id&&r.digest===s.digest)),'A prepared workout changed. Queue preserved.');
    const sheets=await GoogleSheetStore.connect(config),state=await sheetState(sheets);
    const verified=reconcileRows(state.values,selected);
    requireValue(!verified.missing.length,'Verified workout log rows are missing. Queue preserved.');
    const nextPlan=applyDecisions(batch,program,contextFor(batch,state),decisions);
    const first=Math.min(...verified.verified),last=Math.max(...verified.verified);
    const sheetReceipt={spreadsheetId:config.spreadsheetId,range:"'"+config.logSheet.replaceAll("'","''")+"'!A"+first+':V'+last,verified:true,sessions:batch.sessions};
    const result=await finalizeProcessing(store,batch,nextPlan,sheetReceipt,program);
    const after=await store.snapshot(program);
    requireValue(batch.sessions.every(s=>!after.queue.sessions.some(q=>q.id===s.id)&&after.plan.processedSessions.some(r=>r.id===s.id&&r.digest===s.digest)),'Publication readback failed. Retry with the same set IDs.');
    console.log('Processed '+batch.sessions.length+' session(s), '+batch.rows.length+' set(s). Commit '+(result.head||'already acknowledged')+'.');
  }else throw Error('Usage: node scripts/automate-workouts.mjs prepare | finalize');
}catch(error){console.error(error.message);process.exitCode=1;}
