# 07: Add configuration and refinement to the existing tabs

## Read

Phases 01/04/06 interfaces; create-short; desk/review-session.mjs, session.mjs/session.html; scripts/desk-session.mjs and serve-desk.mjs. Read ADRs 0007/0008 and corresponding review-session, desk and bridge tests.

## Work

1. Add relevant workflow/format/style/hook/setting/language/presenter/execution controls within the existing tab shell. Read the compact metadata catalog for labels/applicability, not recipe bodies. A future simpler picker uses the same contract and catalog.
2. Store structured selections in the working draft. Saving creates a review version; Generate freezes and dispatches the same skill request as an agent launch. Picker changes, tab navigation and autosave never call a paid API.
3. Preserve existing requested-pickers, inactive defaults, version restoration, applied state and the frozen request's authority over newer drafts. Format options belong in a proper structured selector; the current generic comparison helper's option limit is not the new catalog schema.
4. Show stage progress and the final artifact without forcing user input between stages. Offer advanced script/frame/shot inspection controls separately. Distinguish a delivery receipt from completion, and an available video from an accepted creative result.
5. Refine dependencies precisely: captions/CTA/brand changes use local finishing; source/recipe/movement changes invalidate affected prompts/assets. Do not purchase a new clip for an unrelated caption change. Resume operates on the original request while a new generation uses a new snapshot.
6. Preserve per-project routing and allowlisted HTTP/media access. Browser state contains IDs, previews and progress, never provider keys or pairing cookies. Returning results updates only the owning request/project and does not automatically mark uninspected work applied.

## Ownership

Existing desk/tab/session modules, HTTP request adapters and UI tests. Do not build a second full studio frontend or provider orchestration path. Preserve unrelated projects and existing review interactions.

## Gate

Verify agent and browser request equivalence, selectors and applicability, save-versus-generate semantics, paused/failed/completed states, version restoration and tab refinements. Use T3 collaborative preview tools for UI inspection when available. Render and inspect a moving sample for any visual change; screenshots of an empty picker are not production evidence.

## Handoff

Return the creator flow, exposed controls, request mapping, refinement dependency behavior, UI evidence and regression results. Identify any runtime isolation limitation clearly in the interface rather than implying a fresh context was created.
