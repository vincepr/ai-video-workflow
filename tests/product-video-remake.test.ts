import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runReferenceRemake} from '../scripts/product-video/remake.mjs';

const id = '11111111-1111-1111-1111-111111111111';
async function fixture(voice = {mode: 'none', text: ''}) {
  const root = await mkdtemp(path.join(tmpdir(), 'pv-remake-'));
  const run = path.join(root, 'projects/demo/work/product-video', id);
  await mkdir(path.join(run, 'inputs'), {recursive: true});
  const inputs = [
    {role: 'workflow', path: '.agents/skills/generate-product-video/references/workflows/reference-remake.md', bytes: 'preserve source camera and pacing'},
    {role: 'reference:reference-video', path: 'projects/demo/media/reference.mp4', bytes: 'source clip'},
    {role: 'reference:product', path: 'projects/demo/media/product.png', bytes: 'product image'},
  ];
  const files = [];
  for (const [index, entry] of inputs.entries()) {
    const snapshotPath = `inputs/${String(index).padStart(3, '0')}`;
    await writeFile(path.join(run, snapshotPath), entry.bytes);
    files.push({role: entry.role, path: entry.path, snapshotPath, sha256: createHash('sha256').update(entry.bytes).digest('hex')});
  }
  const request = {schemaVersion: 1, id, projectId: 'demo', action: 'generate', workflow: 'reference-remake', choices: {},
    references: [{role: 'reference-video', path: inputs[1].path}, {role: 'product', path: inputs[2].path}],
    brief: {product: 'Synthetic object', referenceRights: 'Owned source footage'},
    execution: {provider: 'openrouter', models: {edit: 'example/edit'}, budget: {currency: 'USD', maxUsd: 2}, voice}};
  await writeFile(path.join(run, 'request.json'), JSON.stringify({request, context: {files}}));
  return {root, run};
}

test('remake stops as unsupported when video editing is unavailable', async () => {
  const {root, run} = await fixture();
  let calls = 0;
  try {
    const result = await runReferenceRemake({root, projectId: 'demo', requestId: id,
      capabilities: {videoEdit: false}, agent: {plan: async () => {calls++;}}, execute: async () => {calls++;}});
    assert.equal(result.status, 'unsupported');
    assert.match(result.reason, /video.edit/i);
    assert.equal(calls, 0);
    assert.equal(JSON.parse(await readFile(path.join(run, 'remake-state.json'), 'utf8')).status, 'unsupported');
  } finally {await rm(root, {recursive: true, force: true});}
});

test('remake refuses a planned edit above the frozen USD ceiling', async () => {
  const {root} = await fixture();
  let calls = 0;
  try {
    const result = await runReferenceRemake({root, projectId: 'demo', requestId: id,
      capabilities: {videoEdit: true, estimatesUsd: {edit: 3}},
      agent: {plan: async () => {calls++;}}, execute: async () => {calls++;}});
    assert.equal(result.status, 'unsupported');
    assert.match(result.reason, /budget/i);
    assert.equal(calls, 0);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('remake stops before planning when a required stage estimate is missing', async () => {
  const {root} = await fixture();
  let calls = 0;
  try {
    const result = await runReferenceRemake({root, projectId: 'demo', requestId: id,
      capabilities: {videoEdit: true}, agent: {plan: async () => {calls++;}}, execute: async () => {calls++;}});
    assert.equal(result.status, 'unsupported');
    assert.match(result.reason, /estimate/i);
    assert.equal(calls, 0);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('an uncertain edit submission cannot be repeated on resume', async () => {
  const {root} = await fixture();
  let submits = 0;
  const options = {root, projectId: 'demo', requestId: id, capabilities: {videoEdit: true, estimatesUsd: {edit: 1}},
    agent: {plan: async () => ({editPrompt: 'Replace the object', sourceRanges: [{fromFrame: 0, toFrame: 30}]})},
    execute: async (operation: string) => {if (operation === 'submit-edit') {submits++; throw new Error('Connection lost after submission');} throw new Error('Unexpected operation');}};
  try {
    await assert.rejects(() => runReferenceRemake(options), /Connection lost/);
    const resumed = await runReferenceRemake(options);
    assert.equal(resumed.status, 'reconciliation-required');
    assert.equal(submits, 1);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('selected voice replacement adds voice and lip-sync stages without changing the edit job', async () => {
  const {root, run} = await fixture({mode: 'replace', text: 'A new spoken line'});
  const calls: string[] = [];
  const agent = {plan: async () => ({editPrompt: 'Keep pacing and replace product', sourceRanges: [{fromFrame: 0, toFrame: 30}]})};
  const execute = async (operation: string) => {calls.push(operation);
    if (operation === 'submit-edit') return {jobId: 'edit-1'};
    if (operation === 'poll-edit') return {status: 'completed'};
    if (operation === 'download-edit') {await writeFile(path.join(run, 'remake-raw.mp4'), 'video'); return {file: 'remake-raw.mp4'};}
    if (operation === 'submit-voice') return {jobId: 'voice-1'};
    if (operation === 'poll-voice') return {status: 'completed'};
    if (operation === 'submit-lipsync') return {jobId: 'sync-1'};
    if (operation === 'poll-lipsync') return {status: 'completed'};
    if (operation === 'download-lipsync') {await writeFile(path.join(run, 'remake-lipsync-raw.mp4'), 'synced'); return {file: 'remake-lipsync-raw.mp4'};}
    throw Error('Unexpected operation');
  };
  try {
    const result = await runReferenceRemake({root, projectId: 'demo', requestId: id,
      capabilities: {videoEdit: true, voice: true, lipSync: true, estimatesUsd: {edit: 0.5, voice: 0.5, lipSync: 0.5}}, agent, execute});
    assert.equal(result.status, 'finishing-ready');
    assert.deepEqual(calls, ['submit-edit', 'poll-edit', 'download-edit', 'submit-voice', 'poll-voice', 'submit-lipsync', 'poll-lipsync', 'download-lipsync']);
    assert.equal(result.finishPlan.segments[0].source, 'remake-lipsync-raw.mp4');
  } finally {await rm(root, {recursive: true, force: true});}
});

test('remake uses source video and ordered references, then resumes the accepted edit job', async () => {
  const {root, run} = await fixture();
  const calls: string[] = [];
  let poll = 0;
  const agent = {plan: async ({context}: any) => {calls.push('plan'); assert.equal(context.length, 3);
    return {editPrompt: 'Preserve camera path and cuts; replace the product with the reference object', sourceRanges: [{fromFrame: 0, toFrame: 90}]};}};
  const execute = async (operation: string, payload: any) => {calls.push(operation);
    if (operation === 'submit-edit') {assert.equal(payload.references[0].role, 'reference-video'); assert.equal(payload.references[1].role, 'product'); return {jobId: 'edit-1'};}
    if (operation === 'poll-edit') return {status: ++poll === 1 ? 'pending' : 'completed'};
    if (operation === 'download-edit') {await writeFile(path.join(run, 'remake-raw.mp4'), 'edited video'); return {file: 'remake-raw.mp4'};}
    throw Error('Unexpected operation');
  };
  try {
    const first = await runReferenceRemake({root, projectId: 'demo', requestId: id, capabilities: {videoEdit: true, estimatesUsd: {edit: 1}}, agent, execute});
    assert.equal(first.status, 'pending');
    const second = await runReferenceRemake({root, projectId: 'demo', requestId: id, capabilities: {videoEdit: true, estimatesUsd: {edit: 1}}, agent, execute});
    assert.equal(second.status, 'finishing-ready');
    assert.deepEqual(calls, ['plan', 'submit-edit', 'poll-edit', 'poll-edit', 'download-edit']);
    assert.equal(second.finishPlan.segments[0].source, 'remake-raw.mp4');
  } finally {await rm(root, {recursive: true, force: true});}
});
