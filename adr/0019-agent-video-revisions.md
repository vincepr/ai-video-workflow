# 0019: Keep agent video revisions separate from legacy runs

Status: Accepted for offline implementation
Date: 2026-10-15

## Decision

An agent authors a version 2 configuration with a freeform brief, kind, spending cap, concept, shots and stage choices. `npm run agent-video` normalizes, freezes, inspects and reports it. Each revision has a UUID, freeze time, parent revision and change summary. The complete snapshot and reference hashes live in ignored `projects/<id>/work/agent-video/`. Existing version 1 product requests and anime sessions stay readable without migration.

The CLI records attempts as separate immutable files. They contain the actual provider, model, controls, private prompt, project media hashes, job ID, cost, outcome and inspection. A shareable summary omits private prompts and paths. A numbered export may link to a revision only when its bytes match a successful finishing attempt. Missing provenance on an older export remains unknown. Paid execution stops until a live route and exact price can be verified; a recorded estimate alone never authorizes a submission. An uncertain submission blocks retry until reconciled with the same provider job ID or an explicit manual receipt check. Drivers must call this same CLI and cannot silently switch workflows. No Claude adapter is claimed until its integration format is checked.

For offline validation, `run` and `resume` read explicit recorded responses from ignored project work. They check each stage against the cap, persist a separate attempt, stop on unsupported or failed outcomes and skip completed stages on resume. A stage response may contain an ordered array of distinct attempts for a failed retry; each result needs a separate resume. Recorded attempts are labeled validation only. This path has no network or provider call and does not stand in for live capability verification.

## Validation

Run `npm run check`. A synthetic project proves exact revision retries, changed revision rejection, reference hashes, over-cap blocking, uncertain submission recovery, page child revisions and export byte linkage. Verify old request and session tests still pass. Test transfer bundles separately because all new records are under ignored `work/`.
