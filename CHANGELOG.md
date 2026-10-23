# Changelog

Code changes must update this file and README.md in the same commit. Updates are not required for workout processing, data-only changes, or other work without code changes. Entries describe verified work; a source commit alone does not confirm a successful deployment.

## 2026-10-23 — Bodyweight hanging leg raises

- Replaced the hanging-leg-raise load input with Bodyweight; retained reps and actual RIR and removed its equipment-increment field.
- New records and prescriptions use no external load. Sheets preserves blank weight/volume and identifies bodyweight in notes; existing actual records are not rewritten.
- Validation: production build, 42 unit tests and 22 Chromium/mobile WebKit browser checks, including saved bodyweight records and load-free logging through reload.

## 2026-10-22 — Free exercise selection

- Removed dropdown/Next restrictions and separate machine-busy/skip controls. Choose any exercise directly without marking it skipped.
- Preserved logged set counts and exercise selection through reload; Finish still identifies unfinished lifts and prevents accidental incomplete submission.
- Retained compatibility with previously saved explicit omissions and their restore action; historical data is not rewritten.
- Validation: production build, 41 unit tests and 20 Chromium/mobile WebKit browser checks, including jumping past unfinished lifts, returning after reload, missing-set validation, and cardio submission. One mobile WebKit recovery check timed out during the full run and passed on an isolated rerun.

## 2026-10-22 — Cardio logging, unavailable machines, and timer alerts

- Added treadmill minutes, mph, and incline fields with original cardio targets. Duration exports to Sheets; strength placeholders are not used as cardio measurements.
- Added Next up, persistent machine-busy deferral with a return list, and explicit machine-unavailable omissions with an undo action. Omitted sets are never fabricated; deferred exercises remain required at Finish.
- Added opt-in timer tones, a test beep, visible completion, and vibration where supported. Browser audio support and an unlocked/active audio session are required; no physical-iPhone or locked-screen alert guarantee is claimed.
- Reused saved credentials for submission, kept restored logging available during refresh, distinguished token presence from verified writes, and extended bounded retries to transient GitHub read failures.
- Validation: 41 unit tests and 20 Chromium/mobile WebKit browser checks, including cardio export, omission recovery, transient read retries, audio scheduling with an injected audio implementation, and 390 × 664 screen fit. Production build verified. Audio hardware on a physical iPhone was not tested.

## 2026-10-21 — 90-second rest interval

- Set the workout rest countdown and Restart button to 90 seconds for every exercise, as requested.
- Updated the displayed rest interval and README to match.
- Validation: production build passed; existing browser recovery and submission checks passed in Chromium and mobile WebKit.

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
