# Automatic workout processing

The website's successful Finish submission changes `completed.json`. That push starts **Process submitted workouts with Codex**. No web ChatGPT conversation or copy/paste handoff is part of the automatic path.

## One-time setup

The workflow is installed but stays inactive until the following configuration is supplied. ChatGPT/desktop connector connections are not available on a GitHub-hosted runner.

1. In the repository's **Settings → Secrets and variables → Actions → Secrets**, add:
   - `OPENAI_API_KEY`: an OpenAI API project key with access to the Codex action's selected/default model. This path uses API access; it does not reuse the desktop chat login. Configure the API project's budget separately.
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: the complete JSON credential for a Google service account in a project with the Google Sheets API enabled. Do not put it in repository files, the website, or a chat message.
2. Share the private staging workbook listed in `.github/workout-automation.json` with that service account's `client_email` as **Editor**. Share only the staging workbook, not the production Daily Health Data workbook. The configured tabs must already exist: `Test Workout Log` (A:V headers) and `Workout Log` (A:T history).
3. Under **Variables**, create `WORKOUT_AUTOMATION_ENABLED` with value `true`. Optionally set `WORKOUT_CODEX_MODEL` to an API model your project can access; leaving it unset uses the Codex action's default.
4. Open **Actions → Process submitted workouts with Codex → Run workflow** to process the current backlog and verify the complete live setup. Thereafter, each successful website submission triggers it automatically.

Existing site tokens still need only repository Contents read/write; the runner uses its own short-lived `GITHUB_TOKEN`. The configured staging destination is intentionally separate from production. Production remains blocked until its migration/reconciliation is implemented and verified.

## What the runner does

1. **Prepare:** read current Git files, validate headers, deduplicate by set ID, append only missing literal/RAW rows, then read every submitted row back. Conflicts and duplicate IDs stop the run.
2. **Codex review:** on a separate read-only runner, review bounded proposed targets and evidence flags derived from comparable exercise history. This job has neither Google credentials nor Git write permission. Raw workout notes, dates, session/set IDs and private historical set values are excluded from its prompt and public Actions logs. The synthetic test session is excluded from training history.
3. **Publish:** re-read Git and Sheets, compare prepared session hashes, reject unexpected or out-of-bounds model targets, and use the existing atomic Git finalizer. The plan and acknowledgment are one non-force commit. New arrivals are preserved.

Loads can increase only when two comparable sessions satisfy rep/RIR/consistent-load requirements and an increment is known. Bodyweight/cardio receive no external load. Uncertain loads, mixed weights and low RIR produce conservative holds. These limits are validated in code, not delegated solely to a prompt.

## Failures and recovery

- Missing setup: the configuration job reports that automation is inactive; it does not claim any workout was processed.
- Sheets, Codex or publication failure: workouts remain queued. Verified rows are reused on retry; no successful append is treated as proof of a verified readback.
- Retry through **Run workflow** after correcting access or data conflicts. There is no automatic paid retry loop after a failed Codex run.
- The **Actions** run is the processing status. The site shows pending queue entries until an acknowledgment exists; refresh from Git to load published targets.
- Workout submission commits no longer contain `[skip ci]`, because that suppresses the processing trigger. Processing commits retain it to prevent a loop. Data-only submissions do not rebuild Pages.

## Validation status

Unit tests cover row reuse/conflicts, RAW writes, prompt-data minimization, excluded test history, bounded target validation and submission trigger compatibility. Browser tests cover submission/recovery and published plan loading. A disabled configuration run can be tested without any paid model call or Sheets write. A full live automatic run requires the two secrets and staging share above; do not describe it as verified until that run completes.

References: [Codex GitHub Action](https://learn.chatgpt.com/docs/github-action), [Google service-account authentication](https://developers.google.com/identity/protocols/oauth2/service-account), [Sheets RAW append](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append).
