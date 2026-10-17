# Adaptive Workout Tracker

The first handoff slice: select a program day, log every working set, save locally, finish, automatically calculate and save progression, then reopen with the approved target. Code and checks live in the private GitHub repository. No database or backend is required for this slice.

## Reproduce checks

Use Node 22.13+ from a fresh checkout:

```powershell
npm ci
npm test
npm run build
npm run typecheck
npx playwright install chromium webkit
npm run test:e2e
```

Linux CI installs browser system dependencies with `npx playwright install --with-deps chromium webkit`. `npm start` serves the build for development verification; it is not a deployed product. Offline caching is generated only by the production build.

## Workout and progression

Choose week/day and start a workout. Enter actual load, reps, RIR and notes. Equipment increments save with the session. Unknown load/RIR remain null; progression requests review. Each workout and set has a unique ID. A successful save writes a validated snapshot before changing the UI. Storage errors are visible; a stale tab cannot silently overwrite a later saved snapshot. This is a single-user app; avoid simultaneous editing from multiple tabs.

Finishing requires all prescribed sets. Rules `automatic-progression-v3` preserve the original program rep range and store a separate rep goal. Reps below the minimum or harder-than-prescribed RIR hold the actual working load. Otherwise build reps by one from the lowest achieved set, capped at the maximum. All sets at the ceiling within prescribed RIR propose an increase using the equipment increment. Mixed loads, unknown values, excess RIR at the ceiling or unknown equipment increments require review. Actual logs never change. RPE from observed RIR is marked derived, not directly observed.

Finishing a workout automatically calculates and saves targets, without a review form, rep/load re-entry or approval checkboxes. Missing data holds the previous target; a known consistent actual load is held when performance is uncertain. Mixed loads use the lowest recorded load as the conservative next target. Completely unknown loads remain unknown. Valid increases require the configured equipment increment; otherwise the load is held. Original actual sets never change. Older workouts left on the former review screen are completed automatically on reopening. Targets currently apply to the same exact week/day/exercise. Longer-term fatigue modelling and historical import remain pending.

## Data recovery

Export JSON backups regularly. Restore validates the file and shows its counts before an explicit replacement confirmation. Invalid files do not change storage. A valid backup can recover corrupt device storage. Restoring replaces, rather than merges, device records. Browser/OS storage deletion can still remove local data. The old prototype's `awt-v03-local` data remains untouched; automatic migration is not implemented.

All 328 prescriptions are checked against the public program CSV for names, coaching notes, load text, sets, rep and RIR ranges. Copied historical evidence has been removed from public program notes; the original supplied CSV remains unchanged locally. Per-hand load wording remains visible. Numeric load entry uses pounds. Non-rep/cardio notes remain in the source; dedicated cardio logging is pending. No historical records are automatically imported from the supplied prototype validation files.

## Scope and next steps from the handoff

GitHub Pages deployment is enabled by repository variable `PAGES_ENABLED=true`. GitHub Actions verifies the app in a fresh runner before publishing the static build. The public URL is https://chuckdotexe.github.io/adaptive-workout-tracker/.

Program targets are public with the owner's permission. Copied workout-log evidence is removed from the current program notes. Completed workout records stay on the device pending authenticated Sheets sync. No credentials, historical workout JSON or Google API integration are included in the published build. Git commits are source version history, not the workout log.

After the slice is verified: explicit historical alias mapping and migration, then authenticated staging sync with offline retry/idempotency tests and workbook reconciliation. Daily Health Data must remain unchanged. No staging workbook or authenticated backend has been configured, and no Sheets access or writes have occurred. Timers, supersets, substitutions, cross-device sync and real iPhone home-screen verification remain pending. The PWA has icons, mobile metadata and a tested offline cache; WebKit emulation is not physical iPhone verification.

See RESULTS.md for actual checks. Legacy untracked validation files describe the prototype and do not prove current sync or migration results.
