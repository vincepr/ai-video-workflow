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

## Title and thumbnail revisions

When requested, research comparable titles and propose a hook that the selected commentary supports. For Homunculus, the user's preference is the curse of seeing too much, rather than a generic descent-into-madness label. Update an existing video through Studio; upload-only OAuth does not grant videos.update. Verify the saved title after reload and preserve privacy.

Keep revised metadata and a dated revision in the project's upload records, preserving the original API upload response. Save thumbnail files and attribution under project media/thumbnails/. For a source-panel edit, inspect the actual panel and preserve the character, pose and source artwork; use the imagegen skill for raster editing.

Current [YouTube thumbnail guidance](https://support.google.com/youtube/answer/72431?hl=en) supports custom Shorts thumbnails in desktop Studio for verified accounts, recommends 9:16 and allows desktop files up to 50 MB. Recheck the live guidance rather than repeating older mobile-frame-only rules. `setThumbnail` in scripts/youtube-upload.mjs uses the existing upload scope; a 403 stops the API attempt. It does not establish whether verification, Shorts access or another permission caused rejection. Inspect Studio for the next action and stop if the user needs to verify or choose a file.

For the current WorthyALook channel, Studio explicitly requires phone-number verification before custom thumbnails can be added. This is separate from Google OAuth app verification and test-user consent. Editing the local image does not require it; applying that image to YouTube does. Keep the prepared file and stop for the user's verification instead of repeating the rejected API request.

API references: [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert), [resumable uploads](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol).
