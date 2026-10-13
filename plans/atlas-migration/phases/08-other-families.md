# 08: Implement the distinct skit, drama and remake families

## Read

Stable interfaces from phases 01-07; only the relevant family source in source-map.md; the family guide and its selected style/context. Direct Hyper Motion success is not verification of these families.

## Sub-task A: Skit

Implement benefit-driven two-character planning, six selectable styles, product references and a reference-conditioned video/dialogue stage. Keep script review optional in our automatic mode while retaining an advanced editable script tab. Preserve target language and product role in the payoff. Route speech only through verified capabilities; do not assume every image-to-video model lip-syncs.

Gate: offline plan validates cast/dialogue/product references, then executes the expected automatic stages. Style changes produce a real change in the plan. Missing reference/speech capability yields an explicit unsupported state. A larger planner output or extra paid stage must follow ADR 0004 rather than inheriting source defaults.

## Sub-task B: Drama

Implement six drama styles, a structured script with shot-specific cast and duration, consistent character/environment/product reference assets, per-shot reference conditioning, independent job state and final assembly. Keep reference order explicit in prompts and payloads. Reuse completed characters and shots when resuming. Automatic mode includes references, all planned shots and stitching after the initial configuration; advanced controls permit shot-level edits.

Gate: offline multi-shot execution preserves cast references and timing, accounts for every planned stage, resumes only incomplete work and assembles completed shots. A failed shot cannot silently be replaced with unrelated stock footage or marked successful merely because other shots completed.

## Sub-task C: Reference-ad remake

Implement supplied source video plus product/presenter references, a verified video-edit or motion-control operation, and optional voice/lip-sync stages. Preserve requested source pacing/camera treatment through appropriate controls, not an unrelated direct-ad prompt. Explicitly identify source rights and input availability. Do not import the upstream automatic paid retry/fallback chain.

Gate: offline provider-specific payloads use actual video-edit/motion inputs, and optional voice stages are included only when selected. Unavailable operations remain unsupported. Resume keeps accepted tasks and output lineage; no fallback purchases are hidden in a Generate action.

## Coordination and verification

Delegate these sub-tasks only with disjoint guides/adapters/tests and stable shared interfaces. Merge them one at a time, then run combined checks. If a shared runtime change is needed, the orchestrator owns that change and revalidates earlier families.

Separate implemented, supported, verified-offline, verified-live and creatively accepted. Live availability requires refreshed provider evidence. A paid example per family is optional verification only after a new user-authorized scope and budget; do not run a matrix of every style/format.

## Handoff

Return each family's required inputs and stages, context manifest, runnable offline example, provider operation matrix, budget shape, tab controls, tests and remaining unsupported/live-unverified features. Do not call configuration metadata alone a completed family implementation.
