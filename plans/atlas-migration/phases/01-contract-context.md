# 01: Define the shared request and selected context

## Read

Phase 00 handoff; design sections Keep three choices separate and Agent launch and selected context; source map's target integration points. Read existing review snapshot and T3 request code, plus tests/review-session.test.ts and tests/t3-bridge.test.ts.

## Work

1. Define a versioned request contract shared by browser and agent: request/project IDs, action, workflow, applicable recipe IDs, language, destination, references with roles, brief/brand/CTA, execution settings and explicit budget. Separate mutable review drafts from immutable production requests.
2. Normalize choices once. Example IDs are workflow=direct, format=hypermotion, hook=bizarre, setting=seamless. Skit/drama styles are scoped to their workflow; never treat a style ID as a provider model. Reject unknown/inapplicable IDs and missing inputs before launch.
3. Build a deterministic context resolver. Return an ordered manifest of the routing/common instructions, one family guide, selected recipe files, relevant destination/lessons and project facts/assets. Include content hashes or recipe versions. Do not include all recipe bodies, unrelated family guides or full model catalogs.
4. Freeze the normalized request and context manifest with write-once semantics. Changed drafts create a new request; resuming one uses its original inputs and versions. Preserve project-bound paths and reject traversal, foreign project media and arbitrary instruction paths.
5. Define the stage/status and refinement dependency contract before other workers build against it. Separate preparation/selection, accepted task, raw artifact, edited export, offline/live verification and creative judgment.
6. Settle shared module paths, CLI invocation shape and state serialization in a small interface reference. That reference is generic and can be tracked; run-specific manifests belong under work/.

## Ownership

Request schema, normalizer, context resolver and their tests. Do not implement provider submission, fresh session creation or tab UI yet. A metadata catalog fixture is enough to establish the resolver before phase 02 fills real recipes.

## Gate

Equivalent browser/agent inputs normalize identically. Hyper Motion plus Bizarre selects precisely the intended context; None/Auto omit unnecessary recipe bodies. Unknown selections and foreign paths fail. Frozen requests survive draft changes, catalog updates and repeated resume calls unchanged.

## Handoff

Return schema/version, canonical IDs, module exports or CLI contract, ordered context manifest example, dependency invalidation rules, file ownership and test evidence. Mark every provisional interface explicitly so later workers do not implement competing serializers.
