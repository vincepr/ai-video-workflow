# Video workflow

Local tools for producing short videos with an agent. Requires Node.js 24 or newer.

## Layout and Git boundaries

| Path | Purpose | Git |
| --- | --- | --- |
| src/, scripts/, desk/, tests/ | Shared renderer, commands and local editor | Tracked |
| .agents/skills/, adr/ | Workflows and decisions | Tracked |
| projects/<id>/*.json or *.md | Project settings, research, scripts, catalogs and source records | Tracked |
| projects/<id>/media/ | That project's panels, narration, thumbnails and copied library assets | Ignored |
| projects/<id>/work/ | Review versions, requests, history, reservations and temporary files | Ignored |
| projects/<id>/videos/ | Numbered exports and frozen settings | Ignored |
| media/{music,sfx,images,fonts,brand}/ | Shared reusable assets and attribution sidecars | Ignored |
| .env, credentials/ | Local API keys and project connections | Ignored |
| episodes/sample.json, public/sample/ | Standalone render example | Tracked |
| hiddenpicks-profile.png, hiddenpicks-banner.png, channel-description.txt | Approved channel branding | Tracked |
| out/, caches and dependencies | Sample output, tools and caches | Ignored |

Run `npm run files` for the tracked inventory and boundary checks. Git also ignores media extensions outside these folders, except the two approved branding PNGs. Do not force-add ignored files.

To move a project between machines, use the [transfer-project skill](.agents/skills/transfer-project/SKILL.md). Its ZIP carries that project's ignored `media/`, `work/` and `videos/` data separately from Git. Clone or update the repository first, then import the ZIP. Credentials stay local.

## Commands

```sh
npm ci
npm run check
npm run project -- create next-story "Next story"
npm run project -- list
npm run agent-video -- plan projects/<id>/work/agent-video/draft.json
npm run agent-video -- freeze projects/<id>/work/agent-video/draft.json
npm run agent-video -- status <id> <revision-id>
npm run desk
npm run render -- --project homunculus
npm run render -- --project homunculus --session projects/homunculus/work/session.json
```

Creator Desk opens at http://localhost:4173/. Select a project at the top, or open /projects/<id>/. New projects start with empty catalogs; ask the agent to research and prepare choices. Creating or opening a project does not call a model provider.

The Project video tab reads version 2 agent-authored revisions from ignored `work/agent-video/`. It shows the concept, shots, cap, stage choices and progress. Uploads are saved under project media; a caption or output-format edit creates a child revision. Ask the agent to plan and freeze a new video with the `agent-video` skill. `run` renders a local Remotion finish preview from saved media, then waits for agent inspection. After an accepted attempt is recorded, `resume` registers one numbered export with provenance. `--recorded` advances explicit saved responses for offline validation. Paid execution remains blocked until a verified route and price adapter are connected. Existing product-video version 1 requests and anime review sessions remain separate and readable.

Each render reserves `projects/<id>/videos/000011-readable-title/`, containing video.mp4, episode.json, props, optional review snapshot and upload credits. Six-digit numbers increase per project and sort by name. Failed runs may leave gaps. Never overwrite an iteration or delete reservation records. Videos shows the newest exports first and marks the applied choice separately. Deleted files stay greyed out with their original snapshots.

For scratch narration: `npm run produce -- projects/<id>/brief.json --project <id> --assets projects/<id>/images.json`. The brief must be approved. Use --silent for no voice, --prepare-only to stop before rendering or --symbolic for an explicit smoke test. Scratch speech uses Windows; supplied narration belongs in the episode instead. Captions use approximate timing.

The standalone sample remains available through `npm run dev` and `npm run render -- episodes/sample.json out/sample.mp4`. Studio opens at http://localhost:3000. Exports use 1080 x 1920, 30 fps, H.264. The first render downloads Chrome Headless Shell. Advanced audio filters may need a full FFmpeg install.

## Project data and media

Each project has project.json, concepts.json and image-options.json. Add research.json, sources.json, brief.json, images.json and episode.json as needed. Keep downloaded files in its media/ folder. Image and audio paths in episode.json are relative to the project, such as media/images/panel.jpg.

Shots contain image, seconds, text, from, to, source and rights. Camera positions use [x, y, zoom]: x and y are percentages from 0 to 100; zoom is 1 to 2. Animation uses whole frames. Text is a scene caption, not speech-aligned subtitles.

Shared media includes music, effects, images, fonts and brand assets. Every library asset needs a same-basename .attribution.json with title, creator, source, license or permission basis, restrictions, attribution requirement, placement and exact credit. Record unknown terms as unknown. Copy both files into project media before use; never modify library files while producing one project.

Optional episode music contains audio, volume, title, artist, source, license and exact attribution. Narration stays separate. Music fades at both ends, and its credits stay with the numbered video as .description.txt and .release.json and in render history.

Finished versions also include context.md for a later upload session: topic, commentary, creative choices, asset paths and open questions. The adjacent .description.txt contains a public synopsis and required credits. Keep it consistent with release metadata and history; private context stays separate. See ADR 0013.

## Interactive workflow and parallel work

Product-video configuration is available in the existing Creator Desk Product video tab. The agent and tab normalize the same version 1 request, stored under the project's ignored `work/product-video/<request-id>/` folder. Selected recipe files are snapshotted there. The tab can freeze Generate, but this host has no supported fresh agent-session launch operation, so it reports that limitation without spending credit. The existing T3 send still serves create-short requests. See [the migration contract](plans/atlas-migration/contract-v1.md) and [ADR 0017](adr/0017-product-video-runtime-boundary.md).

The Product video tab suggests image and video models and offers ratio, resolution and duration menus. Open Custom model settings JSON to export the current choice or apply a custom model ID and standard controls. The JSON does not change the project's spending cap. It rejects model-specific fields such as `effort`, `quality` or `seed` until those controls have explicit capability and cost handling. Presets can become stale and are rechecked before a paid run.

The JSON import uses this shape; an agent may prepare the same values for the local draft:

```json
{"version":1,"image":{"model":"bytedance-seed/seedream-5-0-pro","resolution":"1K"},"video":{"model":"alibaba/wan-3.0","resolution":"480p","durationSec":8},"aspectRatio":"9:16","audio":false}
```

For a direct run with accepted raw footage, edit the CTA or Final caption in that tab and choose Refine locally. Set `FFMPEG_PATH` and `FFPROBE_PATH` to absolute paths for a full FFmpeg build and FFprobe before starting the desk. The local action saves the changed form, creates an isolated refinement, and adds a numbered export to Videos. It reuses the same export when the same refinement ID is retried. The frozen request and original raw footage stay intact. A frozen request alone does not provide footage to refine.

Offline provider operations use `.agents/skills/generate-product-video/scripts/runtime.py <run-dir> <operation>` with recorded responses. Local editing uses that skill's `scripts/finish.py`; it requires explicit full FFmpeg and FFprobe paths. Live provider capabilities and costs must be refreshed before any separately authorized paid run. Skit, drama and reference-remake stages are offline strategies with explicit unsupported results when their required provider routes are absent.

Ask the agent to use create-short with a topic or link. It handles project setup, research and review choices. Refine commentary and images before production. Add optional pickers only on request; inactive pickers have no effect. Save creates a review version. Save & send to T3 also requests production of that frozen version. Changes become applied only after a matching render is inspected.

Assign a different project ID to each parallel agent. Normal video work edits only its project; shared renderer, editor and library changes have separate scope. Concurrent renders use separate numbered outputs and frozen props. Agents must not edit the same project's episode or review state concurrently. See ADR 0012.

Review state lives in projects/<id>/work/session.json. T3 credentials and target thread live in ignored credentials/t3/<id>.json. Each project needs its own explicit connection; another project's thread is never used as a fallback. Frozen requests and receipts stay in that project's work/requests/.

Homunculus's old scratch files are archived under its work/legacy/. Existing video snapshots remain unchanged; relocated history records retain original paths. Channel branding remains at the root as requested. The old hosted editor has been removed; review is local.

## Credentials and validation

Copy .env.example to .env for OPENROUTER_API_KEY. Keep keys in server scripts and out of browser props. Follow ADR 0004 before model requests. Rendering does not call OpenRouter.

Run npm run check before committing. Inspect a rendered sample after changing visuals. npm run files reports tracked files and rejects tracked credentials, project media, review state and exports. Checks cannot assess commentary quality or grant media permissions. Publishing or adding paid services requires an explicit request.

Dependencies are pinned in package-lock.json. No project license has been selected. Check the [Remotion license](https://www.remotion.dev/license) before changing the usage or team size.
