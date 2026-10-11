---
name: upload-short
description: Set up upload access or upload a selected finished video to the account and platform the user explicitly names.
---

# Upload a selected short

Use this skill when explicitly requested. Account setup does not authorize uploading. A render or an approved creative draft does not authorize publishing.

- For API setup or reconnection, read [setup](references/setup.md). Store all client credentials and tokens under ignored `credentials/`; never print secrets or commit them.
- Before an upload, read adjacent `context.md`, `.description.txt` and `.release.json`. Use the saved synopsis and exact required credits; private handoff notes stay out of the public description. Establish the exact MP4, destination account/channel, title, description and visibility from the user's request. Ask only for missing choices; do not change source media or render history.
- For a private YouTube upload, read [YouTube upload](references/youtube.md) and use `scripts/youtube-upload.mjs`. The helper preserves credits, refreshes expired tokens and saves a resumable session and receipt. It supports private uploads only; releasing a video requires a separate explicit request.
- Use the account/channel selected at OAuth consent. If its identity is uncertain, resolve it before uploading. Upload-only OAuth cannot list channels; additional read permission requires a separate connection request.
- Set the requested visibility explicitly. Check current [upload documentation](https://developers.google.com/youtube/v3/docs/videos/insert) for project restrictions. Vertical or square videos up to three minutes can qualify as Shorts; there is no separate Shorts upload endpoint.
- TikTok's [app review rules](https://developers.tiktok.com/docs/en/app-review-guidelines) exclude personal/private apps. Do not promise production access for this personal workflow. If an eligible approved app becomes available, use `video.upload` for transfer followed by review and posting in TikTok. Direct posting is a separate capability with its own approval and rules.
- Work in the selected video's project. Keep receipts under ignored `projects/<id>/work/uploads/`. After a network failure, inspect upload status before retrying so the same video is not posted twice. Report the video ID, URL, visibility and processing status; distinguish accepted upload from completed processing.
- When sign-in or another user action is needed, open the relevant page in the shared preview and stop the turn. Leave that page intact while the user interacts. Do not navigate away from a one-time credential dialog before its secret has been saved locally.
- The selected Homunculus upload is recorded in [000010 metadata](references/homunculus-000010.md). This record does not authorize another upload or a change in visibility.
