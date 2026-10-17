import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {GitHubStore} from '../lib/github-store.mjs';
import {prepareBatch, finalizeProcessing} from '../lib/processing.mjs';

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
  } else if (process.argv[2] === 'finalize') {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const {batch, nextPlan, sheetReceipt} = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    console.log(JSON.stringify(await finalizeProcessing(store, batch, nextPlan, sheetReceipt, program), null, 2));
  } else {
    throw Error('Usage: node scripts/process-workouts.mjs prepare | finalize (finalize reads JSON from stdin)');
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
