import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {prepareRender} from './render-job';
import {recordRender} from './render-history.mjs';
import {createHash} from 'node:crypto';

const args = process.argv.slice(2);
function option(name: string) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`);
  args.splice(index, 2); return value;
}
const projectId = option('--project');
const session = option('--session');
if (args.some(arg => arg.startsWith('--')) || args.length > 2) throw new Error('Usage: npm run render -- [episode.json] [output.mp4] --project <id> [--session <session.json>]');
const {episode, pickers, output, propsFile, publicDirectory} = await prepareRender(process.cwd(), {projectId, input: args[0], output: args[1], session});
const result = spawnSync(process.execPath, [
  'node_modules/@remotion/cli/remotion-cli.js',
  'render', 'src/index.tsx', 'PanelMotion', output,
  '--props', propsFile, '--codec', 'h264',
  '--public-dir', publicDirectory,
], {stdio: 'inherit'});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
const relativeOutput = path.relative(path.resolve('out'), output);
if (result.status === 0 && (projectId || (relativeOutput !== '..' && !relativeOutput.startsWith('..' + path.sep) && !path.isAbsolute(relativeOutput)))) {
  const sessionId = projectId ?? pickers?.sessionId ?? (episode.title.split(':')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'episode');
  const sourceHash = createHash('sha256').update(await readFile('src/Video.tsx')).digest('hex');
  await recordRender(process.cwd(), {output, episode, pickers, sessionId, renderer: {sourceHash, fps: 30, width: 1080, height: 1920}});
}
