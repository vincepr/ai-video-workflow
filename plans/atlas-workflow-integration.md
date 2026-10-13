# Integrate Atlas creative workflows

Status: Proposed. Research and planning only.
Date: 2026-10-14

## Recommendation

Bring the extracted agent workflow into this repository as a reusable creative engine. Start with its working direct-ad path, then add the other workflow families. Keep product intake, local project storage, OpenRouter, review sessions and numbered exports here. Preserve the creative recipes and finishing behavior that produced the preferred result.

Use a small provider adapter and declarative recipe catalog. Running the complete Atlas web application is optional future work; login, payments, site credits and hosted storage are not prerequisites for the agent workflow.

## Evidence and boundaries

Inspected upstream checkout: [Atlas Marketing Studio](https://github.com/AtlasCloudAI/atlas-marketing-studio), commit `18ec178052f6f97612813997613d88ce34b02fc5`.

The local extraction is at `D:/coding/atlas-marketing-studio/scratchpad/openrouter-ugc/`. Its WORKFLOW.md, references/app-implementation.md and three Python scripts map the direct app path to OpenRouter and local finishing. Product-specific comparisons and artifacts stay in ignored project storage.

One direct Hyper Motion example was exercised with real provider requests. Other workflow families were inspected in source; they have not been verified through this extraction. Its working route uses different models from Atlas's defaults. This is evidence for adopting the workflow, not a controlled comparison proving one model or every preset superior.

Source files to preserve as provenance:

- Direct recipes: src/lib/marketing-studio/{formats,hooks,settings,examples}.ts.
- Direct execution: src/app/marketing-studio/page.tsx and src/lib/marketing-studio/workflow.ts.
- Optional prompt expansion: src/app/api/marketing-studio/expand-prompt/route.ts.
- Drama: src/lib/drama/prompt.ts and src/app/drama-studio/page.tsx.
- Skits: src/lib/ad-skit.ts and src/app/ad-skit/page.tsx.
- Reference remakes: src/lib/ad-reference.ts and src/app/ad-reference/page.tsx.
- Recovery: src/lib/marketing-studio/{resume,polling,gen-task,poll-task}.ts.

The upstream README declares MIT, but the inspected revision has no standalone license file. Record the reuse and attribution basis before copying upstream code or recipe text. No upstream files or dependencies are copied by this plan.

## Keep three choices separate

1. **Workflow family:** the generation stages and required inputs.
2. **Creative configuration:** format, hook, setting, style, language, presenter, brand treatment and CTA.
3. **Execution configuration:** provider, stage-specific models, duration, aspect ratio, resolution, audio and budget.

Destination is a separate release choice: private experiment, organic social, paid advertising or shop page. Creative style does not establish destination eligibility.

## User interaction and automation

The inspected UI separates internal stages from user checkpoints. Direct ads run first-frame generation, video generation and saving from one Generate click; AI Expand is optional. Reference remakes chain selected editing and voice/lip-sync stages from one click. Skits expose Generate script followed by Generate video, which handles product images and video automatically. Drama exposes script generation followed by Generate all, which creates missing references, generates the shots and stitches the result automatically. Individual reference, shot and stitch controls are optional alternatives.

Our default should be **configure once, Generate, then review and refine**. Freeze the configured run and its spending ceiling upfront. Execute its planned stages without requesting human confirmation between them. The agent may inspect intermediate artifacts internally; expose stage-by-stage review only as an optional advanced mode. Stop for an unresolved failure, missing required input/capability or an action outside the configured budget, without silently purchasing repairs or changing providers.

## Workflow families and rollout

| Family | Pipeline to integrate | Priority and prerequisite |
| --- | --- | --- |
| Direct product ad | References and brief, creative expansion, inspected first frame, image-to-video, local finishing | First. Reuse the verified extraction. Supports commercial, UGC and TikTok recipes. |
| Ad skit | Product benefit, two-character script with a reversal, product reference, reference-to-video and dialogue | Second. Requires reference conditioning and an inspected spoken-audio route. |
| AI drama | Script, recurring character/product/environment references, per-shot reference-to-video, continuity review and assembly | Third. Requires persistent per-shot jobs and character continuity. Budget every shot and reference stage. |
| Reference-ad remake | Reference video plus replacement product/presenter, video editing or motion control, optional voice/lip-sync | Fourth. Requires suitable reference rights and verified video-editing capabilities. Expose unavailable stages explicitly. |

A skit and a drama are different pipelines, not extra text appended to a direct-ad request. Reference remakes must not silently become generic image-to-video generation when the requested editing capability is unavailable.

## Preserve the configuration catalog

Keep stable upstream IDs and version the recipes. Import the complete catalog as data, with examples and expected behavior; do not create separate bespoke scripts for each format.

| Catalog | Options to retain |
| --- | --- |
| Direct UGC formats | UGC Testimonial, Direct-to-Camera, Selfie Testimonial, This Gadget Saved Me, Secret Hack Reveal, Product Review, Unboxing Reveal, Unboxing ASMR, Virtual Try-On, Couple Sharing |
| Direct commercial formats | TV Spot, Hyper Motion, Giant Product, Crush Test |
| Direct TikTok formats | Camera POV, Mess to Fresh |
| Hooks, including None | Conflict, Suspenseful Question, Pain Point, Number, Before/After, Identity Twist, Bizarre/Curious, Freebie, First-Person POV, Controversial Take, Expert Authority |
| Settings, including Auto | Office, Living Room, Kitchen, Bedroom, Bathroom/Vanity, City Street, Outdoor, Live Studio, In Car, Cafe, Studio Seamless |
| Skit styles | Funny/meme, Reversal, Sitcom, Warm, Luxury, Urgent |
| Drama styles | Epic Fantasy, Palace Intrigue, Martial Arts Wuxia, Family Drama, Office Politics, Superhero |

Each recipe should describe its hook, visual payoff, movement, pacing, sound and ending, plus required references and presenter behavior. Keep an editable brief and prompt override. Existing facts constrain product claims; do not invent tests, testimonials, expertise or scarcity to satisfy a recipe. Giant-product imagery should be treated as a deliberate surreal treatment rather than physical scale evidence.

Correct the upstream conflicts when translating recipes: a no-presenter commercial must not inherit a generic selfie/spoken-line expansion. Catalog defaultShots does not mean the direct handler generates that many independent clips; its inspected execution builds one shot and one video job.

## Implementation phases

### 1. Preserve a reproducible baseline

Freeze the extracted source mapping and generic scripts, excluding product data, credentials, discoveries and existing runs. Reuse saved media to reproduce the preferred edit without paid calls. Parameterize copy, brand styling, resolution, file locations and the edit plan. Keep the sample-specific mask repair outside the reusable engine.

Start with the existing Python executor behind the repository's commands rather than rewriting the proven API path immediately. Identify its actual dependencies and make font/FFmpeg discovery portable when implementation needs them.

Done when the existing result can be reconstructed with matching segment timing and equivalent captions/audio, and a second product can be configured without editing a script.

### 2. Add recipe-driven direct ads

Introduce a shared creative brief and the complete direct format/hook/setting catalog. Compose separate image and video prompts from selected recipes, inspected references and product facts. Support agent-authored expansion first; a separate paid planner remains optional and subject to ADR 0004's output and spend limits.

Use live provider capabilities to determine available model/settings combinations. A model ID alone does not establish first-frame, reference-to-video, native speech, motion-control or editing support. Refresh capability and pricing evidence before paid work; never forward Atlas-specific payloads to OpenRouter unchanged.

Done when direct formats produce distinct, coherent dry-run plans, respect presenter requirements and factual constraints, and reject unsupported settings before submission.

### 3. Unify jobs, review and finishing

Store brief, selected recipes, prompt revisions, source hashes, stage estimates, receipts and review decisions under each assigned project. Persist first-frame selection and accepted job IDs. Recover polling/downloads without buying duplicate generations. Account for actual spend and outstanding reservations across projects sharing a key; preserve rate/quota stops and no automatic paid fallback.

Generalize finishing into an explicit frame-based edit plan: source clips and ranges, cuts, optional deliberate reversals/repeats, still holds, captions, brand styling and audio treatment. Source fidelity and hook/pacing review are separate judgments. Keep raw generation intact and state which segments were discarded or edited.

Connect the engine to numbered export reservation, render history, attribution, release metadata and context.md. Add shared video-shot support through a separately scoped change to the current still-image renderer. Initially a local finishing adapter can record exports in existing history; avoid product-specific component forks.

Done when internal inspection handles rejected inputs without mandatory human checkpoints, an interrupted run resumes safely, no numbered file is overwritten, and the actual final export passes frame, text, geometry and encoded-audio inspection.

### 4. Add skit, drama and reference-remake strategies

Reuse the common brief, job storage, provider checks, budget and finishing. Add the distinct planning/reference stages in the rollout table, with their own style catalogs and editable dialogue. Preserve reference roles and ordering. Give each drama shot an independent status, cost, selected asset and continuity review. Validate one example per family before calling it verified.

A missing OpenRouter capability should show as unsupported. Adding a different paid provider or increasing a batch budget needs a new user request; implementing a mode does not grant spending authorization.

Done when each available family completes its own documented pipeline, unsupported families explain their missing capability, and reuse/resume behavior works without duplicate spend.

### 5. Expose choices in Creator Desk

Add workflow, format/style, hook, setting and presenter choices to the existing review session. Show only relevant controls and provider-supported settings. Save recipe/model versions with each review so later catalog changes do not alter a frozen result.

Make Generate run the configured pipeline automatically, followed by result review and refinement. Offer planning, dry run and individual-stage actions as advanced controls. Do not make changing a picker trigger paid calls. Changing captions should require only a local render; changing movement may reuse or regenerate footage, depending on the request. Keep comparison choices narrow and user-directed.

Done when a creator can refine one saved ad without leaving the project or repeating unrelated generation stages.

## Validation and release sequence

First validate offline using the existing extraction's media and recorded API responses. Cover recipe routing, presenter conflicts, reference ordering, setting support, budget reservations, ambiguous submissions, resume behavior and project isolation. Then verify a small user-authorized sample for each supported family; do not run the whole preset matrix as a paid batch.

Use the preferred existing result as the creative baseline. Assess opening impact, product truth, motion, pacing, spoken-language quality where applicable, caption clearance, final audio and total cost. Treat user preference as the creative verdict. Measure failures in raw footage as well as the final edit; an attractive salvage is not proof of uninterrupted faithful generation.

Implementation checks: npm run check; render and inspect relevant samples when visuals change. Update generate-product-video with concise workflow-family routing and links to catalogs after the implementation is verified.

Recommended first milestone: reusable direct ads with the full recipe catalog, the existing OpenRouter executor, generic finishing and saved review. Add the other families on that same foundation before expanding the UI.
