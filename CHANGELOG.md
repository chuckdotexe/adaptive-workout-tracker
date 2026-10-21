# Changelog

Code changes must update this file and README.md in the same commit. Updates are not required for workout processing, data-only changes, or other work without code changes. Entries describe verified work; a source commit alone does not confirm a successful deployment.

## 2026-10-21 — Verified staging test processing

- Verified the user-designated test in the private staging copy, Test Workout Log, preserving unknown measurements and unique IDs.
- Read back every submitted cell and checked unique set IDs before publishing the acknowledgment and clearing the processed queue entry.
- Retained current training days and targets because synthetic test data must not drive progression. Original Daily Health Data workbook unchanged.
- Validation: live Sheets readback matched the prepared batch across all 22 columns; duplicate-ID check passed. No application code changed; application tests were not rerun for this data/documentation operation.

## 2026-10-21 — Documentation policy

- Added this changelog and linked it from the existing README.
- Updated the README to describe required sets, forward-navigation locks, exercise set counts, and missing-set recovery links.
- Added the requirement to update both documents for every project change to AGENTS.md, including documentation and workout-processing changes.
- Validation: reviewed the documentation against current code and recent commit history; checked the diff for whitespace errors. No application tests were run for this documentation-only change.

## 2026-10-21 — Require complete lifts before advancing

- Blocked Next exercise and forward exercise-selector jumps until preceding lifts have all prescribed sets logged. Backward navigation remains available.
- Added logged/prescribed counts to the exercise selector and remaining-set guidance beside the set count.
- Finish identifies incomplete lifts and provides buttons to return to them, instead of suggesting a GitHub reconnection for a validation failure.
- Validation: production build and 38 unit tests passed. Existing 12 browser checks passed; the two new navigation checks passed in Chromium and mobile WebKit after correcting an assertion for a native option element.
- Publication: GitHub Pages deployment succeeded and the live JavaScript was checked for the navigation fix (source commit 429b48e).

## 2026-10-21 — Recover workouts and simplify mobile logging

- Saved active workouts, session plans, selected exercises, pending submissions, and rest deadlines on the device so reloads and unavailable GitHub connections do not discard logged sets.
- Remembered the GitHub token in this browser until Disconnect removes it.
- Added a rest countdown after each completed set, with Restart and Clear controls, plus load/reps/RIR plus-minus buttons.
- Compacted the workout view; notes and equipment options expand when needed. Verified the main controls fit a 390 × 664 viewport.
- Added service-worker update checks and automatic refresh when an updated worker takes over outside an active workout.
- Validation: production build, 38 unit tests, and 12 Chromium/mobile WebKit browser checks passed. Inspected a compact-view screenshot. Physical iPhone behavior was not verified directly.
- Publication: GitHub Pages deployment succeeded and the live page was checked for the new version (source commit 36b53fa).

## 2026-10-17 — Git workout queue and processing workflow

- Established completed.json as the completed-workout queue and next-week.json as the upcoming plan.
- Added GitHub submission with stable session/set IDs, conflict handling, and duplicate protection.
- Added the ChatGPT workout-processing workflow with verified Sheets receipts before clearing queued sessions and publishing updated targets.
- Historical entry reconstructed from commit 05c933e and existing project documentation; no additional retrospective test or deployment claims are made here.
