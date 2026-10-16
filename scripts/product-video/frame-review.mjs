import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {readFrozenRequest} from './request.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const runPath = (root, projectId, requestId) => path.join(root, 'projects', projectId, 'work', 'product-video', requestId);

export async function readFirstFrameReview(root, projectId, requestId) {
  const frozen = await readFrozenRequest(root, projectId, requestId);
  if (frozen.request.projectId !== projectId || frozen.request.id !== requestId) throw new Error('Wrong request');
  if (frozen.request.workflow !== 'direct') return null;
  const run = runPath(root, projectId, requestId);
  let state;
  try {state = JSON.parse(await readFile(path.join(run, 'direct-state.json'), 'utf8'));}
  catch (error) {if (error.code === 'ENOENT') return null; throw error;}
  if (!state.frameDecision?.accepted || frozen.request.execution.reviewMode !== 'first-frame') return null;
  const frame = await readFile(path.join(run, 'first-frame.bin'));
  const sha256 = hash(frame);
  let approval = null;
  try {approval = JSON.parse(await readFile(path.join(run, 'frame-approval.json'), 'utf8'));}
  catch (error) {if (error.code !== 'ENOENT') throw error;}
  return {sha256, approved: approval?.frameSha256 === sha256, decision: state.frameDecision,
    imagePrompt: await readFile(path.join(run, 'image-prompt.md'), 'utf8'),
    videoPrompt: approval?.frameSha256 === sha256 ? approval.videoPrompt : await readFile(path.join(run, 'video-prompt.md'), 'utf8')};
}

export async function approveFirstFrame(root, projectId, requestId, frameSha256, videoPrompt) {
  const review = await readFirstFrameReview(root, projectId, requestId);
  if (!review || review.sha256 !== frameSha256) throw new Error('First frame changed; refresh the review');
  if (typeof videoPrompt !== 'string' || !videoPrompt.trim() || videoPrompt.length > 4000) throw new Error('Motion prompt must be 1 to 4000 characters');
  const approval = {frameSha256, videoPrompt: videoPrompt.trim(), approvedAt: new Date().toISOString()};
  const file = path.join(runPath(root, projectId, requestId), 'frame-approval.json');
  try {await writeFile(file, JSON.stringify(approval, null, 2) + '\n', {flag: 'wx'});}
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = JSON.parse(await readFile(file, 'utf8'));
    if (previous.frameSha256 !== approval.frameSha256 || previous.videoPrompt !== approval.videoPrompt) throw new Error('First frame already approved with different instructions');
    return previous;
  }
  return approval;
}
