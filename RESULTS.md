# Actual validation results — 2026-10-17

## Current slice

- `npm test`: 21 passed, 0 failed. Source CSV reconciliation; known bench, leg press, lateral raise and curl cases; repeated set retry; complete workout persistence; incomplete completion blocked; equipment increments after restart; original rep range retained; explicit reviewed 300 lb leg-press target; unknown RIR preserved; marked derived RPE; backup round-trip and invalid-file protection.
- `npm run build`: PASS with Next.js 16.4.2. Static app and offline cache generated.
- `npm run typecheck`: PASS. TypeScript files are checked; JavaScript application logic is exercised by tests.
- `npm run test:e2e`: 12 passed, 0 failed: six browser scenarios in Chromium and mobile WebKit. Covers all 24 sets in Week 1 Day 1, offline app reopening, saved equipment increments, approval and 260 lb bench target, unique next workout, JSON export/restore, invalid backup rejection, corrupt-storage recovery, failed writes, stale tab protection, and explicit 300 lb leg-press review reopening on Day 2. This is emulation, not a real iPhone install test.
- `npm audit`: 0 known vulnerabilities.
- Fresh GitHub runner verification is being rerun for this commit. The previous GitHub run's build/check job passed; its Pages deployment failed because the private repository's account plan is ineligible. Deployment is now gated off by default, independent of verification.

Initial recovery-browser tests failed because the test alert locator also selected Next.js's hidden route announcer. The locator was scoped to the application; all checks then passed. The supplied prototype was source-audited, not baseline build-tested.

## Still pending in the handoff

Historical alias mapping/import; longer-term fatigue history; cross-week prescription review; authenticated staging sync, retry/reconciliation against a real staging workbook; hosting; and physical iPhone home-screen validation. No deployment, staging workbook creation, Google credentials, source-workbook reads or writes were performed. Local tests do not establish cross-device durability or indefinite browser retention. Current Plan on the existing workbook has not been reconciled, so the supplied CSV is not claimed to supersede it.

Screenshots are generated in per-test folders under test-results/ using synthetic data only. No health history JSON is tracked or published.
