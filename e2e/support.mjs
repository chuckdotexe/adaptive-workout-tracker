import fs from 'node:fs';
import {GitHubFixture} from '../tests/helpers/github-fixture.mjs';
import {expect} from '@playwright/test';
export const program=JSON.parse(fs.readFileSync(new URL('../data/ironledger-program.json',import.meta.url)));
export const exercises=program.filter(e=>e.week===1&&e.day===1);
export async function mockGitHub(page){
  const fixture=new GitHubFixture(program);
  await page.context().route('https://api.github.com/**',async route=>{
    const req=route.request();
    try {
      const response=await fixture.fetch(req.url(),{method:req.method(),headers:req.headers(),body:req.postData()});
      await route.fulfill({status:response.status,contentType:'application/json',body:await response.text()});
    } catch {await route.abort('failed');}
  });
  return fixture;
}
export async function connect(page){
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Refresh from Git',exact:true})).toBeEnabled();
  await page.getByLabel('GitHub repository token').fill('test-only-not-a-real-token');
  await page.getByRole('button',{name:'Connect GitHub',exact:true}).click();
  await expect(page.getByRole('heading',{name:'GitHub connected',exact:true})).toBeVisible();
}
export async function logWorkout(page){
  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  for(let j=0;j<exercises.length;j++){
    const ex=exercises[j];await page.getByLabel('Exercise',{exact:true}).selectOption(String(j));
    await page.getByLabel('Load',{exact:true}).fill(String(ex.weight??50));
    await page.getByLabel('Reps',{exact:true}).fill(String(ex.maxReps));
    await page.getByLabel('Actual RIR',{exact:true}).fill(String(ex.rirMin));
    await page.getByText('Notes & equipment',{exact:true}).click();
    await page.getByLabel('Equipment increment').fill('5');
    await page.getByText('Notes & equipment',{exact:true}).click();
    for(let i=0;i<ex.sets;i++)await page.getByRole('button',{name:'Complete set',exact:true}).click();
  }
}
