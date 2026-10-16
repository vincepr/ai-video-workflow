import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runDirectWorkflow} from '../scripts/product-video/direct.mjs';
import {approveFirstFrame, readFirstFrameReview} from '../scripts/product-video/frame-review.mjs';

const id = '11111111-1111-1111-1111-111111111111';
const base = '.agents/skills/generate-product-video/';

async function fixture(format = 'hypermotion', reviewMode?: string) {
  const root = await mkdtemp(path.join(tmpdir(), 'pv-direct-'));
  const run = path.join(root, 'projects', 'demo', 'work', 'product-video', id);
  await mkdir(path.join(run, 'inputs'), {recursive: true});
  const files: Array<{role: string; path: string; content: string; snapshotPath?: string; sha256?: string}> = [
    {role: 'router', path: `${base}SKILL.md`, content: 'router'},
    {role: 'common', path: `${base}references/common.md`, content: 'common'},
    {role: 'workflow', path: `${base}references/workflows/direct.md`, content: 'direct'},
    {role: 'format', path: `${base}references/configuration/formats/${format}.md`, content: format === 'hypermotion' ? 'no presenter, no speech' : 'presenter speaks'},
    {role: 'reference:product', path: 'projects/demo/media/product.png', content: 'synthetic product'},
  ];
  for (const [i, file] of files.entries()) {
    file.snapshotPath = `inputs/${String(i).padStart(3, '0')}`;
    file.sha256 = createHash('sha256').update(file.content).digest('hex');
    await writeFile(path.join(run, file.snapshotPath), file.content);
  }
  const frozen = {request: {schemaVersion: 1, id, projectId: 'demo', action: 'generate', workflow: 'direct',
    choices: {format, hook: 'none', setting: 'auto'}, language: 'en', destination: 'private',
    references: [{role: 'product', path: 'projects/demo/media/product.png'}],
    brief: {product: 'Synthetic object', facts: ['Blue surface']},
    execution: {provider: 'openrouter', models: {image: 'test/image', video: 'test/video'}, durationSec: 5,
      aspectRatio: '9:16', resolution: '720p', audio: false, ...(reviewMode ? {reviewMode} : {}), budget: {currency: 'USD', maxUsd: 1}}},
    context: {files: files.map(({content, ...file}) => file)}};
  await writeFile(path.join(run, 'request.json'), JSON.stringify(frozen));
  return {root, run, frozen};
}

test('one configured run reaches a finishing-ready plan using only selected context', async () => {
  const {root, run} = await fixture();
  const calls: string[] = [];
  const agent = {
    plan: async ({context}: any) => {calls.push('plan'); assert.equal(context.length, 5); assert.equal(context[3].text, 'no presenter, no speech');
      return {outline: 'One fast move and a settled hero frame', imagePrompt: 'Synthetic object against a clean backdrop', videoPrompt: 'One controlled fly-in, then settle'};},
    inspectFrame: async ({file}: any) => {calls.push('frame'); assert.equal(file, path.join(run, 'first-frame.bin'));
      return {accepted: true, width: 720, height: 1280, inventory: 'complete', crop: 'clear', mask: 'clear', endingBounds: 'clear', notes: 'Matches reference'};},
    inspectVideo: async () => {calls.push('video'); return {accepted: true, acceptedRanges: [{fromFrame: 0, toFrame: 120}],
      captions: [{text: 'Meet the product', fromFrame: 75, toFrame: 120}],
      productIdentity: 'preserved', scale: 'plausible', contact: 'plausible', motion: 'accepted', audio: 'silent', creativeVerdict: 'promising'};},
  };
  const execute = async (operation: string) => {calls.push(operation);
    if (operation === 'submit-image') {await writeFile(path.join(run, 'first-frame.bin'), 'frame'); return {stage: 'image'};}
    if (operation === 'submit-video') return {jobId: 'job-1'};
    if (operation === 'poll') return {status: 'completed', terminal: true};
    if (operation === 'download') {await writeFile(path.join(run, 'video-raw.mp4'), 'video'); return {file: path.join(run, 'video-raw.mp4')};}
    throw new Error(`unexpected ${operation}`);
  };
  try {
    const result = await runDirectWorkflow({root, projectId: 'demo', requestId: id, agent, execute});
    assert.equal(result.status, 'finishing-ready');
    assert.deepEqual(calls, ['plan', 'submit-image', 'frame', 'submit-video', 'poll', 'download', 'video']);
    assert.deepEqual(result.finishPlan.segments, [{source: 'video-raw.mp4', fromFrame: 0, toFrame: 120, kind: 'motion'}]);
    assert.equal(result.review.creativeVerdict, 'promising');
    assert.equal(result.finishPlan.captions[0].text, 'Meet the product');
    const saved = JSON.parse(await readFile(path.join(run, 'direct-state.json'), 'utf8'));
    assert.equal(saved.frameDecision.inventory, 'complete');
    assert.equal(saved.sources[0].role, 'product');
  } finally {await rm(root, {recursive: true, force: true});}
});

test('first-frame mode stops before video and resumes only for the approved frame', async () => {
  const {root, run} = await fixture('hypermotion', 'first-frame');
  const calls: string[] = [];
  const agent = {
    plan: async () => ({outline: 'Product reveal', imagePrompt: 'Clean product image', videoPrompt: 'Slow camera move'}),
    inspectFrame: async () => ({accepted: true, width: 720, height: 1280, inventory: 'complete', crop: 'clear', mask: 'clear', endingBounds: 'clear'}),
    inspectVideo: async () => ({accepted: true, acceptedRanges: [{fromFrame: 0, toFrame: 90}], captions: []}),
  };
  const execute = async (operation: string) => {
    calls.push(operation);
    if (operation === 'submit-image') {await writeFile(path.join(run, 'first-frame.bin'), 'frame'); return {stage: 'image'};}
    if (operation === 'submit-video') return {jobId: 'job'};
    if (operation === 'poll') return {terminal: true, status: 'completed'};
    if (operation === 'download') {await writeFile(path.join(run, 'video-raw.mp4'), 'video'); return {file: 'video-raw.mp4'};}
  };
  try {
    assert.equal((await runDirectWorkflow({root, projectId: 'demo', requestId: id, agent, execute})).status, 'first-frame-review');
    assert.deepEqual(calls, ['submit-image']);
    const review = await readFirstFrameReview(root, 'demo', id);
    await assert.rejects(approveFirstFrame(root, 'demo', id, 'wrong', review!.videoPrompt), /changed/);
    await approveFirstFrame(root, 'demo', id, review!.sha256, 'New motion prompt');
    assert.equal((await runDirectWorkflow({root, projectId: 'demo', requestId: id, agent, execute})).status, 'finishing-ready');
    assert.deepEqual(calls, ['submit-image', 'submit-video', 'poll', 'download']);
    assert.equal((await readFirstFrameReview(root, 'demo', id))!.videoPrompt, 'New motion prompt');
  } finally {await rm(root, {recursive: true, force: true});}
});
