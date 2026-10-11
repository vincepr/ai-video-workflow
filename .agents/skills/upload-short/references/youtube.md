# Private YouTube upload

Use only after the user identifies the selected finished video and requests an upload. "Without releasing" means private, with no publication schedule. The helper fixes private visibility, not-made-for-kids status and no subscriber notification; it is intended for this adult manga commentary workflow. Review audience suitability before using it for a different type of video.

The user explicitly requires AI disclosure to be Yes for this workflow. The helper includes `status.containsSyntheticMedia: true` in the initial videos.insert request and records it under requestedStatus in the receipt. This is a status field, not a snippet tag or a description disclaimer. Verify Yes under Studio's Verwendung von KI section. For existing videos, use Studio with the current upload-only authorization; a status API update requires broader OAuth permission. Preserve privacy when making the correction. See [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert).

Read the numbered export's context.md, video.mp4.description.txt, video.mp4.release.json and frozen episode. Build a viewer-facing title, synopsis, author credit, relevant tags and a few hashtags. Preserve required music attribution exactly. Keep private production notes out of the description. Check music restrictions against the requested use; attribution does not establish panel or narration rights.

## Descriptions and search terms

Follow [YouTube's description guidance](https://support.google.com/youtube/answer/12948449): put the main topic and relevant terms in the opening sentence, then give a clear overview matching the actual video. For Homunculus, use Homunculus manga, Hideo Yamamoto, psychological horror and Susumu Nakoshi naturally near the start. Explain the curse of seeing too much, rather than promising a full plot or ending explanation that the Short does not provide. Keep credits below the overview and use only a few relevant hashtags.

Do not add length for its own sake, stuff repeated keywords, or claim search-volume evidence without research. A red outline or generic optimization tip alone does not establish why a field is invalid. Inspect the field's validation message and saved state. Preserve exact music attribution while making revisions, verify the saved text after reload, and record confirmed lessons in the skill and local upload receipt.

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

The WorthyALook channel initially required phone-number verification for custom thumbnails. The user completed it, and a requested API retry successfully installed the corrected Homunculus thumbnail. Channel verification is separate from Google OAuth app verification and test-user consent. If another channel presents this requirement, keep the prepared file and stop for the user's verification before retrying.

Verify thumbnail application at both boundaries: API acceptance and a fresh served image, then Studio's selected thumbnail after reload. For Homunculus, the API/CDN showed the corrected image while Studio still selected an autogenerated frame. Do not claim the editor is fixed from the API response alone. Load the prepared file through Studio's actual thumbnail input and verify the saved selection. Inspect other pending form changes before Save; if visibility differs from the user's request, resolve it rather than committing an unintended visibility change. Image data URLs can exceed preview result limits, so inspect only their prefixes and dimensions.

The Homunculus discrepancy was resolved by loading the same PNG into Studio's file input, saving and checking the editor after reload. If the shared preview lacks a file-upload tool, an observed file input can receive a File through DataTransfer using preview_evaluate, followed by its change event. Transfer local bytes through Node REPL without printing them; keep each evaluate expression below 64,000 characters, for example 45,000-byte base64 chunks. Verify the exact selected file and byte count, then save through the visible UI and inspect the resulting thumbnail. Preserve the user's confirmed visibility choice; this video is now Unlisted at their request.

API references: [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert), [resumable uploads](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol).
