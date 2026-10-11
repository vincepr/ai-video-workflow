---
name: upload-short
description: Set up upload access or upload a selected finished video to the account and platform the user explicitly names.
---

# Upload a selected short

Use this skill when explicitly requested. Account setup does not authorize uploading. A render or an approved creative draft does not authorize publishing.

- For API setup or reconnection, read [setup](references/setup.md). Store all client credentials and tokens under ignored `credentials/`; never print secrets or commit them.
- Before an upload, establish the exact local MP4, destination account/channel, title, description and visibility from the user's request. Ask only for missing choices. Carry required credits from the adjacent `.description.txt` and `.release.json`; do not change source media or render history.
- YouTube uses the Data API `videos.insert` with OAuth `youtube.upload`. The connection helper is `node scripts/youtube-auth.mjs connect`; `status` reports file presence only. It does not implement uploading. A missing uploader is work to implement and validate before making a live request; never claim connection means an upload was tested.
- Use the account/channel selected at OAuth consent. If its identity is uncertain, resolve it before uploading. Upload-only OAuth cannot list channels; additional read permission requires a separate connection request.
- Set the requested visibility explicitly. Check current [upload documentation](https://developers.google.com/youtube/v3/docs/videos/insert) for project restrictions. Vertical or square videos up to three minutes can qualify as Shorts; there is no separate Shorts upload endpoint.
- TikTok's [app review rules](https://developers.tiktok.com/docs/en/app-review-guidelines) exclude personal/private apps. Do not promise production access for this personal workflow. If an eligible approved app becomes available, use `video.upload` for transfer followed by review and posting in TikTok. Direct posting is a separate capability with its own approval and rules.
- Work in the selected video's project. Keep receipts under ignored `projects/<id>/work/uploads/`. After a network failure, inspect upload status before retrying so the same video is not posted twice. Report the video ID, URL, visibility and processing status; distinguish accepted upload from completed processing.
