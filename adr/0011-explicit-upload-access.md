# 0011: Connect upload accounts locally

Status: Accepted
Date: 2026-10-11

## Decision

Use an explicit-only upload-short skill. Each upload request identifies a finished video, platform, destination account, metadata and visibility. Account setup and rendering do not authorize uploading.

Store provider client credentials and OAuth tokens under ignored credentials/. Reuse the existing exclusion rather than adding secrets to environment examples. Keep upload receipts under ignored projects/<id>/work/uploads/ as defined in ADR 0012 and carry the render's attribution sidecars into upload metadata.

Start with YouTube desktop OAuth and upload-only permission. The local connection helper uses loopback, state and PKCE; it performs no uploads, hides token responses, applies a timeout and does not retry. It checks Git exclusion before using credentials. No provider SDK is needed for connection.

TikTok production review excludes personal/private apps, so production access for this personal skill is not promised. An eligible approved app is required even for upload followed by manual completion in TikTok. Do not build or publish a public app to evade review.

## Validation

Run npm run check. Test OAuth state rejection, PKCE, token exchange, a local callback and credential status without real provider requests. Verify git check-ignore and git ls-files for credential paths. A real Google consent flow remains necessary to validate account connection; uploading requires a separate explicit request.
