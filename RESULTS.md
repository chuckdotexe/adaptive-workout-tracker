# Actual validation results — 2026-10-17

- `npm run build`: PASS on Next.js 16.4.2; static export and offline cache generated in out/.
- `npm test`: 13 passed, 0 failed. Includes source CSV reconciliation, known bench/leg press/lateral raise/curl cases, complete-workout persistence, duplicate replay, incomplete completion rejection and storage failures.
- `npm run typecheck`: PASS. Note that this checks TypeScript files; application logic is JavaScript, covered by runtime tests.
- `npm run test:e2e`: 1 Chromium browser test passed. Logged every prescribed set in Week 1 Day 1; reloaded the application offline using its service worker; finished and approved targets offline; reloaded online and saw bench 260 lb; started another workout on the same day without duplicate or lost sets. No remote sync was involved.
- Dependency audit after updating to Next.js 16.4.2: 0 known vulnerabilities.

The first build attempt ran before installation completed and could not find Next.js. An intermediate build was interrupted by a dependency update and failed with a missing package file. The final build above passed after installation completed. The supplied prototype itself was audited by source inspection, not reported as baseline build-tested.

Not performed: deployment, real iPhone Safari/home-screen verification, authenticated sync, staging workbook creation or reconciliation against Google Sheets. The original workbook was never accessed or modified. Local tests do not establish cross-device durability or long-term browser retention.

Browser screenshot: test-results/completed-workout.png (synthetic test data only).
