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
  "references": ["projects/example/media/panel.png"],
  "plan": {
    "concept": "One clear reveal",
    "shots": [{"id": "opening", "description": "Show the scene", "caption": ""}],
    "stages": [{"id": "finish", "kind": "finish", "provider": "local", "model": "remotion", "estimateUsd": 0,
      "parameters": {"episode": {"title": "One clear reveal", "shots": [{"image": "media/panel.png", "seconds": 3,
        "text": "Show the scene", "from": [50, 50, 1], "to": [50, 50, 1.1], "source": "Creator", "rights": "Owned"}]}}}]
  }
}
```

Kinds: `ad`, `commentary`, `other`. Stage kinds: `image`, `video`, `audio`, `finish`. `references` are paths under this project's `media/`. The CLI hashes them when freezing. The agent chooses shot and stage IDs, unique lowercase words with digits or hyphens. A new revision copies the whole configuration, changes its UUID, points `parentId` at the prior revision and describes the change.

`record <project-id> <revision-id> <attempt.json>` saves an immutable attempt. Include an attempt UUID, stage ID, status (`succeeded`, `failed`, `uncertain`, `unsupported`), actual provider and model, parameters, private prompt, start and end ISO timestamps, reported USD cost, optional provider job ID and inspection decision, and arrays of input and output project media paths. Success requires an output and `inspection: {"accepted": true}`; paid-model success also requires the submitted prompt. Reconcile uncertainty with the same provider job ID. If none was returned, inspect the provider account, then record a terminal attempt with `reconcilesAttemptId` and a nonempty `reconciliationEvidence` note. Do not resubmit while its status is uncertain. `attach <project-id> <revision-id> projects/<id>/videos/<number>-<title>/video.mp4` links a numbered export only when its bytes match a successful finish output.

For offline validation, place one JSON response per stage at `projects/<id>/work/agent-video/recorded/<revision-id>/<stage-id>.json`, then call `npm run agent-video -- run <id> <revision-id> --recorded`. Each response has the attempt fields above except stage ID; provider and model default to the frozen plan and must match it if given. Referenced output files must already be under project media. For a retry after failure, put distinct attempt objects in a JSON array in that stage file and call `resume` after each result. `resume` skips successful stages and waits if the next stage response is absent. Recorded responses never call a provider and are labeled validation only in the shareable summary.

For the local Remotion finish shown above, put the panel in project media before freezing. The episode's shot order must match `plan.shots`; each planned caption replaces the corresponding episode shot text. Only 9:16 is supported by this renderer. Call `run` without `--recorded`. It returns `needs-inspection`, a preview path and an ignored attempt draft path. Inspect the preview, edit the draft to set `inspection.accepted: true` with a note, call `record`, then call `resume`. The CLI attaches provenance and render history to one numbered export. Do not accept footage you have not inspected.

If a local render fails before writing an MP4, its failed attempt is saved and `resume` can retry. If the process stops after producing an MP4, `resume` checks its encoded frames and dimensions before recovering the preview. A partial or invalid output needs a child revision; its bytes are kept for inspection.
