# 0007: Keep review choices and render history together

Status: Accepted
Date: 2026-10-11

## Decision

Use `create-short` as the shared workflow. Keep picker details in short references and load only the relevant one. Iterate by reading current choices, offering options, revising one picker and saving a checkpoint before production.

Videos comes first and has a distinct style. Commentary and images form the core review. Add optional pickers only on request, with no initial choice. Grey placeholders may advertise inactive pickers; they have no effect on production. Reset an optional picker to no override, or a core picker to its applied state.

Compare draft choices with the last applied state and show changes per tab. Commentary changes flag images and voice for review. A global rebuild request freezes all pending choices together. Saving never marks it applied. Mark applied only after inspecting the matching rendered video.

Save review versions as independent copies of draft state. Restore a version without replacing the applied baseline or video history. Preserve the working draft before restoring. Video records contain their own snapshots and do not depend on review versions. Image arrangement changes image placement, not narration order.

Put global Save and Save & send to T3 actions left of Videos in the sticky tab bar. Both create a full review version; only the second dispatches a frozen request to T3. Show reset icons beside tab labels only when that tab has pending changes. Hide them once the matching render is applied. No picker-specific save or export buttons. Autosave updates the working draft without adding versions. Version restoration remains separate from production. See ADR 0008 for delivery.

Browser previews demonstrate style without rendering. Verify that production implements the reviewed settings; a saved preference is not proof that a renderer used it. Word captions require timings from the selected recording.

Use the local desk at localhost:4173 for review. It saves `out/<session>/session.json`, serves registered videos and checks file availability. Keep media and versions local and ignored. Stop deploying desk updates; the previous hosted copy is outside the workflow.

After successful rendering, save an immutable record under `out/render-history/<session>/` with the episode, supplied picker snapshot, renderer identity and file fingerprint. Later picker edits never change that record. Deleted or replaced videos remain listed and greyed out. Older imports retain their episode data without inventing missing picker state.

## Reason

Initialize the embedded image picker from session choices before reading it, including when its load completes before the parent module. Older image storage must not replace a saved request or restored version.

One review loop avoids separate workflows for every creative choice. Saved render state makes comparisons understandable after the session changes.

## Validation

Check that the local root opens the session and the skill starts it without deployment. Check inactive defaults, change and dependency indicators, reset, rebuild snapshots, version restoration and unchanged video history. Check choice persistence, added comparisons, image enlargement and unchanged narration after rearrangement. Verify deletion, replacement, range playback and snapshot immutability. Inspect effective render settings before production.
