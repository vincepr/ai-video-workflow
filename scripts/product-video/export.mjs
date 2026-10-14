import {copyFile, mkdir, readFile, realpath, rename, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {projectPaths, reserveIteration} from '../projects.mjs';
import {recordRender} from '../render-history.mjs';
import {readFrozenRequest} from './request.mjs';

async function json(file) {return JSON.parse(await readFile(file, 'utf8'));}
async function optionalJson(file) {try {return await json(file);} catch (error) {if (error.code === 'ENOENT') return null; throw error;}}
async function writeJson(file, value) {await writeFile(file, JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});}
function relative(root, file) {return path.relative(root, file).split(path.sep).join('/');}

/** Register one locally finished MP4 as a new numbered, immutable product-video export. */
export async function registerFinishedExport({root, projectId, requestId, finishedFile, label}) {
  const paths = projectPaths(root, projectId);
  const run = path.join(paths.work, 'product-video', requestId);
  const actualRun = await realpath(run);
  const actualFile = await realpath(finishedFile);
  if (path.relative(actualRun, actualFile).startsWith('..') || path.isAbsolute(path.relative(actualRun, actualFile)) || path.extname(actualFile).toLowerCase() !== '.mp4') throw new Error('Finished file must be an MP4 inside the frozen run');
  if (!(await stat(actualFile)).isFile()) throw new Error('Finished file is not a file');
  const frozen = await readFrozenRequest(root, projectId, requestId);
  if (frozen.request.id !== requestId || frozen.request.projectId !== projectId) throw new Error('Frozen request does not belong to this project');
  const state = await json(path.join(run, 'direct-state.json'));
  if (state.status !== 'finishing-ready' || state.finishPlan?.version !== 1) throw new Error('Direct run is not ready for finishing');
  const report = await json(path.join(run, 'finish-report.json'));
  if (path.resolve(report.file) !== actualFile || report.frames <= 0 || report.fps !== state.finishPlan.fps) throw new Error('Finish report does not match the file or plan');
  const hash = createHash('sha256').update(await readFile(actualFile)).digest('hex');
  const title = String(label || frozen.request.brief.product).trim();
  const iteration = await reserveIteration(root, projectId, title);
  await copyFile(actualFile, iteration.output);
  await writeJson(path.join(iteration.directory, 'finish-plan.json'), state.finishPlan);
  await writeJson(path.join(iteration.directory, 'finish-report.json'), report);
  await writeJson(path.join(iteration.directory, 'frozen-request.json'), frozen);
  const sourceAttribution = [];
  for (const reference of frozen.request.references ?? []) {
    const name = reference.path;
    if (typeof name !== 'string' || !name.startsWith(`projects/${projectId}/media/`) || name.includes('\\') || name.split('/').includes('..')) throw new Error('Invalid frozen reference path');
    const file = path.resolve(root, name);
    const sidecar = path.join(path.dirname(file), `${path.parse(file).name}.attribution.json`);
    const attribution = await optionalJson(sidecar);
    if (attribution) sourceAttribution.push({reference: name, attribution});
  }
  await writeJson(path.join(iteration.directory, 'source-attribution.json'), sourceAttribution);
  const credits = [...new Set(sourceAttribution.filter(item => item.attribution.attributionRequired).map(item => item.attribution.exactCredit).filter(Boolean))];
  const description = [frozen.request.brief.product, frozen.request.brief.cta, ...credits].filter(Boolean).join('\n\n').trim();
  const sourceLines = (report.sources ?? []).map(source => `- ${source.path} (${source.sha256})`).join('\n');
  const context = `# Product-video export\n\nRequest: ${requestId}\nWorkflow: ${frozen.request.workflow ?? 'direct'}\nCreative choice: ${JSON.stringify(frozen.request.choices ?? {})}\n\n## Sources\n\n${sourceLines || 'Not recorded'}\n\nReference attribution is in source-attribution.json.\n\n## Edit\n\n${report.frames} frames at ${report.fps} fps. Segment ranges and caption windows are in finish-plan.json. Raw output remains in the frozen run.\n\n## Release questions\n\nCheck source rights, factual claims and destination eligibility before publication.\n`;
  await writeFile(path.join(iteration.directory, 'context.md'), context, {flag: 'wx'});
  const episode = {title, shots: [], productVideo: {requestId, finishPlan: state.finishPlan, sourceSha256: report.sources ?? [], outputSha256: hash}};
  const recorded = await recordRender(root, {output: iteration.output, episode, sessionId: projectId, label: title,
    renderer: {kind: 'product-video-ffmpeg', fps: report.fps, frames: report.frames, canvas: report.canvas}});
  const release = {description, music: null};
  await writeFile(`${iteration.output}.description.txt`, description + '\n', {flag: 'wx'});
  await writeJson(`${iteration.output}.release.json`, {renderId: recorded.id, file: recorded.file, ...release});
  const historyFile = path.join(paths.history, `${recorded.id}.json`);
  const updated = {...recorded, release, snapshot: {...recorded.snapshot, productVideo: episode.productVideo}};
  const next = `${historyFile}.partial`;
  await writeFile(next, JSON.stringify(updated, null, 2) + '\n', {flag: 'wx'});
  await rename(next, historyFile);
  return {id: iteration.id, output: iteration.output, file: relative(root, iteration.output), renderId: recorded.id, sha256: hash};
}
