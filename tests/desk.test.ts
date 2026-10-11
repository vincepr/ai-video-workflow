import assert from 'node:assert/strict';
import test from 'node:test';
import {createDeskServer} from '../scripts/serve-desk.mjs';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {recordRender} from '../scripts/render-history.mjs';

test('the desk serves its page and modules without exposing repository files', async () => {
  const server = createDeskServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /Creator Desk/);
    assert.match(html, /id="review-version"/);
    assert.equal((await fetch(origin + '/workflow.mjs')).status, 200);
    assert.equal((await fetch(origin + '/images.html')).status, 200);
    assert.equal((await fetch(origin + '/image-selection.mjs')).status, 200);
    assert.equal((await fetch(origin + '/panel-options/../../.env')).status, 404);
    assert.equal((await fetch(origin + '/.env')).status, 404);
    assert.equal((await fetch(origin + '/package.json')).status, 404);
    assert.equal((await fetch(origin, {method: 'POST'})).status, 405);
  } finally {await new Promise<void>((resolve) => server.close(() => resolve()));}
});

test('the local session persists choices and serves only registered videos with live file status', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'creator-session-'));
  const server = createDeskServer({root, sessionId: 'test'});
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    await mkdir(path.join(root, 'out'));
    const output = path.join(root, 'out', 'voice.mp4');
    await writeFile(output, '0123456789');
    const record = await recordRender(root, {output, sessionId: 'test', episode: {title: 'Voice', shots: []}});
    const session = {version: 1, sessionId: 'test', captions: {mode: 'word'}, extraTabs: [{id: 'music', label: 'Music', choice: 'Silence'}]};
    const saved = await fetch(origin + '/api/session', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(session)});
    assert.equal(saved.status, 200);
    const state = await fetch(origin + '/api/session').then((response) => response.json());
    assert.deepEqual(state.session, session);
    assert.equal(state.history[0].status, 'available');
    const video = await fetch(origin + `/api/renders/${record.id}/video`, {headers: {Range: 'bytes=2-5'}});
    assert.equal(video.status, 206);
    assert.equal(video.headers.get('content-range'), 'bytes 2-5/10');
    assert.equal(await video.text(), '2345');
    assert.equal((await fetch(origin + '/api/renders/unknown/video')).status, 404);
    const crossOrigin = await fetch(origin + '/api/session', {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'https://example.com'}, body: JSON.stringify(session)});
    assert.equal(crossOrigin.status, 403);
    const withVersions = {...session, versions: [{state: {script: 'x'.repeat(300 * 1024)}}]};
    const versionSave = await fetch(origin + '/api/session', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(withVersions)});
    assert.equal(versionSave.status, 200);
    assert.deepEqual((await fetch(origin + '/api/session').then(response => response.json())).session, withVersions);
    await rm(output);
    const updated = await fetch(origin + '/api/session').then((response) => response.json());
    assert.equal(updated.history[0].status, 'deleted');
    assert.equal(updated.history[0].snapshot.episode.title, 'Voice');
    assert.equal((await fetch(origin + `/api/renders/${record.id}/video`)).status, 404);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    assert.equal(path.dirname(root), tmpdir());
    await rm(root, {recursive: true, force: true});
  }
});
