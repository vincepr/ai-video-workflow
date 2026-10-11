# 0007: Keep review choices and render history together

Status: Accepted
Date: 2026-10-11

## Decision

Use `create-short` as the shared workflow. Keep picker details in short references and load only the relevant one. Iterate by reading current choices, offering options, revising one picker and saving a checkpoint before production.

Videos comes first and has a distinct style. Commentary and images form the core review. Add optional pickers only on request, with no initial choice. Grey placeholders may advertise inactive pickers; they have no effect on production. Reset an optional picker to no override, or a core picker to its applied state.

Compare draft choices with the last applied state and show changes per tab. Commentary changes flag images and voice for review. A global rebuild request freezes all pending choices together. Saving a request never marks it applied or starts an agent turn. Mark applied only after inspecting the matching rendered video.

Save review versions as independent copies of draft state. Restore a version without replacing the applied baseline or video history. Preserve the working draft before restoring. Video records contain their own snapshots and do not depend on review versions. Image arrangement changes image placement, not narration order.

Browser previews demonstrate style without rendering. Verify that production implements the reviewed settings; a saved preference is not proof that a renderer used it. Word captions require timings from the selected recording.

Keep the hosted desk static. The local desk saves `out/<session>/session.json`, serves registered videos and checks file availability. Keep media local and ignored. Hosted history cannot check local deletions and must say so.

After successful rendering, save an immutable record under `out/render-history/<session>/` with the episode, supplied picker snapshot, renderer identity and file fingerprint. Later picker edits never change that record. Deleted or replaced videos remain listed and greyed out. Older imports retain their episode data without inventing missing picker state.

## Reason

One review loop avoids separate workflows for every creative choice. Saved render state makes comparisons understandable after the session changes.

## Validation

Check inactive defaults, change and dependency indicators, reset, rebuild snapshots, version restoration and unchanged video history. Check choice persistence, added comparisons, image enlargement and unchanged narration after rearrangement. Verify deletion, replacement, range playback and snapshot immutability. Confirm the hosted page distinguishes local-only files. Inspect effective render settings before production.
