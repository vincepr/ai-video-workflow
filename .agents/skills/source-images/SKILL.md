---
name: source-images
description: Find real images or manga panels on the web, inspect them, save local source records and prepare a video image manifest. Optionally remove speech-bubble text after panel selection.
---

# Source images

Use the approved visual beats and existing research. Keep downloaded files under ignored `public/media/<topic>/` and records under `out/<topic>/`.

- Search for the actual work and scene. Prefer publisher previews, official galleries and public editorial excerpts. Use image search for discovery, then inspect the source page. Avoid generated lookalikes and unrelated fan art.
- Download a small candidate set with request timeouts. Reuse existing assets. Do not bypass access controls or download a complete series to find a few panels.
- Inspect every image before selecting it. Verify the character, scene, resolution and crop. Do not infer scene identity from search captions alone. Record uncertainty and missing scenes; do not silently substitute illustrations.
- Match visible panel text to the commentary language unless the user requests otherwise, and record the verified language in `sources.json`.
- Save `sources.json` with local path, source page, direct image or sample URL, work, available chapter/page, visual beat, crop and usage notes. A public preview is not a redistribution license. Keep review renders local unless publishing is requested.
- Save `images.json` as an array in caption order. Each item has `image` relative to `public/`, `from` and `to` camera triples, `source` and `rights`. Use one entry per caption; repeat a source deliberately when needed. Crops and camera movement should follow the narrative.
- For image review, populate Creator Desk's `image-options.json` with three inspected candidates per visual beat, scene fit and any gaps. Read `window.creatorDesk.getImageSelection()` from `images.html`; save a local checkpoint. Let the user choose and reorder before updating production files or rendering.
- Run `npm run produce -- out/approved-brief.json --assets out/<topic>/images.json`. The command reports the required image count if the manifest and captions differ. No model request is needed for sourcing.

## Optional speech-bubble cleanup

Keep bubbles for the first draft unless requested otherwise. Preserve originals and write edited copies beside them.

- Default cleanup means removing lettering inside speech bubbles while keeping their outlines and the surrounding artwork. Confirm whether the user instead wants the entire bubble removed when that distinction is unclear.
- Prefer a mask and a plain fill for flat white bubbles. Use an image-editing model for textured backgrounds or whole-bubble removal. Inspect the original first and follow the available image-editing skill or tool instructions.
- Edit one representative panel first. Check lettering, linework, faces and bubble boundaries before processing more. Record the edit and provider in `sources.json`; point the image manifest to the cleaned copy.
- Verify image-editing support before choosing a model. Read `adr/0004-api-costs.md` before paid requests. Do not spend credit or batch edits merely to prepare a first draft.
