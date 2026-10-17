# Adaptive Workout Tracker

The first handoff slice: select a program day, log every working set, save locally, finish, review and approve progression, then reopen with the approved target. Code and checks live in the private GitHub repository. No database or backend is required for this slice.

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

Finishing requires all prescribed sets. Rules `double-progression-v2` preserve the original program rep range and store a separate rep goal. Reps below the minimum or harder-than-prescribed RIR hold the actual working load. Otherwise build reps by one from the lowest achieved set, capped at the maximum. All sets at the ceiling within prescribed RIR propose an increase using the equipment increment. Mixed loads, unknown values, excess RIR at the ceiling or unknown equipment increments require review. Actual logs never change. RPE from observed RIR is marked derived, not directly observed.

Approval is explicit. For review decisions, enter a load and a rep goal within the program range and check its approval box. Unchecked review decisions keep the previous target. Targets apply to the same exact week/day/exercise; they are not transferred blindly into another week with different prescriptions. The selected program day persists after approval. Decisions record rule version, actual loads and approval provenance. Longer-term fatigue modelling and historical import remain pending.

## Data recovery

Export JSON backups regularly. Restore validates the file and shows its counts before an explicit replacement confirmation. Invalid files do not change storage. A valid backup can recover corrupt device storage. Restoring replaces, rather than merges, device records. Browser/OS storage deletion can still remove local data. The old prototype's `awt-v03-local` data remains untouched; automatic migration is not implemented.

All 328 prescriptions are checked against the source CSV for names, notes, load text, sets, rep and RIR ranges. Per-hand load wording remains visible. Numeric load entry uses pounds. Non-rep/cardio notes remain in the source; dedicated cardio logging is pending. No historical records are automatically imported from the supplied prototype validation files.

## Scope and next steps from the handoff

The current application is not deployed. GitHub Actions installs from the lockfile in a fresh runner and verifies the app. Deployment is disabled unless the repository variable `GITHUB_PAGES_ENABLED` is explicitly set to `true`; no hosting provider is being selected by this change. The previous Pages eligibility check was rejected for the private repository's current plan.

The supplied program contains personal training notes and starting-load evidence. It must not be published to an unauthenticated host as-is. Hosting access and which program data may be published need resolution before deployment. No credentials, historical workout JSON, or Google API integration are included in the deployed app.

After the slice is verified: explicit historical alias mapping and migration, then authenticated staging sync with offline retry/idempotency tests and workbook reconciliation. Daily Health Data must remain unchanged. No staging workbook or authenticated backend has been configured, and no Sheets access or writes have occurred. Timers, supersets, substitutions, cross-device sync and real iPhone home-screen verification remain pending. The PWA has icons, mobile metadata and a tested offline cache; WebKit emulation is not physical iPhone verification.

See RESULTS.md for actual checks. Legacy untracked validation files describe the prototype and do not prove current sync or migration results.
