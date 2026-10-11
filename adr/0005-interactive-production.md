# 0005: Refine a draft before production

Status: Accepted
Date: 2026-10-11

## Decision

Use Creator Desk to select a video concept, compare two commentary drafts and refine the script with the agent. Keep the workflow skill in `.agents/skills/create-short/`. The user supplies a topic; the agent handles research, project files and rendering.

Research the relevant plot arc before proposing concepts. A publisher synopsis alone is insufficient for scene or character analysis. Keep source evidence, interpretation and unverified user notes distinct in a compact local research record. Reuse it across revisions.

Store drafts in browser storage, with separate drafts per concept and commentary option. The static private Site has no API key and makes no model requests. The agent reads the current draft through the shared browser. Downloads are an optional fallback. Drafts do not sync across devices or origins.

Refine the selected angle using local browser draft updates and checkpoints. Do not rewrite the page, regenerate every option or reread all research for each wording change. ADR 0007 replaces hosted review with the local desk.

Require approval of the exact draft before production. Changes to the draft clear approval. Validate the approval snapshot again in the production command. Approval in the desk does not start a background render; the agent starts production when asked.

Use actual source panels for manga commentary through `.agents/skills/source-images/`. Report missing scenes rather than substituting artwork. Original symbolic graphics require an explicit smoke-test option. Keep speech bubbles in the first draft; cleanup is optional and preserves originals. Use a free local English scratch voice. Derive duration from narration; captions initially use approximate timing.

Review images in Creator Desk with three candidates per visual beat and source, language and scene-fit notes. Save choices separately from the script. Reordering moves images over the unchanged narration; review the new pairing before production. Picking or saving images does not render a video.

## Reason

An interactive review makes editorial decisions visible before generating media or spending credit. Keeping review and rendering local gives the desk access to saved state and media.

## Validation

Tests reject unapproved or edited briefs, missing source images and invalid media paths. Confirm selected panels and camera paths survive production. Browser checks cover selection, editing, persistence and approval. Check the exported video and audio metadata.

Before proposing concepts, review plot coverage and scene support. During refinement, check that the selected draft and visual beats follow the editorial brief and that existing research is reused.

Check image selection persistence and reordering without changing commentary order. Inspect candidate images and disclose missing literal scene matches.
