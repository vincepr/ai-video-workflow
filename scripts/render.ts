import {readFile, access, mkdir, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {validateEpisode} from '../src/episode';
import {recordRender} from './render-history.mjs';
import {createHash} from 'node:crypto';

const input = process.argv[2] ?? 'episodes/sample.json';
const output = path.resolve(process.argv[3] ?? 'out/sample.mp4');
const episode = validateEpisode(JSON.parse(await readFile(input, 'utf8')));
const sessionFlag = process.argv.indexOf('--session');
const pickers = sessionFlag >= 0 ? JSON.parse(await readFile(process.argv[sessionFlag + 1], 'utf8')) : null;
for (const shot of episode.shots) {
  await access(path.join('public', shot.image));
}
if (episode.audio) await access(path.join('public', episode.audio));
await mkdir(path.dirname(output), {recursive: true});
const propsFile = `${output}.props.json`;
await writeFile(propsFile, JSON.stringify({episode}, null, 2) + '\n');
const result = spawnSync(process.execPath, [
  'node_modules/@remotion/cli/remotion-cli.js',
  'render', 'src/index.tsx', 'PanelMotion', output,
  '--props', propsFile, '--codec', 'h264',
], {stdio: 'inherit'});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
const relativeOutput = path.relative(path.resolve('out'), output);
if (result.status === 0 && relativeOutput !== '..' && !relativeOutput.startsWith('..' + path.sep) && !path.isAbsolute(relativeOutput)) {
  const sessionId = pickers?.sessionId ?? (episode.title.split(':')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'episode');
  const sourceHash = createHash('sha256').update(await readFile('src/Video.tsx')).digest('hex');
  await recordRender(process.cwd(), {output, episode, pickers, sessionId, renderer: {sourceHash, fps: 30, width: 1080, height: 1920}});
}
