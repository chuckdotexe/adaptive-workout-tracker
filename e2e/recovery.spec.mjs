import {test, expect} from '@playwright/test';
import fs from 'node:fs/promises';
import {empty, start, record, finish, approve, setIncrement} from '../lib/workout.mjs';
const program = JSON.parse(await fs.readFile(new URL('../data/ironledger-program.json', import.meta.url)));
const exercises = program.filter(e => e.week === 1 && e.day === 1);

function completedWorkout() {
  let state = start(empty(), 1, 1, 'backup-session', '2026-10-17');
  for (const e of exercises) {
    state = setIncrement(state, e, 5);
    for (let i = 0; i < e.sets; i++) state = record(state, e, {
      id: e.id + '-' + i, weight: e.weight ?? 50, reps: e.maxReps, rir: e.rirMin, notes: 'Backup test',
    });
  }
  return approve(finish(state, exercises), exercises);
}

test('backup export, preview, restore, and invalid-file protection on a phone viewport', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  const original = completedWorkout();
  await page.goto('/');
  await page.evaluate(s => localStorage.setItem('awt-v1', JSON.stringify(s)), original);
  await page.reload();
  await expect(page.getByTestId('target')).toContainText('260 lb');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Export backup'}).click();
  const download = await downloadPromise;
  const backup = await fs.readFile(await download.path(), 'utf8');
  expect(JSON.parse(backup)).toEqual(original);
  await page.evaluate(() => localStorage.removeItem('awt-v1'));
  await page.reload();
  await page.getByLabel('Restore workout backup').setInputFiles({name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup)});
  await expect(page.getByRole('status')).toContainText('Backup contains 1 workouts');
  expect(await page.evaluate(() => localStorage.getItem('awt-v1'))).toBeNull();
  await page.getByRole('button', {name: 'Replace device data with backup'}).click();
  await page.reload();
  await expect(page.getByTestId('target')).toContainText('260 lb');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('awt-v1')))).toEqual(original);
  const invalid = structuredClone(original); invalid.sessions[0].sets[0].weight = -1;
  await page.getByLabel('Restore workout backup').setInputFiles({name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid))});
  await expect(page.locator('main [role=alert]')).toContainText('Backup not loaded');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('awt-v1')))).toEqual(original);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('failed storage write leaves UI and durable sets unchanged', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Start workout', exact: true}).click();
  await page.evaluate(() => {Storage.prototype.setItem = () => {throw new DOMException('Quota exceeded', 'QuotaExceededError');};});
  await page.getByRole('button', {name: 'Complete set', exact: true}).click();
  await expect(page.locator('main [role=alert]')).toContainText('Save failed');
  await expect(page.getByText('0/4 sets logged', {exact: true})).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('awt-v1')).sessions[0].sets.length)).toBe(0);
});

test('stale tab is blocked from overwriting newer durable sets', async ({page, context}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Start workout', exact: true}).click();
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByRole('button', {name: 'Complete set', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Complete set', exact: true}).click();
  await other.getByRole('button', {name: 'Complete set', exact: true}).click();
  await expect(other.locator('main [role=alert]')).toContainText('changed in another tab');
  expect(await other.evaluate(() => JSON.parse(localStorage.getItem('awt-v1')).sessions[0].sets.length)).toBe(1);
  await other.reload();
  await expect(other.getByText('1/4 sets logged', {exact: true})).toBeVisible();
});

test('valid backup can recover corrupt device storage only after confirmation', async ({page}) => {
  const original = completedWorkout();
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('awt-v1', '{broken'));
  await page.reload();
  await expect(page.getByText('Storage unavailable. Existing data has not been replaced.')).toBeVisible();
  await page.getByLabel('Restore workout backup').setInputFiles({name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(original))});
  expect(await page.evaluate(() => localStorage.getItem('awt-v1'))).toBe('{broken');
  await page.getByRole('button', {name: 'Replace device data with backup'}).click();
  await expect(page.getByTestId('target')).toContainText('260 lb');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('awt-v1')))).toEqual(original);
});

test('existing pending workout saves automatically using actual load and reopens the correct program day', async ({page}) => {
  const lower = program.filter(e => e.week === 1 && e.day === 2);
  let state = start(empty(), 1, 2, 'lower-session', '2026-10-17');
  for (const e of lower) {
    for (let i = 0; i < e.sets; i++) state = record(state, e, {
      id: e.id + '-' + i, weight: e.name === 'Leg Press' ? 300 : e.weight ?? 50,
      reps: e.maxReps, rir: e.name === 'Leg Press' ? 4 : e.rirMin,
    });
  }
  state = finish(state, lower);
  await page.goto('/');
  await page.evaluate(s => localStorage.setItem('awt-v1', JSON.stringify(s)), state);
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Workout saved', exact: true})).toBeVisible();
  await expect(page.getByLabel('Reviewed load for Leg Press', {exact: true})).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Day', {exact: true})).toHaveValue('2');
  await expect(page.getByTestId('target')).toContainText('300 lb');
  await page.getByRole('button', {name: 'Start workout', exact: true}).click();
  await expect(page.getByLabel('Load', {exact: true})).toHaveValue('300');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('awt-v1')));
  expect(saved.sessions[0].sets.filter(s => s.exerciseId === lower[0].id).every(s => s.weight === 300)).toBe(true);
});
