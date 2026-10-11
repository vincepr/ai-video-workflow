# 0008: Send saved requests through the local T3 server

Status: Accepted
Date: 2026-10-11

## Decision

Pair Creator Desk as a standard T3 client through the installed T3 CLI and browser-session exchange. Store the client cookie, local origin and selected thread in ignored credentials/t3/<project-id>.json. Keep credentials server-side and dispatch only to that project's configured thread on a loopback HTTP origin. See ADR 0012.

Save creates a version without contacting T3. Save & send to T3 saves the version and request before dispatching `thread.turn.start` through `/api/orchestration/dispatch`. This is an explicit request to process the saved changes. Do not send automatically on edits, tab changes or reloads.

Write a frozen request and exact dispatch command under projects/<id>/work/requests/. Use the request ID as the command ID. Keep an accepted delivery receipt; concurrent or repeated sends reuse it. An unconfirmed send keeps its command for an explicit retry. Never retry in a loop or claim successful delivery before T3 returns its sequence receipt.

An accepted dispatch starts or steers the connected thread; it does not prove that a video has finished. The agent reads the frozen request file and checks dependencies, assets and narration before production. Keep the applied baseline unchanged until the matching render is inspected.

## Validation

Check that Save never dispatches, and Save & send saves before dispatch. Verify the target thread, receipt, duplicate suppression, identical timeout retries, error feedback and credential exclusion. Reject cross-origin sends and nonlocal T3 origins. Use a bounded diagnostic for the live connection without rendering or paid provider requests.
