# 0005: Refine a draft before production

Status: Accepted
Date: 2026-10-11

## Decision

Use Creator Desk to select a video concept, compare two commentary drafts and refine the script with the agent. Keep the workflow skill in `.agents/skills/create-short/`. The user supplies a topic; the agent handles research, project files and rendering.

Store drafts in browser storage, with separate drafts per concept and commentary option. The static private Site has no API key and makes no model requests. The agent reads the current draft through the shared browser. Downloads are an optional fallback. Drafts do not sync across devices or origins.

Require approval of the exact draft before production. Changes to the draft clear approval. Validate the approval snapshot again in the production command. Approval in the desk does not start a background render; the agent starts production when asked.

Start Homunculus with original symbolic graphics and a free local English scratch voice. Treat visual previews as directions, not actual manga panels or finished videos. Derive final duration from narration; captions initially use approximate timing.

## Reason

An interactive review makes editorial decisions visible before generating media or spending credit. The local renderer can remain simple while the desk is hosted privately.

## Validation

Tests reject unapproved or edited briefs and invalid media paths. Browser checks cover selection, editing, persistence and approval. Run a synthetic production smoke test before handing off the workflow. Check the exported video and audio metadata.
