import {test,expect} from '@playwright/test';
import {mockGitHub,connect,logWorkout} from './support.mjs';

test('failed online save retains the draft for retry and does not claim success',async({page})=>{
  const fixture=await mockGitHub(page);await connect(page);await logWorkout(page);
  fixture.rejectWrite=true;
  await page.getByRole('button',{name:'Finish workout',exact:true}).click();
  await expect(page.locator('main [role=alert]')).toContainText('Workout not confirmed saved');
  await expect(page.getByRole('status')).toHaveCount(0);
  expect(fixture.files['completed.json'].sessions).toHaveLength(0);
  await expect(page.getByLabel('Load',{exact:true})).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Load',{exact:true})).toBeDisabled();
  fixture.rejectWrite=false;
  await page.getByRole('button',{name:'Finish workout',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Workout saved to Git');
  expect(fixture.files['completed.json'].sessions).toHaveLength(1);
});
test('incomplete workout is not submitted and remains editable',async({page})=>{
  const fixture=await mockGitHub(page);await connect(page);
  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  await page.getByRole('button',{name:'Finish workout',exact:true}).click();
  await expect(page.locator('main [role=alert]')).toContainText('Incomplete completed workout');
  await expect(page.getByLabel('Load',{exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Complete set',exact:true}).click();
  await expect(page.getByText('1/4 sets logged',{exact:true})).toBeVisible();
  expect(fixture.files['completed.json'].sessions).toHaveLength(0);
});
test('reload offline recovers sets, token, timer and exercise on iPhone',async({page})=>{
 await mockGitHub(page);await connect(page);
 await page.setViewportSize({width:390,height:664});
 await page.getByRole('button',{name:'Start workout',exact:true}).click();
 await page.getByRole('button',{name:'Increase Reps',exact:true}).click();
 await page.getByRole('button',{name:'Complete set',exact:true}).click();
 await expect(page.getByText('1/4 sets logged',{exact:true})).toBeVisible();
 await expect(page.getByRole('timer')).toContainText('Rest');
 expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight)).toBe(true);
 await page.screenshot({path:'test-results/compact-workout.png'});
 await page.route('https://api.github.com/**',route=>route.abort());
 await page.reload();
 await expect(page.getByText('1/4 sets logged',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Disconnect',exact:true})).toBeVisible();
 await expect(page.getByRole('timer')).toContainText('Rest');
 await page.getByRole('button',{name:'Complete set',exact:true}).click();
 await expect(page.getByText('2/4 sets logged',{exact:true})).toBeVisible();
});
test('GitHub errors are visible and cannot be mistaken for an empty queue',async({page})=>{
  await page.route('https://api.github.com/**',route=>route.fulfill({status:403,contentType:'application/json',body:'{}'}));
  await page.goto('/');
  await expect(page.locator('main [role=alert]')).toContainText('Could not load Git workouts');
  await expect(page.getByRole('button',{name:'Start workout',exact:true})).toHaveCount(0);
});

test('exercise dropdown and Next allow unfinished lifts without losing sets; Finish lists missing sets',async({page})=>{
 const fixture=await mockGitHub(page);await connect(page);
 await page.getByRole('button',{name:'Start workout',exact:true}).click();
 const next=page.getByRole('button',{name:'Next exercise',exact:true});
 await expect(next).toBeEnabled();
 await expect(page.getByLabel('Exercise',{exact:true}).locator('option').nth(7)).not.toHaveAttribute('disabled','');
 await page.getByRole('button',{name:'Complete set',exact:true}).click();
 await page.getByLabel('Exercise',{exact:true}).selectOption('7');
 await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('7');
 await page.reload();await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('7');
 await page.getByLabel('Exercise',{exact:true}).selectOption('0');
 await expect(page.getByText('1/4 sets logged',{exact:true})).toBeVisible();
 await next.click();await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('1');
 await page.getByRole('button',{name:'Finish workout',exact:true}).click();
 await expect(page.locator('main [role=alert]')).toContainText('Bench Press (1/4)');
 await expect(page.getByRole('button',{name:'Bench Press · 1/4',exact:true})).toBeVisible();
 expect(fixture.files['completed.json'].sessions).toHaveLength(0);
 await expect(page.getByRole('button',{name:'Machine busy: do later',exact:true})).toHaveCount(0);
});
