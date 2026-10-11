# 0012: Separate video projects and numbered iterations

Status: Accepted
Date: 2026-10-11

## Decision

One video project lives in projects/<id>/. Track project.json, research, commentary, catalogs, source records and episode settings. Ignore its media/, work/ and videos/ trees. work/ holds review state, frozen requests, history, reservations and temporary files.

Each production run reserves videos/<six-digit-id>-<title>/ atomically. Store video.mp4, frozen episode settings, picker snapshot and credit sidecars there. Numbers increase per project and are never reused, even when an export is deleted. Failed runs can leave gaps. Keep reservation records in work/iteration-ids/. The latest successful export appears first in Videos; label the applied choice separately. No final/ copy is needed.

Shared reusable media lives in ignored media/{music,sfx,images,fonts,brand}/ with same-basename attribution sidecars. Copy library assets into project media so later library edits cannot change an existing project's inputs. Existing channel PNGs at the root remain the two explicitly approved tracked branding files.

Shared code lives in src/, scripts/ and desk/. Project work changes only its own data and local assets. Assign different project IDs to parallel agents; do not have them edit the same episode or review state. Multiple renders can run concurrently with separate numbered folders and frozen props. Shared code changes require their own scope and regression checks. Commit only files owned by the completed task.

Route review, catalogs, media and history by project ID. Store the T3 destination in credentials/t3/<id>.json; never fall back to another project's thread. A render rejects another project's session, output path or media. Legacy CLI output remains supported only for the standalone sample and old tests.

Keep old snapshots intact during migration. Archive old scratch files under project work/legacy/ and record each old export path in its relocated history record. Verify video hashes after moving them.

## Validation

Run npm run check. Test simultaneous iteration reservations, deleted exports, two concurrent projects, catalog and session isolation, media boundaries, output overwrite rejection and separate T3 destinations. Render and inspect the sample. Check existing playback, deleted history and the applied state after migration. Use npm run files to inspect tracked boundaries; source media, review state, credentials and exports must remain excluded.
