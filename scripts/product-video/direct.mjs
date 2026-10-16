import {readFile, writeFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readFrozenRequest} from './request.mjs';
import {readFirstFrameReview} from './frame-review.mjs';

async function json(file) {
  try {return JSON.parse(await readFile(file, 'utf8'));}
  catch (error) {if (error.code === 'ENOENT') return null; throw error;}
}
async function save(file, value) {
  const next = `${file}.partial`;
  await writeFile(next, JSON.stringify(value, null, 2) + '\n');
  const {rename} = await import('node:fs/promises');
  await rename(next, file);
}
async function exists(file) {try {await stat(file); return true;} catch (error) {if (error.code === 'ENOENT') return false; throw error;}}

export async function runDirectWorkflow({root, projectId, requestId, agent, execute}) {
  if (!agent?.plan || !agent?.inspectFrame || !agent?.inspectVideo || typeof execute !== 'function') throw new Error('Direct workflow requires an agent and execution adapter');
  const run = path.join(root, 'projects', projectId, 'work', 'product-video', requestId);
  const frozen = await readFrozenRequest(root, projectId, requestId);
  const request = frozen.request;
  if (request.projectId !== projectId || request.id !== requestId || request.workflow !== 'direct' || request.action !== 'generate') throw new Error('Wrong frozen direct request');
  const context = [];
  for (const entry of frozen.context.files) {
    const snapshot = path.join(run, entry.snapshotPath);
    const bytes = await readFile(snapshot);
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Frozen context changed: ${entry.path}`);
    context.push({...entry, file: snapshot, text: entry.role.startsWith('reference:') ? null : bytes.toString('utf8')});
  }
  const stateFile = path.join(run, 'direct-state.json');
  const state = await json(stateFile) ?? {status: 'new', sources: context.filter(file => file.role.startsWith('reference:')).map(({role, path, sha256}) => ({role: role.slice('reference:'.length), path, sha256}))};
  if (state.status === 'finishing-ready') return state;
  if (!state.plan) {
    const plan = await agent.plan({request, context});
    if (!plan?.outline || !plan?.imagePrompt || !plan?.videoPrompt) throw new Error('Agent must supply an outline and separate image/video prompts');
    state.plan = {outline: plan.outline};
    await writeFile(path.join(run, 'image-prompt.md'), plan.imagePrompt, {flag: 'wx'});
    await writeFile(path.join(run, 'video-prompt.md'), plan.videoPrompt, {flag: 'wx'});
    state.status = 'planned'; await save(stateFile, state);
  }
  if (!state.imageSubmission) {
    state.imageSubmission = await execute('submit-image', {run, request});
    state.status = 'image-submitted'; await save(stateFile, state);
  }
  if (!state.frameDecision) {
    const file = path.join(run, 'first-frame.bin');
    if (!await exists(file)) throw new Error('First frame missing after image operation');
    const decision = await agent.inspectFrame({file, request, context});
    if (!decision || typeof decision.accepted !== 'boolean' || !Number.isInteger(decision.width) || !Number.isInteger(decision.height) || !decision.inventory || !decision.crop || !decision.mask || !decision.endingBounds) throw new Error('First-frame inspection is incomplete');
    state.frameDecision = decision;
    state.status = decision.accepted ? 'frame-accepted' : 'frame-rejected'; await save(stateFile, state);
  }
  if (!state.frameDecision.accepted) return state;
  if (request.execution.reviewMode === 'first-frame' && !(await readFirstFrameReview(root, projectId, requestId))?.approved) {
    state.status = 'first-frame-review'; await save(stateFile, state); return state;
  }
  if (!state.videoSubmission) {
    state.videoSubmission = await execute('submit-video', {run, request});
    state.status = 'video-submitted'; await save(stateFile, state);
  }
  if (!state.videoStatus?.terminal) {
    state.videoStatus = await execute('poll', {run, request, submission: state.videoSubmission});
    state.status = state.videoStatus?.terminal ? state.videoStatus.status : 'video-pending'; await save(stateFile, state);
  }
  if (state.videoStatus.status !== 'completed') return state;
  if (!state.rawArtifact) {
    state.rawArtifact = await execute('download', {run, request, submission: state.videoSubmission});
    state.status = 'raw-downloaded'; await save(stateFile, state);
  }
  if (!state.review) {
    const file = path.join(run, 'video-raw.mp4');
    if (!await exists(file)) throw new Error('Raw video missing after download');
    state.review = await agent.inspectVideo({file, request, context});
    if (!state.review || typeof state.review.accepted !== 'boolean' || !Array.isArray(state.review.acceptedRanges) || !Array.isArray(state.review.captions)) throw new Error('Raw video inspection and first text edit are incomplete');
    state.status = state.review.accepted ? 'raw-accepted' : 'raw-rejected'; await save(stateFile, state);
  }
  if (!state.review.accepted) return state;
  const segments = state.review.acceptedRanges.map(({fromFrame, toFrame}) => ({source: 'video-raw.mp4', fromFrame, toFrame, kind: 'motion'}));
  const frames = segments.reduce((sum, segment) => sum + segment.toFrame - segment.fromFrame, 0);
  if (state.review.captions.some(item => typeof item.text !== 'string' || !item.text.trim() || !Number.isInteger(item.fromFrame) || !Number.isInteger(item.toFrame) || item.fromFrame < 0 || item.toFrame <= item.fromFrame || item.toFrame > frames)) throw new Error('First text edit has an invalid caption window');
  state.finishPlan = {version: 1, fps: 30, segments, captions: state.review.captions, audio: {source: 'none'}};
  state.status = 'finishing-ready'; await save(stateFile, state);
  return state;
}
