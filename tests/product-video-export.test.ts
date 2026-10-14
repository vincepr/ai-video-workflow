import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createProject} from '../scripts/projects.mjs';
import {readRenderHistory} from '../scripts/render-history.mjs';
import {registerFinishedExport} from '../scripts/product-video/export.mjs';

test('registration reserves a numbered video and persists frozen plan, release and history', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pv-export-'));
  const id = '9a4fec5b-d5d4-4fc6-ae92-df73acd109be';
  try {
    await createProject(root, 'demo', 'Demo');
    await writeFile(path.join(root, 'projects/demo/media/block.png'), 'product bytes');
    const attribution = JSON.stringify({title: 'Synthetic block photo', creator: 'Test artist', source: 'local test', license: 'test permission', restrictions: '', attributionRequired: true, exactCredit: 'Photo: Test artist'});
    await writeFile(path.join(root, 'projects/demo/media/block.attribution.json'), attribution);
    const run = path.join(root, 'projects/demo/work/product-video', id);
    await mkdir(run, {recursive: true});
    const request = {id, projectId: 'demo', brief: {product: 'Synthetic block', cta: 'See details'}, references: [{role: 'product', path: 'projects/demo/media/block.png'}]};
    const plan = {version: 1, fps: 30, segments: [{source: 'video-raw.mp4', fromFrame: 0, toFrame: 30, kind: 'motion'}], captions: [], audio: {source: 'none'}};
    await mkdir(path.join(run, 'inputs'), {recursive: true});
    await writeFile(path.join(run, 'inputs/000'), attribution);
    await writeFile(path.join(run, 'request.json'), JSON.stringify({request, context: {files: [{role: 'reference-attribution:product', path: 'projects/demo/media/block.attribution.json', snapshotPath: 'inputs/000', sha256: createHash('sha256').update(attribution).digest('hex')}]}}));
    await writeFile(path.join(root, 'projects/demo/media/block.attribution.json'), JSON.stringify({...JSON.parse(attribution), exactCredit: 'Changed after freeze'}));
    await writeFile(path.join(run, 'direct-state.json'), JSON.stringify({status: 'finishing-ready', finishPlan: plan}));
    await writeFile(path.join(run, 'video-raw.mp4'), 'raw bytes');
    await writeFile(path.join(run, 'finished.mp4'), 'finished bytes');
    const outputSha256 = createHash('sha256').update('finished bytes').digest('hex');
    await writeFile(path.join(run, 'finish-report.json'), JSON.stringify({file: path.join(run, 'finished.mp4'), outputSha256, frames: 30, fps: 30, canvas: [180, 320], sources: [{path: path.join(run, 'video-raw.mp4'), sha256: 'synthetic'}]}));
    const result = await registerFinishedExport({root, projectId: 'demo', requestId: id, finishedFile: path.join(run, 'finished.mp4'), label: 'First pass'});
    assert.match(result.output, /projects[\\/]demo[\\/]videos[\\/]000001-first-pass[\\/]video\.mp4$/);
    assert.equal(await readFile(result.output, 'utf8'), 'finished bytes');
    assert.equal(await readFile(path.join(run, 'video-raw.mp4'), 'utf8'), 'raw bytes');
    assert.deepEqual(JSON.parse(await readFile(path.join(path.dirname(result.output), 'finish-plan.json'), 'utf8')), plan);
    const description = await readFile(`${result.output}.description.txt`, 'utf8');
    assert.match(description, /Synthetic block/);
    assert.match(description, /Photo: Test artist/);
    assert.match(await readFile(path.join(path.dirname(result.output), 'source-attribution.json'), 'utf8'), /Photo: Test artist/);
    assert.equal(JSON.parse(await readFile(`${result.output}.release.json`, 'utf8')).description, description.trimEnd());
    const history = await readRenderHistory(root, 'demo');
    assert.equal(history.length, 1);
    assert.equal(history[0].status, 'available');
    assert.equal(history[0].release.description, description.trimEnd());
    assert.equal(history[0].snapshot.productVideo.requestId, id);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('registration rejects bytes changed after the finishing report', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pv-export-tamper-'));
  const id = '9a4fec5b-d5d4-4fc6-ae92-df73acd109be';
  try {
    await createProject(root, 'demo', 'Demo');
    const run = path.join(root, 'projects/demo/work/product-video', id);
    await mkdir(run, {recursive: true});
    const plan = {version: 1, fps: 30, segments: [], captions: [], audio: {source: 'none'}};
    await writeFile(path.join(run, 'request.json'), JSON.stringify({request: {id, projectId: 'demo', brief: {product: 'Synthetic block'}, references: []}, context: {files: []}}));
    await writeFile(path.join(run, 'direct-state.json'), JSON.stringify({status: 'finishing-ready', finishPlan: plan}));
    await writeFile(path.join(run, 'finished.mp4'), 'changed bytes');
    await writeFile(path.join(run, 'finish-report.json'), JSON.stringify({file: path.join(run, 'finished.mp4'), outputSha256: '0'.repeat(64), frames: 30, fps: 30, canvas: [180, 320], sources: []}));
    await assert.rejects(() => registerFinishedExport({root, projectId: 'demo', requestId: id, finishedFile: path.join(run, 'finished.mp4')}), /hash|changed/i);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('refined edit registers its own plan without changing the original run', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pv-export-refine-'));
  const id = '9a4fec5b-d5d4-4fc6-ae92-df73acd109be';
  const variantId = '172197b8-239b-4bea-853e-d496443b1002';
  try {
    await createProject(root, 'demo', 'Demo');
    const run = path.join(root, 'projects/demo/work/product-video', id);
    const variantDirectory = path.join(run, 'refinements', variantId);
    await mkdir(variantDirectory, {recursive: true});
    const original = {version: 1, fps: 30, segments: [{source: 'video-raw.mp4', fromFrame: 0, toFrame: 30, kind: 'motion'}], captions: [], audio: {source: 'none'}};
    const revised = {...original, captions: [{text: 'New CTA', fromFrame: 0, toFrame: 30}]};
    await writeFile(path.join(run, 'request.json'), JSON.stringify({request: {id, projectId: 'demo', brief: {product: 'Synthetic block'}, references: []}, context: {files: []}}));
    await writeFile(path.join(run, 'direct-state.json'), JSON.stringify({status: 'finishing-ready', finishPlan: original}));
    await writeFile(path.join(variantDirectory, 'edit-plan.json'), JSON.stringify(revised));
    await writeFile(path.join(variantDirectory, 'finished.mp4'), 'revised bytes');
    await writeFile(path.join(variantDirectory, 'finish-report.json'), JSON.stringify({file: path.join(variantDirectory, 'finished.mp4'), outputSha256: createHash('sha256').update('revised bytes').digest('hex'), frames: 30, fps: 30, canvas: [180, 320], sources: []}));
    const result = await registerFinishedExport({root, projectId: 'demo', requestId: id, finishedFile: path.join(variantDirectory, 'finished.mp4'), variantDirectory, label: 'New CTA'});
    assert.equal(JSON.parse(await readFile(path.join(path.dirname(result.output), 'finish-plan.json'), 'utf8')).captions[0].text, 'New CTA');
    assert.equal(JSON.parse(await readFile(path.join(run, 'direct-state.json'), 'utf8')).finishPlan.captions.length, 0);
  } finally {await rm(root, {recursive: true, force: true});}
});
