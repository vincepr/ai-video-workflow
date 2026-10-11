# Video workflow

Local tools for making vertical videos from an episode file. The first format uses still images, camera movement and text. No account or API key is needed.

## Run

Requires Node.js 24 or newer.

```sh
npm ci
npm run check
npm run dev
npm run render
```

Studio opens at http://localhost:3000. The default render writes `out/sample.mp4`: 1080 x 1920, 30 fps, H.264. The first render downloads Chrome Headless Shell. Remotion includes reduced FFmpeg and FFprobe builds. Advanced filters may need a full FFmpeg install.

## Local credentials and files

Copy `.env.example` to `.env` and set `OPENROUTER_API_KEY` there. `.env` stays local. Server scripts can load it with Node's `--env-file=.env` option. The renderer does not call OpenRouter yet. Keep the key in server scripts; never pass it to composition props or browser code.

Git ignores media files, model weights, archives, credentials, caches and output folders by default. Put source assets in `public/media/` and exports in `out/`. The original SVG sample stays tracked. Check `git status --short` before committing. Do not force-add ignored files.

Keep reusable downloads under ignored `media/`, such as `media/music/kyoto.mp3`. Every asset needs a same-basename sidecar, such as `kyoto.attribution.json`, with its title, creator, source URL, license URL or permission basis, usage restrictions, whether attribution is required, where to put it and the exact credit text. Record unknown terms as unknown. Both files stay local. Copy assets into `public/media/` when needed for a render, and carry their credits into the video metadata.

## Make an episode

1. Copy `episodes/sample.json` to `episodes/your-episode.json`.
2. Place local images under `public/media/`, which is ignored by Git. Paths in the episode start with `media/`.
3. Update the title, shots, source notes and permission basis.
4. Run `npm run render -- episodes/your-episode.json out/your-episode.mp4`.
5. Watch the full export before publishing. Check crops, text, timing and rights.

Each shot has `image`, `seconds`, `text`, `from`, `to`, `source` and `rights`. Camera positions use `[x, y, zoom]`: x and y are object-position percentages from 0 to 100; zoom is 1 to 2. Text is a scene caption, not speech-aligned subtitles. Duration is rounded to whole frames per shot.

Optional `music` contains `audio`, `volume` (0 to 1), `title`, `artist`, `source`, `license` and exact `attribution`. Narration stays separate; music fades at both ends. Each music render saves .description.txt and .release.json beside its MP4, plus credits in history. Videos offers a description download.

Keep the chosen export in ignored `final/<episode>/`, with its .description.txt and .release.json sidecars. Copy it from render history so playback and snapshots stay intact. Put only the selected version here.

The sample is a silent, 9-second motion test using an original SVG. Anime footage, model-generated video and posting are not implemented yet.

## Interactive creation

Ask the agent to use `create-short` with a topic or link. It researches the topic and opens Creator Desk with three video concepts and two commentary drafts each. Choose an angle, edit or leave notes, and ask the agent to revise. Approve the final draft, then say “Make the approved draft.” The repo's `source-images` skill finds and inspects real panels; speech-bubble cleanup is optional after the first draft.

Run `npm run desk` and open [Creator Desk](http://localhost:4173/). Review stays local, including versions, picker state, video playback and file availability. The agent starts the server and opens the page for you. The previous hosted page is no longer part of the workflow; do not deploy desk updates.

Add optional pickers only when needed; inactive pickers have no effect. Tabs indicate pending changes and dependencies. Reset discards a tab's pending choices. Restore review versions at the top right without changing Videos. Browser previews do not render a video. Sessions save under `out/homunculus/session.json` and in the local browser.

“Save” creates a local review version. “Save & send to T3” also saves a frozen request and sends it to the connected T3 thread. Both stay left of Videos in the sticky tab bar. Reset icons discard one tab's changes. Sending starts or steers a T3 turn; the page confirms delivery only after T3 accepts it. The applied state changes only after a matching video has been rendered and inspected.

T3 client credentials and the target thread live in ignored `credentials/t3.json`, used only by the local server. Frozen requests and delivery receipts stay under `out/<session>/requests/`. Failed sends keep the version; retry uses the same command ID. The agent can reconnect an expired pairing using the skill's T3 reference.

The Videos tab plays registered renders and greys out deleted or replaced files while preserving their snapshots. For a reviewed render, pass `--session out/homunculus/session.json` after the output path to save the picker snapshot alongside the actual episode. See ADR 0007.

`npm run produce -- out/approved-brief.json --assets out/homunculus/images.json` uses selected panels, a local Windows English scratch voice and writes an MP4 under `out/homunculus-<concept>/`. The skill reads the approved brief from the shared browser. Use `--silent` for a visual-only draft, `--prepare-only` to prepare files or `--symbolic` instead of `--assets` for a smoke test. Narration determines duration; captions use approximate timing.

## Agent workflow

Ask an agent to edit an episode, validate it, render it and inspect the output. The episode file is the storyboard. No orchestration framework or provider adapters are needed yet.

`AGENTS.md` contains working rules. `adr/` records decisions and how to validate them. `npm run check` checks types, episode behavior and repository text. It cannot assess writing quality or grant media permissions.

Dependencies are pinned in `package-lock.json`. No project license has been selected. Check the [Remotion license](https://www.remotion.dev/license) before changing the usage or team size. See [Remotion's parameterized rendering documentation](https://www.remotion.dev/docs/parameterized-rendering) for the rendering model.
