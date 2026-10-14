import assert from 'node:assert/strict';
import test from 'node:test';
import {createDeskServer} from '../scripts/serve-desk.mjs';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {recordRender} from '../scripts/render-history.mjs';
import {recordWorkerUpdate} from '../scripts/product-video/launcher.mjs';
import {normalizeRequest} from '../scripts/product-video/request.mjs';
import {createServer} from 'node:http';

test('project desks keep catalogs, sessions and videos separate', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desk-projects-'));
  const server = createDeskServer({root});
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    for (const id of ['alpha', 'beta']) {
      await mkdir(path.join(root, 'projects', id), {recursive: true});
      await writeFile(path.join(root, 'projects', id, 'project.json'), JSON.stringify({id, title: id}));
      await writeFile(path.join(root, 'projects', id, 'image-options.json'), JSON.stringify({id: `${id}-panels`, projectId: id}));
    }
    const listing = await fetch(origin + '/api/projects');
    assert.equal(listing.status, 200);
    assert.deepEqual((await listing.json()).projects.map((item: {id: string}) => item.id), ['alpha', 'beta']);
    for (const id of ['alpha', 'beta']) {
      const base = `${origin}/projects/${id}`;
      assert.equal((await fetch(`${base}/image-options.json`).then(response => response.json())).projectId, id);
      const state = {version: 1, sessionId: id, notes: `${id} choices`};
      assert.equal((await fetch(`${base}/api/session`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(state)})).status, 200);
    }
    assert.equal((await fetch(`${origin}/projects/alpha/api/session`).then(response => response.json())).session.notes, 'alpha choices');
    assert.equal((await fetch(`${origin}/projects/beta/api/session`).then(response => response.json())).session.notes, 'beta choices');
    assert.equal((await fetch(`${origin}/projects/alpha/api/session`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({version: 1, sessionId: 'beta'})})).status, 400);
    assert.equal((await fetch(`${origin}/projects/missing/api/session`)).status, 404);
    assert.equal((await fetch(`${origin}/projects/alpha/work/session.json`)).status, 404);
    const output = path.join(root, 'projects', 'alpha', 'videos', '000001-first-look', 'video.mp4');
    await mkdir(path.dirname(output), {recursive: true});
    await writeFile(output, 'alpha-video');
    const record = await recordRender(root, {output, sessionId: 'alpha', episode: {title: 'Alpha', shots: []}});
    const history = (await fetch(`${origin}/projects/alpha/api/session`).then(response => response.json())).history;
    assert.equal(await fetch(origin + history[0].videoUrl).then(response => response.text()), 'alpha-video');
    assert.equal((await fetch(`${origin}/projects/beta/api/renders/${record.id}/video`)).status, 404);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(root, {recursive: true, force: true});
  }
});

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
    assert.match(html, /id="project-picker"/);
    assert.match(html, /id="review-version"/);
    assert.match(html, /id="panel-product-video"/);
    assert.match(html, /id="pv-generate"/);
    assert.match(html, /id="rebuild-session"/);
    assert.match(html, /id="save-session"[^>]*>Save<\/button>/);
    assert.match(html, /id="rebuild-session"[^>]*>Save &amp; send to T3<\/button>/);
    assert.doesNotMatch(html, /id="reset-tab"/);
    assert.doesNotMatch(html, /id="save-version"/);
    assert.equal((await fetch(origin + '/workflow.mjs')).status, 200);
    assert.equal((await fetch(origin + '/images.html')).status, 200);
    const images = await fetch(origin + '/images.html').then(response => response.text());
    assert.doesNotMatch(images, /id="save-images"/);
    assert.doesNotMatch(images, /id="download-images"/);
    assert.equal((await fetch(origin + '/image-selection.mjs')).status, 200);
    assert.equal((await fetch(origin + '/panel-options/../../.env')).status, 404);
    assert.equal((await fetch(origin + '/.env')).status, 404);
    assert.equal((await fetch(origin + '/package.json')).status, 404);
    assert.equal((await fetch(origin, {method: 'POST'})).status, 405);
  } finally {await new Promise<void>((resolve) => server.close(() => resolve()));}
});

test('the send endpoint dispatches a saved request and rejects cross-origin sends', async () => {
  const root = await mkdtemp(path.join(tmpdir(),'desk-send-'));
  let dispatches = 0;
  const t3 = createServer(async (request,response) => {
    assert.equal(request.url,'/api/orchestration/dispatch');
    assert.equal(request.headers.cookie,'session=local-test');
    let body = '';for await(const chunk of request) body += chunk;
    assert.equal(JSON.parse(body).threadId,'current-thread');dispatches++;
    response.writeHead(200,{'Content-Type':'application/json'});response.end(JSON.stringify({sequence:5}));
  });
  const desk = createDeskServer({root,sessionId:'test'});
  await new Promise<void>(r=>t3.listen(0,'127.0.0.1',r));
  await new Promise<void>(r=>desk.listen(0,'127.0.0.1',r));
  const t3Address = t3.address(),deskAddress=desk.address();
  assert.ok(t3Address && typeof t3Address !== 'string' && deskAddress && typeof deskAddress !== 'string');
  const origin=`http://127.0.0.1:${deskAddress.port}`;
  const id='e41ecf16-af81-4e3d-8dfb-c9be3b0f6a5b';
  try {
    await mkdir(path.join(root,'credentials'));
    await writeFile(path.join(root,'credentials','t3.json'),JSON.stringify({origin:`http://127.0.0.1:${t3Address.port}`,cookie:'session=local-test',threadId:'current-thread'}));
    await fetch(origin+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:1,sessionId:'test',rebuildRequest:{id,state:{script:'Draft'}}})});
    const send = (headers = {}) => fetch(origin+'/api/session/send',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({requestId:id})});
    assert.equal((await send({Origin:'https://example.com'})).status,403);
    assert.equal(dispatches,0);
    const result=await send();assert.equal(result.status,200);
    assert.equal((await result.json()).status,'sent');assert.equal(dispatches,1);
    assert.equal((await send()).status,200);assert.equal(dispatches,1);
    assert.equal((await fetch(origin+'/credentials/t3.json')).status,404);
  } finally {
    await new Promise<void>(r=>desk.close(()=>r()));await new Promise<void>(r=>t3.close(()=>r()));
    assert.equal(path.dirname(root),tmpdir());await rm(root,{recursive:true,force:true});
  }
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

test('product video catalog is compact and Generate freezes the saved draft once', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'desk-product-'));
  const base = '.agents/skills/generate-product-video';
  const paths = [`${base}/SKILL.md`, `${base}/references/common.md`, `${base}/references/workflows/direct.md`, `${base}/references/configuration/formats/hypermotion.md`, `${base}/references/private.md`, 'projects/alpha/media/cube.png', 'projects/alpha/project.json'];
  const catalog: any = {version: 1, files: {router: paths[0], common: paths[1], workflows: {direct: paths[2]}, formats: {hypermotion: paths[3]}, hooks: {}, settings: {}, destinations: {private: paths[4]}}, choices: {direct: {formats: ['hypermotion'], hooks: ['none'], settings: ['auto']}, skit: {styles: ['funny']}}, metadata: {formats: {hypermotion: {label: 'Hyper Motion'}}, styles: {skit: {funny: {label: 'Funny'}}}}};
  const calls: any[] = [];
  const server = createDeskServer({root, productVideoTransport: {createFreshSession: async (seed: any) => {calls.push(seed); return {sessionId: 'fresh-1', executionId: 'run-1'};}}});
  try {
    for (const file of paths) {await mkdir(path.dirname(path.join(root, file)), {recursive: true}); await writeFile(path.join(root, file), file);}
    await writeFile(path.join(root, 'projects/alpha/project.json'), JSON.stringify({id: 'alpha', title: 'Alpha'}));
    const catalogPath = path.join(root, base, 'references/configuration/catalog.json');
    await writeFile(catalogPath, JSON.stringify(catalog));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/projects/alpha`;
    const choices = await fetch(`${url}/api/product-video/catalog`).then(response => response.json());
    assert.equal(choices.metadata.formats.hypermotion.label, 'Hyper Motion');
    assert.equal(choices.metadata.styles.skit.funny.label, 'Funny');
    assert.equal(JSON.stringify(choices).includes('references/configuration/formats'), false);
    const draft = {action: 'plan', workflow: 'direct', choices: {format: 'hypermotion', hook: 'none', setting: 'auto'}, language: 'en', destination: 'private', references: [{role: 'product', path: 'projects/alpha/media/cube.png'}], brief: {product: 'Synthetic cube', facts: ['Blue shell']}, execution: {provider: 'openrouter', models: {}, durationSec: 5, aspectRatio: '9:16', resolution: '720p', audio: false, budget: {currency: 'USD', maxUsd: 0}}};
    assert.equal((await fetch(`${url}/api/session`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({version: 1, sessionId: 'alpha', productVideo: draft})})).status, 200);
    assert.equal(calls.length, 0);
    const id = '9a4fec5b-d5d4-4fc6-ae92-df73acd109be';
    const generate = () => fetch(`${url}/api/product-video/generate`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({requestId: id})});
    assert.equal((await generate()).status, 200);
    assert.equal((await generate()).status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].skill, 'generate-product-video');
    assert.equal(calls[0].request.projectId, 'alpha');
    assert.deepEqual(calls[0].request, normalizeRequest({...draft, id, projectId: 'alpha', source: 'agent'}, catalog));
    await recordWorkerUpdate(root, 'alpha', id, {executionId: 'run-1', status: 'accepted', receipt: {jobId: 'synthetic-job'}});
    const progress = await fetch(`${url}/api/product-video/status?requestId=${id}`).then(response => response.json());
    assert.equal(progress.launch.status, 'dispatched');
    assert.equal(progress.worker.status, 'accepted');
    const cancel = await fetch(`${url}/api/product-video/cancel`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({requestId: id})});
    assert.equal((await cancel.json()).status, 'cancelled');
    assert.equal((await fetch(`${url}/api/product-video/status?requestId=${id}`).then(response => response.json())).worker.receipt.jobId, 'synthetic-job');
    assert.equal((await fetch(`${url}/api/product-video/generate`, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'https://example.com'}, body: JSON.stringify({requestId: id})})).status, 403);
    catalog.metadata.formats.hypermotion = {label: 'Hyper Motion', requiredInputs: ['product', 'presenter']};
    await writeFile(catalogPath, JSON.stringify(catalog));
    const needsPresenter = await fetch(`${url}/api/product-video/generate`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({requestId: 'e7d60911-3dcb-47a1-96d1-1bbccf5920da'})});
    assert.equal(needsPresenter.status, 400);
    assert.match((await needsPresenter.json()).error, /presenter/);
  } finally {await new Promise<void>(resolve => server.close(() => resolve())); await rm(root, {recursive: true, force: true});}
});
