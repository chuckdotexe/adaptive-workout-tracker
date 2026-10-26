import {test,expect} from '@playwright/test';
import {mockGitHub,connect,program,exercises} from './support.mjs';
import {empty,start,record} from '../lib/workout.mjs';
import {makeSubmission,seedPlan} from '../lib/online-workflow.mjs';

test('next-five page shows five workouts and returning preserves an active set',async({page},testInfo)=>{
 await mockGitHub(page);await connect(page);
 await page.getByRole('button',{name:'Start workout',exact:true}).click();
 await page.getByRole('button',{name:'Complete set',exact:true}).click();
 await page.getByRole('link',{name:'Next five workouts →',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Next five workouts',exact:true})).toBeVisible();
 await expect(page.locator('.upcoming-workout')).toHaveCount(5);
 await expect(page.locator('.upcoming-workout').first()).toContainText('Week 1, day 1');
 await expect(page.locator('.upcoming-workout').last()).toContainText('Week 1, day 5');
 await expect(page.locator('.upcoming-workout').first()).toContainText('4 × 4–6 reps · 255 lb');
 await expect(page.locator('.upcoming-workout').first()).toContainText('70 lb per hand');
 await expect(page.locator('.upcoming-workout').first()).toContainText('Rest 90 sec');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/upcoming-${testInfo.project.name}.png`});
 await page.getByRole('link',{name:'← Back to workout',exact:true}).click();
 await expect(page.getByText('1/4 sets logged',{exact:true})).toBeVisible();
});

test('preview excludes submitted sessions and retains a labelled cached plan offline',async({page})=>{
 const fixture=await mockGitHub(page);
 let state=start(empty(),1,1,'pending-preview','2026-10-26');
 for(const ex of exercises)for(let i=0;i<ex.sets;i++)state=record(state,ex,{id:`${ex.id}-${i}`,weight:ex.weight,reps:ex.minReps,rir:2});
 fixture.files['completed.json'].sessions=[makeSubmission(state.sessions[0],exercises,seedPlan(program))];
 await connect(page);await page.getByRole('link',{name:'Next five workouts →',exact:true}).click();
 await expect(page.locator('.upcoming-workout')).toHaveCount(5);
 await expect(page.locator('.upcoming-workout').first()).toContainText('Week 1, day 2');
 await expect(page.locator('.upcoming-workout').last()).toContainText('Week 1, day 6');
 await expect(page.getByText('Submitted workouts are awaiting processing.',{exact:false})).toBeVisible();
 await page.route('https://api.github.com/**',route=>route.abort('failed'));
 await page.reload();
 await expect(page.locator('main [role=alert]')).toContainText('Showing the last available plan.',{timeout:10000});
 await expect(page.getByText('Saved plan',{exact:false})).toBeVisible();
 await expect(page.locator('.upcoming-workout')).toHaveCount(5);
});
