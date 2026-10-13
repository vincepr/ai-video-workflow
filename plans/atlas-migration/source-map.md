# Migration source map

Read the rows relevant to the current phase. Paths described as proposed do not exist yet; settle their names in phase 01 before implementation workers depend on them.

## Repositories and design

- Target: D:/coding/ai-video-workflow.
- Inspected source: D:/coding/atlas-marketing-studio at commit 18ec178052f6f97612813997613d88ce34b02fc5.
- Upstream: https://github.com/AtlasCloudAI/atlas-marketing-studio/tree/18ec178052f6f97612813997613d88ce34b02fc5.
- Existing extraction: D:/coding/atlas-marketing-studio/scratchpad/openrouter-ugc/.
- Target design: [atlas-workflow-integration.md](../atlas-workflow-integration.md) and [ADR 0016](../../adr/0016-atlas-workflow-integration-plan.md).

The source checkout has unrelated Docker changes from another session. Treat it as read-only. If unavailable, inspect the pinned upstream revision in a separate local vendor workspace. Do not replace the source checkout or switch it to a newer commit silently.

## Extracted agent workflow

| File under the extraction | Why read it |
| --- | --- |
| README.md | Commands, script responsibilities, dependencies and known portability assumptions |
| WORKFLOW.md | Detailed staged execution and recorded learning; contains local example material, so select relevant portions |
| references/app-implementation.md | Exact pinned app source mappings and independent adaptation boundaries |
| references/app-options.md | Direct format, hook and setting options |
| references/provider-adaptation.md | Atlas versus OpenRouter API envelopes, recovery and credentials |
| probe.py | Key loading and read-only discovery; adapt rather than invoking during offline tests |
| generate.py | Image request, video submission, durable job polling and download |
| finish.py | Inspection and finishing; copy, fonts, dimensions and repair coordinates are sample-specific |
| requirements.txt | Finishing dependencies; add them only when the implementation actually requires them |

Saved discovery is dated evidence, not current capability truth. Use mock responses for offline development. Do not run the extraction's command examples as a batch: non-dry-run image and video commands spend credit. Existing runs contain product-specific data and must remain local.

## Upstream behavior

Source paths below are relative to the pinned Atlas checkout. GitHub links can be formed from the pinned base above plus the file path.

| Source | Behavior to preserve or examine |
| --- | --- |
| src/lib/marketing-studio/formats.ts | Sixteen direct formats; category, presenter requirement, recipe and defaultShots metadata |
| src/lib/marketing-studio/hooks.ts | Twelve opening choices including None |
| src/lib/marketing-studio/settings.ts | Twelve setting choices including Auto |
| src/lib/marketing-studio/examples.ts | Paired image/video examples; distinguish transferable energy from product-specific effects |
| src/app/marketing-studio/page.tsx | buildDirectMarketingPlan and genDirectVideo; one click runs first frame, video and saving |
| src/app/api/marketing-studio/expand-prompt/route.ts | Optional expansion; generic selfie defaults conflict with no-presenter formats |
| src/lib/marketing-studio/workflow.ts | Atlas field names, model-specific inputs and distinct first-frame/reference routes |
| src/lib/marketing-studio/schema.ts | Upstream plan/shot shape, not automatically the target request contract |
| src/lib/marketing-studio/resume.ts and polling.ts | Recovery and accepted-task state |
| src/lib/marketing-studio/gen-task.ts and poll-task.ts | Site credits, task bookkeeping and output persistence; do not transplant billing |
| src/lib/ad-skit.ts and src/app/ad-skit/page.tsx | Six styles; script step, then automatic image/video step |
| src/lib/drama/prompt.ts and src/app/drama-studio/page.tsx | Six styles; cast/environment references, per-shot prompts; Generate all also stitches |
| src/lib/ad-reference.ts and src/app/ad-reference/page.tsx | Video-edit/motion-control path and optional voice/lip-sync chain |

Do not carry over arbitrary automatic paid retries, provider fallbacks or larger LLM output caps. Existing ADR 0004 applies. Upstream README says MIT, but no standalone license file was present in the inspected revision. Establish reuse/attribution terms for copied material; independently implement documented behavior where a copy basis is unresolved. Do not invent a license grant or stall unrelated independent work.

## Target integration points

| Existing target file | Responsibility / tests |
| --- | --- |
| .agents/skills/generate-product-video/SKILL.md | Existing domain router; preserve physical facts, source intake, review and destination requirements |
| .agents/skills/create-short/SKILL.md | Existing agent/tab behavior and frozen request authority |
| scripts/projects.mjs | projectPaths, readProject, reserveIteration; tests/projects.test.ts |
| scripts/render-history.mjs | recordRender and readRenderHistory; tests/render-history.test.ts |
| scripts/render-job.ts | prepareRender validates local media and freezes an image episode; tests/render-job.test.ts |
| src/episode.ts and src/Video.tsx | Current still-image episode schema and renderer; tests/episode.test.ts |
| src/timing.ts | Frame-based shot timing; tests/timing.test.ts |
| desk/review-session.mjs | Saved/applied state, requestRebuild, versions and dependencies; tests/review-session.test.ts |
| desk/session.mjs and desk/session.html | Tab UI and interaction |
| scripts/desk-session.mjs | Project-scoped HTTP actions and review persistence; tests/desk.test.ts |
| scripts/serve-desk.mjs | Local routes and allowlisted public files; tests/desk.test.ts |
| scripts/t3-bridge.mjs | sendSavedRequest targets a paired thread and currently names create-short; tests/t3-bridge.test.ts |
| scripts/repository-files.mjs and scripts/check-repo.mjs | Tracked boundaries and document conventions |

Read ADRs 0001 for concise context, 0004 for spending, 0007 for review state, 0008 for T3 dispatch, 0010/0013 for credits/context and 0012 for project boundaries as the relevant phase requires. Preserve old snapshots rather than rewriting them to fit a new schema.

## Proposed ownership layout

- Skill router: existing .agents/skills/generate-product-video/SKILL.md.
- Family guides: references/workflows/{direct,skit,drama,reference-remake}.md under that skill.
- Recipe bodies: separate format, hook, setting and family-style files under the skill's references/configuration/.
- Metadata catalog: a versioned JSON index containing IDs, labels, applicable controls and context paths, not full recipe bodies.
- Python utilities: the skill's scripts/ directory, adapted from the extraction.
- Shared request/context/launcher adapters: a scoped scripts/product-video/ module group, with matching tests.
- Existing tab/session modules: extend in place once contracts are stable.
- Per-run mutable state: projects/<id>/work/product-video/<request-id>/.
- Raw and prepared media: projects/<id>/media/ with source/provenance records.
- Final exports: existing reserved projects/<id>/videos/<iteration>/.
- Shared credential-budget reservations: a local ignored directory such as out/product-video-ledger/, with no key value stored.

This is a suggested layout, not a demand for placeholder files. Add only files needed by the current phase, and record final paths/interfaces before delegation. The migration project itself is for local verification; concrete product evidence does not become a generic fixture.
