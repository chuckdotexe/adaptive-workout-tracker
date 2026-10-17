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
test('no local storage access is required and legacy local records are untouched',async({page})=>{
  await mockGitHub(page);
  await page.addInitScript(()=>{
    Storage.prototype.getItem=()=>{throw Error('Local storage disabled');};
    Storage.prototype.setItem=()=>{throw Error('Local storage disabled');};
  });
  await connect(page);
  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  await page.getByRole('button',{name:'Complete set',exact:true}).click();
  await expect(page.getByText('1/4 sets logged',{exact:true})).toBeVisible();
  await expect(page.locator('main [role=alert]')).toHaveCount(0);
});
test('GitHub errors are visible and cannot be mistaken for an empty queue',async({page})=>{
  await page.route('https://api.github.com/**',route=>route.fulfill({status:403,contentType:'application/json',body:'{}'}));
  await page.goto('/');
  await expect(page.locator('main [role=alert]')).toContainText('Could not load Git workouts');
  await expect(page.getByRole('button',{name:'Start workout',exact:true})).toHaveCount(0);
});
