import {createHash} from 'node:crypto';
import {readFile, writeFile, rename, stat} from 'node:fs/promises';
import path from 'node:path';
import {readFrozenRequest} from './request.mjs';

async function optional(file) {try {return JSON.parse(await readFile(file, 'utf8'));} catch (error) {if (error.code === 'ENOENT') return null; throw error;}}
async function save(file, state) {const next = `${file}.partial`; await writeFile(next, JSON.stringify(state, null, 2) + '\n'); await rename(next, file);}

export async function runReferenceRemake({root, projectId, requestId, capabilities, agent, execute}) {
  const frozen = await readFrozenRequest(root, projectId, requestId);
  const request = frozen.request;
  if (request.id !== requestId || request.projectId !== projectId || request.workflow !== 'reference-remake' || request.action !== 'generate') throw new Error('Wrong frozen remake request');
  const run = path.join(root, 'projects', projectId, 'work', 'product-video', requestId);
  const stateFile = path.join(run, 'remake-state.json');
  const state = await optional(stateFile) ?? {status: 'new'};
  if (state.status === 'finishing-ready') return state;
  if (!capabilities?.videoEdit || !request.execution?.models?.edit) {
    state.status = 'unsupported'; state.reason = 'Video-edit operation is unavailable for this frozen request';
    await save(stateFile, state); return state;
  }
  if (request.execution.voice?.mode === 'replace' && (!capabilities.voice || !capabilities.lipSync)) {
    state.status = 'unsupported'; state.reason = 'Selected voice and lip-sync operations are unavailable';
    await save(stateFile, state); return state;
  }
  const estimated = state.estimatesUsd ?? capabilities.estimatesUsd;
  const stages = request.execution.voice?.mode === 'replace' ? ['edit', 'voice', 'lipSync'] : ['edit'];
  if (stages.some(stage => !Number.isFinite(estimated?.[stage]) || estimated[stage] < 0) ||
      stages.reduce((total, stage) => total + estimated[stage], 0) > request.execution.budget.maxUsd) {
    state.status = 'unsupported'; state.reason = 'Required stage estimate is missing or exceeds the frozen budget';
    await save(stateFile, state); return state;
  }
  if (!state.estimatesUsd) {state.estimatesUsd = Object.fromEntries(stages.map(stage => [stage, estimated[stage]])); await save(stateFile, state);}
  if (typeof agent?.plan !== 'function' || typeof execute !== 'function') throw new Error('Remake requires an agent and execution adapter');
  const context = [];
  for (const entry of frozen.context.files) {
    if (!/^inputs\/\d{3}$/.test(entry.snapshotPath)) throw new Error('Invalid frozen snapshot path');
    const bytes = await readFile(path.join(run, entry.snapshotPath));
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error('Frozen context changed');
    context.push({...entry, file: path.join(run, entry.snapshotPath), text: entry.role.startsWith('reference:') ? null : bytes.toString('utf8')});
  }
  const references = request.references;
  if (!request.brief?.referenceRights || !references.some(ref => ref.role === 'reference-video') || !references.some(ref => ref.role === 'product')) throw new Error('Remake needs source rights, a source video and product reference');
  if (!state.plan) {
    const plan = await agent.plan({request, context});
    if (!plan?.editPrompt?.trim() || !Array.isArray(plan.sourceRanges) || !plan.sourceRanges.length ||
        plan.sourceRanges.some(range => !Number.isInteger(range.fromFrame) || !Number.isInteger(range.toFrame) || range.fromFrame < 0 || range.toFrame <= range.fromFrame)) throw new Error('Agent must supply an edit prompt and source ranges');
    state.plan = plan; state.status = 'planned'; await save(stateFile, state);
  }
  async function submitOnce(stage, operation, payload, field) {
    if (state[field]) return true;
    const claim = path.join(run, `${stage}-submission.claim.json`);
    const receipt = path.join(run, `${stage}-submission.receipt.json`);
    const accepted = await optional(receipt);
    if (accepted) {state[field] = accepted; await save(stateFile, state); return true;}
    try {await writeFile(claim, JSON.stringify({operation, requestId, stage}) + '\n', {flag: 'wx'});}
    catch (error) {
      if (error.code === 'EEXIST') return false;
      throw error;
    }
    const result = await execute(operation, payload);
    if (!result?.jobId) throw new Error(`${stage} submission has no accepted job ID; reconcile before retrying`);
    await writeFile(receipt, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
    state[field] = result; await save(stateFile, state);
    return true;
  }
  if (!state.editSubmission) {
    if (!await submitOnce('edit', 'submit-edit', {run, request, references, prompt: state.plan.editPrompt, sourceRanges: state.plan.sourceRanges}, 'editSubmission'))
      return {...state, status: 'reconciliation-required', reason: 'Edit submission was attempted without a confirmed receipt'};
    state.status = 'accepted'; await save(stateFile, state);
  }
  if (state.editStatus?.status !== 'completed') {
    state.editStatus = await execute('poll-edit', {run, request, jobId: state.editSubmission.jobId});
    state.status = state.editStatus?.status === 'completed' ? 'edited' : state.editStatus?.status === 'failed' ? 'failed' : 'pending';
    await save(stateFile, state);
    if (state.status !== 'edited') return state;
  }
  if (!state.rawArtifact) {
    state.rawArtifact = await execute('download-edit', {run, request, jobId: state.editSubmission.jobId});
    const file = path.join(run, 'remake-raw.mp4');
    if (!(await stat(file)).isFile()) throw new Error('Edited raw video is missing');
    state.status = 'downloaded'; await save(stateFile, state);
  }
  let source = 'remake-raw.mp4';
  if (request.execution.voice?.mode === 'replace') {
    if (!state.voiceSubmission) {
      if (!await submitOnce('voice', 'submit-voice', {run, request, text: request.execution.voice.text}, 'voiceSubmission'))
        return {...state, status: 'reconciliation-required', reason: 'Voice submission was attempted without a confirmed receipt'};
      state.status = 'voice-accepted'; await save(stateFile, state);
    }
    if (state.voiceStatus?.status !== 'completed') {
      state.voiceStatus = await execute('poll-voice', {run, request, jobId: state.voiceSubmission.jobId});
      state.status = state.voiceStatus?.status === 'completed' ? 'voice-completed' : state.voiceStatus?.status === 'failed' ? 'failed' : 'pending';
      await save(stateFile, state); if (state.status !== 'voice-completed') return state;
    }
    if (!state.lipSyncSubmission) {
      if (!await submitOnce('lipsync', 'submit-lipsync', {run, request, videoJobId: state.editSubmission.jobId, voiceJobId: state.voiceSubmission.jobId}, 'lipSyncSubmission'))
        return {...state, status: 'reconciliation-required', reason: 'Lip-sync submission was attempted without a confirmed receipt'};
      state.status = 'lipsync-accepted'; await save(stateFile, state);
    }
    if (state.lipSyncStatus?.status !== 'completed') {
      state.lipSyncStatus = await execute('poll-lipsync', {run, request, jobId: state.lipSyncSubmission.jobId});
      state.status = state.lipSyncStatus?.status === 'completed' ? 'lipsync-completed' : state.lipSyncStatus?.status === 'failed' ? 'failed' : 'pending';
      await save(stateFile, state); if (state.status !== 'lipsync-completed') return state;
    }
    if (!state.lipSyncArtifact) {
      state.lipSyncArtifact = await execute('download-lipsync', {run, request, jobId: state.lipSyncSubmission.jobId});
      if (!(await stat(path.join(run, 'remake-lipsync-raw.mp4'))).isFile()) throw new Error('Lip-sync raw video is missing');
      state.status = 'lipsync-downloaded'; await save(stateFile, state);
    }
    source = 'remake-lipsync-raw.mp4';
  }
  state.finishPlan = {version: 1, fps: 30, segments: state.plan.sourceRanges.map(range => ({source, ...range, kind: 'motion'})), captions: [], audio: {source: 'native'}};
  state.status = 'finishing-ready'; await save(stateFile, state);
  return state;
}
