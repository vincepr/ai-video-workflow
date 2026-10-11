# 0010: Keep music settings and credits with each render

Status: Accepted
Date: 2026-10-11

## Decision

Background music is an optional episode layer with a local audio path, volume, title, artist, source, license notes and exact attribution. Keep narration separate. Fade music over the first second and last two seconds using frame timing.

Record the effective music settings in the immutable video snapshot. Save the exact upload credit in the history record and beside the MP4 as .description.txt and .release.json. Show and download it from Videos. Keep credits available when media is deleted.

An arbitrary comparison tab is a review note, not an audio implementation. Never imply that a named choice adds music without an actual track and render settings. Keep source recordings local and do not publish or buy licenses without a request.

## Validation

Reject remote audio, invalid volume and missing attribution. Check fades, narration intelligibility and the complete audio stream. Verify that each comparison has its own credits and that sidecars and history agree after file deletion. Compare identical video frames when only audio changes.
