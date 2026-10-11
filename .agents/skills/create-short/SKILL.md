---
name: create-short
description: Research and refine a short video through a saved review session, compare creative choices and produce a reviewed version when requested.
---

# Create a short

Handle the tools and project files for the user. Keep one session and change one part at a time.

- Start `npm run desk` if needed and open `http://localhost:4173/`. Keep review local; do not deploy the desk. Read `window.creatorDesk.getReviewSession()` before changing choices. Save a checkpoint under `out/<topic>/session.json`; preserve existing drafts and image selections.
- For a T3 delivery, the frozen request state is authoritative. The working draft may have newer edits; do not replace them with the delivered version.
- Load only the reference needed: [commentary](references/commentary.md), the repo's `source-images` skill, [motion and captions](references/presentation.md), [voice](references/voice.md), or [render history](references/history.md).
- Offer a small set of comparable options. Add optional pickers only on request, with no selected default. Retain other choices. Reset discards pending overrides; save and restore review versions independently of video history.
- Refine the current state rather than rebuilding every example. Read browser state again after the user changes a picker.
- Save alone does not request production. Save & send to T3 sends an explicit request to the connected thread. Read its frozen request file; review dependencies, image fit and recording after commentary edits. Use [production](references/production.md) for production and [T3 connection](references/t3.md) only for pairing or delivery issues. Keep publishing separate.
- Follow ADR 0004 before model requests. Do not spend credit merely to populate pickers or previews.
