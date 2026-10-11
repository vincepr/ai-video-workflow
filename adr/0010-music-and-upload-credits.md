# 0010: Keep music settings and credits with each render

Status: Accepted
Date: 2026-10-11

## Decision

Background music is an optional episode layer with a local audio path, volume, title, artist, source, license notes and exact attribution. Keep narration separate. Fade music over the first second and last two seconds using frame timing.

Store reusable assets under ignored media/, using media/music/ for songs. Pair every asset with a same-basename .attribution.json file containing title, creator, source, license or permission basis, restrictions, attribution requirement, placement and exact credit. Unknown rights stay unknown. Never commit the asset or its sidecar. Read the sidecar before reuse and copy its credits into the render record and upload description.

Record the effective music settings in the immutable video snapshot. Save the exact upload credit in the history record and beside the MP4 as .description.txt and .release.json. Show and download it from Videos. Keep credits available when media is deleted.

Store exports and credit sidecars together in numbered project video folders. ADR 0012 replaces the earlier final/ copy convention. Keep the applied choice in review state and preserve render history.

An arbitrary comparison tab is a review note, not an audio implementation. Never imply that a named choice adds music without an actual track and render settings. Keep source recordings local and do not publish or buy licenses without a request.

## Validation

Reject remote audio, invalid volume and missing attribution. Check fades, narration intelligibility and the complete audio stream. Verify that each comparison has its own credits and that sidecars and history agree after file deletion. Compare identical video frames when only audio changes.

Check that each library asset has its sidecar, credits match the source and git check-ignore excludes both. Confirm copied media hashes match their originals. Only usage instructions belong in Git.
