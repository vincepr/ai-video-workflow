import {readFile, writeFile, rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {readFrozenRequest} from './request.mjs';

async function optionalJson(file) {
  try {return JSON.parse(await readFile(file, 'utf8'));}
  catch (error) {if (error.code === 'ENOENT') return null; throw error;}
}
async function save(file, state) {
  const temporary = `${file}.partial`;
  await writeFile(temporary, JSON.stringify(state, null, 2) + '\n');
  await rename(temporary, file);
}
function localAsset(value, name) {
  if (typeof value?.path !== 'string' || !/^[a-z0-9][a-z0-9/._-]*$/i.test(value.path) || value.path.split('/').some(part => part === '..' || part === '.' || !part)) throw new Error(`Invalid ${name} asset path`);
  return value;
}
function validateScript(script, request) {
  if (!script || typeof script.title !== 'string' || !script.title.trim() || !Array.isArray(script.cast) || !script.cast.length || !script.environment?.name || !Array.isArray(script.shots) || !script.shots.length) throw new Error('Drama plan needs title, cast, environment and shots');
  const castIds = new Set();
  for (const character of script.cast) {
    if (typeof character.id !== 'string' || !/^[a-z0-9-]+$/.test(character.id) || !character.name || castIds.has(character.id)) throw new Error('Drama cast IDs and names must be unique');
    castIds.add(character.id);
  }
  const shotIds = new Set(); let duration = 0;
  for (const shot of script.shots) {
    if (typeof shot.id !== 'string' || !/^[a-z0-9-]+$/.test(shot.id) || shotIds.has(shot.id) || !Number.isFinite(shot.durationSec) || shot.durationSec <= 0 || !Array.isArray(shot.castIds) || !shot.castIds.length || shot.castIds.some(id => !castIds.has(id)) || !shot.scene || !shot.action || typeof shot.dialogue !== 'string' || typeof shot.product !== 'boolean' || typeof shot.prompt !== 'string' || !shot.prompt.trim()) throw new Error('Drama shot has invalid cast, duration or prompt');
    shotIds.add(shot.id); duration += shot.durationSec;
  }
  if (Math.abs(duration - request.execution.durationSec) > 0.001) throw new Error('Drama shot durations must match the frozen request');
  return script;
}
function estimate(script, request, costs, existingReferences) {
  if (!Number.isFinite(costs?.referenceUsd) || costs.referenceUsd < 0 || !Number.isFinite(costs?.shotUsd) || costs.shotUsd < 0) return null;
  const references = script.cast.length + (existingReferences.environment ? 0 : 1) - (existingReferences.presenter ? 1 : 0);
  const totalUsd = Number((references * costs.referenceUsd + script.shots.length * costs.shotUsd).toFixed(6));
  return {references: {count: references, unitUsd: costs.referenceUsd, estimatedUsd: Number((references * costs.referenceUsd).toFixed(6))}, shots: script.shots.map(shot => ({id: shot.id, durationSec: shot.durationSec, estimatedUsd: costs.shotUsd})), assemblyUsd: 0, totalUsd, ceilingUsd: request.execution.budget.maxUsd};
}

/** @param {{root: string, projectId: string, requestId: string, agent: any, execute: (operation: string, payload: any) => Promise<any>, capabilities?: any, costs?: any}} options */
export async function runDramaWorkflow({root, projectId, requestId, agent, execute, capabilities = {}, costs}) {
  if (typeof agent?.plan !== 'function' || typeof execute !== 'function') throw new Error('Drama workflow requires agent planning and execution adapter');
  const run = path.join(root, 'projects', projectId, 'work', 'product-video', requestId);
  const frozen = await readFrozenRequest(root, projectId, requestId);
  const request = frozen.request;
  if (request.projectId !== projectId || request.id !== requestId || request.workflow !== 'drama') throw new Error('Wrong frozen drama request');
  const context = [];
  for (const entry of frozen.context.files) {
    if (!/^inputs\/[0-9]{3,}$/.test(entry.snapshotPath)) throw new Error('Invalid frozen context snapshot');
    const bytes = await readFile(path.join(run, entry.snapshotPath));
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Frozen context changed: ${entry.path}`);
    context.push({...entry, file: path.join(run, entry.snapshotPath), text: entry.role.startsWith('reference:') ? null : bytes.toString('utf8')});
  }
  const existingReferences = {product: context.find(item => item.role === 'reference:product'), presenter: context.find(item => item.role === 'reference:presenter'), environment: context.find(item => item.role === 'reference:environment')};
  if (!existingReferences.product) throw new Error('Drama requires a frozen product reference');
  const stateFile = path.join(run, 'drama-state.json');
  const state = await optionalJson(stateFile) ?? {status: 'new', references: {}, shots: []};
  if (!state.script) {
    state.script = validateScript(await agent.plan({request, context}), request);
    state.shots = state.script.shots.map(shot => ({id: shot.id, status: 'pending'}));
    state.status = 'planned'; await save(stateFile, state);
  }
  for (const shot of state.script.shots) {
    const file = path.join(run, `${shot.id}-prompt.md`);
    try {await writeFile(file, shot.prompt + '\n', {flag: 'wx'});}
    catch (error) {if (error.code !== 'EEXIST' || await readFile(file, 'utf8') !== shot.prompt + '\n') throw error;}
  }
  if (!state.estimate) {
    state.estimate = estimate(state.script, request, costs, existingReferences);
    if (!state.estimate) {state.status = 'unsupported'; state.reason = 'Stage cost estimate is unavailable'; await save(stateFile, state); return state;}
    if (state.estimate.totalUsd > request.execution.budget.maxUsd) {state.status = 'unsupported'; state.reason = 'Planned drama stages exceed the frozen budget'; await save(stateFile, state); return state;}
    await save(stateFile, state);
  }
  if (request.action === 'plan') return state;
  if (!capabilities.referenceToVideo) {state.status = 'unsupported'; state.reason = 'Reference-conditioned video route is unavailable'; await save(stateFile, state); return state;}
  if (state.script.shots.some(shot => shot.dialogue.trim()) && !capabilities.nativeSpeech) {state.status = 'unsupported'; state.reason = 'Verified spoken dialogue route is unavailable'; await save(stateFile, state); return state;}
  const prepare = async (key, payload) => {
    if (state.referenceAttempts?.[key]) {state.status = 'reference-unknown'; await save(stateFile, state); return null;}
    state.referenceAttempts ??= {};
    state.referenceAttempts[key] = 'attempted'; await save(stateFile, state);
    let asset;
    try {asset = localAsset(await execute('prepare-reference', payload), key);}
    catch (error) {state.status = 'reference-unknown'; state.reason = error.message; await save(stateFile, state); return null;}
    state.references[key] = asset;
    delete state.referenceAttempts[key];
    state.status = 'references-preparing'; await save(stateFile, state);
    return asset;
  };
  if (!state.references.environment) {
    if (existingReferences.environment) state.references.environment = {path: existingReferences.environment.file, sha256: existingReferences.environment.sha256};
    else if (!await prepare('environment', {run, request, kind: 'environment', id: 'setting', script: state.script})) return state;
    state.status = 'references-preparing'; await save(stateFile, state);
  }
  for (const [index, character] of state.script.cast.entries()) {
    if (state.references[character.id]) continue;
    if (index === 0 && existingReferences.presenter) state.references[character.id] = {path: existingReferences.presenter.file, sha256: existingReferences.presenter.sha256};
    else if (!await prepare(character.id, {run, request, kind: 'character', id: character.id, character, script: state.script})) return state;
    state.status = 'references-preparing'; await save(stateFile, state);
  }
  state.status = 'references-ready'; await save(stateFile, state);
  for (const [index, shot] of state.script.shots.entries()) {
    const item = state.shots[index];
    if (item.status === 'complete') continue;
    if (item.status === 'failed' || item.status === 'submission-unknown') {state.status = item.status; return state;}
    if (item.status === 'submission-attempted' && !item.submission) {item.status = 'submission-unknown'; state.status = 'submission-unknown'; await save(stateFile, state); return state;}
    const references = [...(shot.product ? [{role: 'product', path: existingReferences.product.file, sha256: existingReferences.product.sha256}] : []),
      ...shot.castIds.map(castId => ({role: `character:${castId}`, ...state.references[castId]})),
      {role: 'environment', ...state.references.environment}];
    if (!item.submission) {
      item.status = 'submission-attempted'; await save(stateFile, state);
      let submission;
      try {submission = await execute('submit-shot', {run, request, shot, prompt: shot.prompt, references, index});}
      catch (error) {item.status = 'submission-unknown'; item.reason = error.message; state.status = 'submission-unknown'; await save(stateFile, state); return state;}
      if (!submission?.jobId) {item.status = 'submission-unknown'; state.status = 'submission-unknown'; await save(stateFile, state); return state;}
      item.submission = submission; item.status = 'accepted'; await save(stateFile, state);
    }
    if (!item.terminal?.terminal) {
      item.terminal = await execute('poll-shot', {run, request, shot, submission: item.submission, index});
      item.status = item.terminal?.terminal ? item.terminal.status : 'pending'; await save(stateFile, state);
    }
    if (!item.terminal?.terminal) {state.status = 'pending'; return state;}
    if (item.terminal.status !== 'completed') {item.status = 'failed'; state.status = 'failed'; await save(stateFile, state); return state;}
    if (!item.artifact) {
      item.artifact = localAsset(await execute('download-shot', {run, request, shot, submission: item.submission, index}), 'shot');
      if (item.artifact.frames !== Math.round(shot.durationSec * 30)) throw new Error('Shot frame count does not match planned duration');
      item.status = 'complete'; await save(stateFile, state);
    }
  }
  if (!state.assembly) {
    state.assembly = localAsset(await execute('assemble', {run, request, script: state.script, shots: state.shots.map(item => item.artifact)}), 'assembly');
    const expected = Math.round(state.script.shots.reduce((total, shot) => total + shot.durationSec, 0) * 30);
    if (state.assembly.frames !== expected || state.assembly.fps !== 30) throw new Error('Drama assembly timing does not match planned shots');
    state.status = 'complete'; await save(stateFile, state);
  }
  return state;
}
