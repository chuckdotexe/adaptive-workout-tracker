# Actual validation results — 2026-10-17

## GitHub Pages publication

- Repository is public, as explicitly authorized.
- Live URL: https://chuckdotexe.github.io/adaptive-workout-tracker/
- GitHub Actions run 39053761550 passed: fresh install, 22 unit/data checks, 12 browser checks, static Pages build, and successful deployment of e17b0e0.
- Live-site verification passed in Chromium and mobile WebKit: HTTP 200; manifest available; 24 synthetic sets logged; offline reload, completion, approval, and reopening in a new tab; bench target 260 lb; zero duplicate sets or page exceptions. The browser contexts were temporary and made no Sheets writes.
- Targets and coaching notes are public. Copied workout-log evidence was removed from the current public program files; original input CSV remains unchanged locally.
- Authenticated Sheets sync remains unconnected. Live app logs currently persist only in the visitor's browser.


## Current slice

- `npm test`: 22 passed, 0 failed. Source CSV reconciliation; known bench, leg press, lateral raise and curl cases; repeated set retry; complete workout persistence; incomplete completion blocked; equipment increments after restart; original rep range retained; explicit reviewed 300 lb leg-press target; unknown RIR preserved; marked derived RPE; backup round-trip and invalid-file protection.
- `npm run build`: PASS with Next.js 16.4.2. Static app and offline cache generated.
- `npm run typecheck`: PASS. TypeScript files are checked; JavaScript application logic is exercised by tests.
- `npm run test:e2e`: 12 passed, 0 failed: six browser scenarios in Chromium and mobile WebKit. Covers all 24 sets in Week 1 Day 1, offline app reopening, saved equipment increments, approval and 260 lb bench target, unique next workout, JSON export/restore, invalid backup rejection, corrupt-storage recovery, failed writes, stale tab protection, and explicit 300 lb leg-press review reopening on Day 2. This is emulation, not a real iPhone install test.
- `npm audit`: 0 known vulnerabilities.
- Fresh checkout on GitHub Actions: PASS for commit d0f8d53, run https://github.com/chuckdotexe/adaptive-workout-tracker/actions/runs/39053103072. The runner installed from the lockfile, built the static app, passed 21 unit/data tests and 12 Chromium/mobile-WebKit browser checks; deployment was skipped. The subsequent mobile-control styling correction was rebuilt, passed all 12 browser checks again locally, and was visually inspected.

Initial recovery-browser tests failed because the test alert locator also selected Next.js's hidden route announcer. The locator was scoped to the application; all checks then passed. Visual inspection of the mobile WebKit screenshot exposed unreadable native selects; explicit dark control styling fixed it and was visually rechecked. The supplied prototype was source-audited, not baseline build-tested.

## Still pending in the handoff

Historical alias mapping/import; longer-term fatigue history; cross-week prescription review; authenticated staging sync, retry/reconciliation against a real staging workbook; and physical iPhone home-screen validation. No staging workbook creation, Google credentials, source-workbook reads or writes were performed. Deployment was performed as recorded above. Local tests do not establish cross-device durability or indefinite browser retention. Current Plan on the existing workbook has not been reconciled, so the supplied CSV is not claimed to supersede it.

Screenshots are generated in per-test folders under test-results/ using synthetic data only. No health history JSON is tracked or published.

## Automatic completion update

The finish screen no longer asks the user to review, re-enter or approve targets. `automatic-progression-v3` saves conservative targets when a workout finishes. Old pending review screens are finalized automatically on reopening; original sets remain unchanged. Unknown data is not invented, and mixed working loads conservatively hold the lowest recorded load.

Validation: 26 unit/data tests passed, including automatic completion, idempotent repeated completion, unknown values, actual 300 lb leg press and mixed-load curls. Chromium/mobile-WebKit browser tests exercise one-step completion and recovery of old pending workouts without manual target entry. The production build passes. This update does not add an AI API or Sheets sync.

Automatic completion deployment: GitHub Actions run https://github.com/chuckdotexe/adaptive-workout-tracker/actions/runs/39055004731 passed build, 26 unit/data checks, 12 browser checks and Pages deployment for 5f52c37. Live Chromium and WebKit verification passed logging all 24 sets, one-step automatic completion, zero manual target fields, automatic recovery of a previous pending review without altering actual sets, null load preservation and offline reopening. No Sheets reads or writes occurred.

## Git queue workflow (2026-10-17)

Supersedes the browser-local UI described above. The tracker now appends complete sessions to completed.json and loads next-week.json from GitHub. Drafts and credentials remain only in tab memory; only a day/plan preference is stored in cookies. Existing legacy local records are untouched.

Verified locally: 38 unit tests, production build, TypeScript check, and 12 Playwright cases across Chromium and mobile WebKit. Tests include concurrent submissions, lost success responses, ID/digest conflicts, receipt coverage, atomic queue/plan processing, retained new arrivals, failed browser submissions, day preferences, and no browser workout storage. GitHub API responses and Sheets receipts were simulated in these tests; no actual workout or Google Sheet was written. The generated mobile page was visually inspected.

The ChatGPT task procedure is PROCESS_WORKOUTS.md. Finalization requires a complete verified Sheets receipt, but the script does not query Sheets itself; the agent must perform actual read-back verification through connected tools. Live token connection, real workout submission, real Sheets processing, and physical iPhone use remain to be verified. The initial queue is empty and the upcoming plan is seeded from the original program.
