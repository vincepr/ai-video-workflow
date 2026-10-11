import {readFile, access, mkdir, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {validateEpisode} from '../src/episode';

const input = process.argv[2] ?? 'episodes/sample.json';
const output = path.resolve(process.argv[3] ?? 'out/sample.mp4');
const episode = validateEpisode(JSON.parse(await readFile(input, 'utf8')));
for (const shot of episode.shots) {
  await access(path.join('public', shot.image));
}
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
