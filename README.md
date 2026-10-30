# Adaptive Workout Tracker

A personal, mobile-friendly tracker with two online JSON files:

- `completed.json`: completed workouts awaiting ChatGPT processing. Finish appends a session with unique session/set IDs.
- `next-week.json`: the next six training sessions and targets, with processing receipts to make retries safe.

The website reads the files directly from `chuckdotexe/adaptive-workout-tracker` on `main`. GitHub is the data store; Google Sheets is the long-term history. The existing combined Outlook/workout task checks every two hours at ten past odd-numbered hours Eastern (including the daily 9:10 a.m. workout run) using subscription access and [the connected-tool processing procedure](PROCESS_WORKOUTS.md). The weekday command center runs at 9:30 a.m. Eastern and reads the verified log for historical workout feedback. Keep the computer and app running. Completion/failure notices go to Discord #workout-processing; empty queues are silent. The [optional API-billed GitHub workflow](AUTOMATION.md) remains disabled.

Dumbbell lateral raises are named **DB Lateral Raise**; cable variations remain separate. Older dumbbell names still match last-set history.

The current program is **Adaptive 1**. Its six day labels are Upper A — Chest Focus; Lower A — Quad Focus + Delts; Cardio + Core; Upper B — Back + Shoulders; Lower B — Posterior Chain + Delts; and Upper C — Chest + Arms. Weekdays and program order stay the same.

## Use

Last-set history includes legacy production Sheets records as well as website submissions. Processing requires the historical source rows and fills display metadata independently of target loads; active workouts keep their starting prescription while receiving refreshed history. **Next five workouts** opens a new tab so the tracker stays open.

Open **Next five workouts** from the tracker to view a separate `/upcoming/` page with the next five published training sessions, exercises, rep ranges, loads (including per-hand/bodyweight), RIR, 90-second rest defaults and target reasons. Submitted queue entries are excluded. The page reads the current Git plan, supports refresh and labels cached fallback data when offline. Returning to the tracker restores an active draft. At the end of the program or while processing is pending, it shows only the sessions actually published.

The workout screen shows the last recorded set above a larger rep-range target, larger set counts, and every logged set without a clipped list. History starts with already-published Git workouts and is carried forward in processed plans; unavailable history is labelled explicitly. Chest-supported dumbbell rows are named **DB Chest Supported Row**, with load per hand.

Starting a workout starts its elapsed-time clock. Expand **Workout time** to Stop/Resume or enter total minutes manually (manual edits stop the clock). It survives reload, stops on Finish, and is saved with the session; Sheets export records it as workout-total notes, separate from cardio duration. Old drafts have no invented start time and can use Resume or manual minutes. Larger text and visible sets may require vertical scrolling on an iPhone.

Resistance exercise targets display the original program rep range (for example, 3 × 10–12 reps), including in the next-six-workouts overview. The Reps control still starts at the saved suggested count; record the reps actually completed. Fixed-rep prescriptions show a single number, and cardio shows its duration target.

1. Open https://chuckdotexe.github.io/adaptive-workout-tracker/.
2. Connect GitHub using a fine-grained personal access token restricted to this repository, with **Contents: Read and write**. GitHub Pages has no backend, so the static app sends the credential directly to GitHub. It is remembered in localStorage in this browser on this device, and removed with Disconnect. It is never embedded in the build or committed. Repository Contents permission covers repository files, not only these two files.
3. Select your program week/day and start. Log actual load, reps, RIR, notes, and optional equipment increments. Sets and the session plan are saved on the device immediately. Use plus/minus controls for load, reps and RIR. A 90-second rest countdown starts with each completed set; Restart also starts a fresh 90 seconds for strength exercises. Tap **Sound off** to enable a test beep and timer-end tones; the preference is remembered. Sound requires browser audio support and an active audio session; background/locked-screen alerts are not guaranteed. Vibration is attempted only on supporting browsers.
4. Choose any exercise from the dropdown whenever a machine is busy; **Next exercise** also works before all sets are logged. Use the dropdown to return to earlier exercises; there is no Previous button. No separate skip or deferral action is needed. Returning to an exercise restores its logged set count. **Next up** names the next unfinished exercise, and Finish lists any lifts that still need sets. The selector shows logged/prescribed set counts. Hanging leg raises are bodyweight: log reps and actual RIR, with no load or equipment increment. Their saved/exported weight stays blank, rather than becoming zero or an invented bodyweight in pounds. Treadmill walks use **Minutes**, **Speed (mph)**, and **Incline (%)**, with the original cardio duration target shown. Minutes are required; speed and incline may be left unknown. Cardio exports to Sheets duration rather than weight/reps/RIR. Tap **Finish workout**. Wait for **Workout saved to Git**. If sets are missing, Finish names the incomplete lifts and offers buttons to return to them. A failed online save keeps the same submission on the device for retry; it never claims success or clears the draft. Once a submission is attempted, it is frozen until confirmed to avoid changing an uncertain remote write.
5. After [one-time automation setup](AUTOMATION.md), the submission push triggers GitHub Actions. The runner verifies/deduplicates Sheets rows, Codex reviews comparable history, and validated targets plus queue acknowledgment are published atomically. Until setup is complete, sessions remain queued and manual processing is available.
6. Refresh from Git to load the updated targets. Until processing, the prior plan remains available; days outside its window show original program targets clearly labeled.

All completed workouts and plans in this public repository are public, including cleared records in Git history. The user chose this architecture. No Google credentials belong in the tracker.

## Persistence and connectivity

The active workout, session plan, exercise selection, pending submission and rest deadline are stored under `awt-recovery-v1`. Reload restores them even if GitHub is unavailable. The repository token is remembered under `awt-github-token`; Disconnect removes it. Browser data clearing removes recovery and credentials. Internet is needed for Git submission. Logging can continue without a GitHub connection, and restored workouts remain editable while a background refresh runs. Finish reuses the saved token and retries transient GitHub reads as well as writes. The header reports token presence and browser online/offline status; it does not certify token write permissions. The compact workout view keeps primary controls together; notes and equipment options expand when needed.

The service worker caches only the public static application shell, not responses from GitHub. Existing legacy local records (`awt-v1` and `awt-v03-local`) are neither read, deleted, nor automatically uploaded. The earlier local-storage workflow is superseded; any existing device history remains there until separately migrated.

The week/day cookie is a device preference. Successful submissions advance to the following training day. Sessions in the online queue and the first day in the upcoming plan provide the online position on other devices. Older workouts still awaiting Sheets processing cannot move the next workout backward: the saved plan position and furthest queued workout determine the next training day. This tracks training days, not calendar days. Week eight ends without silently looping to week one.

## Safety of queue processing

Submission and processing use Git tree/commit APIs and non-force branch updates. On conflicts they re-read and merge rather than overwriting. Session hashes catch reuse of an ID with different values. Retried submissions are skipped if already queued or acknowledged by a receipt in next-week.json. A lost success response is safe to retry with the same session ID.

Processing must verify all Sheets rows before finalizing. Plan update, receipts, and removal of acknowledged queue entries happen in one Git commit. New arrivals remain queued. Sheets and Git cannot participate in one transaction: Sheets ID-based deduplication makes a failure between them recoverable. The processing agent must read back Sheets values; the finalization script checks the supplied receipt's coverage, not Google Sheets independently.

The initial next-week.json contains the original first six training sessions, not inferred personal history. ChatGPT reviews all comparable history for every exercise. Final-set RIR above 2 or a weight increase triggers set-by-set assessment; successful heavier sets can establish the next target without a rigid two-session gate. Small load trials remain conditional on equipment and prescribed reps/RIR; fatigue can call for fewer reps at the same load rather than automatically choosing the lowest weight. See PROCESS_WORKOUTS.md. Automated fatigue diagnosis and substitutions are not implemented. Automatic processing runs through GitHub Actions after configuration; it does not start a web ChatGPT conversation.

## Project documentation

See [CHANGELOG.md](CHANGELOG.md) for dated changes and validation results. Code changes must update both this README and the changelog in the same commit. Workout processing, data-only changes, and other work without code changes do not require updates to either document. Keep this README accurate for current behavior; record what changed, why, and what was verified in the changelog. Do not copy credentials or private workout details into documentation. This requirement is also recorded in [AGENTS.md](AGENTS.md) for future assistants.

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

`npm start` serves the production build on http://127.0.0.1:4173. GitHub Pages deployment uses `PAGES_ENABLED=true` and the repository base path. Workout submissions trigger processing without rebuilding Pages. Processing commits use `[skip ci]` to prevent loops; the app reads live data without rebuilding.

The test suite covers program fidelity, retry/idempotency, concurrent submissions, processing receipts, atomic plan/queue updates, new arrivals, failed saves, and the browser workflow in Chromium and mobile WebKit. Tests simulate GitHub and Sheets receipts; they do not prove live Sheets writes or physical iPhone behavior.

## Assistant processing command

`node scripts/process-workouts.mjs prepare` prints the current batch and Sheets rows. `node scripts/process-workouts.mjs finalize` accepts `{batch,nextPlan,sheetReceipt}` on stdin after actual Sheets verification. These commands are for ChatGPT's execution tools, not user-managed file transfer. Credentials come from GITHUB_TOKEN or Git Credential Manager; WORKOUT_REPOSITORY and WORKOUT_BRANCH optionally override the default target.

Production reconciliation is complete. The task now writes to **Daily Health Data → Workout Log**, preserving A:T and using U/V for session/set IDs. History and new records are read from this single production log without double-counting a staging copy. Follow PROCESS_WORKOUTS.md for verification and recovery.

API reference: [GitHub Git references](https://docs.github.com/en/rest/git/refs) and [repository contents](https://docs.github.com/en/rest/repos/contents).

## Processing verification status

On 2026-10-26, all 68 real entries from three sessions in staging were matched against Git receipts, copied into production Workout Log A937:V1004 and independently read back across all 22 columns. All 935 previous data rows, their order and the original summary formula were preserved. The 24-row synthetic test session was excluded. Staging remains an archive; future scheduled processing uses production. Existing plans/queue receipts were not reset or replayed. API-billed automation remains disabled.

Bayesian Curl uses the user-confirmed 90 lb machine setting; older 30 lb setup notes do not override recorded loads.
