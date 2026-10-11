---
name: create-short
description: Research and refine a short video through a saved review session, compare creative choices and produce a reviewed version when requested.
---

# Create a short

Handle the tools and project files for the user. Keep one session and change one part at a time.

- Open Creator Desk's `session.html`, hosted or through `npm run desk`. Read `window.creatorDesk.getReviewSession()` before changing choices. Save a checkpoint under `out/<topic>/session.json`; preserve existing drafts and image selections.
- Load only the reference needed: [commentary](references/commentary.md), the repo's `source-images` skill, [motion and captions](references/presentation.md), [voice](references/voice.md), or [render history](references/history.md).
- Offer a small set of comparable options. Add optional pickers only on request, with no selected default. Retain other choices. Reset discards pending overrides; save and restore review versions independently of video history.
- Refine the current state rather than rebuilding every example or redeploying for wording changes. Read browser state again after the user changes a picker.
- Picking, versioning or saving a rebuild request does not start production. Review all pending changes together, including image fit and a new recording after commentary edits. Use [production](references/production.md) when the user asks to render. Keep publishing separate.
- Follow ADR 0004 before model requests. Do not spend credit merely to populate pickers or previews.
