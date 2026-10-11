# Private YouTube upload

Use only after the user identifies the selected finished video and requests an upload. "Without releasing" means private, with no publication schedule. The helper fixes private visibility, not-made-for-kids status and no subscriber notification; it is intended for this adult manga commentary workflow. Review audience suitability before using it for a different type of video.

Read the numbered export's context.md, video.mp4.description.txt, video.mp4.release.json and frozen episode. Build a viewer-facing title, synopsis, author credit, relevant tags and a few hashtags. Preserve required music attribution exactly. Keep private production notes out of the description. Check music restrictions against the requested use; attribution does not establish panel or narration rights.

Save snippet metadata as `projects/<id>/work/uploads/<iteration>-youtube.metadata.json`: title, description, tags, categoryId, defaultLanguage and optional defaultAudioLanguage. English entertainment commentary currently uses categoryId `24` and language `en`; choose values for the actual content.

Run from the repository root:

```sh
node scripts/youtube-auth.mjs status
node scripts/youtube-upload.mjs upload-private projects/<id>/videos/<iteration>/video.mp4 projects/<id>/work/uploads/<iteration>-youtube.metadata.json projects/<id>/work/uploads/<iteration>-youtube.receipt.json
```

Missing account consent requires `node scripts/youtube-auth.mjs connect`. The uploader refreshes an expired access token once; failed refresh requires reconnection. Credentials remain under ignored credentials/youtube/. Never print token files.

The command checks project paths, Git exclusion and required music credit before uploading. It creates the receipt exclusively, hashes the exact MP4 and uses a resumable session. A receipt blocks a second upload attempt. It saves the returned video ID, channel ID, metadata, visibility and upload status. There is no automatic transfer retry or publication command.

If transfer fails, keep the receipt and its sessionUrl local. Inspect that session before any retry: an empty PUT with `Content-Range: bytes */<file-size>` and `Content-Length: 0` can return the completed video or a `308` with the received byte range. Do not start a new `videos.insert` while completion is uncertain. Session URLs must not be printed or committed.

Confirm the API returned private visibility and the intended metadata. Use the returned ID to inspect YouTube Studio processing and copyright checks in the signed-in preview if available. `uploadStatus: uploaded` means transfer accepted, not finished processing or cleared copyright. Upload-only OAuth cannot list channels, so trust the account/channel explicitly selected by the user at consent and save the returned channel ID.

Save concrete upload details in the project receipt. Maintain a short skill reference when the user requests durable recall of a particular upload, but keep credentials, session URLs, media and the raw receipt out of Git. Do not rewrite immutable render snapshots.

API references: [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert), [resumable uploads](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol).
