---
name: agent-video
description: Plan and track a video from a freeform brief through the shared project revision CLI. Use for new agent-led ads and other videos that need a spending cap, shot plan and provenance.
---

# Agent video

Start from the user's brief, references and upfront USD cap. Work in one `projects/<id>/` folder. Put private draft JSON and media in its ignored `work/` and `media/` folders. Do not require a product or a fixed ad form. For anime commentary with review choices, keep using `create-short` and its Save & send to T3 gate.

Prepare a version 2 draft with a revision UUID, parent ID and change summary; a freeform brief; kind; cap; project media paths; concept; shots; and stages with model, provider, controls and estimated USD. Use `npm run agent-video -- plan <draft.json>` to check it, then `freeze` to save the exact revision. A change gets a new UUID and parent ID. `status`, `inspect` and `summary` read saved revisions. `run` or `resume` blocks paid stages until a verified execution adapter exists. Use `--recorded` only with explicit saved response fixtures for offline validation; these attempts are marked as validation only. Do not report a frozen or recorded plan as live generated footage.

Read [revision format](references/revision.md) when preparing a new configuration or attempt file.

For product footage, load only the selected `generate-product-video` recipe and the [dated model recommendations](../generate-product-video/references/model-recommendations.md). Reassess the shortlist after 30 days. Verify the chosen stage route and exact live price before any separately authorized paid submission; stop if the cap, route or host capability cannot be confirmed. Do not switch to another workflow silently. Record each attempt through the CLI with its actual provider, model, controls, prompt, job ID, inputs, outputs, hashes, cost and inspection. Reconcile an uncertain submission before trying again.

The Project video page shows the latest revision and supports caption and output format edits. These create child revisions without generation. Uploaded references have project media paths for the next agent revision. Keep private prompts and receipts in ignored work data; use the CLI `summary` for a shareable description.
