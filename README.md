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

## Make an episode

1. Copy `episodes/sample.json` to `episodes/your-episode.json`.
2. Place local images under `public/media/`, which is ignored by Git. Paths in the episode start with `media/`.
3. Update the title, shots, source notes and permission basis.
4. Run `npm run render -- episodes/your-episode.json out/your-episode.mp4`.
5. Watch the full export before publishing. Check crops, text, timing and rights.

Each shot has `image`, `seconds`, `text`, `from`, `to`, `source` and `rights`. Camera positions use `[x, y, zoom]`: x and y are object-position percentages from 0 to 100; zoom is 1 to 2. Text is a scene caption, not speech-aligned subtitles. Duration is rounded to whole frames per shot.

The sample is a silent, 9-second motion test using an original SVG. Voiceover, anime footage, generated video and posting are not implemented yet.

## Agent workflow

Ask an agent to edit an episode, validate it, render it and inspect the output. The episode file is the storyboard. No orchestration framework or provider adapters are needed yet.

`AGENTS.md` contains working rules. `adr/` records decisions and how to validate them. `npm run check` checks types, episode behavior and repository text. It cannot assess writing quality or grant media permissions.

Dependencies are pinned in `package-lock.json`. No project license has been selected. Check the [Remotion license](https://www.remotion.dev/license) before changing the usage or team size. See [Remotion's parameterized rendering documentation](https://www.remotion.dev/docs/parameterized-rendering) for the rendering model.
