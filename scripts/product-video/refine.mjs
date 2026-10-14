import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {copyFile, mkdir, readFile, realpath, stat, writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {projectPaths} from '../projects.mjs';
import {readFrozenRequest} from './request.mjs';

const execute = promisify(execFile);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
async function json(file) {return JSON.parse(await readFile(file, 'utf8'));}
async function exists(file) {try {await stat(file); return true;} catch (error) {if (error.code === 'ENOENT') return false; throw error;}}
function localName(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || path.isAbsolute(value) ||
      value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Invalid refinement source path');
  return value;
}
function location(root, projectId, requestId, refinementId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refinementId)) throw new Error('Invalid refinement ID');
  const paths = projectPaths(root, projectId);
  return {run: path.join(paths.work, 'product-video', requestId), directory: path.join(paths.work, 'product-video', requestId, 'refinements', refinementId)};
}

/** Stage one revised local edit without changing the frozen request or accepted raw media. */
export async function prepareLocalRefinement({root, projectId, requestId, refinementId, plan}) {
  const {run, directory} = location(root, projectId, requestId, refinementId);
  const frozen = await readFrozenRequest(root, projectId, requestId);
  if (frozen.request.id !== requestId || frozen.request.projectId !== projectId || frozen.request.workflow !== 'direct' || frozen.request.action !== 'generate') throw new Error('Wrong frozen direct request');
  const state = await json(path.join(run, 'direct-state.json'));
  if (state.status !== 'finishing-ready' || state.review?.accepted !== true || state.finishPlan?.version !== 1) throw new Error('Direct run has no accepted raw media ready for local finishing');
  if (plan?.version !== 1 || plan.fps !== state.finishPlan.fps || !Array.isArray(plan.segments) || !plan.segments.length) throw new Error('Invalid local edit plan');
  const allowed = new Set(state.finishPlan.segments.map(segment => localName(segment.source)));
  if (state.finishPlan.audio?.source && !['none', 'native'].includes(state.finishPlan.audio.source)) allowed.add(localName(state.finishPlan.audio.source));
  const required = new Set(plan.segments.map(segment => localName(segment.source)));
  if (plan.audio?.source && !['none', 'native'].includes(plan.audio.source)) required.add(localName(plan.audio.source));
  for (const name of required) if (!allowed.has(name)) throw new Error(`Refinement source was not in the accepted edit: ${name}`);
  const runReal = await realpath(run);
  const sources = [];
  for (const name of required) {
    const file = await realpath(path.join(run, name));
    const relative = path.relative(runReal, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !(await stat(file)).isFile()) throw new Error('Refinement source leaves the frozen run');
    sources.push({name, file, sha256: sha256(await readFile(file))});
  }
  const metadataFile = path.join(directory, 'refinement.json');
  if (await exists(directory)) {
    const previous = await json(metadataFile);
    if (JSON.stringify(previous.plan) !== JSON.stringify(plan) || JSON.stringify(previous.sources.map(({name, sha256}) => ({name, sha256}))) !== JSON.stringify(sources.map(({name, sha256}) => ({name, sha256})))) throw new Error('Refinement ID already exists with different inputs');
    for (const source of sources) if (sha256(await readFile(path.join(directory, source.name))) !== source.sha256) throw new Error('Refinement source copy changed');
    return {status: 'prepared', directory, planFile: path.join(directory, 'edit-plan.json'), sources: previous.sources};
  }
  await mkdir(path.dirname(directory), {recursive: true});
  await mkdir(directory);
  for (const source of sources) {
    const destination = path.join(directory, source.name);
    await mkdir(path.dirname(destination), {recursive: true});
    await copyFile(source.file, destination, constants.COPYFILE_EXCL);
    if (sha256(await readFile(destination)) !== source.sha256) throw new Error('Refinement source copy failed verification');
  }
  await writeFile(path.join(directory, 'edit-plan.json'), JSON.stringify(plan, null, 2) + '\n', {flag: 'wx'});
  await writeFile(metadataFile, JSON.stringify({version: 1, requestId, refinementId, plan,
    sources: sources.map(({name, sha256}) => ({name, sha256}))}, null, 2) + '\n', {flag: 'wx'});
  return {status: 'prepared', directory, planFile: path.join(directory, 'edit-plan.json'), sources: sources.map(({name, sha256}) => ({name, sha256}))};
}

/** Render locally; export registration needs registerFinishedExport's variantDirectory option. */
export async function renderLocalRefinement({root, projectId, requestId, refinementId, plan, ffmpeg, ffprobe, python = 'python'}) {
  if (!path.isAbsolute(ffmpeg ?? '') || !path.isAbsolute(ffprobe ?? '')) throw new Error('Pass explicit absolute full FFmpeg and FFprobe paths');
  const prepared = await prepareLocalRefinement({root, projectId, requestId, refinementId, plan});
  const {directory, planFile} = prepared;
  const finishedFile = path.join(directory, 'finished.mp4');
  const reportFile = path.join(directory, 'finish-report.json');
  if (await exists(finishedFile) || await exists(reportFile)) {
    if (!await exists(finishedFile) || !await exists(reportFile)) throw new Error('Incomplete refinement render; use a new refinement ID');
    const report = await json(reportFile);
    if (report.outputSha256 !== sha256(await readFile(finishedFile))) throw new Error('Refinement output changed after render');
    return {status: 'rendered-needs-export', directory, finishedFile, reportFile, planFile, sources: prepared.sources};
  }
  const script = path.join(root, '.agents/skills/generate-product-video/scripts/finish.py');
  try {
    await execute(python, [script, 'render', directory, '--plan', planFile, '--output', finishedFile, '--ffmpeg', ffmpeg, '--ffprobe', ffprobe],
      {windowsHide: true, timeout: 600000, maxBuffer: 1024 * 1024});
  } catch (error) {throw new Error(`Local refinement render failed: ${String(error.stderr || error.message).slice(-3000)}`);}
  const report = await json(reportFile);
  if (report.outputSha256 !== sha256(await readFile(finishedFile))) throw new Error('Refinement output changed after render');
  for (const source of prepared.sources) if (sha256(await readFile(path.join(directory, source.name))) !== source.sha256) throw new Error('Accepted raw source changed during refinement');
  return {status: 'rendered-needs-export', directory, finishedFile, reportFile, planFile, sources: prepared.sources};
}
