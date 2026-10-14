import {createHash} from 'node:crypto';
import {readFile, writeFile, stat, rename} from 'node:fs/promises';
import path from 'node:path';
import {readFrozenRequest} from './request.mjs';

async function optionalJson(file) {try {return JSON.parse(await readFile(file, 'utf8'));} catch (error) {if (error.code === 'ENOENT') return null; throw error;}}
async function save(file, value) {const temporary = `${file}.partial`; await writeFile(temporary, JSON.stringify(value, null, 2) + '\n'); await rename(temporary, file);}
async function exists(file) {try {await stat(file); return true;} catch (error) {if (error.code === 'ENOENT') return false; throw error;}}
async function writeStable(file, content) {
  try {await writeFile(file, content, {flag: 'wx'});}
  catch (error) {if (error.code !== 'EEXIST' || await readFile(file, 'utf8') !== content) throw error;}
}
function nonempty(value) {return typeof value === 'string' && Boolean(value.trim());}

function validateScript(script, request) {
  if (!script || script.version !== 1 || script.style !== request.choices.style || script.language !== request.language ||
      !nonempty(script.idea) || script.productReferenceRole !== 'product' || !nonempty(script.imagePrompt) || !nonempty(script.videoPrompt) ||
      !Array.isArray(script.cast) || script.cast.length !== 2 || !Array.isArray(script.beats) || script.beats.length < 3) throw new Error('Invalid skit script, style, language or product role');
  const names = script.cast.map(person => person.id);
  if (new Set(names).size !== 2 || script.cast.some(person => !nonempty(person.id) || !nonempty(person.name) || !nonempty(person.role))) throw new Error('Skit needs two distinct characters');
  const total = Math.round(request.execution.durationSec * 30);
  let cursor = 0;
  for (const beat of script.beats) {
    if (!['hook', 'conflict', 'payoff'].includes(beat.kind) || !Number.isInteger(beat.fromFrame) || !Number.isInteger(beat.toFrame) ||
        beat.fromFrame !== cursor || beat.toFrame <= cursor || !nonempty(beat.action) || !Array.isArray(beat.dialogue) ||
        beat.dialogue.some(line => !names.includes(line.speaker) || !nonempty(line.text))) throw new Error('Invalid skit beat timing, action or dialogue');
    cursor = beat.toFrame;
  }
  if (cursor !== total || script.beats[0].kind !== 'hook' || !script.beats.some(beat => beat.kind === 'conflict') ||
      !script.beats.some(beat => beat.kind === 'payoff' && beat.usesProduct === true)) throw new Error('Skit needs a timed hook, conflict and product payoff');
  return script;
}

function capabilityPlan(request, capabilities) {
  const refs = request.references ?? [];
  if (!refs.some(ref => ref.role === 'product')) return 'Missing product reference';
  if (!capabilities?.referenceVideo) return 'Selected video route lacks product reference conditioning';
  if (!capabilities?.speech || request.execution.audio !== true) return 'Selected route lacks verified spoken dialogue';
  if (refs.filter(ref => ref.role === 'presenter').length < 2 && !capabilities?.castGeneration) return 'Second character requires verified cast generation or a presenter reference';
  const costs = capabilities.stages;
  if (!costs || ['script', 'image', 'video'].some(name => !Number.isFinite(costs[name]) || costs[name] < 0)) return 'Stage costs are not verified';
  const total = costs.script + costs.image + costs.video;
  if (total > request.execution.budget?.maxUsd) return 'Planned skit stages exceed frozen USD budget';
  return [{name: 'script', estimatedUsd: costs.script}, {name: 'image', estimatedUsd: costs.image}, {name: 'video', estimatedUsd: costs.video}];
}

/** Run the skit family using frozen context and injected, capability-checked operations. */
export async function runSkitWorkflow({root, projectId, requestId, agent, execute, capabilities, checkpoint = null}) {
  if (!agent?.plan || !agent?.inspectFrame || !agent?.inspectVideo || typeof execute !== 'function') throw new Error('Skit requires a planner, inspectors and execution adapter');
  const frozen = await readFrozenRequest(root, projectId, requestId);
  const request = frozen.request;
  if (request.schemaVersion !== 1 || request.projectId !== projectId || request.id !== requestId || request.workflow !== 'skit' || request.action !== 'generate') throw new Error('Wrong frozen skit request');
  const run = path.join(root, 'projects', projectId, 'work', 'product-video', requestId);
  const context = [];
  for (const entry of frozen.context.files) {
    const file = path.join(run, entry.snapshotPath);
    const bytes = await readFile(file);
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Frozen context changed: ${entry.path}`);
    context.push({...entry, file, text: entry.role.startsWith('reference:') ? null : bytes.toString('utf8')});
  }
  const styleFiles = context.filter(entry => entry.role === 'style');
  if (styleFiles.length !== 1 || !styleFiles[0].path.endsWith(`/styles/skit/${request.choices.style}.md`) ||
      context.filter(entry => entry.role === 'workflow').length !== 1 ||
      !context.find(entry => entry.role === 'workflow').path.endsWith('/workflows/skit.md')) throw new Error('Frozen skit context has wrong workflow or style');
  const references = context.filter(entry => entry.role.startsWith('reference:')).map(entry => ({role: entry.role.slice(10), path: entry.path, file: entry.file, sha256: entry.sha256}));
  if (!references.some(ref => ref.role === 'product')) throw new Error('Frozen skit context has no product reference');
  const stateFile = path.join(run, 'skit-state.json');
  const state = await optionalJson(stateFile) ?? {status: 'new', references: references.map(({role, path, sha256}) => ({role, path, sha256}))};
  if (['finishing-ready', 'unsupported', 'rejected', 'submission-uncertain'].includes(state.status)) return state;
  const stagePlan = capabilityPlan(request, capabilities);
  if (typeof stagePlan === 'string') {state.status = 'unsupported'; state.reason = stagePlan; await save(stateFile, state); return state;}
  state.stagePlan = stagePlan;
  const operation = async (name, input) => {
    try {return await execute(name, input);}
    catch (error) {
      if (error.code !== 'UNSUPPORTED') throw error;
      state.status = 'unsupported'; state.reason = `${name}: ${error.message}`; await save(stateFile, state); return null;
    }
  };
  if (!state.script) {
    state.script = validateScript(await agent.plan({request, context, stagePlan}), request);
    await writeStable(path.join(run, 'skit-script.json'), JSON.stringify(state.script, null, 2) + '\n');
    await writeStable(path.join(run, 'skit-image-prompt.md'), state.script.imagePrompt);
    await writeStable(path.join(run, 'skit-video-prompt.md'), state.script.videoPrompt);
    state.status = 'script-ready'; await save(stateFile, state);
  }
  if (checkpoint === 'script') return state;
  if (!state.image) {
    state.image = await operation('prepare-image', {run, request, script: state.script, references, stagePlan});
    if (state.status === 'unsupported') return state;
    state.status = 'image-prepared'; await save(stateFile, state);
  }
  if (!state.frameDecision) {
    const file = path.join(run, 'skit-frame.bin');
    if (!await exists(file)) throw new Error('Skit first frame missing');
    state.frameDecision = await agent.inspectFrame({file, request, context, script: state.script});
    if (typeof state.frameDecision?.accepted !== 'boolean') throw new Error('Skit first-frame inspection is incomplete');
    state.status = state.frameDecision.accepted ? 'frame-accepted' : 'rejected'; await save(stateFile, state);
  }
  if (!state.frameDecision.accepted) return state;
  if (!state.videoSubmission) {
    state.videoSubmission = await operation('submit-video', {run, request, script: state.script, references, frame: path.join(run, 'skit-frame.bin'), speech: true, stagePlan});
    if (state.status === 'unsupported') return state;
    if (!state.videoSubmission?.jobId) {
      state.status = 'submission-uncertain'; state.reason = 'Skit video submission has no durable job ID; inspect the provider before resuming';
      await save(stateFile, state); return state;
    }
    state.status = 'video-accepted'; await save(stateFile, state);
  }
  if (!state.videoStatus?.terminal) {
    state.videoStatus = await operation('poll', {run, request, submission: state.videoSubmission});
    if (state.status === 'unsupported') return state;
    state.status = state.videoStatus?.terminal ? state.videoStatus.status : 'video-pending'; await save(stateFile, state);
  }
  if (state.videoStatus.status !== 'completed') return state;
  if (!state.rawArtifact) {
    state.rawArtifact = await operation('download', {run, request, submission: state.videoSubmission});
    if (state.status === 'unsupported') return state;
    state.status = 'raw-downloaded'; await save(stateFile, state);
  }
  if (!state.review) {
    const file = path.join(run, 'skit-raw.mp4');
    if (!await exists(file)) throw new Error('Skit raw video missing');
    state.review = await agent.inspectVideo({file, request, context, script: state.script});
    if (typeof state.review?.accepted !== 'boolean' || !Array.isArray(state.review.acceptedRanges)) throw new Error('Skit video review is incomplete');
    state.status = state.review.accepted ? 'raw-accepted' : 'rejected'; await save(stateFile, state);
  }
  if (!state.review.accepted) return state;
  state.finishPlan = {version: 1, fps: 30, segments: state.review.acceptedRanges.map(range => ({source: 'skit-raw.mp4', fromFrame: range.fromFrame, toFrame: range.toFrame, kind: 'motion'})),
    captions: state.script.caption ? [{text: state.script.caption, fromFrame: Math.max(0, Math.round(request.execution.durationSec * 30) - 45), toFrame: Math.round(request.execution.durationSec * 30)}] : [],
    audio: {source: 'native'}};
  state.status = 'finishing-ready'; await save(stateFile, state);
  return state;
}
