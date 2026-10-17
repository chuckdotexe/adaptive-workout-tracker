# Runnable local slice

Read AUDIT.md for the prototype assessment. This version is static React (Next.js export), local browser storage and a cached app shell. There is no backend, database, credential or Sheets connection.

## Run

Node 22.13+ recommended. From this directory:

```powershell
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm start
```

Open http://127.0.0.1:4173. `npm run dev` is for development; offline caching is generated only by the production build. Use the same origin/port for existing local data.

Select week/day, start workout, enter actual load/reps/RIR and complete each prescribed set. Remove a mistaken set before finishing. Optional equipment increments enable increase proposals; unknown increments request review. Finish, review decisions and approve. Repeat the same program week/day to use approved targets. Each workout has its own UUID, even on the same date. Every successful operation writes a single snapshot before updating the UI. Save failures are visible. Concurrent tab changes require reload instead of overwriting data.

## Progression v1

Exactly the prescribed set count is required. Missing load/RIR, mixed loads, unknown increment at the rep ceiling, or excessive RIR at the ceiling require review. Below-minimum reps or harder-than-target RIR hold the actual working load. Otherwise build reps by one from the lowest achieved set, capped at the original maximum. All sets at the ceiling within target RIR propose an increase using the explicitly entered equipment increment, and reset reps to the original minimum. Approval is required. Review decisions retain the previous prescription. Actual set loads are never replaced by program loads. Rules use current session fatigue signals; longer-term fatigue modelling is deferred.

## Boundaries

Targets are scoped to the exact program week/day/exercise, not automatically carried into later weeks with different prescriptions. Logging is manual; no automatic historical name mapping or historical import is enabled. Original CSV notes, load wording and all 328 prescriptions are included and checked against the source CSV. Numeric load entry is pounds; per-hand wording is shown explicitly. Non-rep/cardio entries keep their original notes but do not receive automatic progression.

Export JSON backups regularly. Browser storage can be cleared by the user or OS. Backup restore, sync, cross-device access, staging reconciliation, timers, substitutions and verified iPhone home-screen installation are deferred. Legacy prototype storage (`awt-v03-local`) is left untouched, not silently migrated. The original ZIP remains available one directory up. Local workout data is never included in the static build.

The `out/` directory can be served by a static HTTPS host without running Node on the host. No hosting account was selected or deployment performed. Serve at a domain root; subpath hosting needs base-path/service-worker adjustments. Do not publish the original historical JSON files in `data/`; only `out/` is a deployment artifact. No infrastructure or Google Sheets changes were made.

Old documents and validation JSON files describe the prototype and are not evidence that this version has synced data. See RESULTS.md for checks actually run for this slice.

## GitHub Pages

GitHub Actions runs unit and browser tests, builds the static app with `/adaptive-workout-tracker` as its base path, and deploys only `out/`. Enable Pages with GitHub Actions as the source. The repository can remain private only if the account's GitHub plan supports Pages for private repositories. The published app shell is public; workout logs remain in the visitor's browser and are never committed or uploaded. No Google credentials or Sheets integration are configured.
