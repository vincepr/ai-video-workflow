# Render history

- The local session API returns current choices and registered render records. Use it for playback and live availability checks.
- Rendering stores immutable JSON under `out/render-history/<session>/`. Each record contains the actual episode, optional picker snapshot, renderer identity and file fingerprint.
- Keep deleted or replaced files in history with disabled playback. Never edit an old snapshot to match current choices.
- Older videos can be imported from their render props. Mark unknown picker state as unknown; do not reconstruct it from today's session.
- After production, refresh the local Videos tab. Keep snapshots and media on disk; do not publish the desk or upload its files.
