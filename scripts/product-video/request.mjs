import {projectPaths} from '../projects.mjs';
import {readFile, writeFile, mkdir, mkdtemp, rename, rm, realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const actions = ['generate', 'plan'];
const workflows = ['direct', 'skit', 'drama', 'reference-remake'];
const referenceRoles = ['product', 'presenter', 'environment', 'reference-video'];
const choiceField = {direct: 'format', skit: 'style', drama: 'style', 'reference-remake': 'style'};

function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${name}`);
  return value.trim();
}
function listed(value, list, name) {
  if (!list?.includes(value)) throw new Error(`Unknown or inapplicable ${name}: ${value}`);
  return value;
}
function projectFile(file, projectId) {
  const prefix = `projects/${projectId}/media/`;
  if (typeof file !== 'string' || !file.startsWith(prefix) || file.includes('\\') || file.split('/').some(part => part === '..' || part === '.' || !part)) throw new Error(`Foreign or invalid project media path: ${file}`);
  return file;
}

export function normalizeRequest(draft, catalog) {
  if (draft?.schemaVersion !== undefined && draft.schemaVersion !== 1) throw new Error('Unsupported request schema');
  const projectId = required(draft?.projectId, 'project ID');
  projectPaths('.', projectId);
  const id = required(draft.id, 'request ID');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Invalid request ID');
  const workflow = listed(draft.workflow, workflows, 'workflow');
  const allowed = catalog?.choices?.[workflow];
  if (!allowed) throw new Error(`Workflow is unavailable: ${workflow}`);
  const choices = draft.choices ?? {};
  const primary = choiceField[workflow];
  const normalizedChoices = workflow === 'reference-remake' ? {} : {[primary]: listed(choices[primary], allowed[`${primary}s`], primary)};
  let presenterDescription;
  if (workflow === 'direct') {
    normalizedChoices.hook = listed(choices.hook ?? 'none', allowed.hooks, 'hook');
    normalizedChoices.setting = listed(choices.setting ?? 'auto', allowed.settings, 'setting');
    if (choices.avatar !== undefined) {
      normalizedChoices.avatar = listed(choices.avatar, allowed.avatars, 'avatar');
      presenterDescription = catalog.metadata?.avatars?.[normalizedChoices.avatar]?.castingDescription;
      if (typeof presenterDescription !== 'string') throw new Error(`Missing avatar description: ${normalizedChoices.avatar}`);
    }
  }
  for (const key of Object.keys(choices)) if (!(key in normalizedChoices)) throw new Error(`Inapplicable choice: ${key}`);
  const references = (draft.references ?? []).map((ref, index) => ({
    role: listed(ref.role, referenceRoles, `reference role ${index}`),
    path: projectFile(ref.path, projectId),
  }));
  if (!references.some(ref => ref.role === 'product')) throw new Error('Missing product reference');
  if (workflow === 'reference-remake' && !references.some(ref => ref.role === 'reference-video')) throw new Error('Missing reference-video source');
  if (normalizedChoices.avatar === 'custom' && !references.some(ref => ref.role === 'presenter')) throw new Error('Custom avatar requires a presenter reference');
  const brief = draft.brief ?? {};
  if (workflow === 'reference-remake') required(brief.referenceRights, 'reference video rights');
  if (brief.direction !== undefined && (typeof brief.direction !== 'string' || brief.direction.length > 2000)) throw new Error('Invalid creative direction');
  const execution = draft.execution ?? {};
  const reviewMode = execution.reviewMode === undefined ? undefined : listed(execution.reviewMode, ['full', 'first-frame'], 'review mode');
  if (reviewMode === 'first-frame' && workflow !== 'direct') throw new Error('First-frame review is available for direct ads only');
  const voice = execution.voice ?? {mode: 'none'};
  if (!['none', 'replace'].includes(voice.mode) || (voice.mode === 'replace' && (workflow !== 'reference-remake' || !voice.text?.trim()))) throw new Error('Invalid voice replacement');
  const budget = execution.budget ?? {};
  if (budget.currency !== 'USD' || !Number.isFinite(budget.maxUsd) || budget.maxUsd < 0) throw new Error('Invalid USD budget');
  if (!Number.isFinite(execution.durationSec) || execution.durationSec <= 0) throw new Error('Invalid duration');
  return {
    schemaVersion: 1, id, projectId, action: listed(draft.action, actions, 'action'), workflow, choices: normalizedChoices,
    language: required(draft.language, 'language'), destination: listed(draft.destination, Object.keys(catalog.files?.destinations ?? {}), 'destination'),
    references, brief: {product: required(brief.product, 'product'), facts: Array.isArray(brief.facts) ? brief.facts.map(fact => required(fact, 'fact')) : [], brand: brief.brand?.trim() ?? '', cta: brief.cta?.trim() ?? '', referenceRights: brief.referenceRights?.trim() ?? '', ...(brief.direction === undefined ? {} : {direction: brief.direction.trim()})},
    ...(presenterDescription === undefined ? {} : {presenterDescription}),
    execution: {provider: required(execution.provider, 'provider'), models: execution.models ?? {}, durationSec: execution.durationSec, aspectRatio: required(execution.aspectRatio, 'aspect ratio'), imageResolution: required(execution.imageResolution ?? execution.resolution, 'image resolution'), resolution: required(execution.resolution, 'video resolution'), audio: Boolean(execution.audio), voice: {mode: voice.mode, ...(voice.mode === 'replace' ? {text: voice.text.trim()} : {})}, budget: {currency: 'USD', maxUsd: budget.maxUsd}, ...(reviewMode === undefined ? {} : {reviewMode})},
  };
}
function requestDirectory(root, projectId, id) {
  projectPaths(root, projectId);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid request ID');
  return path.join(projectPaths(root, projectId).work, 'product-video', id);
}

export async function readFrozenRequest(root, projectId, id) {
  return JSON.parse(await readFile(path.join(requestDirectory(root, projectId, id), 'request.json'), 'utf8'));
}

export async function freezeRequest(root, request, manifest) {
  if (request.schemaVersion !== 1 || manifest.schemaVersion !== 1 || manifest.requestId !== request.id || manifest.projectId !== request.projectId) throw new Error('Mismatched request and context manifest');
  const target = requestDirectory(root, request.projectId, request.id);
  const parent = path.dirname(target);
  await mkdir(parent, {recursive: true});
  const sameExisting = async () => {
    const existing = await readFrozenRequest(root, request.projectId, request.id);
    if (JSON.stringify(existing.request) !== JSON.stringify(request) || JSON.stringify(existing.context.files.map(({snapshotPath, ...file}) => file)) !== JSON.stringify(manifest.files)) throw new Error('Request ID already frozen with a different request or context');
    return existing;
  };
  try {return await sameExisting();} catch (error) {if (error.code !== 'ENOENT') throw error;}
  const staging = await mkdtemp(path.join(parent, '.freeze-'));
  try {
    const files = [];
    for (const [index, entry] of manifest.files.entries()) {
      const file = entry.path;
      const valid = file.startsWith('.agents/skills/generate-product-video/') || file.startsWith(`projects/${request.projectId}/media/`) || file === `projects/${request.projectId}/project.json`;
      if (!valid || file.includes('\\') || file.split('/').includes('..') || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error(`Invalid frozen input: ${file}`);
      const source = await realpath(path.resolve(root, file));
      const allowedRoot = await realpath(path.resolve(root, file.startsWith('projects/') ? `projects/${request.projectId}` : '.agents/skills/generate-product-video'));
      const relative = path.relative(allowedRoot, source);
      if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Input leaves allowed directory: ${file}`);
      const bytes = await readFile(source);
      if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Input changed before freeze: ${file}`);
      const snapshotPath = `inputs/${String(index).padStart(3, '0')}`;
      await mkdir(path.join(staging, 'inputs'), {recursive: true});
      await writeFile(path.join(staging, snapshotPath), bytes, {flag: 'wx'});
      files.push({...entry, snapshotPath});
    }
    const frozen = {request, context: {...manifest, files}};
    await writeFile(path.join(staging, 'request.json'), JSON.stringify(frozen, null, 2) + '\n', {flag: 'wx'});
    try {await rename(staging, target);} catch (error) {if (error.code === 'EEXIST' || error.code === 'EPERM') return await sameExisting(); throw error;}
    return frozen;
  } finally {await rm(staging, {recursive: true, force: true});}
}
