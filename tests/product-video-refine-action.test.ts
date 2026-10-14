import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, mkdir, writeFile, readFile, copyFile, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createProject} from '../scripts/projects.mjs';
import {refineProductVideo} from '../scripts/product-video/refine-action.mjs';
import {normalizeRequest} from '../scripts/product-video/request.mjs';

const mediaReady = Boolean(process.env.FFMPEG_PATH && process.env.FFPROBE_PATH);
test('CTA refinement renders a new numbered export once from accepted raw footage', {skip: !mediaReady}, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pv-refine-action-'));
  const id = '42f98010-7c0a-4fe5-9089-5e5a69b7a501';
  const refinementId = 'b4e50ed0-8f3e-411b-814c-b12322ce49f0';
  try {
    await createProject(root, 'demo', 'Demo');
    const script = '.agents/skills/generate-product-video/scripts/finish.py';
    await mkdir(path.dirname(path.join(root, script)), {recursive: true});
    await copyFile(path.resolve(script), path.join(root, script));
    const run = path.join(root, 'projects/demo/work/product-video', id);
    await mkdir(run, {recursive: true});
    const draft = {schemaVersion: 1, id, projectId: 'demo', action: 'generate', workflow: 'direct', choices: {format: 'hypermotion', hook: 'none', setting: 'auto'}, language: 'en', destination: 'private',
      references: [{role: 'product', path: 'projects/demo/media/product.png'}], brief: {product: 'Synthetic block', facts: [], brand: '', cta: 'Old CTA'},
      execution: {provider: 'openrouter', models: {image: 'test/image', video: 'test/video'}, durationSec: 1, aspectRatio: '16:9', resolution: '480p', audio: false, voice: {mode: 'none'}, budget: {currency: 'USD', maxUsd: 1}}};
    const catalog = {version: 1, files: {destinations: {private: ''}}, choices: {direct: {formats: ['hypermotion'], hooks: ['none'], settings: ['auto']}}};
    await writeFile(path.join(run, 'request.json'), JSON.stringify({request: normalizeRequest(draft, catalog), context: {files: []}}));
    const plan = {version: 1, fps: 30, canvas: {width: 160, height: 90}, segments: [{source: 'video-raw.mp4', fromFrame: 0, toFrame: 30, kind: 'motion'}], captions: [], audio: {source: 'none'}};
    await writeFile(path.join(run, 'direct-state.json'), JSON.stringify({status: 'finishing-ready', review: {accepted: true}, finishPlan: plan}));
    const made = spawnSync(process.env.FFMPEG_PATH!, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=30:d=1', '-c:v', 'libx264', path.join(run, 'video-raw.mp4')], {encoding: 'utf8'});
    assert.equal(made.status, 0, made.stderr);
    await writeFile(path.join(root, 'projects/demo/media/product.png'), 'synthetic product');
    const revised = {...draft, brief: {...draft.brief, cta: 'New CTA'}};
    const options = {root, projectId: 'demo', requestId: id, refinementId, draft: revised, catalog,
      ffmpeg: process.env.FFMPEG_PATH!, ffprobe: process.env.FFPROBE_PATH!};
    await assert.rejects(() => refineProductVideo({...options, registerExport: async () => {throw new Error('Transient registration failure');}}), /Transient registration failure/);
    const first = await refineProductVideo(options);
    await rm(path.join(run, 'refinements', refinementId, 'export.json'));
    const second = await refineProductVideo(options);
    if (process.env.REFINEMENT_SAMPLE_DIR) {
      await mkdir(process.env.REFINEMENT_SAMPLE_DIR, {recursive: true});
      await copyFile(first.output, path.join(process.env.REFINEMENT_SAMPLE_DIR, 'synthetic-refinement.mp4'));
    }
    assert.equal(first.output, second.output);
    assert.match(first.output, /videos[\\/]000001-/);
    const savedPlan = JSON.parse(await readFile(path.join(path.dirname(first.output), 'finish-plan.json'), 'utf8'));
    assert.equal(savedPlan.captions.at(-1).text, 'New CTA');
    assert.equal(JSON.parse(await readFile(path.join(run, 'direct-state.json'), 'utf8')).finishPlan.captions.length, 0);
  } finally {await rm(root, {recursive: true, force: true});}
});
