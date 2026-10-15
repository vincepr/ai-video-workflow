import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {projectPaths} from './projects.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const projectFile = (id, file) => typeof file === 'string' && file.startsWith(`projects/${id}/media/`) &&
  !file.includes('\\') && file.split('/').every(part => part && part !== '.' && part !== '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const base = (root, id) => path.join(projectPaths(root, id).work, 'agent-video');
const revisionFile = (root, id, revisionId) => {
  if (!uuid.test(revisionId)) throw new Error('Invalid revision ID');
  return path.join(base(root, id), 'revisions', `${revisionId}.json`);
};

async function hashMedia(root, id, file) {
  if (!projectFile(id, file)) throw new Error(`Invalid project media path: ${file}`);
  const media = await realpath(projectPaths(root, id).media);
  const actual = await realpath(path.resolve(root, file));
  const within = path.relative(media, actual);
  if (!within || within.startsWith('..') || path.isAbsolute(within)) throw new Error(`Media leaves project: ${file}`);
  return sha(await readFile(actual));
}

export function normalizeAgentConfig(draft) {
  const id = String(draft?.projectId ?? '');
  projectPaths('.', id);
  if (draft?.schemaVersion !== 2 || !uuid.test(draft.revisionId)) throw new Error('Expected version 2 and a revision UUID');
  if (draft.parentId != null && !uuid.test(draft.parentId)) throw new Error('Invalid parent revision ID');
  if (typeof draft.change !== 'string' || !draft.change.trim() || typeof draft.brief !== 'string' || !draft.brief.trim()) throw new Error('Revision needs a change summary and brief');
  if (!['ad', 'commentary', 'other'].includes(draft.kind)) throw new Error('Invalid video kind');
  if (!['9:16', '16:9', '1:1'].includes(draft.outputFormat ?? '9:16')) throw new Error('Invalid output format');
  if (!Number.isFinite(draft.budgetUsd) || draft.budgetUsd < 0) throw new Error('Invalid USD spending cap');
  if (!Array.isArray(draft.references) || draft.references.some(ref => !projectFile(id, ref))) throw new Error('Invalid project references');
  const plan = draft.plan;
  if (typeof plan?.concept !== 'string' || !plan.concept.trim() || !Array.isArray(plan.shots) || !plan.shots.length) throw new Error('Plan needs a concept and shots');
  const ids = new Set();
  for (const shot of plan.shots) {
    if (!/^[a-z0-9-]+$/.test(shot?.id) || ids.has(shot.id) || typeof shot.description !== 'string' || !shot.description.trim()) throw new Error('Invalid or duplicate shot');
    ids.add(shot.id);
  }
  if (!Array.isArray(plan.stages)) throw new Error('Plan needs stages');
  let estimate = 0;
  for (const stage of plan.stages) {
    if (!/^[a-z0-9-]+$/.test(stage?.id) || ids.has(stage.id) || !['image', 'video', 'audio', 'finish'].includes(stage.kind) ||
      typeof stage.provider !== 'string' || !stage.provider || typeof stage.model !== 'string' || !stage.model ||
      !Number.isFinite(stage.estimateUsd) || stage.estimateUsd < 0) throw new Error('Invalid or duplicate stage');
    ids.add(stage.id); estimate += stage.estimateUsd;
  }
  return {schemaVersion: 2, projectId: id, revisionId: draft.revisionId, parentId: draft.parentId ?? null,
    change: draft.change.trim(), brief: draft.brief.trim(), kind: draft.kind, outputFormat: draft.outputFormat ?? '9:16', budgetUsd: draft.budgetUsd,
    references: [...draft.references], plan: {concept: plan.concept.trim(), shots: plan.shots.map(shot => ({id: shot.id, description: shot.description.trim(), caption: String(shot.caption ?? '')})),
      stages: plan.stages.map(stage => ({id: stage.id, kind: stage.kind, provider: stage.provider, model: stage.model, estimateUsd: stage.estimateUsd, parameters: stage.parameters ?? {}}))},
    estimateUsd: estimate};
}

export async function freezeAgentRevision(root, draft) {
  const config = normalizeAgentConfig(draft);
  const file = revisionFile(root, config.projectId, config.revisionId);
  if (config.parentId) await readFile(revisionFile(root, config.projectId, config.parentId));
  const references = [];
  for (const name of config.references) references.push({path: name, sha256: await hashMedia(root, config.projectId, name)});
  const frozen = {...config, references, frozenAt: new Date().toISOString()};
  await mkdir(path.dirname(file), {recursive: true});
  try {await writeFile(file, JSON.stringify(frozen, null, 2) + '\n', {flag: 'wx'});}
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const old = JSON.parse(await readFile(file, 'utf8'));
    if (JSON.stringify({...old, frozenAt: null}) !== JSON.stringify({...frozen, frozenAt: null})) throw new Error('Revision ID already has different content');
    return old;
  }
  return frozen;
}

export async function readAgentRevision(root, id, revisionId) {
  return JSON.parse(await readFile(revisionFile(root, id, revisionId), 'utf8'));
}

export async function latestAgentRevision(root, id) {
  const directory = path.join(base(root, id), 'revisions');
  let names;
  try {names = (await readdir(directory)).filter(name => uuid.test(path.basename(name, '.json')) && name.endsWith('.json'));}
  catch (error) {if (error.code === 'ENOENT') return null; throw error;}
  if (!names.length) return null;
  const revisions = await Promise.all(names.map(async name => readAgentRevision(root, id, path.basename(name, '.json'))));
  revisions.sort((a, b) => (b.frozenAt ?? '').localeCompare(a.frozenAt ?? '') || b.revisionId.localeCompare(a.revisionId));
  return revisions[0];
}

export async function agentStatus(root, id, revisionId) {
  const revision = await readAgentRevision(root, id, revisionId);
  const attempts = [];
  for (const stage of revision.plan.stages) {
    const file = path.join(base(root, id), 'attempts', stage.id);
    let names = [];
    try {names = await readdir(file);} catch (error) {if (error.code !== 'ENOENT') throw error;}
    for (const name of names.filter(name => name.endsWith('.json'))) {
      const attempt = JSON.parse(await readFile(path.join(file, name), 'utf8'));
      if (attempt.revisionId === revisionId) attempts.push(attempt);
    }
  }
  attempts.sort((a, b) => (a.recordedAt ?? a.endedAt).localeCompare(b.recordedAt ?? b.endedAt) || a.id.localeCompare(b.id));
  const charges = new Map();
  for (const attempt of attempts) {
    const key = attempt.reconcilesAttemptId ?? (attempt.providerJobId ? `${attempt.stageId}:${attempt.providerJobId}` : attempt.id);
    charges.set(key, Math.max(charges.get(key) ?? 0, attempt.costUsd ?? 0));
  }
  const spentUsd = [...charges.values()].reduce((sum, cost) => sum + cost, 0);
  const uncertain = attempts.some(attempt => attempt.status === 'uncertain' &&
    !attempts.some(next => next.stageId === attempt.stageId && next.id !== attempt.id && ['succeeded', 'failed'].includes(next.status) &&
      (attempt.providerJobId ? next.providerJobId === attempt.providerJobId : next.reconcilesAttemptId === attempt.id && next.reconciliationEvidence)));
  const blocked = revision.estimateUsd > revision.budgetUsd ? 'Plan exceeds spending cap' : uncertain ? 'Uncertain submission needs reconciliation' :
    revision.plan.stages.some(stage => stage.provider !== 'local' && !attempts.some(attempt => attempt.stageId === stage.id && attempt.status === 'succeeded')) ? 'Live provider capability and price are not verified by this CLI' : null;
  const complete = revision.plan.stages.length > 0 && revision.plan.stages.every(stage => attempts.some(attempt => attempt.stageId === stage.id && attempt.status === 'succeeded'));
  return {revision, attempts, spentUsd, blocked, status: blocked ? 'blocked' : complete ? 'complete' : 'planned'};
}

export function shareableAgentSummary(status) {
  const {revision, attempts, spentUsd} = status;
  return {kind: revision.kind, concept: revision.plan.concept, shots: revision.plan.shots.map(({id, description, caption}) => ({id, description, caption})),
    stages: revision.plan.stages.map(stage => ({id: stage.id, kind: stage.kind, provider: stage.provider, model: stage.model,
      outcome: attempts.filter(attempt => attempt.stageId === stage.id).at(-1)?.status ?? 'not started'})), spentUsd};
}

export async function recordAgentAttempt(root, id, revisionId, draft) {
  const revision = await readAgentRevision(root, id, revisionId);
  const stage = revision.plan.stages.find(item => item.id === draft?.stageId);
  if (!stage || !uuid.test(draft?.id) || !['succeeded', 'failed', 'uncertain', 'unsupported'].includes(draft.status)) throw new Error('Invalid attempt');
  if (draft.provider !== stage.provider || draft.model !== stage.model || !Number.isFinite(draft.costUsd) || draft.costUsd < 0 ||
      typeof draft.startedAt !== 'string' || typeof draft.endedAt !== 'string' || !Array.isArray(draft.inputs) || !Array.isArray(draft.outputs)) throw new Error('Incomplete attempt');
  if (!Number.isFinite(Date.parse(draft.startedAt)) || !Number.isFinite(Date.parse(draft.endedAt)) ||
      !draft.parameters || typeof draft.parameters !== 'object' || Array.isArray(draft.parameters) ||
      (draft.status === 'succeeded' && (!draft.outputs.length || draft.inspection?.accepted !== true ||
        (stage.provider !== 'local' && !String(draft.prompt ?? '').trim())))) throw new Error('Attempt needs actual controls, timestamps, prompt, accepted inspection and successful output');
  const status = await agentStatus(root, id, revisionId);
  if (status.status === 'complete') throw new Error('Completed revision requires a child revision for another attempt');
  const availableInputs = new Set([...revision.references.map(ref => ref.path),
    ...status.attempts.filter(attempt => attempt.status === 'succeeded').flatMap(attempt => attempt.outputs.map(output => output.path))]);
  if (draft.inputs.some(name => !availableInputs.has(name))) throw new Error('Attempt input must come from a frozen reference or successful stage output');
  const uncertain = status.attempts.find(attempt => attempt.stageId === stage.id && attempt.status === 'uncertain' &&
    !status.attempts.some(next => next.stageId === stage.id && next.id !== attempt.id && ['succeeded', 'failed'].includes(next.status) &&
      (attempt.providerJobId ? next.providerJobId === attempt.providerJobId : next.reconcilesAttemptId === attempt.id && next.reconciliationEvidence)));
  if (draft.reconcilesAttemptId && (!uncertain || draft.reconcilesAttemptId !== uncertain.id)) throw new Error('Invalid reconciliation link');
  if (uncertain && (!['succeeded', 'failed'].includes(draft.status) || (uncertain.providerJobId ? draft.providerJobId !== uncertain.providerJobId :
      draft.reconcilesAttemptId !== uncertain.id || typeof draft.reconciliationEvidence !== 'string' || !draft.reconciliationEvidence.trim())))
    throw new Error('Uncertain submission requires the same job ID or a documented manual reconciliation');
  if (status.spentUsd + Math.max(0, draft.costUsd - (uncertain?.costUsd ?? 0)) > revision.budgetUsd) throw new Error('Attempt exceeds spending cap');
  const files = async names => Promise.all(names.map(async name => ({path: name, sha256: await hashMedia(root, id, name)})));
  const attempt = {revisionId, stageId: stage.id, id: draft.id, status: draft.status, provider: draft.provider, model: draft.model,
    parameters: draft.parameters ?? stage.parameters, prompt: String(draft.prompt ?? ''), providerJobId: draft.providerJobId ?? null,
    reconcilesAttemptId: draft.reconcilesAttemptId ?? null, reconciliationEvidence: draft.reconciliationEvidence ?? null,
    startedAt: draft.startedAt, endedAt: draft.endedAt, recordedAt: new Date().toISOString(), costUsd: draft.costUsd, inspection: draft.inspection ?? null,
    inputs: await files(draft.inputs), outputs: await files(draft.outputs)};
  const file = path.join(base(root, id), 'attempts', stage.id, `${attempt.id}.json`);
  await mkdir(path.dirname(file), {recursive: true});
  await writeFile(file, JSON.stringify(attempt, null, 2) + '\n', {flag: 'wx'});
  return attempt;
}

export async function runAgentRevision(root, id, revisionId) {
  const status = await agentStatus(root, id, revisionId);
  if (status.blocked) return status;
  if (status.status === 'complete') return status;
  return {...status, status: 'needs-agent', reason: 'Agent must execute and inspect the planned stages through a verified adapter'};
}

export async function attachAgentExport(root, id, revisionId, file) {
  const status = await agentStatus(root, id, revisionId);
  if (status.status !== 'complete') throw new Error('All planned stages must succeed before attaching an export');
  if (typeof file !== 'string' || !new RegExp(`^projects/${id}/videos/[0-9]{6}-[a-z0-9-]+/video\\.mp4$`).test(file)) throw new Error('Invalid numbered export path');
  const videos = await realpath(projectPaths(root, id).videos);
  const actual = await realpath(path.resolve(root, file));
  const within = path.relative(videos, actual);
  if (!within || within.startsWith('..') || path.isAbsolute(within)) throw new Error('Export leaves project');
  const outputSha256 = sha(await readFile(actual));
  const finishStages = new Set(status.revision.plan.stages.filter(stage => stage.kind === 'finish').map(stage => stage.id));
  if (!status.attempts.some(attempt => finishStages.has(attempt.stageId) && attempt.status === 'succeeded' &&
      attempt.outputs.some(output => output.sha256 === outputSha256 && output.path.endsWith('.mp4')))) throw new Error('Export does not match a successful finishing output');
  for (const reference of status.revision.references) if (await hashMedia(root, id, reference.path) !== reference.sha256) throw new Error(`Reference changed: ${reference.path}`);
  for (const attempt of status.attempts) for (const asset of [...attempt.inputs, ...attempt.outputs])
    if (await hashMedia(root, id, asset.path) !== asset.sha256) throw new Error(`Attempt asset changed: ${asset.path}`);
  const manifest = {version: 2, revisionId, revisionSha256: sha(await readFile(revisionFile(root, id, revisionId))),
    attempts: await Promise.all(status.attempts.map(async attempt => ({stageId: attempt.stageId, id: attempt.id,
      sha256: sha(await readFile(path.join(base(root, id), 'attempts', attempt.stageId, `${attempt.id}.json`)))}))),
    output: {path: file, sha256: outputSha256}};
  const provenance = path.join(path.dirname(actual), 'provenance.json');
  for (const [target, value] of [[provenance, manifest], [path.join(path.dirname(actual), 'shareable-summary.json'), shareableAgentSummary(status)]]) {
    const bytes = JSON.stringify(value, null, 2) + '\n';
    try {await writeFile(target, bytes, {flag: 'wx'});}
    catch (error) {
      if (error.code !== 'EEXIST' || await readFile(target, 'utf8') !== bytes) throw error;
    }
  }
  return manifest;
}
