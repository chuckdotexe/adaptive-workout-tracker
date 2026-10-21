# Adaptive Workout Tracker

A personal, mobile-friendly tracker with two online JSON files:

- `completed.json`: completed workouts awaiting ChatGPT processing. Finish appends a session with unique session/set IDs.
- `next-week.json`: the next six training sessions and targets, with processing receipts to make retries safe.

The website reads the files directly from `chuckdotexe/adaptive-workout-tracker` on `main`. GitHub is the data store; Google Sheets is the long-term history. Say **Process my workouts** in this repository's ChatGPT/Codex task to follow [PROCESS_WORKOUTS.md](PROCESS_WORKOUTS.md).

## Use

1. Open https://chuckdotexe.github.io/adaptive-workout-tracker/.
2. Connect GitHub using a fine-grained personal access token restricted to this repository, with **Contents: Read and write**. GitHub Pages has no backend, so the static app sends the credential directly to GitHub. It is remembered in localStorage in this browser on this device, and removed with Disconnect. It is never embedded in the build or committed. Repository Contents permission covers repository files, not only these two files.
3. Select your program week/day and start. Log actual load, reps, RIR, notes, and optional equipment increments. Sets and the session plan are saved on the device immediately. Use plus/minus controls for load, reps and RIR. A rest countdown starts with each completed set.
4. Tap **Finish workout**. Wait for **Workout saved to Git**. A failed save keeps the same submission on the device for retry; it never claims success or clears the draft. Once a submission is attempted, it is frozen until confirmed to avoid changing an uncertain remote write.
5. Tell ChatGPT **Process my workouts**. ChatGPT reads the queue, verifies/deduplicates Sheets rows, reads recent comparable history, analyzes targets, then atomically updates the upcoming plan and removes only processed queue entries.
6. Refresh from Git to load the updated targets. Until processing, the prior plan remains available; days outside its window show original program targets clearly labeled.

All completed workouts and plans in this public repository are public, including cleared records in Git history. The user chose this architecture. No Google credentials belong in the tracker.

## Persistence and connectivity

The active workout, session plan, exercise selection, pending submission and rest deadline are stored under `awt-recovery-v1`. Reload restores them even if GitHub is unavailable. The repository token is remembered under `awt-github-token`; Disconnect removes it. Browser data clearing removes recovery and credentials. Internet is needed for Git submission. The compact workout view keeps primary controls together; notes and equipment options expand when needed.

The service worker caches only the public static application shell, not responses from GitHub. Existing legacy local records (`awt-v1` and `awt-v03-local`) are neither read, deleted, nor automatically uploaded. The earlier local-storage workflow is superseded; any existing device history remains there until separately migrated.

The week/day cookie is a device preference. Successful submissions advance to the following training day. Sessions in the online queue and the first day in the upcoming plan provide the online position on other devices. This tracks training days, not calendar days. Week eight ends without silently looping to week one.

## Safety of queue processing

Submission and processing use Git tree/commit APIs and non-force branch updates. On conflicts they re-read and merge rather than overwriting. Session hashes catch reuse of an ID with different values. Retried submissions are skipped if already queued or acknowledged by a receipt in next-week.json. A lost success response is safe to retry with the same session ID.

Processing must verify all Sheets rows before finalizing. Plan update, receipts, and removal of acknowledged queue entries happen in one Git commit. New arrivals remain queued. Sheets and Git cannot participate in one transaction: Sheets ID-based deduplication makes a failure between them recoverable. The processing agent must read back Sheets values; the finalization script checks the supplied receipt's coverage, not Google Sheets independently.

The initial next-week.json contains the original first six training sessions, not inferred personal history. ChatGPT uses the last one or two comparable sessions per exercise; increases require two supporting sessions and a known increment. See the processing procedure for conservative hold rules. Automated fatigue diagnosis, substitutions, cardio logging, and automatic ChatGPT triggering are not implemented.

## Development

Node 22.13+:

```powershell
npm ci
npm test
npm run build
npm run typecheck
npx playwright install chromium webkit
npm run test:e2e
```

`npm start` serves the production build on http://127.0.0.1:4173. GitHub Pages deployment uses `PAGES_ENABLED=true` and the repository base path. Data-only commits use `[skip ci]`; the app reads live data without rebuilding.

The test suite covers program fidelity, retry/idempotency, concurrent submissions, processing receipts, atomic plan/queue updates, new arrivals, failed saves, and the browser workflow in Chromium and mobile WebKit. Tests simulate GitHub and Sheets receipts; they do not prove live Sheets writes or physical iPhone behavior.

## Assistant processing command

`node scripts/process-workouts.mjs prepare` prints the current batch and Sheets rows. `node scripts/process-workouts.mjs finalize` accepts `{batch,nextPlan,sheetReceipt}` on stdin after actual Sheets verification. These commands are for ChatGPT's execution tools, not user-managed file transfer. Credentials come from GITHUB_TOKEN or Git Credential Manager; WORKOUT_REPOSITORY and WORKOUT_BRANCH optionally override the default target.

The existing Daily Health Data workbook must remain unchanged until staging reconciliation succeeds. This implementation does not write to any Sheet. Follow PROCESS_WORKOUTS.md for the first connected processing run.

API reference: [GitHub Git references](https://docs.github.com/en/rest/git/refs) and [repository contents](https://docs.github.com/en/rest/repos/contents).
