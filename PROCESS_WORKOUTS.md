# Process my workouts

The existing two-hour Outlook/workout task uses this procedure with connected tools and subscription access. The API-billed GitHub workflow in [AUTOMATION.md](AUTOMATION.md) remains disabled.

Repository: chuckdotexe/adaptive-workout-tracker, branch main.
Online files: completed.json (append-only submission queue until acknowledged) and next-week.json (next six training sessions plus processed-session receipts).

## Prepare

Run `node scripts/process-workouts.mjs prepare`. It captures the current branch head, hashes each queued session, supplies Sheets rows in A:V order, and creates a six-session plan skeleton. Credentials are read privately from GITHUB_TOKEN or Git Credential Manager. Do not print them. With no shell credentials, use the connected GitHub tools to read both files at the same commit and use the exported pure functions in lib/processing.mjs.

If the queue is empty, report that there are no new workouts and stop. Preserve the batch snapshot in the task context; no user download/upload is involved.

## Write and verify Sheets

Use the Google Drive/Sheets skills and connected tools. The existing Daily Health Data workbook ID is 1sNIsfGpvUEk_qcd5oj23vur7xdBFrBC4NfxOs6WVML4. Its Workout Log A:T schema is preserved by lib/processing.mjs. Do not write to the original workbook until a separate staging copy and migration validation have succeeded, as required by the project handoff. Find/reuse a designated staging copy; if none exists, create a private staging workbook for this first verification. Report the actual destination.

For the selected destination, preserve A:T and use U = Session ID, V = Set ID. Verify existing headers before any write; never overwrite existing columns with unrelated content. If the existing workbook has a different schema, create a new staging tab with the exact 22 headers from the batch.

Read U:V and match IDs before appending. A retry must append only missing set IDs. If an existing ID has differing actual values, stop and reconcile; never silently skip conflicts or rewrite actual logs. Write literal strings using RAW input (notes must never execute as spreadsheet formulas). Null/unknown measurements stay blank. Cardio entries with kind=cardio use durationMinutes in column L, treadmill type in P, and actual speed/incline in Notes; leave resistance reps/load/RPE/RIR blank. Legacy treadmill entries without a duration must be clarified with the user; never interpret their placeholder reps as minutes. Explicitly skipped exercises are recorded in session.skipped with a reason; they have no invented set rows and must not justify load increases. Preserve that metadata in the queued-session digest and processing context. RPE for resistance sets is explicitly derived as 10 - actual RIR; per-hand load semantics remain in Notes. Do not invent muscle groups or estimated 1RM.

After writing, read back EVERY submitted row and compare its IDs, date, exercise, reps, load, unit, RIR, derived RPE, and notes to the batch. Verify exactly one row per set ID. Only then create a receipt:

```
{
  "spreadsheetId": "actual destination ID",
  "range": "'Workout Log'!A2:V100",
  "verified": true,
  "sessions": [{"id": "session ID", "digest": "batch SHA-256", "setIds": ["all set IDs"]}]
}
```

The receipt is an assertion by the processing agent after tool verification; the script does not independently authenticate with or query Google Sheets. Never manufacture a successful receipt after an error or unverified write. If Sheets is disconnected, leave both Git files unchanged and report that processing could not finish.

## Analyze and update the plan

Read available comparable history per upcoming exercise from Sheets to assess trends, including newly written sessions; use the latest two comparable sessions for the increase criteria below. Match explicit exercise names/aliases, equipment and per-hand/total load semantics. DB Chest Supported Row is the original Chest Supported Row (Dumbbell), not a machine row. The new queued session includes its original prescriptions and equipment increments. Never equate different machines or infer missing loads.

For each upcoming exercise, include `lastSet` from its latest comparable recorded set: `date`, `weight` (null for unknown/bodyweight), `reps`, `rir`, `bodyweight`, and `loadSemantics`; include cardio measurements when applicable. Preserve actual values and dates. This supports the app's history display above the target, separate from the prescription. The finalizer also carries forward last-set data from newly processed sessions. Do not invent history where none exists. Session `durationMinutes` is the total workout time; preserve it in processing/export notes rather than treating it as exercise/cardio time.

Modify the prepared nextPlan exercise targets with concise reasons. Preserve the original program exercise order, sets, rep ranges, RIR and rest in data/ironledger-program.json. Do not move program days or add/remove exercises. Keep six consecutive upcoming training sessions (fewer only at the end of week eight). Preserve existing targets for unaffected exercises; brand-new days begin with the original program target.

Use the latest comparable session to hold a recorded load or build reps. Increase only when TWO recent comparable sessions support it: every prescribed set reaches the rep ceiling, actual RIR is within the prescribed range, loads are consistent, and equipment increment is known. If the second session is missing, use a conservative hold/build-reps target. Low RIR, missed minimum reps, inconsistent loads, uncertain equipment, or conflicting evidence should hold the actual working load and explain why. Unknown loads stay unknown. Do not change actual records. When severe fatigue suggests a change outside these rules, explain the concern and hold rather than inventing a new program.

## Publish and acknowledge atomically

Run `node scripts/process-workouts.mjs finalize` with this JSON on stdin (the agent supplies it; the user does not manage files):

```
{"batch": "the full prepared batch object", "nextPlan": "the analyzed plan object", "sheetReceipt": "the verified receipt object"}
```

The example strings above stand for objects, not literal strings. The script re-reads both Git files, verifies session hashes and receipts, preserves new arrivals, writes the new plan and removes only the processed IDs in ONE Git commit, and advances main without force. It retries concurrent submissions. If another processor changed the plan, prepare and analyze again; Sheets IDs make the retry safe. Git history retains cleared records. Receipts in next-week.json prevent an old tab from re-adding already processed sessions.

With connector-only access, perform the equivalent Git tree + commit + non-force ref update using lib/processing.mjs rules. Never update the files separately and never force-push. A failed Git publish leaves the queue available; rerun with the same verified Sheets IDs.

Report sessions/sets processed, the actual Sheets destination, main target changes, and the resulting Git commit. Do not claim success unless all three are confirmed: Sheets values verified, upcoming plan committed, processed queue entries removed.
