# 0013: Keep upload context with finished videos

Status: Accepted
Date: 2026-10-11

## Decision

Before handing off a finished version, the production agent saves context.md beside video.mp4. Summarize the topic, final commentary, reviewed creative choices, recording and media paths, rights notes and unresolved upload choices. Use the iteration's frozen episode and props rather than current project settings. Keep the summary concise and local; no separate model request is needed.

Add a short viewer-facing synopsis under About this video in video.mp4.description.txt, followed by exact required attribution. Store the same description in video.mp4.release.json and the render history's release metadata. Preserve episode, picker and renderer snapshots. Keep private production notes out of the public description.

The upload workflow reads these adjacent files before preparing metadata. Missing context can be reconstructed from the frozen files, with unknown details marked unknown. A summary does not authorize uploading or establish media permissions. All handoff files remain in the ignored iteration folder.

## Validation

Check that context describes the selected iteration, referenced assets exist and the public synopsis matches its narration. Compare description text with release and history metadata; required credits must remain verbatim. Verify Git exclusion, unchanged MP4 hash and unchanged render snapshots. Run npm run check after changing instructions.
