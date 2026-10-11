# Upload API setup

Run from the repository root. The existing `.gitignore` excludes `credentials/` and `.env*`. Client files and tokens are local plaintext; Git exclusion does not encrypt them. Do not print their contents.

## YouTube

1. In [Google Cloud](https://console.cloud.google.com/), create a project named `Video Workflow`. Enable **YouTube Data API v3**. Billing and a paid trial are not needed for this setup.
2. In **Google Auth Platform**, configure branding as `Video Workflow`, using the signed-in user's support/contact email. Choose **External** audience and keep **Testing** for initial connection. Add that user's email as a test user, commit the email chip and save. Verify it appears in the saved audience table before starting OAuth; an empty list causes `403 access_denied`.
3. Add `https://www.googleapis.com/auth/youtube.upload` under **Data Access**. Create an OAuth client of type **Desktop app**, named `Video Workflow local`. Download its JSON directly to `credentials/youtube/client.json`. An API key or service account is not enough for a personal channel upload.
4. Run `node scripts/youtube-auth.mjs status`, then `node scripts/youtube-auth.mjs connect`. Open the emitted URL in the shared preview and stop for the user to select the intended account/channel and grant access. If Google rejects the embedded browser, give the user the URL for their system browser. Restart the helper if its five-minute window expires.
5. The helper binds only to `127.0.0.1`, checks OAuth state, uses PKCE, times out after five minutes and saves tokens to `credentials/youtube/token.json`. It performs no video upload. It never logs token responses and does not retry token exchange.
6. Verify `git check-ignore credentials/youtube/client.json credentials/youtube/token.json`. Confirm neither path appears in `git ls-files`. Presence alone is not a live access test.

External apps in Testing can have short-lived refresh tokens, commonly seven days for these scopes. Reconnect if the token expires. Moving OAuth consent to Production and a YouTube API compliance audit are separate steps; do not treat them as equivalent. Google's upload reference and older resource documentation disagree about unverified-project privacy restrictions as checked on 2026-10-11. Verify the actual project behavior before promising public API posts.

OAuth flow: [Google desktop documentation](https://developers.google.com/identity/protocols/oauth2/native-app). Upload endpoint: [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert).

## TikTok

Production access is blocked for a personal/private app under the current [app review rules](https://developers.tiktok.com/docs/en/app-review-guidelines). Do not submit a misleading public-app description or deploy a website merely to bypass this requirement.

If the user has an eligible public app or an existing approved integration, register it at [TikTok for Developers](https://developers.tiktok.com/), add Content Posting API and request `video.upload`. Both app scope approval and the user's OAuth authorization are required. Keep its client and tokens under `credentials/tiktok/`. Do not fabricate credentials before approval.

The [upload flow](https://developers.tiktok.com/docs/en/content-posting-api-get-started-upload-content) transfers a local video with `FILE_UPLOAD`; the user opens the resulting inbox notification to review and finish posting in TikTok. This avoids needing public media hosting. It still requires app approval. Sandbox experiments are tests and do not establish production eligibility.
