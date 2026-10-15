import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {agentStatus, attachAgentExport, freezeAgentRevision, normalizeAgentConfig, recordAgentAttempt, runAgentRevision, shareableAgentSummary} from '../scripts/agent-video.mjs';
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
    await assert.rejects(recordAgentAttempt(root, projectId, draft.revisionId, {...attempt, id: randomUUID(), providerJobId: 'different'}), /same job ID/);
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

test('an uncertain submission without a job ID needs explicit manual reconciliation', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agent-uncertain-'));
  const projectId = 'synthetic';
  const media = path.join(root, 'projects', projectId, 'media');
  try {
    await mkdir(media, {recursive: true});
    await writeFile(path.join(media, 'frame.png'), 'frame');
    const revisionId = randomUUID();
    await freezeAgentRevision(root, {schemaVersion: 2, projectId, revisionId, change: 'First plan', brief: 'A frame', kind: 'ad', budgetUsd: 0.75,
      references: [], plan: {concept: 'Frame', shots: [{id: 'one', description: 'Frame'}], stages: [{id: 'image', kind: 'image', provider: 'openrouter', model: 'example', estimateUsd: 0.5, parameters: {}}]}});
    const attempt = {id: randomUUID(), stageId: 'image', status: 'uncertain', provider: 'openrouter', model: 'example', costUsd: 0.5,
      startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), inputs: [], outputs: [], parameters: {}, prompt: 'Frame'};
    await recordAgentAttempt(root, projectId, revisionId, attempt);
    await assert.rejects(recordAgentAttempt(root, projectId, revisionId, {...attempt, id: randomUUID(), status: 'succeeded', outputs: [`projects/${projectId}/media/frame.png`], inspection: {accepted: true}}), /documented manual reconciliation/);
    assert.match((await agentStatus(root, projectId, revisionId)).blocked ?? '', /Uncertain/);
    await recordAgentAttempt(root, projectId, revisionId, {...attempt, id: randomUUID(), status: 'succeeded', outputs: [`projects/${projectId}/media/frame.png`],
      inspection: {accepted: true}, providerJobId: 'later-id', reconcilesAttemptId: attempt.id, reconciliationEvidence: 'Provider account receipt checked by agent'});
    assert.equal((await agentStatus(root, projectId, revisionId)).status, 'complete');
    assert.equal((await agentStatus(root, projectId, revisionId)).spentUsd, 0.5);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('recorded stages run in order, resume without duplicate attempts and stop at the cap', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agent-recorded-'));
  const projectId = 'synthetic';
  const revisionId = randomUUID();
  const media = path.join(root, 'projects', projectId, 'media');
  const recorded = path.join(root, 'projects', projectId, 'work', 'agent-video', 'recorded', revisionId);
  const frame = `projects/${projectId}/media/frame.png`;
  const finished = `projects/${projectId}/media/finished.mp4`;
  try {
    await mkdir(media, {recursive: true}); await mkdir(recorded, {recursive: true});
    await writeFile(path.join(media, 'frame.png'), 'frame'); await writeFile(path.join(media, 'finished.mp4'), 'finished');
    await freezeAgentRevision(root, {schemaVersion: 2, projectId, revisionId, change: 'First plan', brief: 'A story', kind: 'other', budgetUsd: 0.5, references: [],
      plan: {concept: 'Reveal', shots: [{id: 'one', description: 'Reveal'}], stages: [
        {id: 'frame', kind: 'image', provider: 'openrouter', model: 'example', estimateUsd: 0.4, parameters: {}},
        {id: 'finish', kind: 'finish', provider: 'local', model: 'ffmpeg', estimateUsd: 0, parameters: {}}]}});
    const startedAt = new Date().toISOString();
    const frameResponse = {id: randomUUID(), status: 'succeeded', costUsd: 0.4, startedAt, endedAt: startedAt,
      inputs: [], outputs: [frame], parameters: {}, prompt: 'Reveal', providerJobId: 'job-1', inspection: {accepted: true}};
    await writeFile(path.join(recorded, 'frame.json'), JSON.stringify(frameResponse));
    assert.equal((await runAgentRevision(root, projectId, revisionId, {recorded: true})).status, 'waiting-recorded-response');
    assert.equal((await agentStatus(root, projectId, revisionId)).attempts.length, 1);
    await writeFile(path.join(recorded, 'finish.json'), JSON.stringify({...frameResponse, id: randomUUID(), costUsd: 0, providerJobId: null, inputs: [frame], outputs: [finished], prompt: ''}));
    assert.equal((await runAgentRevision(root, projectId, revisionId, {recorded: true})).status, 'complete');
    assert.equal((await runAgentRevision(root, projectId, revisionId, {recorded: true})).attempts.length, 2);
    assert.equal((await agentStatus(root, projectId, revisionId)).spentUsd, 0.4);
    assert.equal(shareableAgentSummary(await agentStatus(root, projectId, revisionId)).stages[0].validationOnly, true);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('recorded execution stops before over-cap work and preserves unsupported receipts', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agent-recorded-stop-'));
  const projectId = 'synthetic';
  const work = path.join(root, 'projects', projectId, 'work', 'agent-video', 'recorded');
  const config = (revisionId: string, budgetUsd: number) => ({schemaVersion: 2, projectId, revisionId, change: 'First plan', brief: 'A frame', kind: 'ad', budgetUsd, references: [],
    plan: {concept: 'Frame', shots: [{id: 'one', description: 'Frame'}], stages: [{id: 'image', kind: 'image', provider: 'openrouter', model: 'example', estimateUsd: 0.4, parameters: {}}]}});
  try {
    const overCap = randomUUID();
    await freezeAgentRevision(root, config(overCap, 0.3));
    assert.match((await runAgentRevision(root, projectId, overCap, {recorded: true})).blocked ?? '', /exceeds spending cap/);
    assert.equal((await agentStatus(root, projectId, overCap)).attempts.length, 0);
    const unsupported = randomUUID();
    await freezeAgentRevision(root, config(unsupported, 0.5));
    await mkdir(path.join(work, unsupported), {recursive: true});
    const now = new Date().toISOString();
    await writeFile(path.join(work, unsupported, 'image.json'), JSON.stringify({id: randomUUID(), status: 'unsupported', costUsd: 0,
      startedAt: now, endedAt: now, inputs: [], outputs: [], parameters: {}, prompt: '', inspection: null}));
    assert.match((await runAgentRevision(root, projectId, unsupported, {recorded: true})).blocked ?? '', /unsupported/);
    assert.match((await agentStatus(root, projectId, unsupported)).blocked ?? '', /unsupported/);
    assert.equal((await runAgentRevision(root, projectId, unsupported, {recorded: true})).attempts.length, 1);
    const retry = randomUUID();
    await freezeAgentRevision(root, config(retry, 1));
    await mkdir(path.join(work, retry), {recursive: true});
    await mkdir(path.join(root, 'projects', projectId, 'media'), {recursive: true});
    await writeFile(path.join(root, 'projects', projectId, 'media', 'frame.png'), 'frame');
    const retryFile = path.join(work, retry, 'image.json');
    const failed = {id: randomUUID(), status: 'failed', costUsd: 0.1, startedAt: now, endedAt: now,
      inputs: [], outputs: [], parameters: {}, prompt: 'Frame'};
    const succeeded = {...failed, id: randomUUID(), status: 'succeeded', costUsd: 0.4,
      outputs: [`projects/${projectId}/media/frame.png`], inspection: {accepted: true}};
    await writeFile(retryFile, JSON.stringify([{...failed, provider: 'wrong'}, succeeded]));
    await assert.rejects(runAgentRevision(root, projectId, retry, {recorded: true}), /Incomplete attempt/);
    assert.equal((await agentStatus(root, projectId, retry)).attempts.length, 0);
    await writeFile(retryFile, JSON.stringify([failed, succeeded]));
    assert.match((await runAgentRevision(root, projectId, retry, {recorded: true})).blocked ?? '', /failed/);
    assert.equal((await runAgentRevision(root, projectId, retry, {recorded: true})).status, 'complete');
    assert.equal((await agentStatus(root, projectId, retry)).attempts.length, 2);
  } finally {await rm(root, {recursive: true, force: true});}
});
