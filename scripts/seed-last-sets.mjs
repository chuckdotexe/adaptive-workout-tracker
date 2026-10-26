// Bootstrap display history only from actual workouts already published in Git.
// Never copy private Sheets history into a public static asset.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {lastRecordedSet,historyName} from '../lib/session-details.mjs';
const program=JSON.parse(fs.readFileSync('data/ironledger-program.json','utf8'));
const sessions=new Map();
const revisions=execFileSync('git',['rev-list','--reverse','HEAD','--','completed.json'],{encoding:'utf8'}).trim().split(/\s+/);
for(const revision of revisions){
  try{const queue=JSON.parse(execFileSync('git',['show',`${revision}:completed.json`],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
    for(const session of queue.sessions || [])if(session.id!=='b4774b22-e8b1-406f-914c-cab7b67a2f86')sessions.set(session.id,session);
  }catch{}
}
const history={};
for(const exercise of program){const last=lastRecordedSet(exercise,[...sessions.values()],program);if(last)history[historyName(exercise.name)]=last;}
fs.writeFileSync('data/last-sets.json',JSON.stringify(history,null,2)+'\n');
console.log(`Seeded ${Object.keys(history).length} exercise histories from published Git workouts.`);
