import {readFile, writeFile, mkdir, access, realpath} from 'node:fs/promises';
import {execFileSync, spawnSync} from 'node:child_process';
import path from 'node:path';
import {approvedBrief} from '../desk/workflow.mjs';
import {art} from '../desk/art.mjs';
import {buildEpisode} from '../src/production';
import {projectPaths, readProject, reserveIteration} from './projects.mjs';

const input = process.argv[2];
if (!input) throw new Error('Usage: npm run produce -- <approved-brief.json> --project <id> --assets <images.json> [--silent] [--prepare-only]');
const projectArgument = process.argv.indexOf('--project');
const projectId = projectArgument >= 0 ? process.argv[projectArgument + 1] : undefined;
if (!projectId || projectId.startsWith('--')) throw new Error('--project needs a project ID');
await readProject(process.cwd(), projectId);
const paths = projectPaths(process.cwd(), projectId);
if (!path.resolve(input).startsWith(paths.directory + path.sep)) throw new Error('Brief is outside the assigned project');
const brief = approvedBrief(JSON.parse(await readFile(input, 'utf8')));
const assetArgument = process.argv.indexOf('--assets');
const assetFile = assetArgument < 0 ? undefined : process.argv[assetArgument + 1];
if (assetArgument >= 0 && (!assetFile || assetFile.startsWith('--'))) throw new Error('--assets needs an image manifest path');
if (assetFile && !path.resolve(assetFile).startsWith(paths.directory + path.sep)) throw new Error('Image manifest is outside the assigned project');
if (assetFile && process.argv.includes('--symbolic')) throw new Error('Choose source images or --symbolic');
const assets = assetFile ? JSON.parse(await readFile(assetFile, 'utf8')) : process.argv.includes('--symbolic') ? 'symbolic' : undefined;
// Validate before creating assets or invoking speech synthesis.
const prepared = buildEpisode(brief, brief.seconds, undefined, assets);
if (Array.isArray(assets)) {
  const mediaRoot = await realpath(paths.media);
  for (const shot of prepared.shots) {
    const resolved = await realpath(path.join(paths.directory, shot.image));
    if (!resolved.startsWith(mediaRoot + path.sep)) throw new Error('Image is outside project media');
    await access(resolved);
  }
}
const run = await reserveIteration(process.cwd(), projectId, brief.title);
const outputDirectory = run.directory;
const generatedMedia = `media/runs/${run.id}`;
const mediaDirectory = path.join(paths.directory, generatedMedia);
await mkdir(outputDirectory, {recursive: true});
await mkdir(mediaDirectory, {recursive: true});
await writeFile(path.join(outputDirectory, 'approved-brief.json'), JSON.stringify(brief, null, 2) + '\n');
const scriptFile = path.join(outputDirectory, 'script.txt');
await writeFile(scriptFile, brief.script + '\n');
const motif = 'eye';
for (let i = 0; assets === 'symbolic' && i < 3; i++) {
  const svg = art(motif).replace('viewBox="0 0 500 300"', 'width="1080" height="1920" viewBox="0 0 500 889"')
    .replace('<g ', `<rect width="500" height="889" fill="#222a24"/><g transform="translate(0 ${160 + i * 45})" `);
  await writeFile(path.join(mediaDirectory, `${brief.conceptId}-${i}.svg`), svg);
}
let seconds = brief.seconds;
let audio: string | undefined;
if (!process.argv.includes('--silent')) {
  if (process.platform !== 'win32') throw new Error('Local scratch voice currently needs Windows. Use --silent or provide a licensed voice track.');
  audio = `${generatedMedia}/voice.wav`;
  const audioFile = path.join(paths.directory, audio);
  const speechScript = await readFile('scripts/scratch-voice.ps1', 'utf8');
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    `& {\n${speechScript}\n} -TextFile $env:CREATOR_VOICE_TEXT -OutputPath $env:CREATOR_VOICE_OUTPUT`], {
    env: {...process.env, CREATOR_VOICE_TEXT: scriptFile, CREATOR_VOICE_OUTPUT: audioFile},
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  const probe = execFileSync(process.execPath, ['node_modules/@remotion/cli/remotion-cli.js', 'ffprobe',
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', audioFile], {encoding: 'utf8'});
  seconds = Number(JSON.parse(probe).format.duration);
}
const episode = buildEpisode(brief, seconds, audio, assets, generatedMedia);
const episodeFile = path.join(outputDirectory, 'episode.json');
await writeFile(episodeFile, JSON.stringify(episode, null, 2) + '\n');
console.log(`Prepared ${episodeFile}. Duration: ${seconds.toFixed(1)}s. Captions use approximate timing.`);
if (!process.argv.includes('--prepare-only')) {
  const result = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/render.ts',
    episodeFile, run.output, '--project', projectId], {stdio: 'inherit'});
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
