import {createHash, randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {constants} from 'node:fs';
import {copyFile, mkdir, readFile, readdir, realpath, stat, unlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {isDeepStrictEqual, promisify} from 'node:util';
import {RenderInternals} from '@remotion/renderer';
import {projectPaths, reserveIteration} from './projects.mjs';
import {readRenderHistory, recordRender} from './render-history.mjs';

const execute = promisify(execFile);

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const projectFile = (id, file) => typeof file === 'string' && file.startsWith(`projects/${id}/media/`) &&
  !file.includes('\\') && file.split('/').every(part => part && part !== '.' && part !== '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const base = (root, id) => path.join(projectPaths(root, id).work, 'agent-video');
const revisionFile = (root, id, revisionId) => {
  if (!uuid.test(revisionId)) throw new Error('Invalid revision ID');
  return path.join(base(root, id), 'revisions', `${revisionId}.json`);
};
const localDirectory = (root, id, revisionId, stageId) => path.join(base(root, id), 'local', revisionId, stageId);
const relative = (root, file) => path.relative(root, file).split(path.sep).join('/');
const readOptional = async file => {
  try {return JSON.parse(await readFile(file, 'utf8'));}
  catch (error) {if (error.code === 'ENOENT') return null; throw error;}
};

async function hashMedia(root, id, file) {
  if (!projectFile(id, file)) throw new Error(`Invalid project media path: ${file}`);
  const media = await realpath(projectPaths(root, id).media);
  const actual = await realpath(path.resolve(root, file));
  const within = path.relative(media, actual);
  if (!within || within.startsWith('..') || path.isAbsolute(within)) throw new Error(`Media leaves project: ${file}`);
  return sha(await readFile(actual));
}

async function renderRemotion({root, props, output, publicDirectory}) {
  await execute(process.execPath, [path.join(root, 'node_modules/@remotion/cli/remotion-cli.js'),
    'render', 'src/index.tsx', 'PanelMotion', output, '--props', props, '--codec', 'h264', '--public-dir', publicDirectory],
  {cwd: root, timeout: 600000, maxBuffer: 1024 * 1024, windowsHide: true});
}

async function probeRemotion(root, output) {
  const binary = RenderInternals.getExecutablePath({type: 'ffprobe', indent: false, logLevel: 'error', binariesDirectory: null});
  RenderInternals.makeFileExecutableIfItIsNot(binary);
  const libraryPath = path.dirname(binary);
  const env = {...process.env, ...(process.platform === 'darwin' ? {DYLD_LIBRARY_PATH: libraryPath} :
    process.platform === 'linux' ? {LD_LIBRARY_PATH: libraryPath} : {})};
  const {stdout} = await execute(binary,
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_frames', '-of', 'json', output],
    {cwd: root, timeout: 30000, windowsHide: true, env});
  return JSON.parse(stdout).streams?.[0];
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {process.kill(pid, 0); return true;}
  catch (error) {if (error.code === 'ESRCH') return false; throw error;}
}

async function failLocalRender(root, id, revision, stage, directory, {reason, retryable, startedAt, inputs, episode}) {
  const file = path.join(directory, 'render-failure.json');
  let receipt = await readOptional(file);
  if (!receipt) {
    receipt = {reason, retryable, attempt: {id: randomUUID(), stageId: stage.id, status: 'failed',
      provider: stage.provider, model: stage.model, costUsd: 0, startedAt, endedAt: new Date().toISOString(),
      inputs, outputs: [], parameters: {...stage.parameters, episode}, prompt: '', inspection: {accepted: false}, error: reason}};
    await writeFile(file, JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
  }
  const attemptFile = path.join(base(root, id), 'attempts', stage.id, `${receipt.attempt.id}.json`);
  if (!await readOptional(attemptFile)) await recordAgentAttempt(root, id, revision.revisionId, receipt.attempt);
  if (receipt.retryable) {
    try {await unlink(path.join(directory, 'render-lock'));} catch (error) {if (error.code !== 'ENOENT') throw error;}
    await unlink(file);
  }
  return {...await agentStatus(root, id, revision.revisionId), status: 'blocked', blocked: receipt.reason};
}

async function renderLocalPreview(root, id, status, stage, renderLocal, probeLocal) {
  const {revision} = status;
  if (revision.outputFormat !== '9:16') return {...status, status: 'blocked', blocked: 'Local Remotion finish supports 9:16 only'};
  const supplied = stage.parameters?.episode;
  if (!supplied || !Array.isArray(supplied.shots) || supplied.shots.length !== revision.plan.shots.length) {
    return {...status, status: 'blocked', blocked: 'Local Remotion finish needs one episode shot per planned shot'};
  }
  const episode = {...supplied, shots: supplied.shots.map((shot, index) =>
    ({...shot, text: revision.plan.shots[index].caption || revision.plan.shots[index].description}))};
  const assets = [...episode.shots.map(shot => shot.video ?? shot.image), episode.audio, episode.music?.audio].filter(Boolean);
  const known = new Map([...revision.references, ...status.attempts.filter(attempt => attempt.status === 'succeeded').flatMap(attempt => attempt.outputs)]
    .map(asset => [asset.path, asset.sha256]));
  const inputs = [];
  for (const asset of new Set(assets)) {
    const name = `projects/${id}/${asset}`;
    if (!projectFile(id, name) || !known.has(name)) throw new Error(`Local finish source is not a frozen reference or successful output: ${asset}`);
    if (await hashMedia(root, id, name) !== known.get(name)) throw new Error(`Local finish source changed: ${asset}`);
    inputs.push(name);
  }
  const directory = localDirectory(root, id, revision.revisionId, stage.id);
  await mkdir(directory, {recursive: true});
  const propsFile = path.join(directory, 'props.json');
  const props = JSON.stringify({episode}, null, 2) + '\n';
  try {await writeFile(propsFile, props, {flag: 'wx'});}
  catch (error) {if (error.code !== 'EEXIST' || await readFile(propsFile, 'utf8') !== props) throw error;}
  const rendered = path.join(directory, 'rendered.mp4');
  const resultFile = path.join(directory, 'render-result.json');
  let result = await readOptional(resultFile);
  if (!result) {
    const lock = path.join(directory, 'render-lock');
    const previous = await readOptional(lock);
    const failure = await readOptional(path.join(directory, 'render-failure.json'));
    if (failure) return failLocalRender(root, id, revision, stage, directory, {reason: failure.reason, retryable: failure.retryable,
      startedAt: failure.attempt.startedAt, inputs, episode});
    let outputExists = false;
    try {await stat(rendered); outputExists = true;} catch (error) {if (error.code !== 'ENOENT') throw error;}
    if (previous) {
      if (processAlive(previous.pid)) return {...status, status: 'blocked', blocked: 'Local render is still running'};
      if (outputExists) {
        let video;
        try {video = await probeLocal(root, rendered);} catch (error) {
          const reason = `Interrupted local render has invalid output: ${String(error.message).slice(-300)}`;
          return failLocalRender(root, id, revision, stage, directory, {reason, retryable: false, startedAt: previous.startedAt, inputs, episode});
        }
        const frames = episode.shots.reduce((sum, shot) => sum + (shot.video ? shot.endFrame - shot.startFrame : Math.round(shot.seconds * 30)), 0);
        if (video?.width !== 1080 || video?.height !== 1920 || Number(video.nb_frames) !== frames) {
          return failLocalRender(root, id, revision, stage, directory, {reason: 'Interrupted local render has wrong encoded frames or size',
            retryable: false, startedAt: previous.startedAt, inputs, episode});
        }
        result = {startedAt: previous.startedAt, endedAt: new Date().toISOString(), sha256: sha(await readFile(rendered)), inputs, recovered: true};
        await writeFile(resultFile, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
        await unlink(lock);
      } else {
        return failLocalRender(root, id, revision, stage, directory, {reason: 'Interrupted local render produced no output',
          retryable: true, startedAt: previous.startedAt, inputs, episode});
      }
    }
    if (!result && outputExists) return {...status, status: 'blocked', blocked: 'Incomplete local render; use a child revision'};
  }
  if (!result) {
    const startedAt = new Date().toISOString();
    const lock = path.join(directory, 'render-lock');
    try {await writeFile(lock, JSON.stringify({pid: process.pid, startedAt}) + '\n', {flag: 'wx'});}
    catch (error) {if (error.code === 'EEXIST') return {...status, status: 'blocked', blocked: 'Local render is running or interrupted'}; throw error;}
    try {
      await renderLocal({root, props: propsFile, output: rendered, publicDirectory: projectPaths(root, id).directory});
      if (!(await stat(rendered)).size) throw new Error('Local render produced an empty file');
      result = {startedAt, endedAt: new Date().toISOString(), sha256: sha(await readFile(rendered)), inputs};
      await writeFile(resultFile, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
      await unlink(lock);
    } catch (error) {
      let partial = false;
      try {await stat(rendered); partial = true;} catch (missing) {if (missing.code !== 'ENOENT') throw missing;}
      // shortcut: keep partial MP4s for inspection; add an explicit discard action if same-revision retries are needed.
      const reason = String(error.stderr || error.message).slice(-500);
      return failLocalRender(root, id, revision, stage, directory, {reason: partial ? `Partial local render: ${reason}` : `Local render failed: ${reason}`,
        retryable: !partial, startedAt, inputs, episode});
    }
  }
  if (sha(await readFile(rendered)) !== result.sha256) throw new Error('Local render changed after completion');
  const preview = `projects/${id}/media/agent-video/${revision.revisionId}-${stage.id}.mp4`;
  const destination = path.resolve(root, preview);
  await mkdir(path.dirname(destination), {recursive: true});
  try {await copyFile(rendered, destination, constants.COPYFILE_EXCL);}
  catch (error) {if (error.code !== 'EEXIST') throw error;}
  if (await hashMedia(root, id, preview) !== result.sha256) throw new Error('Local preview path has different bytes');
  const draftFile = path.join(directory, 'attempt-draft.json');
  if (!await readOptional(draftFile)) await writeFile(draftFile, JSON.stringify({id: randomUUID(), stageId: stage.id,
    status: 'succeeded', provider: stage.provider, model: stage.model, costUsd: 0, startedAt: result.startedAt, endedAt: result.endedAt,
    inputs: result.inputs, outputs: [preview], parameters: {...stage.parameters, episode}, prompt: '', inspection: {accepted: false}}, null, 2) + '\n', {flag: 'wx'});
  return {...await agentStatus(root, id, revision.revisionId), status: 'needs-inspection', preview, attemptDraft: relative(root, draftFile)};
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
  const stopped = revision.plan.stages.map(stage => ({stage, last: attempts.filter(attempt => attempt.stageId === stage.id).at(-1)}))
    .find(({stage, last}) => ['failed', 'unsupported'].includes(last?.status) && !attempts.some(attempt => attempt.stageId === stage.id && attempt.status === 'succeeded'));
  const blocked = revision.estimateUsd > revision.budgetUsd ? 'Plan exceeds spending cap' : uncertain ? 'Uncertain submission needs reconciliation' :
    stopped ? `Stage ${stopped.stage.id} ${stopped.last.status}` :
    revision.plan.stages.some(stage => stage.provider !== 'local' && !attempts.some(attempt => attempt.stageId === stage.id && attempt.status === 'succeeded')) ? 'Live provider capability and price are not verified by this CLI' : null;
  const complete = revision.plan.stages.length > 0 && revision.plan.stages.every(stage => attempts.some(attempt => attempt.stageId === stage.id && attempt.status === 'succeeded'));
  const pending = [];
  const activity = [];
  for (const stage of revision.plan.stages.filter(stage => stage.kind === 'finish' && stage.provider === 'local' && stage.model === 'remotion')) {
    if (attempts.some(attempt => attempt.stageId === stage.id && attempt.status === 'succeeded')) continue;
    const directory = localDirectory(root, id, revisionId, stage.id);
    const result = await readOptional(path.join(directory, 'render-result.json'));
    const preview = `projects/${id}/media/agent-video/${revisionId}-${stage.id}.mp4`;
    if (result) {
      try {if (await hashMedia(root, id, preview) === result.sha256) pending.push({stageId: stage.id, preview});}
      catch (error) {if (error.code !== 'ENOENT') throw error;}
    } else {
      const lock = await readOptional(path.join(directory, 'render-lock'));
      if (lock) activity.push({stageId: stage.id, state: processAlive(lock.pid) ? 'rendering' : 'interrupted'});
    }
  }
  const currentBlock = stopped && pending.some(item => item.stageId === stopped.stage.id) ? null : blocked;
  return {revision, attempts, spentUsd, blocked: currentBlock, pending, activity, status: currentBlock && !currentBlock.startsWith('Live provider') ? 'blocked' :
    complete ? 'complete' : pending.length ? 'needs-inspection' : activity[0]?.state ?? (currentBlock ? 'blocked' : 'planned')};
}

export function shareableAgentSummary(status) {
  const {revision, attempts, spentUsd} = status;
  return {kind: revision.kind, concept: revision.plan.concept, shots: revision.plan.shots.map(({id, description, caption}) => ({id, description, caption})),
    stages: revision.plan.stages.map(stage => {
      const last = attempts.filter(attempt => attempt.stageId === stage.id).at(-1);
      return {id: stage.id, kind: stage.kind, provider: stage.provider, model: stage.model,
        outcome: status.pending?.some(item => item.stageId === stage.id) ? 'needs inspection' :
          status.activity?.find(item => item.stageId === stage.id)?.state ?? last?.status ?? 'not started',
        validationOnly: last?.mode === 'recorded'};
    }), spentUsd};
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
    mode: draft.mode === 'recorded' ? 'recorded' : 'reported',
    parameters: draft.parameters ?? stage.parameters, prompt: String(draft.prompt ?? ''), error: draft.error ?? null, providerJobId: draft.providerJobId ?? null,
    reconcilesAttemptId: draft.reconcilesAttemptId ?? null, reconciliationEvidence: draft.reconciliationEvidence ?? null,
    startedAt: draft.startedAt, endedAt: draft.endedAt, recordedAt: new Date().toISOString(), costUsd: draft.costUsd, inspection: draft.inspection ?? null,
    inputs: await files(draft.inputs), outputs: await files(draft.outputs)};
  const file = path.join(base(root, id), 'attempts', stage.id, `${attempt.id}.json`);
  await mkdir(path.dirname(file), {recursive: true});
  await writeFile(file, JSON.stringify(attempt, null, 2) + '\n', {flag: 'wx'});
  return attempt;
}

async function finishLocalExport(root, id, status) {
  const stage = status.revision.plan.stages.find(item => item.kind === 'finish' && item.provider === 'local' && item.model === 'remotion');
  if (!stage) return status;
  const attempt = status.attempts.find(item => item.stageId === stage.id && item.status === 'succeeded' && item.mode !== 'recorded');
  const directory = localDirectory(root, id, status.revision.revisionId, stage.id);
  const result = await readOptional(path.join(directory, 'render-result.json'));
  const preview = `projects/${id}/media/agent-video/${status.revision.revisionId}-${stage.id}.mp4`;
  if (!attempt || !result || !attempt.outputs.some(output => output.path === preview && output.sha256 === result.sha256)) return status;
  const episode = (await readOptional(path.join(directory, 'props.json'))).episode;
  if (!isDeepStrictEqual(attempt.parameters, {...stage.parameters, episode}) ||
      JSON.stringify(attempt.inputs.map(input => input.path).sort()) !== JSON.stringify([...result.inputs].sort()) ||
      attempt.startedAt !== result.startedAt || attempt.endedAt !== result.endedAt || attempt.costUsd !== 0) {
    throw new Error('Accepted local attempt does not match rendered controls and inputs');
  }
  if (await hashMedia(root, id, preview) !== result.sha256) throw new Error('Accepted local preview changed');
  const receiptFile = path.join(directory, 'export.json');
  let receipt = await readOptional(receiptFile);
  if (!receipt) {
    const iteration = await reserveIteration(root, id, episode.title);
    receipt = {file: relative(root, iteration.output)};
    await writeFile(receiptFile, JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx'});
  }
  if (typeof receipt.file !== 'string' || !new RegExp(`^projects/${id}/videos/[0-9]{6}-[a-z0-9-]+/video\\.mp4$`).test(receipt.file)) {
    throw new Error('Invalid local export receipt');
  }
  const output = path.resolve(root, receipt.file);
  const videos = await realpath(projectPaths(root, id).videos);
  const parent = await realpath(path.dirname(output));
  if (!parent.startsWith(videos + path.sep)) throw new Error('Local export leaves project');
  try {await copyFile(path.resolve(root, preview), output, constants.COPYFILE_EXCL);}
  catch (error) {if (error.code !== 'EEXIST') throw error;}
  if (sha(await readFile(output)) !== result.sha256) throw new Error('Numbered export differs from accepted preview');
  await attachAgentExport(root, id, status.revision.revisionId, receipt.file);
  if (!(await readRenderHistory(root, id)).some(item => item.file === receipt.file)) {
    await recordRender(root, {output, episode, sessionId: id, renderer: {kind: 'agent-video-remotion', fps: 30, width: 1080, height: 1920}});
  }
  return {...status, export: receipt.file};
}

export async function runAgentRevision(root, id, revisionId, {recorded = false, renderLocal = renderRemotion, probeLocal = probeRemotion} = {}) {
  let status = await agentStatus(root, id, revisionId);
  if (status.status === 'complete') return recorded ? status : finishLocalExport(root, id, status);
  if (status.blocked && !(status.blocked.startsWith('Live provider') || status.blocked.endsWith(' failed'))) return status;
  if (!recorded) {
    for (const stage of status.revision.plan.stages) {
      if (status.attempts.some(attempt => attempt.stageId === stage.id && attempt.status === 'succeeded')) continue;
      if (stage.kind === 'finish' && stage.provider === 'local' && stage.model === 'remotion') return renderLocalPreview(root, id, status, stage, renderLocal, probeLocal);
      return {...status, status: 'blocked', blocked: stage.provider === 'local' ? `Local stage ${stage.id} has no execution adapter` :
        `Stage ${stage.id} needs verified live capability and price`};
    }
    return status;
  }
  for (const stage of status.revision.plan.stages) {
    const attempts = status.attempts.filter(attempt => attempt.stageId === stage.id);
    if (attempts.some(attempt => attempt.status === 'succeeded')) continue;
    if (attempts.at(-1)?.status === 'unsupported') return status;
    if (status.spentUsd + stage.estimateUsd > status.revision.budgetUsd) return {...status, status: 'blocked', blocked: `Stage ${stage.id} exceeds spending cap`};
    const file = path.join(base(root, id), 'recorded', revisionId, `${stage.id}.json`);
    let saved;
    try {saved = JSON.parse(await readFile(file, 'utf8'));}
    catch (error) {
      if (error.code === 'ENOENT') return attempts.at(-1)?.status === 'failed' ? status :
        {...status, status: 'waiting-recorded-response', reason: `Missing recorded response for ${stage.id}`};
      throw error;
    }
    const response = Array.isArray(saved) ? saved.find(item => !attempts.some(attempt => attempt.id === item?.id)) :
      attempts.length ? null : saved;
    if (!response) return status;
    if (status.spentUsd + response.costUsd > status.revision.budgetUsd) return {...status, status: 'blocked', blocked: `Recorded cost for ${stage.id} exceeds spending cap`};
    await recordAgentAttempt(root, id, revisionId, {...response, stageId: stage.id,
      provider: response.provider ?? stage.provider, model: response.model ?? stage.model, mode: 'recorded'});
    status = await agentStatus(root, id, revisionId);
    if (response.status !== 'succeeded') return {...status, status: 'blocked', blocked: `Stage ${stage.id} ${response.status}`};
  }
  return agentStatus(root, id, revisionId);
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
