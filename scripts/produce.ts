import {readFile, writeFile, mkdir, access} from 'node:fs/promises';
import {execFileSync, spawnSync} from 'node:child_process';
import path from 'node:path';
import {approvedBrief} from '../sites/creator-desk/app/workflow.mjs';
import {art} from '../sites/creator-desk/app/art.mjs';
import {buildEpisode} from '../src/production';

const input = process.argv[2];
if (!input) throw new Error('Usage: npm run produce -- <approved-brief.json> --assets <images.json> [--silent] [--prepare-only]');
const brief = approvedBrief(JSON.parse(await readFile(input, 'utf8')));
const assetArgument = process.argv.indexOf('--assets');
const assetFile = assetArgument < 0 ? undefined : process.argv[assetArgument + 1];
if (assetArgument >= 0 && (!assetFile || assetFile.startsWith('--'))) throw new Error('--assets needs an image manifest path');
if (assetFile && process.argv.includes('--symbolic')) throw new Error('Choose source images or --symbolic');
const assets = assetFile ? JSON.parse(await readFile(assetFile, 'utf8')) : process.argv.includes('--symbolic') ? 'symbolic' : undefined;
// Validate before creating assets or invoking speech synthesis.
const prepared = buildEpisode(brief, brief.seconds, undefined, assets);
if (Array.isArray(assets)) {
  for (const shot of prepared.shots) await access(path.join('public', shot.image));
}
const outputDirectory = path.resolve('out', `homunculus-${brief.conceptId}`);
const mediaDirectory = path.resolve('public/media/homunculus');
await mkdir(outputDirectory, {recursive: true});
await mkdir(mediaDirectory, {recursive: true});
await writeFile(path.join(outputDirectory, 'approved-brief.json'), JSON.stringify(brief, null, 2) + '\n');
const scriptFile = path.join(outputDirectory, 'script.txt');
await writeFile(scriptFile, brief.script + '\n');
const motif = {perception: 'eye', car: 'car', observer: 'mirror'}[brief.conceptId as string];
for (let i = 0; assets === 'symbolic' && i < 3; i++) {
  const svg = art(motif).replace('viewBox="0 0 500 300"', 'width="1080" height="1920" viewBox="0 0 500 889"')
    .replace('<g ', `<rect width="500" height="889" fill="#222a24"/><g transform="translate(0 ${160 + i * 45})" `);
  await writeFile(path.join(mediaDirectory, `${brief.conceptId}-${i}.svg`), svg);
}
let seconds = brief.seconds;
let audio: string | undefined;
if (!process.argv.includes('--silent')) {
  if (process.platform !== 'win32') throw new Error('Local scratch voice currently needs Windows. Use --silent or provide a licensed voice track.');
  audio = `media/homunculus/${brief.conceptId}-voice.wav`;
  const audioFile = path.resolve('public', audio);
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
const episode = buildEpisode(brief, seconds, audio, assets);
const episodeFile = path.join(outputDirectory, 'episode.json');
await writeFile(episodeFile, JSON.stringify(episode, null, 2) + '\n');
console.log(`Prepared ${episodeFile}. Duration: ${seconds.toFixed(1)}s. Captions use approximate timing.`);
if (!process.argv.includes('--prepare-only')) {
  const result = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/render.ts',
    episodeFile, path.join(outputDirectory, 'video.mp4')], {stdio: 'inherit'});
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
