---
name: create-short
description: Research and refine a short video through a saved review session, compare creative choices and produce a reviewed version when requested.
---

# Create a short

Handle the tools and project files for the user. Keep one session and change one part at a time.

- Open Creator Desk's `session.html`, hosted or through `npm run desk`. Read `window.creatorDesk.getReviewSession()` before changing choices. Save a checkpoint under `out/<topic>/session.json`; preserve existing drafts and image selections.
- Load only the reference needed: [commentary](references/commentary.md), the repo's `source-images` skill, [motion and captions](references/presentation.md), [voice](references/voice.md), or [render history](references/history.md).
- Offer a small set of comparable options. Explain scene fit or meaningful tradeoffs. Let the user select, reorder or revise; retain other choices. Add a comparison tab when a new choice needs its own options.
- Refine the current state rather than rebuilding every example or redeploying for wording changes. Read browser state again after the user changes a picker.
- Picking or saving does not start production. Get review of the exact script and settings, then use [production](references/production.md) when the user asks to render. Keep publishing separate.
- Follow ADR 0004 before model requests. Do not spend credit merely to populate pickers or previews.
