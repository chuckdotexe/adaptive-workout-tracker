import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {GitHubStore} from '../lib/github-store.mjs';
import {prepareBatch, finalizeProcessing,SHEET_HEADERS} from '../lib/processing.mjs';
import {attachSheetHistory} from '../lib/session-details.mjs';

// Capture credentials privately; never print a token or include it in arguments.
function credential() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const result = execFileSync('git', ['credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8',
      env: {...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never'}, stdio: ['pipe', 'pipe', 'pipe'],
    });
    return result.split(/\r?\n/).find(line => line.startsWith('password='))?.slice(9) ?? '';
  } catch { return ''; }
}
const program = JSON.parse(await fs.readFile(new URL('../data/ironledger-program.json', import.meta.url)));
const store = new GitHubStore({token: credential(), repository: process.env.WORKOUT_REPOSITORY, branch: process.env.WORKOUT_BRANCH || 'main'});
try {
  if (process.argv[2] === 'prepare') {
    console.log(JSON.stringify(await prepareBatch(await store.snapshot(program), program), null, 2));
  } else if (process.argv[2] === 'history') {
    const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);
    const source=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const config=JSON.parse(await fs.readFile(new URL('../.github/workout-automation.json',import.meta.url)));
    if(source.spreadsheetId!==config.spreadsheetId || !Array.isArray(source.values) || !SHEET_HEADERS.every((h,i)=>source.values[0]?.[i]===h))throw Error('History source/header mismatch');
    for(let attempt=0;attempt<3;attempt++){
      const snapshot=await store.snapshot(program);
      const plan=attachSheetHistory(snapshot.plan,program,source.values.slice(1),config.excludedSessionIds);
      if(JSON.stringify(plan)===JSON.stringify(snapshot.plan)){console.log('Published workout history is already current.');break;}
      plan.revision='history-'+crypto.randomUUID();plan.historyUpdatedAt=new Date().toISOString();
      try{
        const head=await store.writeFiles(snapshot.head,{'next-week.json':plan},'Refresh last-set history from verified workout log [skip ci]');
        const after=await store.snapshot(program);
        if(JSON.stringify(after.plan)!==JSON.stringify(plan))throw Error('History publication readback mismatch');
        console.log(JSON.stringify({head,historyTargets:plan.workouts.flatMap(w=>w.exercises).filter(t=>t.lastSet).length,verified:true}));break;
      }catch(error){if(attempt===2||error.status&&!([409,422,500,502,503,504].includes(error.status)))throw error;}
    }
  } else if (process.argv[2] === 'finalize') {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const {batch, nextPlan, sheetReceipt,historySource} = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const config=JSON.parse(await fs.readFile(new URL('../.github/workout-automation.json', import.meta.url)));
    if(historySource?.spreadsheetId!==config.spreadsheetId || sheetReceipt?.spreadsheetId!==config.spreadsheetId || !Array.isArray(historySource?.values) || !SHEET_HEADERS.every((h,i)=>historySource.values[0]?.[i]===h))throw Error('Verified production historySource with A:V headers is required before publishing. Queue preserved.');
    const withHistory=attachSheetHistory(nextPlan,program,historySource.values.slice(1),config.excludedSessionIds);
    console.log(JSON.stringify(await finalizeProcessing(store, batch, withHistory, sheetReceipt, program), null, 2));
  } else {
    throw Error('Usage: node scripts/process-workouts.mjs prepare | finalize | history (finalize/history read JSON from stdin)');
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
