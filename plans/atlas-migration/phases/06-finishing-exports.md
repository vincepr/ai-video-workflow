# 06: Generalize editing, video rendering and numbered exports

## Read

Phases 03/05 handoffs; extraction finish.py and its saved edit-plan/render-command examples; target src/episode.ts, src/Video.tsx, src/timing.ts, scripts/render-job.ts, projects.mjs and render-history.mjs. Read ADRs 0010/0012/0013.

## Work

1. Replace hardcoded sample copy, canvas, fonts, colors and timings with a data-driven frame-based edit plan. Support accepted source ranges, cuts, explicit forward/reverse/repeat treatments, still holds, exact caption/CTA windows and separate audio selection/fades/limiting.
2. Keep native generated audio separate from reversed visual segments. Audio measurement must inspect the encoded delivery file, including floating-point decoded peaks where relevant; RMS is not LUFS. Do not promise a platform loudness target without measuring it.
3. Decide and record a portable FFmpeg/font strategy. The bundled Remotion FFmpeg has limited filters; the extraction's full FFmpeg and machine-specific FFprobe paths are not automatically portable. Add only necessary dependencies and check native output size rather than assuming exact 9:16.
4. Connect finishing through reserveIteration, immutable render inputs, history and release/context sidecars. Preserve raw output, selected-frame provenance, original media attribution and discarded ranges. Local finishing creates a new numbered export rather than overwriting an inspected file.
5. Add shared video-shot support as a scoped renderer/schema change while preserving legacy image episodes. Use an explicit version/adapter boundary; do not rewrite old frozen episodes. Validate clip paths, frame ranges and owning project media before rendering.
6. Reproduce the preferred local edit from saved source media with no API calls. Copy necessary assets into the migration project's media with attribution/provenance; do not move or mutate the original runs. Use original hashes to verify preservation, not to demand identical codec bytes from a new encode.

## Ownership

Generic finishing Python, agreed edit-plan schema, renderer/video adapters, numbered-export integration and relevant tests. Coordinate interface changes with the orchestrator; do not concurrently change phase 01 schemas without a reviewed update.

## Gate

Render and inspect real moving-media samples: opening hook, late-shot product clearance, midpoint and CTA. Verify duration/frame count, source trim boundaries, aspect handling, exact typography and final audio. Existing still rendering and history tests pass. Source hashes remain unchanged and deleted/old exports remain discoverable.

## Handoff

Return supported edit operations, renderer compatibility strategy, output/evidence paths, visual/audio findings, history/sidecar contract and reproducible local commands. State which baseline motion was generated and which parts are local editing or still holds.
