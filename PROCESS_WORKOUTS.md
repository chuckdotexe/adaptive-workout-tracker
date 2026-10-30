# Process my workouts

The existing two-hour Outlook/workout task uses this procedure with connected tools and subscription access. The API-billed GitHub workflow in [AUTOMATION.md](AUTOMATION.md) remains disabled.

Repository: chuckdotexe/adaptive-workout-tracker, branch main.
Online files: completed.json (append-only submission queue until acknowledged) and next-week.json (next six training sessions plus processed-session receipts).

## Prepare

Run `node scripts/process-workouts.mjs prepare`. It captures the current branch head, hashes each queued session, supplies Sheets rows in A:V order, and creates a six-session plan skeleton. Credentials are read privately from GITHUB_TOKEN or Git Credential Manager. Do not print them. With no shell credentials, use the connected GitHub tools to read both files at the same commit and use the exported pure functions in lib/processing.mjs.

If the queue is empty, report that there are no new workouts and stop. Preserve the batch snapshot in the task context; no user download/upload is involved.

## Write and verify Sheets

Use the Google Drive/Sheets skills and connected tools. The authoritative destination is the actual Daily Health Data workbook, ID 1sNIsfGpvUEk_qcd5oj23vur7xdBFrBC4NfxOs6WVML4, tab Workout Log A:V, configured in .github/workout-automation.json. Production reconciliation completed on October 26, 2026: 68 entries from three real sessions were copied and verified across all 22 columns; all 935 prior data rows and the original summary formula were preserved; the 24-row synthetic test session was excluded. Write future workouts directly to this production log. Staging is retained only as an archive. Do not append there or count its copied history again.

Preserve A:T and use U = Session ID, V = Set ID. Verify existing headers before any write; never overwrite existing columns with unrelated content. If the workbook has a different schema, stop and report the mismatch rather than silently changing the destination. Inspect native formats/validation before extending rows and preserve them with literal-value writes. New Strength/Treadmill walk values must be accepted by new-row validation without altering old records. Do not reapply filter sort specifications when extending its range: this can reorder old rows and affect formula references. Preserve existing ordering and formulas.

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

Read ALL available comparable history per exercise to assess trends, including new sessions. Use the latest session set by set, with earlier sessions for context; do not truncate the analysis to two sessions. Match explicit exercise names/aliases, equipment and per-hand/total load semantics. DB Chest Supported Row is the original Chest Supported Row (Dumbbell), not a machine row. The new queued session includes its original prescriptions and equipment increments. Never equate different machines or infer missing loads.

For each upcoming exercise, include `lastSet` from its latest comparable recorded set: `date`, `weight` (null for unknown/bodyweight), `reps`, `rir`, `bodyweight`, and `loadSemantics`; include cardio measurements when applicable. Preserve actual values and dates. This supports the app's history display above the target, separate from the prescription. The finalizer also carries forward last-set data from newly processed sessions. Do not invent history where none exists. Session `durationMinutes` is the total workout time; preserve it in processing/export notes rather than treating it as exercise/cardio time.

Modify the prepared nextPlan exercise targets with concise reasons. Preserve the original program exercise order, sets, rep ranges, RIR and rest in data/ironledger-program.json. Do not move program days or add/remove exercises. Keep six consecutive upcoming training sessions (fewer only at the end of week eight). Preserve existing targets for unaffected exercises; brand-new days begin with the original program target.

### Effort-aware review for every exercise

Assess every upcoming target, not only exercises in the newest workout. Distinguish recorded performance from a prescription, and retain original program sets, rep ranges and RIR. A load increase within a workout is evidence requiring analysis, not an automatic inconsistency penalty. Use the successful heavier working sets to establish the next target; do not default to the lowest load. A single clear comparable session can support this decision; two sessions are corroboration, not a gate.

Final-set RIR above 2 ALWAYS triggers a load-or-reps review. Examine reps within the range, earlier-set effort, ramping versus back-offs, rep drop-off, fatigue across comparable history and equipment/load semantics. Near the top of the range with headroom supports a small conditional next-step load trial; below the top may support more reps at the established load. Reaching the ceiling at RIR 2 can also support progression. Explain the choice and any fallback. Do not promise capacity or invent available machine increments. Use observed loads as established baselines; if an increment is unknown, state a conditional trial or build reps, not an unexplained permanent hold.

For final RIR 0–1, assess whether fewer reps WITHIN the prescribed range would restore the effort target at the same weight. Otherwise use a lower demonstrated load and explain. Do not automatically revert every successful heavier load because the final set was hard. A set below minimum reps, unrecorded effort, incomplete work, concrete equipment mismatch or conflicting load convention requires explicit review, not fabricated evidence. Repeated failure/falling reps across history strengthens a reduction; isolated fatigue may only need fewer reps. RIR-based rep headroom is an estimate, not a guarantee; stop at prescribed RIR and adjust load if needed.

Every published reason must name relevant actual evidence and explain adopt heavier / load trial / build reps / hold / reduce / clarify. Missing starting targets use comparable working sets, never an invented load or automatic lowest-load rule. Normalize numeric strings and explicit exercise aliases when reading Sheets, without rewriting actual records. Preserve source measurements and bodyweight/cardio semantics. Review cardio using actual duration, speed, incline and tolerance; never prescribe resistance load for cardio or Hanging Leg Raise. No program structural change or automatic medical diagnosis.

## Publish and acknowledge atomically

Run `node scripts/process-workouts.mjs finalize` with this JSON on stdin (the agent supplies it; the user does not manage files):

```
{"batch": "the full prepared batch object", "nextPlan": "the analyzed plan object", "sheetReceipt": "the verified receipt object", "historySource": {"spreadsheetId": "the configured production ID", "values": ["A:V header row followed by the actually read historical rows"]}}
```

The example strings above stand for objects, not literal strings. The script re-reads both Git files, verifies session hashes and receipts, preserves new arrivals, writes the new plan and removes only the processed IDs in ONE Git commit, and advances main without force. It retries concurrent submissions. If another processor changed the plan, prepare and analyze again; Sheets IDs make the retry safe. Git history retains cleared records. Receipts in next-week.json prevent an old tab from re-adding already processed sessions.

Supply `historySource` from actual connected-tool reads of production Workout Log A:V. Include the full header plus the relevant historical records, not just today's uploaded rows. The CLI requires this source and deterministically adds last-set metadata for upcoming exercises, including legacy Sheets records. Never fabricate source rows or substitute the current prescription for actual performance. To repair missing display history independently of processing, run `node scripts/process-workouts.mjs history` with this same historySource object on stdin; it updates only last-set metadata, preserving targets, receipts and the queue.

With connector-only access, perform the equivalent Git tree + commit + non-force ref update using lib/processing.mjs rules. Never update the files separately and never force-push. A failed Git publish leaves the queue available; rerun with the same verified Sheets IDs.

Report sessions/sets processed, the actual Sheets destination, main target changes, and the resulting Git commit. Do not claim success unless all three are confirmed: Sheets values verified, upcoming plan committed, processed queue entries removed.


Confirmed equipment: On October 29, 2026 the user confirmed the recent Reverse Pec Deck entries (50, 100 and 60–90 lb) used the same machine. Treat those records as comparable; do not keep claiming machine equivalence is unconfirmed.
