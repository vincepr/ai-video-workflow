# 0005: Refine a draft before production

Status: Accepted
Date: 2026-10-11

## Decision

Use Creator Desk to select a video concept, compare two commentary drafts and refine the script with the agent. Keep the workflow skill in `.agents/skills/create-short/`. The user supplies a topic; the agent handles research, project files and rendering.

Research the relevant plot arc before proposing concepts. A publisher synopsis alone is insufficient for scene or character analysis. Keep source evidence, interpretation and unverified user notes distinct in a compact local research record. Reuse it across revisions.

Store drafts in browser storage, with separate drafts per concept and commentary option. The static private Site has no API key and makes no model requests. The agent reads the current draft through the shared browser. Downloads are an optional fallback. Drafts do not sync across devices or origins.

Refine the selected angle using browser draft updates and local checkpoints. Deployments are for Site changes or requested updates to published examples. Do not rewrite the page, regenerate every option or reread all research for each wording change.

Require approval of the exact draft before production. Changes to the draft clear approval. Validate the approval snapshot again in the production command. Approval in the desk does not start a background render; the agent starts production when asked.

Start Homunculus with original symbolic graphics and a free local English scratch voice. Treat visual previews as directions, not actual manga panels or finished videos. Derive final duration from narration; captions initially use approximate timing.

## Reason

An interactive review makes editorial decisions visible before generating media or spending credit. The local renderer can remain simple while the desk is hosted privately.

## Validation

Tests reject unapproved or edited briefs and invalid media paths. Browser checks cover selection, editing, persistence and approval. Run a synthetic production smoke test before handing off the workflow. Check the exported video and audio metadata.

Before proposing concepts, review plot coverage and scene support. During refinement, check that the selected draft and visual beats follow the editorial brief and that existing research is reused.
