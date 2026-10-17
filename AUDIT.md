# Prototype audit

- The page only appended date-scoped sets; repeating a workout on the same date merged sessions. It lacked completion, approval and persistent next-session targets. The pure progression engine was disconnected from the page.
- Storage parsing errors were swallowed; failed writes were not surfaced. No session ID or application-level retry protection was used by the UI. No offline app-shell service worker existed, and the manifest had no icons.
- The server routes required Google credentials and a bearer token the UI never supplied. They did not provide a usable end-to-end flow. The staging duplicate check was a non-atomic read then append, unsafe under simultaneous retries.
- No lockfile or browser flow tests were provided. The existing verification script only rewrote historical decision JSON; it did not exercise workout logging or reopening the app. Historical validation files must not be treated as live verification.
- CSV inspection: 328 exercise prescriptions, 48 days, 8 weeks. Raw load text and notes are important (per-hand vs total, unknown loads). Automated reconciliation checks every source row for exact name/load text/notes/set count. The existing parsed program is retained.
- Source includes health history in data JSON. A repository containing those files must remain private or have those files removed before publication. They are not imported into the frontend and are not copied into the static export.

## Chosen change

Retain React/Next.js as a static exporter; remove unused Google API routes and dependencies. Use browser-local atomic snapshots, UUIDs, explicit completion and approval, a shared deterministic progression engine, a generated offline cache and backup export. Google Apps Script is deferred because the requested local workflow needs no sync. The Daily Health Data workbook has not been accessed or modified.

## Follow-up reliability review

The first slice also lost equipment increments on reload, changed the original rep range when raising the rep goal, offered no backup restore, and had no explicit reviewed-load approval path. These are corrected in the current slice and covered by runtime and browser tests. Mobile icons/metadata and mobile WebKit coverage were added. This does not constitute deployment, full historical migration or physical iPhone verification.
