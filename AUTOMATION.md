# Automatic workout processing

Current setup: the combined Outlook/workout task checks every two hours at ten past odd-numbered hours Eastern (including the daily 9:10 a.m. workout run) using existing subscription access and connected tools, following PROCESS_WORKOUTS.md. The weekday command center runs at 9:30 a.m. Eastern and reads the verified log for historical workout feedback. Keep the computer and app running. It reports completed/failed processing to Discord #workout-processing and stays silent when nothing is pending. The API-billed workflow described below is installed but disabled; do not enable or purchase API credits without the user's instruction.

Production destination: **Daily Health Data → Workout Log A:V**. Staging reconciliation and full readback completed on October 26, 2026; `.github/workout-automation.json` records the production ID and verification timestamp. Historical and newly submitted performance share this one tab and are read once, without combining a duplicate staging copy. Staging remains an archive.

The website's successful Finish submission changes `completed.json`. That push starts **Process submitted workouts with Codex**. No web ChatGPT conversation or copy/paste handoff is part of the automatic path.

## One-time setup

The workflow is installed but stays inactive until the following configuration is supplied. ChatGPT/desktop connector connections are not available on a GitHub-hosted runner.

1. In the repository's **Settings → Secrets and variables → Actions → Secrets**, add:
   - `OPENAI_API_KEY`: an OpenAI API project key with access to the Codex action's selected/default model. This path uses API access; it does not reuse the desktop chat login. Configure the API project's budget separately.
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: the complete JSON credential for a Google service account in a project with the Google Sheets API enabled. Do not put it in repository files, the website, or a chat message.
2. Only if the user explicitly chooses this paid alternative, grant that service account access to the configured production workbook. The configured `Workout Log` tab has A:V headers and holds both the destination and historical records. This service-account setup is not required by the existing connected-tool task.
3. Under **Variables**, create `WORKOUT_AUTOMATION_ENABLED` with value `true`. Optionally set `WORKOUT_CODEX_MODEL` to an API model your project can access; leaving it unset uses the Codex action's default.
4. Open **Actions → Process submitted workouts with Codex → Run workflow** to process the current backlog and verify the complete live setup. Thereafter, each successful website submission triggers it automatically.

Existing site tokens still need only repository Contents read/write; the optional runner uses its own short-lived `GITHUB_TOKEN`. Production is configured following verified migration; it is no longer blocked by the former staging-only guard.

## What the runner does

1. **Prepare:** read current Git files, validate headers, deduplicate by set ID, append only missing literal/RAW rows, then read every submitted row back. Conflicts and duplicate IDs stop the run.
2. **Codex review:** on a separate read-only runner, review bounded proposed targets and evidence flags derived from comparable exercise history. This job has neither Google credentials nor Git write permission. Raw workout notes, dates, session/set IDs and private historical set values are excluded from its prompt and public Actions logs. The synthetic test session is excluded from training history.
3. **Publish:** re-read Git and Sheets, compare prepared session hashes, reject unexpected or out-of-bounds model targets, and use the existing atomic Git finalizer. The plan and acknowledgment are one non-force commit. New arrivals are preserved.

The review uses all comparable history. Successful heavier working sets are retained as evidence; final-set RIR above 2 and within-session weight increases trigger assessment rather than an automatic lowest-load hold. One clear session can support a bounded trial with a known equipment increment; two sessions are corroboration. Unknown increments require a conditional recommendation or rep progression. Back-offs, low RIR, missing effort and concrete equipment mismatches remain explicit review cases. Bodyweight/cardio receive no external load. Deterministic bounds validate the analysis output; the paid workflow remains disabled.

## Failures and recovery

- Missing setup: the configuration job reports that automation is inactive; it does not claim any workout was processed.
- Sheets, Codex or publication failure: workouts remain queued. Verified rows are reused on retry; no successful append is treated as proof of a verified readback.
- Retry through **Run workflow** after correcting access or data conflicts. There is no automatic paid retry loop after a failed Codex run.
- The **Actions** run is the processing status. The site shows pending queue entries until an acknowledgment exists; refresh from Git to load published targets.
- Workout submission commits no longer contain `[skip ci]`, because that suppresses the processing trigger. Processing commits retain it to prevent a loop. Data-only submissions do not rebuild Pages.

## Validation status

Unit tests cover row reuse/conflicts, RAW writes, prompt-data minimization, excluded test history, bounded target validation, submission trigger compatibility and single-tab history deduplication. Browser tests cover submission/recovery and published plan loading. Production migration was verified through connected tools. The API-billed GitHub path remains disabled and unverified end to end; a disabled configuration run does not prove that optional path.

References: [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action), [Google service-account authentication](https://developers.google.com/identity/protocols/oauth2/service-account), [Sheets RAW append](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append).
