---
name: create-short
description: Research a short video topic, present concepts and commentary in Creator Desk, refine the user's draft, then produce a video after approval.
---

# Create a short

Work from a topic or source link. Handle setup, research, files and rendering for the user.

- Read README.md for commands and adr/0004-api-costs.md before model requests.
- Check the supplied source and a publisher or other primary source. Keep factual setup separate from interpretation. Avoid unsupported chapter and panel claims.
- Use `sites/creator-desk/app/concepts.json` for the topic, sources, three concepts and two commentary drafts per concept. Keep drafts short enough for the intended duration. The current production adapter supports Homunculus.
- Open the existing private Site listed in `sites/creator-desk/.openai/hosting.json`, or start `npm run desk` and open localhost:4173. Use the available shared browser. Follow Sites instructions when updating the hosted page.
- Read `window.creatorDesk.getDraft()` through browser evaluation to see the user's current selection, edits and notes. Use `window.creatorDesk.revise(changes)` to apply requested revisions. This clears approval. Do not navigate away before reading the current draft; drafts are stored per browser origin.
- Resolve requested edits in the notes, then present the revised draft for review. Do not approve it on the user's behalf. The user approves in the desk or explicitly approves the exact reviewed draft in chat.
- After approval and a request to produce, read `window.creatorDesk.getApprovedBrief()` and save its returned JSON to `out/approved-brief.json`. For explicit chat approval, use the workflow module's `approveDraft` on the exact reviewed draft. A downloaded brief is an optional fallback, not a required user setup step.
- Run `npm run produce -- out/approved-brief.json`. The Homunculus adapter creates original symbolic graphics and a local English scratch voice on Windows. Use `--silent` for a visual-only draft. Premium narration and manga panels need their own source and usage review.
- Inspect frames, audio, captions and the complete export. Report approximate caption timing and any mismatch with the target duration. Return the local MP4 for review. Publishing remains a separate request.

Keep the user's current draft in the browser and production files under ignored `out/` and `public/media/`. Do not spend credit merely to populate the desk when the coding agent can draft the material directly.
