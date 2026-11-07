import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the active exercise card shows the published target reason in an expandable footer', () => {
  const page = fs.readFileSync(new URL('../app/page.jsx', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../app/style.css', import.meta.url), 'utf8');
  const panel = page.indexOf('data-testid="exercise-target-reason"');
  const sets = page.indexOf('className="logged-sets"');
  const overview = page.indexOf('className="card overview"');

  assert.ok(panel > sets && panel < overview, 'target rationale belongs below the set log inside the exercise card');
  assert.match(page, /<details className="target-rationale" key=\{ex\.id\} data-testid="exercise-target-reason"><summary>Why this target\?<\/summary><p>\{target\.reason\}<\/p><\/details>/);
  assert.match(styles, /\.active-workout \.target-rationale summary/);
  assert.doesNotMatch(styles, /\.active-workout \.target-rationale\s*\{[^}]*display\s*:\s*none/);
});
