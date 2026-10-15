# Version 2 revision format

Save drafts under `projects/<id>/work/agent-video/`. This synthetic example has no provider call:

```json
{
  "schemaVersion": 2,
  "projectId": "example",
  "revisionId": "00000000-0000-4000-8000-000000000001",
  "parentId": null,
  "change": "First concept",
  "brief": "A short silent story",
  "kind": "other",
  "outputFormat": "9:16",
  "budgetUsd": 0,
  "references": [],
  "plan": {
    "concept": "One clear reveal",
    "shots": [{"id": "opening", "description": "Show the scene", "caption": ""}],
    "stages": [{"id": "finish", "kind": "finish", "provider": "local", "model": "ffmpeg", "estimateUsd": 0, "parameters": {}}]
  }
}
```

Kinds: `ad`, `commentary`, `other`. Stage kinds: `image`, `video`, `audio`, `finish`. `references` are paths under this project's `media/`. The CLI hashes them when freezing. The agent chooses shot and stage IDs, unique lowercase words with digits or hyphens. A new revision copies the whole configuration, changes its UUID, points `parentId` at the prior revision and describes the change.

`record <project-id> <revision-id> <attempt.json>` saves an immutable attempt. Include an attempt UUID, stage ID, status (`succeeded`, `failed`, `uncertain`, `unsupported`), actual provider and model, parameters, private prompt, start and end ISO timestamps, reported USD cost, optional provider job ID and inspection decision, and arrays of input and output project media paths. Success requires an output and `inspection: {"accepted": true}`; paid-model success also requires the submitted prompt. An uncertain attempt with no job ID remains blocked until a future recovery route can identify the submission. `attach <project-id> <revision-id> projects/<id>/videos/<number>-<title>/video.mp4` links a numbered export only when its bytes match a successful finish output.
