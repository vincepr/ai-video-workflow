import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {projectPaths} from '../projects.mjs';
import {normalizeRequest, readFrozenRequest} from './request.mjs';
import {renderLocalRefinement} from './refine.mjs';
import {registerFinishedExport} from './export.mjs';

const json = async file => JSON.parse(await readFile(file, 'utf8'));
function frames(plan) {
  return plan.segments.reduce((sum, segment) => sum + (segment.kind === 'still' || segment.kind === 'hold' ? segment.frames : segment.toFrame - segment.fromFrame), 0);
}

/** Refinish accepted direct footage using only local caption/CTA changes. */
export async function refineProductVideo({root, projectId, requestId, refinementId, draft, catalog, ffmpeg, ffprobe, python = 'python'}) {
  const frozen = await readFrozenRequest(root, projectId, requestId);
  const request = frozen.request;
  if (request.workflow !== 'direct' || request.action !== 'generate') throw new Error('Only accepted direct requests support local refinement');
  const candidate = normalizeRequest({...draft, id: requestId, projectId}, catalog);
  const fixed = value => ({...value, brief: {...value.brief, cta: '', brand: ''}});
  if (JSON.stringify(fixed(candidate)) !== JSON.stringify(fixed(request))) throw new Error('Local refinement may only change brand, CTA or final caption');
  const caption = String(draft.finishing?.caption?.trim() || candidate.brief.cta).trim();
  if (!caption || caption.length > 40 || /[\r\n]/.test(caption)) throw new Error('Final caption must contain 1 to 40 characters on one line');
  const run = path.join(projectPaths(root, projectId).work, 'product-video', requestId);
  const state = await json(path.join(run, 'direct-state.json'));
  if (state.status !== 'finishing-ready' || state.review?.accepted !== true || state.finishPlan?.version !== 1) throw new Error('Accepted direct footage is unavailable');
  const total = frames(state.finishPlan);
  if (!Number.isInteger(total) || total < 1) throw new Error('Accepted edit has no frames');
  const canvasWidth = state.finishPlan.canvas?.width ?? 1080;
  const fontSize = Math.max(12, Math.min(48, Math.floor(canvasWidth / Math.max(caption.length * 0.62, 12))));
  const plan = {...state.finishPlan, captions: [...(state.finishPlan.captions ?? []), {text: caption, fromFrame: Math.max(0, total - 2 * state.finishPlan.fps), toFrame: total, fontSize, y: 'h-text_h-40'}]};
  const rendered = await renderLocalRefinement({root, projectId, requestId, refinementId, plan, ffmpeg, ffprobe, python});
  const receiptFile = path.join(rendered.directory, 'export.json');
  try {return await json(receiptFile);} catch (error) {if (error.code !== 'ENOENT') throw error;}
  const claimFile = path.join(rendered.directory, 'export.claim.json');
  try {await writeFile(claimFile, JSON.stringify({requestId, refinementId, caption}) + '\n', {flag: 'wx'});}
  catch (error) {if (error.code === 'EEXIST') throw new Error('Export registration is already claimed; inspect the variant before retrying'); throw error;}
  const exported = await registerFinishedExport({root, projectId, requestId, finishedFile: rendered.finishedFile, variantDirectory: rendered.directory,
    label: candidate.brief.product, releaseBrief: candidate.brief});
  const result = {status: 'finished', ...exported};
  await writeFile(receiptFile, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
  return result;
}
