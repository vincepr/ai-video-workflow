# 0007: Keep review choices and render history together

Status: Accepted
Date: 2026-10-11

## Decision

Use `create-short` as the shared workflow. Keep picker details in short references and load only the relevant one. Iterate by reading current choices, offering options, revising one picker and saving a checkpoint before production.

Use a session page with tabs for commentary, images, motion, captions, voice and videos. Extra comparisons can be added as named tabs with options and notes. Preserve choices across reloads. Image arrangement changes image placement, not narration order.

Browser previews demonstrate style without rendering. Verify that production implements the reviewed settings; a saved preference is not proof that a renderer used it. Word captions require timings from the selected recording.

Keep the hosted desk static. The local desk saves `out/<session>/session.json`, serves registered videos and checks file availability. Keep media local and ignored. Hosted history cannot check local deletions and must say so.

After successful rendering, save an immutable record under `out/render-history/<session>/` with the episode, supplied picker snapshot, renderer identity and file fingerprint. Later picker edits never change that record. Deleted or replaced videos remain listed and greyed out. Older imports retain their episode data without inventing missing picker state.

## Reason

One review loop avoids separate workflows for every creative choice. Saved render state makes comparisons understandable after the session changes.

## Validation

Check tab and choice persistence, added comparisons, image enlargement and unchanged narration after rearrangement. Verify file deletion and replacement status, range playback and snapshot immutability. Confirm the hosted page distinguishes local-only files from deleted files. Inspect effective render settings before production.
