import {test,expect} from '@playwright/test';
import {mockGitHub,connect} from './support.mjs';

test('busy-machine deferral survives reload and remains required at Finish',async({page})=>{
 await mockGitHub(page);await connect(page);await page.getByRole('button',{name:'Start workout',exact:true}).click();
 await expect(page.getByText('Next up: Chest Supported Row',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Machine busy: do later',exact:true}).click();
 await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('1');
 await page.reload();await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('1');
 await page.getByRole('button',{name:'Finish workout',exact:true}).click();
 await expect(page.locator('main [role=alert]')).toContainText('Bench Press (0/4)');
 await page.getByRole('button',{name:'Bench Press · 0/4',exact:true}).first().click();
 await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('0');
});

test('cardio form uses minutes speed and incline; explicit machine skips submit without fake sets',async({page},testInfo)=>{
 const fixture=await mockGitHub(page);await connect(page);await page.getByLabel('Day',{exact:true}).selectOption('5');
 await page.getByRole('button',{name:'Start workout',exact:true}).click();
 for(let i=0;i<6;i++){
  await page.getByText('Notes, equipment & skip',{exact:true}).click();
  await page.getByRole('button',{name:'Skip remaining sets: machine unavailable',exact:true}).click();
  await page.getByText('Notes, equipment & skip',{exact:true}).click();
 }
 await expect(page.getByLabel('Exercise',{exact:true})).toHaveValue('6');
 await expect(page.getByLabel('Load',{exact:true})).toHaveCount(0);
 await expect(page.getByTestId('target')).toContainText('15-20 min');
 await page.getByLabel('Minutes',{exact:true}).fill('10');await page.getByLabel('Speed (mph)',{exact:true}).fill('2.7');await page.getByLabel('Incline (%)',{exact:true}).fill('10');
 await page.getByRole('button',{name:'Complete cardio',exact:true}).click();
 await page.screenshot({path:testInfo.outputPath('cardio.png'),fullPage:true});
 await page.getByRole('button',{name:'Finish workout',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Workout saved to Git');
 const session=fixture.files['completed.json'].sessions[0];expect(session.sets).toHaveLength(1);expect(session.sets[0]).toMatchObject({kind:'cardio',durationMinutes:10,speedMph:2.7,inclinePercent:10,weight:null,rir:null,reps:0});expect(Object.keys(session.skipped)).toHaveLength(6);
});

test('sound is opt-in and rest completes visibly after 90 seconds',async({page})=>{
 await page.addInitScript(()=>{window.__tones=[];window.AudioContext=class {currentTime=0;destination={};resume(){return Promise.resolve();}createGain(){return {gain:{value:0},connect(){}};}createOscillator(){return {frequency:{value:0},connect(){},start(time){window.__tones.push(time || 0);},stop(){}};}};});
 await page.clock.install();await mockGitHub(page);await connect(page);await page.getByRole('button',{name:'Start workout',exact:true}).click();
 await page.getByRole('button',{name:'Sound off',exact:true}).click();
 await expect(page.getByRole('button',{name:'Sound on',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Complete set',exact:true}).click();
 expect(await page.evaluate(()=>window.__tones.filter(t=>t>0).length)).toBeGreaterThanOrEqual(3);
 await page.clock.fastForward(91000);
 await expect(page.getByRole('timer')).toContainText('Rest complete');
 await page.getByRole('button',{name:'Restart',exact:true}).click();await expect(page.getByRole('timer')).toContainText('1:30');
});
