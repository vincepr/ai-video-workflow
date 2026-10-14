import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createProject} from '../scripts/projects.mjs';
import {readRenderHistory} from '../scripts/render-history.mjs';
import {registerFinishedExport} from '../scripts/product-video/export.mjs';

test('registration reserves a numbered video and persists frozen plan, release and history', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pv-export-'));
  const id = '9a4fec5b-d5d4-4fc6-ae92-df73acd109be';
  try {
    await createProject(root, 'demo', 'Demo');
    await writeFile(path.join(root, 'projects/demo/media/block.png'), 'product bytes');
    await writeFile(path.join(root, 'projects/demo/media/block.attribution.json'), JSON.stringify({title: 'Synthetic block photo', creator: 'Test artist', source: 'local test', license: 'test permission', restrictions: '', attributionRequired: true, exactCredit: 'Photo: Test artist'}));
    const run = path.join(root, 'projects/demo/work/product-video', id);
    await mkdir(run, {recursive: true});
    const request = {id, projectId: 'demo', brief: {product: 'Synthetic block', cta: 'See details'}, references: [{role: 'product', path: 'projects/demo/media/block.png'}]};
    const plan = {version: 1, fps: 30, segments: [{source: 'video-raw.mp4', fromFrame: 0, toFrame: 30, kind: 'motion'}], captions: [], audio: {source: 'none'}};
    await writeFile(path.join(run, 'request.json'), JSON.stringify({request, context: {files: []}}));
    await writeFile(path.join(run, 'direct-state.json'), JSON.stringify({status: 'finishing-ready', finishPlan: plan}));
    await writeFile(path.join(run, 'video-raw.mp4'), 'raw bytes');
    await writeFile(path.join(run, 'finished.mp4'), 'finished bytes');
    await writeFile(path.join(run, 'finish-report.json'), JSON.stringify({file: path.join(run, 'finished.mp4'), frames: 30, fps: 30, canvas: [180, 320], sources: [{path: path.join(run, 'video-raw.mp4'), sha256: 'synthetic'}]}));
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
