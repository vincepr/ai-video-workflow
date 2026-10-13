# Atlas workflow migration runbook

Status: Ready for a future implementation request. No migration phase has been executed.
Prepared: 2026-10-14

## Outcome

Implement one agent-driven product-video system. Agent and browser launches submit the same frozen configuration. Skills load the selected workflow and recipe context; Python utilities execute provider and finishing operations. Results and refinements stay in the existing project tabs and numbered history.

Default interaction: configure, Generate, review the result, refine. The agent handles planned intermediate stages without repeated human confirmation. Stage controls remain optional. Strict context isolation uses a fresh production session, not the conversation that designed the system.

## Start here

1. Read the repository AGENTS.md, README.md, [design direction](../atlas-workflow-integration.md) and [source map](source-map.md).
2. Read ADR 0016, then only the ADRs and source files named by the current phase.
3. Begin with [phase 00](phases/00-preflight.md). Implement phases in dependency order; do not treat this document as evidence they already exist.
4. Use the orchestration procedure below. Load one phase file into each implementation task, not every phase and recipe.

The separate OS-temp handoff supplies local comparison media paths. Generic migration documents intentionally omit product data, prompts, credentials and generated assets. Source-map links provide recovery if that handoff is unavailable.

## Scope and authorization

This request created the runbook; it does not start implementation. A later instruction to implement it authorizes the shared-code and skill migration described here. Offline implementation and recorded-response verification are the normal path. It does not renew the stopped product-generation experiment or authorize publishing, a new paid service, a larger budget or a paid preset sweep.

Keep all existing projects, media, reviews, upload records and numbered snapshots intact. Product-specific projects remain locally excluded from Git. Commit reusable code, generic instructions and synthetic test fixtures only. Never force-add ignored assets or credentials.

## Phase order

| Phase | Deliverable | Depends on |
| --- | --- | --- |
| [00: Preflight](phases/00-preflight.md) | Baseline, source provenance, migration workspace and progress record | None |
| [01: Contract and context](phases/01-contract-context.md) | Versioned request, validation, immutable snapshot and selected-context resolver | 00 |
| [02: Skills and catalog](phases/02-skills-catalog.md) | Routing skill, family guides and individually loaded recipes | 01 |
| [03: Provider runtime](phases/03-provider-runtime.md) | Generic Python operations, durable stages and shared budget accounting | 01 |
| [04: Agent launcher](phases/04-agent-launcher.md) | Same request from agent/browser, project-bound dispatch and fresh-session isolation | 01, 02 |
| [05: Direct workflow](phases/05-direct-workflow.md) | Agent-directed automatic direct-ad run using selected context and Python | 02, 03, 04 |
| [06: Finishing and exports](phases/06-finishing-exports.md) | Data-driven local editing, numbered outputs, video support and history | 03; direct evidence from 05 |
| [07: Existing tabs](phases/07-existing-tabs.md) | Configuration and refinement inside Creator Desk | 04, 05, 06 |
| [08: Other families](phases/08-other-families.md) | Skit, drama and reference-remake strategies on the same foundation | 05, 06; reuse UI from 07 |
| [09: Release and handoff](phases/09-release-handoff.md) | End-to-end evidence, compatibility checks, documentation and clean Git state | All implemented phases |

Phases 02 and 03 can run in parallel after the contract is integrated, with disjoint file ownership. Their combined code must pass integration checks before phase 05. Family sub-tasks in phase 08 may run in parallel only after shared interfaces are frozen. Keep renderer, dispatcher and session changes sequential when they share files. Parallel work is optional, not required for completion.

## Orchestrator procedure

At phase 00, create an assigned generic migration project with the existing project command. Store mutable coordination state under its ignored work/ directory. Do not create a tracked progress log full of local paths or product evidence.

Track, per phase: status, dependencies, assigned owner, branch/worktree, changed files, commits, checks, evidence paths, unresolved issues and next action. Use states not-started, active, integrated, verified-offline, verified-live or unsupported. Separate implementation completion from provider availability and creative acceptance.

For each phase:

1. Check upstream commits and workspace status. Do not reset another agent's changes or assume an old HEAD still applies.
2. Freeze the phase scope and file ownership; delegate only after dependencies are integrated. Use isolated worktrees when useful. Do not assign the same files or media project to concurrent agents.
3. Require tests appropriate to changed production behavior. Read applicable skills before implementing; documentation-only edits do not need invented tests.
4. Review the worker's result against that phase's acceptance gate. A claimed success without evidence is not an integrated phase.
5. Integrate the commit without changing product snapshots. Run npm run check on the combined tree; inspect a real sample for visual changes.
6. Record the accepted commit, evidence and any deferred live capability. Push completed integration commits to origin/main according to repository rules.
7. Give the next worker only the source map, current phase, stable interfaces and relevant prior handoff. Do not forward the complete development conversation into a production run.

If a gate fails, keep the phase active and record the smallest corrective task. Missing paid verification does not justify hidden retries or block unrelated offline work. Missing capabilities must be reported accurately; do not disguise another pipeline as an implementation of the requested mode.

## Task packet for an implementation worker

Supply: phase number and link; objective; owned files; dependencies and integrated commits; required references; configuration/interface decisions; allowed offline commands; acceptance tests; prohibited actions; evidence location.

Require the worker to return: change summary; exact files and commit IDs; checks and visual evidence; remaining limitations; migration/compatibility effects; commands for the next phase. Identify whether each command exists or is newly proposed. Never leave the orchestrator to guess whether a sample used a paid call.

## Delivery gates

- Agent and browser produce equivalent normalized requests and route through the same skill.
- Hyper Motion plus Bizarre & Curious loads only those recipes, the direct guide and relevant shared/product context. No unrelated family or catalog bodies enter the production context.
- Fresh-context execution is verified in the runtime; existing-thread dispatch is clearly labeled if retained as a compatibility option.
- One configured Generate operation advances through its planned stages. Intermediate agent inspection does not require user clicks by default.
- Provider support, stage cost and run limits are checked before paid submission. Jobs survive interruptions without duplicate spend.
- Finishing choices, captions and local holds are recorded explicitly. Raw generation is preserved, and edited footage is not described as uninterrupted generated motion.
- Existing still episodes, inactive pickers, project boundaries, saved versions, history and frozen exports remain compatible.
- Saving or selecting a tab never spends credit. User refinements invalidate only dependent artifacts.
- All four families have documented implementations or explicit unsupported operations. Offline, live and creative verdicts stay distinct.

## Suggested skills

Use generate-product-video for domain and release routing; skill-creator when changing skill instructions; test-driven-development for production behavior; systematic-debugging for failures; using-git-worktrees for isolated implementation; handoff for task/session continuation. Use create-short for the existing tab/review behavior. Read each skill only when its role is relevant to the current phase.

The runbook is implementation guidance, not a new generation request. The first concrete milestone is phases 00-06: a reusable direct workflow, scoped context, automatic agent execution and generic finishing. Continue through the tabs and additional families after that foundation passes its gates.
