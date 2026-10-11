---
name: create-short
description: Research a short video topic, present concepts and commentary in Creator Desk, refine the user's draft, then produce a video after approval.
---

# Create a short

Work from a topic or source link. Handle setup, research, files and rendering for the user.

- Read README.md for commands and adr/0004-api-costs.md before model requests.
- Research the relevant plot arc beyond the opening synopsis: character motives, turning points, relationships and consequences. Check scene candidates against the work or a detailed, reliable account. Publisher blurbs establish the premise, not the full story.
- Save compact evidence notes under `out/<topic>/research.json`: source links, supported scenes, spoiler boundaries, interpretations and gaps. Reuse these notes across revisions. Label user-supplied scene details as such until verified. Respect requests to skip further research.
- Derive a short editorial brief from the conversation: central idea, viewpoint, tone, spoiler limit, opening, ending and duration. Use character-centered third person unless the user requests another perspective. Match visual beats to the character's journey.
- Use `sites/creator-desk/app/concepts.json` for the topic, sources, three concepts and two commentary drafts per concept. Keep drafts short enough for the intended duration. The current production adapter supports Homunculus.
- Open the existing private Site listed in `sites/creator-desk/.openai/hosting.json`, or start `npm run desk` and open localhost:4173. Use the available shared browser. Follow Sites instructions when updating the hosted page.
- Read `window.creatorDesk.getDraft()` through browser evaluation to see the user's current selection, edits and notes. Use `window.creatorDesk.revise(changes)` to apply requested revisions. This clears approval. Do not navigate away before reading the current draft; drafts are stored per browser origin.
- Once an angle is selected, refine that draft rather than regenerating all options. Patch browser state and save a checkpoint under `out/<topic>/draft.json`. Draft-only edits do not require rebuilding or deploying the Site. Change published examples only when requested.
- Resolve requested edits in the notes, then present the revised draft for review. Do not approve it on the user's behalf. The user approves in the desk or explicitly approves the exact reviewed draft in chat.
- After approval and a request to produce, read `window.creatorDesk.getApprovedBrief()` and save its returned JSON to `out/approved-brief.json`. For explicit chat approval, use the workflow module's `approveDraft` on the exact reviewed draft. A downloaded brief is an optional fallback, not a required user setup step.
- Use the repo's `source-images` skill for manga panels and other web images. Match real assets to the approved visual beats. Keep speech bubbles for the first draft; clean them only when requested. Missing scenes are gaps to report, not permission to replace the artwork.
- Run `npm run produce -- out/approved-brief.json --assets out/<topic>/images.json`. The Homunculus adapter uses selected images and a local English scratch voice on Windows. Use `--silent` for a visual-only draft. `--symbolic` is an explicit smoke-test option.
- Inspect frames, audio, captions and the complete export. Report approximate caption timing and any mismatch with the target duration. Return the local MP4 for review. Publishing remains a separate request.

Keep the user's current draft in the browser and production files under ignored `out/` and `public/media/`. Do not spend credit merely to populate the desk when the coding agent can draft the material directly.
