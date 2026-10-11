# Render history

- The local session API returns current choices and registered render records. Use it for playback and live availability checks; the hosted list is a static metadata copy.
- Rendering stores immutable JSON under `out/render-history/<session>/`. Each record contains the actual episode, optional picker snapshot, renderer identity and file fingerprint.
- Keep deleted or replaced files in history with disabled playback. Never edit an old snapshot to match current choices.
- Older videos can be imported from their render props. Mark unknown picker state as unknown; do not reconstruct it from today's session.
- After production, refresh the local Videos tab. Updating hosted metadata is separate from saving local choices and never requires uploading MP4 files.
