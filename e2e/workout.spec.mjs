import {test,expect} from '@playwright/test';
import {GitHubStore} from '../lib/github-store.mjs';
import {prepareBatch,finalizeProcessing} from '../lib/processing.mjs';
import {mockGitHub,connect,logWorkout,program,exercises} from './support.mjs';

test('Finish saves to Git, processing publishes new targets, and the tracker reloads them',async({page},testInfo)=>{
  const fixture=await mockGitHub(page);await connect(page);await logWorkout(page);
  await page.getByRole('button',{name:'Finish workout',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Workout saved to Git');
  const queue=fixture.files['completed.json'];
  expect(queue.sessions).toHaveLength(1);
  expect(queue.sessions[0].sets).toHaveLength(exercises.reduce((n,e)=>n+e.sets,0));
  expect(new Set(queue.sessions[0].sets.map(s=>s.id)).size).toBe(queue.sessions[0].sets.length);
  expect(await page.evaluate(()=>localStorage.getItem('awt-recovery-v1'))).toBeTruthy();
  expect(await page.evaluate(()=>Object.keys(sessionStorage))).toEqual([]);
  const store=new GitHubStore({token:'test-only',fetchImpl:fixture.fetch});
  const batch=await prepareBatch(await store.snapshot(program),program);
  batch.nextPlan.workouts[0].exercises[0].weight=305;
  batch.nextPlan.workouts[0].exercises[0].reason='Synthetic browser-test target';
  await finalizeProcessing(store,batch,batch.nextPlan,{spreadsheetId:'mock-staging-only',range:'A2:V40',verified:true,sessions:batch.sessions},program);
  await page.getByRole('button',{name:'Refresh from Git',exact:true}).click();
  await expect(page.getByTestId('target')).toContainText('305 lb');
  await expect(page.getByRole('heading',{name:'Awaiting ChatGPT processing (0)',exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('git-workflow.png'),fullPage:true});
  await page.reload();
  await expect(page.getByTestId('target')).toContainText('305 lb');
  await expect(page.getByRole('heading',{name:'GitHub connected',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.cookie)).not.toContain('test-only');
  expect(fixture.files['completed.json'].sessions).toHaveLength(0);
  expect(fixture.files['next-week.json'].processedSessions).toHaveLength(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('selected program day is remembered alongside device recovery',async({page})=>{
  await mockGitHub(page);await page.goto('/');
  await expect(page.getByLabel('Day',{exact:true})).toBeVisible();
  await page.getByLabel('Week',{exact:true}).selectOption('3');
  await page.getByLabel('Day',{exact:true}).selectOption('4');
  await page.reload();
  await expect(page.getByLabel('Week',{exact:true})).toHaveValue('3');
  await expect(page.getByLabel('Day',{exact:true})).toHaveValue('4');
  await expect(page.getByText(/Program day 16 of 48/)).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('awt-recovery-v1'))).toBeTruthy();
});

test('refresh selects the newer published plan while an older workout remains queued',async({page})=>{
 const fixture=await mockGitHub(page);await connect(page);await logWorkout(page);
 await page.getByRole('button',{name:'Finish workout',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Workout saved to Git');
 const {seedPlan}=await import('../lib/online-workflow.mjs');
 fixture.files['next-week.json']=seedPlan(program,{week:2,day:1});
 await page.reload();
 await expect(page.getByLabel('Week',{exact:true})).toHaveValue('2');
 await expect(page.getByLabel('Day',{exact:true})).toHaveValue('1');
 expect(fixture.files['completed.json'].sessions).toHaveLength(1);
});
