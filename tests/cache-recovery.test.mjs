import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/repair.js', import.meta.url), 'utf8');

test('recovery removes only tracker caches and scoped worker without touching saved data', async () => {
  let onClick;
  const button = { disabled: false, addEventListener: (_, fn) => { onClick = fn; } };
  const status = { textContent: '' };
  const removed = [];
  const unregistered = [];
  const redirects = [];
  const location = {
    href: 'https://chuckdotexe.github.io/adaptive-workout-tracker/repair.html',
    replace: url => redirects.push(url),
  };
  const scope = 'https://chuckdotexe.github.io/adaptive-workout-tracker/';
  const storage = new Proxy({}, { get: () => { throw new Error('Recovery must not access user storage'); } });

  vm.runInNewContext(source, {
    document: { getElementById: id => id === 'repair' ? button : status },
    navigator: { serviceWorker: { getRegistrations: async () => [
      { scope, unregister: async () => { unregistered.push(scope); return true; } },
      { scope: 'https://chuckdotexe.github.io/other-app/', unregister: async () => { throw new Error('Other app worker touched'); } },
    ] } },
    window: { location, caches: {
      keys: async () => ['workout-old', 'unrelated-cache', 'workout-new'],
      delete: async key => { removed.push(key); return true; },
    } },
    localStorage: storage,
    sessionStorage: storage,
    URL,
    Date: { now: () => 12345 },
    setTimeout: fn => fn(),
  });

  await onClick();
  assert.deepEqual(unregistered, [scope]);
  assert.deepEqual(removed, ['workout-old', 'workout-new']);
  assert.deepEqual(redirects, ['./?cache-repaired=12345']);
  assert.match(status.textContent, /saved workouts and GitHub token were not touched/);
});
