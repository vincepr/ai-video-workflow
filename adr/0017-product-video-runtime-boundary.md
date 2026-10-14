# 0017: Keep frozen product-video runs and unsupported routes explicit

Status: Accepted for offline implementation
Date: 2026-10-14

## Decision

Agent and Creator Desk submit one version 1 request. Normalize it before launch and copy only selected skill instructions, recipes and project references into an immutable run folder. Reference attribution sidecars, when present, are frozen alongside their media so later edits cannot change release credits. A changed configuration gets a new request ID. Mutable stage receipts and edits stay beside the frozen request.

The direct, skit, drama and reference-remake strategies are distinct. Python performs OpenRouter operations and local finishing; agent callbacks plan and inspect creative results. Provider capabilities, current prices and a shared USD ceiling gate paid submissions. Ambiguous submissions stop until reconciled.

Image and video resolution are separate request fields because the selected providers use different value sets. `imageResolution` controls image preparation, while `resolution` controls video generation. Older frozen drafts without `imageResolution` keep their original shared resolution value.

The existing T3 bridge starts a turn in a paired thread and retains its history. This runtime exposes no documented fresh-session launch adapter to Creator Desk. The new launcher therefore reports unsupported when no fresh transport is configured. An injected transport verifies the isolation contract offline but does not prove live isolation. Other family provider operations remain unsupported until verified; no substitute generation route is implied.

Existing still episodes keep their schema. Version 2 adds project-local video shots with explicit source frame ranges. The local finisher preserves raw media and creates numbered exports with frozen edit plans, history, credits and encoded-output measurements.

Local CTA and caption changes in Creator Desk render from an accepted direct edit in a separate refinement folder. A stable refinement ID and export receipt prevent a repeated request from reserving another numbered export. The original edit plan and source bytes remain available for comparison.

## Validation

Run `npm run check`, the Python runtime and finishing tests, `npm run files`, and the product-video skill validator. Render a version 2 moving shot and inspect opening, midpoint and CTA frames. Check source/output hashes and encoded audio in the ignored migration project. Record offline, live and creative verdicts separately.

Test a request with 1K image output and 480p video output, including provider capability validation and the Creator Desk form.
