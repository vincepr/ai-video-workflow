# 0014: Upload selected videos privately with a receipt

Status: Accepted
Date: 2026-10-12

## Decision

Support explicitly requested private YouTube uploads through a local resumable helper. Keep metadata and receipts in the selected project's ignored work/uploads/ folder. Preserve the selected export and its release sidecars. Public release remains a separate user request.

Set privacyStatus to private, omit publishAt and disable subscriber notification. For the current adult manga commentary, set not-made-for-kids. Carry the exact music credit into the description. Save the uploaded file hash and returned metadata, video ID, channel ID, visibility and transfer status.

The user requires AI disclosure to be Yes for this workflow. Include status.containsSyntheticMedia: true in the initial API request, record the requested status in the receipt and verify the saved Studio setting. Do not leave disclosure unspecified.

Create each receipt exclusively before requesting an upload session. Keep session URLs local. An existing receipt prevents another upload, and transfer failures stop without retrying. Inspect the existing session before any recovery so uncertain completion cannot create duplicate videos.

Use the user's OAuth-selected channel and upload-only scope. Refresh expired access tokens once with local credentials; reconnect on failure. Do not add SDK dependencies for this workflow.

Update the upload skill with reusable steps and any concrete metadata the user requests it to remember. Stop the turn when the user needs to sign in, leaving the shared preview intact.

For requested title or thumbnail revisions, retain the original upload response and add dated local revision records. Keep thumbnail files and source attribution in project media/. Verify title changes in Studio; thumbnail API failures stop without retrying. Neither operation releases the private video.

## Validation

Run npm run check. Test private metadata, exact file bytes, exclusive receipts, trusted session hosts, transfer failures and token refresh without real uploads. For an authorized upload, confirm private visibility and returned metadata, preserve its receipt, verify the MP4 hash is unchanged and inspect processing in YouTube Studio when available. Check credential and receipt Git exclusion before committing.
