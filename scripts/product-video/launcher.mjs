import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {normalizeRequest, freezeRequest, readFrozenRequest} from './request.mjs';
import {resolveContext} from './context.mjs';

function runDirectory(root, projectId, requestId) {
  return path.join(root, 'projects', projectId, 'work', 'product-video', requestId);
}
const pending = new Map();
async function readOptional(file) {
  try {return JSON.parse(await readFile(file, 'utf8'));}
  catch (error) {if (error.code === 'ENOENT') return null; throw error;}
}
async function loadOrFreeze(root, request, catalog) {
  let frozen;
  try {frozen = await readFrozenRequest(root, request.projectId, request.id);}
  catch (error) {if (error.code !== 'ENOENT') throw error;}
  if (frozen) {
    if (JSON.stringify(frozen.request) !== JSON.stringify(request)) throw new Error('Request ID already frozen with a different request');
    return frozen;
  }
  const manifest = await resolveContext(root, request, catalog);
  return freezeRequest(root, request, manifest);
}

export async function launchProductVideo(root, draft, options = {}) {
  const key = `${path.resolve(root)}:${draft?.projectId}:${draft?.id}`;
  const fingerprint = JSON.stringify(normalizeRequest(draft, options.catalog));
  if (pending.has(key)) {
    const active = pending.get(key);
    if (active.fingerprint !== fingerprint) throw new Error('Request ID already frozen with a different request');
    return active.work;
  }
  const work = dispatchProductVideo(root, draft, options);
  pending.set(key, {fingerprint, work});
  try {return await work;} finally {pending.delete(key);}
}
export async function readLaunchStatus(root, projectId, requestId) {
  const frozen = await readFrozenRequest(root, projectId, requestId);
  if (frozen.request.projectId !== projectId || frozen.request.id !== requestId) throw new Error('Foreign project or request');
  const directory = runDirectory(root, projectId, requestId);
  return {launch: await readOptional(path.join(directory, 'launch.json')), worker: await readOptional(path.join(directory, 'worker.json'))};
}

export async function cancelProductVideo(root, projectId, requestId) {
  const current = await readLaunchStatus(root, projectId, requestId);
  if (!current.launch) throw new Error('Request has no launch state');
  const cancelled = {...current.launch, status: 'cancelled', cancelRequested: true};
  await writeFile(path.join(runDirectory(root, projectId, requestId), 'launch.json'), JSON.stringify(cancelled, null, 2) + '\n');
  return cancelled;
}

export async function recordWorkerUpdate(root, projectId, requestId, update) {
  const current = await readLaunchStatus(root, projectId, requestId);
  const launch = current.launch;
  if (!launch || launch.projectId !== projectId || launch.requestId !== requestId) throw new Error('Foreign project or request');
  if (launch.executionId !== update.executionId) throw new Error('Worker execution does not match this request');
  const allowed = ['prepared', 'accepted', 'raw-artifact', 'edited-export', 'failed', 'unsupported', 'complete'];
  if (!allowed.includes(update.status)) throw new Error('Invalid worker status');
  if (launch.cancelRequested && !['accepted', 'failed'].includes(update.status)) throw new Error('Request was cancelled; no subsequent stages may start');
  if (update.artifacts !== undefined) {
    if (!Array.isArray(update.artifacts)) throw new Error('Invalid worker artifacts');
    for (const artifact of update.artifacts) {
      if (typeof artifact?.kind !== 'string' || typeof artifact.path !== 'string' ||
          !new RegExp(`^projects/${projectId}/(?:media|work|videos)/`).test(artifact.path) ||
          artifact.path.includes('\\') || artifact.path.split('/').some(part => part === '..' || part === '.' || !part)) throw new Error('Foreign or invalid worker artifact');
    }
  }
  const worker = {requestId, projectId, executionId: update.executionId, status: update.status,
    receipt: update.receipt ?? current.worker?.receipt ?? null,
    artifacts: update.artifacts ?? current.worker?.artifacts ?? []};
  await writeFile(path.join(runDirectory(root, projectId, requestId), 'worker.json'), JSON.stringify(worker, null, 2) + '\n');
  return worker;
}

async function dispatchProductVideo(root, draft, {catalog, transport, mode = 'fresh'} = {}) {
  const request = normalizeRequest(draft, catalog);
  const frozen = await loadOrFreeze(root, request, catalog);
  const directory = runDirectory(root, request.projectId, request.id);
  const statePath = path.join(directory, 'launch.json');
  const existing = await readOptional(statePath);
  if (existing?.status === 'dispatched' || existing?.status === 'cancelled') return existing;
  if (mode !== 'fresh') throw new Error('Only explicit fresh launch is supported by this entry point');
  if (typeof transport?.createFreshSession !== 'function') {
    const unavailable = {requestId: request.id, projectId: request.projectId, status: 'unsupported', isolation: 'unavailable', reason: 'No supported fresh-session transport is configured'};
    await writeFile(statePath, JSON.stringify(unavailable, null, 2) + '\n');
    return unavailable;
  }
  const seed = {
    requestId: request.id, projectId: request.projectId, commandId: request.id,
    skill: 'generate-product-video', request: frozen.request,
    files: frozen.context.files.map(file => ({role: file.role, path: file.path, sha256: file.sha256,
      snapshotPath: path.join(directory, file.snapshotPath)})),
    instruction: 'Run the frozen product-video request using only the listed snapshot files. Return status and artifact records for this project and request.',
  };
  const dispatched = await transport.createFreshSession(seed);
  if (!dispatched?.sessionId || !dispatched?.executionId) throw new Error('Fresh session transport returned no session and execution IDs');
  const state = {requestId: request.id, projectId: request.projectId, status: 'dispatched', isolation: 'fresh', sessionId: dispatched.sessionId, executionId: dispatched.executionId};
  await writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
  return state;
}
