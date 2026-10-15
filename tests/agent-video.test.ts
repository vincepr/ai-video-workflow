import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {agentStatus, attachAgentExport, freezeAgentRevision, normalizeAgentConfig, recordAgentAttempt, runAgentRevision} from '../scripts/agent-video.mjs';
import {createDeskServer} from '../scripts/serve-desk.mjs';

test('agent revisions are immutable and paid plans stop before submission', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agent-video-'));
  const projectId = 'synthetic';
  const media = path.join(root, 'projects', projectId, 'media');
  await mkdir(media, {recursive: true});
  await writeFile(path.join(media, 'reference.png'), 'fixture');
  const draft = {schemaVersion: 2, projectId, revisionId: randomUUID(), change: 'First concept', brief: 'A short story', kind: 'ad', budgetUsd: 1,
    references: [`projects/${projectId}/media/reference.png`], plan: {concept: 'A clear reveal', shots: [{id: 'opening', description: 'Show the scene'}],
      stages: [{id: 'image-1', kind: 'image', provider: 'openrouter', model: 'example/model', estimateUsd: 0.5, parameters: {ratio: '9:16'}},
        {id: 'finish-1', kind: 'finish', provider: 'local', model: 'ffmpeg', estimateUsd: 0, parameters: {}}]}};
  try {
    const frozen = await freezeAgentRevision(root, draft);
    assert.equal(frozen.references[0].sha256.length, 64);
    assert.deepEqual(await freezeAgentRevision(root, draft), frozen);
    await assert.rejects(freezeAgentRevision(root, {...draft, brief: 'Changed'}), /different content/);
    assert.equal((await runAgentRevision(root, projectId, draft.revisionId)).status, 'blocked');
    const image = `projects/${projectId}/media/frame.png`;
    await writeFile(path.join(media, 'frame.png'), 'frame');
    const attempt = {id: randomUUID(), stageId: 'image-1', status: 'uncertain', provider: 'openrouter', model: 'example/model', costUsd: 0,
      startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), inputs: draft.references, outputs: [], providerJobId: 'job-1', parameters: {ratio: '9:16'}, prompt: 'Make a frame'};
    await recordAgentAttempt(root, projectId, draft.revisionId, attempt);
    assert.match((await agentStatus(root, projectId, draft.revisionId)).blocked ?? '', /Uncertain/);
    await assert.rejects(recordAgentAttempt(root, projectId, draft.revisionId, {...attempt, id: randomUUID(), providerJobId: 'different'}), /same provider job/);
    await recordAgentAttempt(root, projectId, draft.revisionId, {...attempt, id: randomUUID(), status: 'succeeded', costUsd: 0.4, outputs: [image], inspection: {accepted: true}});
    assert.equal((await agentStatus(root, projectId, draft.revisionId)).status, 'planned');
    await assert.rejects(recordAgentAttempt(root, projectId, draft.revisionId, {...attempt, id: randomUUID(), costUsd: 2}), /spending cap/);
    const finished = `projects/${projectId}/media/finished.mp4`;
    await writeFile(path.join(media, 'finished.mp4'), 'finished');
    await assert.rejects(recordAgentAttempt(root, projectId, draft.revisionId, {id: randomUUID(), stageId: 'finish-1', status: 'succeeded', provider: 'local', model: 'ffmpeg', costUsd: 0,
      startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), inputs: [finished], outputs: [finished], parameters: {}, inspection: {accepted: true}}), /frozen reference or successful stage output/);
    await recordAgentAttempt(root, projectId, draft.revisionId, {id: randomUUID(), stageId: 'finish-1', status: 'succeeded', provider: 'local', model: 'ffmpeg', costUsd: 0,
      startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), inputs: [image], outputs: [finished], parameters: {}, inspection: {accepted: true}});
    assert.equal((await agentStatus(root, projectId, draft.revisionId)).status, 'complete');
    const output = path.join(root, 'projects', projectId, 'videos', '000001-test', 'video.mp4');
    await mkdir(path.dirname(output), {recursive: true});
    await writeFile(output, 'finished');
    assert.equal((await attachAgentExport(root, projectId, draft.revisionId, `projects/${projectId}/videos/000001-test/video.mp4`)).revisionId, draft.revisionId);
    assert.throws(() => normalizeAgentConfig({...draft, references: ['projects/other/media/file.png']}), /project references/);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('project page edits use the same revision freeze and leave the parent intact', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agent-page-'));
  const projectId = 'synthetic';
  const project = path.join(root, 'projects', projectId);
  const server = createDeskServer({root});
  try {
    await mkdir(project, {recursive: true});
    await writeFile(path.join(project, 'project.json'), JSON.stringify({id: projectId, title: 'Synthetic'}));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/projects/${projectId}`;
    const upload = await fetch(`${url}/api/agent-video/upload?ext=.png`, {method: 'POST', body: Buffer.from('test')});
    assert.equal(upload.status, 200);
    const {path: reference} = await upload.json();
    const draft = {schemaVersion: 2, projectId, revisionId: randomUUID(), change: 'First plan', brief: 'A quiet scene', kind: 'other', budgetUsd: 0,
      references: [reference], plan: {concept: 'One scene', shots: [{id: 'shot-1', description: 'Open wide', caption: 'Before'}], stages: []}};
    await freezeAgentRevision(root, draft);
    const edit = await fetch(`${url}/api/agent-video/edit`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({captions: {'shot-1': 'After'}, outputFormat: '16:9'})});
    assert.equal(edit.status, 200);
    const page = await fetch(`${url}/api/agent-video`).then(response => response.json());
    assert.equal(page.status.revision.parentId, draft.revisionId);
    assert.equal(page.status.revision.plan.shots[0].caption, 'After');
    assert.equal(page.status.revision.outputFormat, '16:9');
    assert.equal(page.shareable.references, undefined);
    assert.equal(page.shareable.shots[0].caption, 'After');
    assert.equal(await fetch(`${url}/api/agent-video/asset?path=${encodeURIComponent(reference)}`).then(response => response.text()), 'test');
    assert.equal((await fetch(`${url}/api/agent-video/asset?path=projects/other/media/private.png`)).status, 404);
    assert.equal((await fetch(`${url}/api/agent-video/edit`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({captions: {'missing': 'No'}})})).status, 400);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(root, {recursive: true, force: true});
  }
});

test('an uncertain submission without a job ID cannot be treated as reconciled', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agent-uncertain-'));
  const projectId = 'synthetic';
  const media = path.join(root, 'projects', projectId, 'media');
  try {
    await mkdir(media, {recursive: true});
    await writeFile(path.join(media, 'frame.png'), 'frame');
    const revisionId = randomUUID();
    await freezeAgentRevision(root, {schemaVersion: 2, projectId, revisionId, change: 'First plan', brief: 'A frame', kind: 'ad', budgetUsd: 1,
      references: [], plan: {concept: 'Frame', shots: [{id: 'one', description: 'Frame'}], stages: [{id: 'image', kind: 'image', provider: 'openrouter', model: 'example', estimateUsd: 0.5, parameters: {}}]}});
    const attempt = {id: randomUUID(), stageId: 'image', status: 'uncertain', provider: 'openrouter', model: 'example', costUsd: 0.5,
      startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), inputs: [], outputs: [], parameters: {}, prompt: 'Frame'};
    await recordAgentAttempt(root, projectId, revisionId, attempt);
    await assert.rejects(recordAgentAttempt(root, projectId, revisionId, {...attempt, id: randomUUID(), status: 'succeeded', outputs: [`projects/${projectId}/media/frame.png`], inspection: {accepted: true}}), /same provider job/);
    assert.match((await agentStatus(root, projectId, revisionId)).blocked ?? '', /Uncertain/);
  } finally {await rm(root, {recursive: true, force: true});}
});
