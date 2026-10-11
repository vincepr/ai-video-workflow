# Production

- Require review of the exact script and creative settings. Desk approval alone does not start a render; wait for the user's production request. Edits after approval need another review.
- For the older desk, save `getApprovedBrief()` to `out/approved-brief.json`. Explicit chat approval can approve the exact reviewed draft through `approveDraft` in `workflow.mjs`.
- Use real selected assets through `source-images`. Run `npm run produce -- out/approved-brief.json --assets out/<topic>/images.json` for a new scratch draft. Symbolic assets require an explicit smoke test.
- For supplied narration or session settings, update the episode directly. Verify that selected motion, transitions and caption mode are implemented before rendering; `produce` would replace supplied narration with scratch speech.
- Save the reviewed picker checkpoint and run `npm run render -- <episode.json> <output.mp4> --session out/<topic>/session.json`. Use a new output filename for each comparison. The render command records history only after success.
- For a rebuild, use the frozen `rebuildRequest.state`, leaving inactive pickers without overrides. Resolve commentary-dependent images and recording together. After verifying the matching history record, call `window.creatorDesk.applyRenderedVersion(recordId)` locally to update the applied baseline. Never mark a saved request applied before rendering.
- Inspect images, audio, cuts, captions and output metadata. Compare the effective episode with the reviewed snapshot. Report gaps and timing limits. Return the local video and refresh history; publishing remains separate.
