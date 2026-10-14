import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, writeFile, readFile, rm, stat, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createProject} from '../scripts/projects.mjs';
import {prepareLocalRefinement, renderLocalRefinement} from '../scripts/product-video/refine.mjs';

const id = '42f98010-7c0a-4fe5-9089-5e5a69b7a501';
const variant = 'b4e50ed0-8f3e-411b-814c-b12322ce49f0';
const plan = {version: 1, fps: 30, canvas: {width: 160, height: 90},
  segments: [{source: 'video-raw.mp4', fromFrame: 0, toFrame: 30, kind: 'motion'}],
  captions: [{text: 'NEW CTA', fromFrame: 0, toFrame: 30, fontSize: 14, x: 10, y: 10}], audio: {source: 'none'}};

async function fixture(raw = 'accepted raw bytes') {
  const root = await mkdtemp(path.join(tmpdir(), 'pv-refine-'));
  await createProject(root, 'demo', 'Demo');
  const run = path.join(root, 'projects/demo/work/product-video', id);
  await mkdir(run, {recursive: true});
  await writeFile(path.join(run, 'request.json'), JSON.stringify({request: {schemaVersion: 1, id, projectId: 'demo', workflow: 'direct', action: 'generate', brief: {product: 'Synthetic object'}}, context: {files: []}}));
  await writeFile(path.join(run, 'direct-state.json'), JSON.stringify({status: 'finishing-ready', review: {accepted: true, acceptedRanges: [{fromFrame: 0, toFrame: 30}]},
    finishPlan: {version: 1, fps: 30, segments: [{source: 'video-raw.mp4', fromFrame: 0, toFrame: 30, kind: 'motion'}], captions: [], audio: {source: 'none'}}}));
  await writeFile(path.join(run, 'video-raw.mp4'), raw);
  return {root, run};
}

test('a revised local plan gets its own ignored directory and immutable source copy', async () => {
  const {root, run} = await fixture();
  try {
    const result = await prepareLocalRefinement({root, projectId: 'demo', requestId: id, refinementId: variant, plan});
    assert.equal(result.status, 'prepared');
    assert.equal(result.directory, path.join(run, 'refinements', variant));
    assert.deepEqual(JSON.parse(await readFile(path.join(result.directory, 'edit-plan.json'), 'utf8')), plan);
    assert.equal(await readFile(path.join(result.directory, 'video-raw.mp4'), 'utf8'), 'accepted raw bytes');
    assert.equal(await readFile(path.join(run, 'video-raw.mp4'), 'utf8'), 'accepted raw bytes');
    assert.equal(createHash('sha256').update(await readFile(path.join(result.directory, 'video-raw.mp4'))).digest('hex'), result.sources[0].sha256);
    assert.equal(JSON.parse(await readFile(path.join(run, 'direct-state.json'), 'utf8')).finishPlan.captions.length, 0);
    const same = await prepareLocalRefinement({root, projectId: 'demo', requestId: id, refinementId: variant, plan});
    assert.equal(same.directory, result.directory);
    await assert.rejects(() => prepareLocalRefinement({root, projectId: 'demo', requestId: id, refinementId: variant,
      plan: {...plan, captions: [{...plan.captions[0], text: 'DIFFERENT'}]}}), /different|already/i);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('refinement rejects foreign sources and a run without accepted media', async () => {
  const {root, run} = await fixture();
  try {
    await assert.rejects(() => prepareLocalRefinement({root, projectId: 'demo', requestId: id, refinementId: variant,
      plan: {...plan, segments: [{...plan.segments[0], source: '../other.mp4'}]}}), /source|path/i);
    await writeFile(path.join(run, 'direct-state.json'), JSON.stringify({status: 'raw-rejected', review: {accepted: false}}));
    await assert.rejects(() => prepareLocalRefinement({root, projectId: 'demo', requestId: id, refinementId: variant, plan}), /accepted|ready/i);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('full FFmpeg renders revised caption without touching original raw file', {skip: !process.env.FFMPEG_PATH || !process.env.FFPROBE_PATH}, async () => {
  const {spawnSync} = await import('node:child_process');
  const root = await mkdtemp(path.join(tmpdir(), 'pv-refine-media-'));
  try {
    await createProject(root, 'demo', 'Demo');
    const script = '.agents/skills/generate-product-video/scripts/finish.py';
    await mkdir(path.dirname(path.join(root, script)), {recursive: true});
    await copyFile(path.resolve(script), path.join(root, script));
    const run = path.join(root, 'projects/demo/work/product-video', id);
    await mkdir(run, {recursive: true});
    await writeFile(path.join(run, 'request.json'), JSON.stringify({request: {schemaVersion: 1, id, projectId: 'demo', workflow: 'direct', action: 'generate', brief: {product: 'Synthetic object'}}, context: {files: []}}));
    await writeFile(path.join(run, 'direct-state.json'), JSON.stringify({status: 'finishing-ready', review: {accepted: true, acceptedRanges: [{fromFrame: 0, toFrame: 30}]}, finishPlan: {...plan, captions: []}}));
    const raw = path.join(run, 'video-raw.mp4');
    const made = spawnSync(process.env.FFMPEG_PATH!, ['-v','error','-f','lavfi','-i','color=c=blue:s=160x90:r=30:d=1','-c:v','libx264',raw], {encoding: 'utf8'});
    assert.equal(made.status, 0, made.stderr);
    const before = createHash('sha256').update(await readFile(raw)).digest('hex');
    const result = await renderLocalRefinement({root, projectId: 'demo', requestId: id, refinementId: variant, plan,
      ffmpeg: process.env.FFMPEG_PATH!, ffprobe: process.env.FFPROBE_PATH!, python: process.env.PYTHON_PATH || 'python'});
    assert.equal(result.status, 'rendered-needs-export');
    assert.ok((await stat(result.finishedFile)).size > 0);
    assert.equal(JSON.parse(await readFile(result.reportFile, 'utf8')).frames, 30);
    assert.equal(createHash('sha256').update(await readFile(raw)).digest('hex'), before);
  } finally {await rm(root, {recursive: true, force: true});}
});
