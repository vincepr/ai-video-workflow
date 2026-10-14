import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runDramaWorkflow} from '../scripts/product-video/drama.mjs';

const id = '11111111-1111-1111-1111-111111111111';
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'pv-drama-'));
  const run = path.join(root, 'projects', 'demo', 'work', 'product-video', id);
  await mkdir(path.join(run, 'inputs'), {recursive: true});
  const files = [
    {role: 'router', path: '.agents/skills/generate-product-video/SKILL.md', text: 'router'},
    {role: 'workflow', path: '.agents/skills/generate-product-video/references/workflows/drama.md', text: 'drama guide'},
    {role: 'style', path: '.agents/skills/generate-product-video/references/configuration/styles/drama/epic.md', text: 'epic style'},
    {role: 'reference:product', path: 'projects/demo/media/cube.png', text: 'synthetic cube'},
  ];
  const manifest = [];
  for (const [index, file] of files.entries()) {
    const snapshotPath = `inputs/${String(index).padStart(3, '0')}`;
    await writeFile(path.join(run, snapshotPath), file.text);
    manifest.push({role: file.role, path: file.path, snapshotPath, sha256: createHash('sha256').update(file.text).digest('hex')});
  }
  const request = {schemaVersion: 1, id, projectId: 'demo', action: 'generate', workflow: 'drama', choices: {style: 'epic'}, language: 'en', destination: 'private', references: [{role: 'product', path: 'projects/demo/media/cube.png'}], brief: {product: 'Synthetic cube', facts: ['Blue shell']}, execution: {provider: 'openrouter', models: {image: 'mock/image', video: 'mock/reference-video'}, durationSec: 8, aspectRatio: '9:16', resolution: '720p', audio: false, budget: {currency: 'USD', maxUsd: 2}}};
  await writeFile(path.join(run, 'request.json'), JSON.stringify({request, context: {files: manifest}}));
  return {root, run};
}

const script = {title: 'Synthetic reversal', cast: [{id: 'lead', name: 'Lead'}, {id: 'rival', name: 'Rival'}], environment: {name: 'Studio'}, shots: [
  {id: 'shot-1', durationSec: 4, castIds: ['lead'], scene: 'Studio', action: 'Approaches cube', dialogue: '', product: true, prompt: 'Lead approaches the exact blue cube in the studio.'},
  {id: 'shot-2', durationSec: 4, castIds: ['rival', 'lead'], scene: 'Studio', action: 'Shares cube', dialogue: '', product: true, prompt: 'Rival shares the exact blue cube with Lead.'},
]};

test('automatic drama run prepares shared refs, preserves per-shot order and assembles after both jobs', async () => {
  const {root, run} = await fixture();
  const calls: Array<{op: string; payload: any}> = [];
  const agent = {plan: async ({context}: any) => {assert.deepEqual(context.map((file: any) => file.role), ['router', 'workflow', 'style', 'reference:product']); return script;}};
  const execute = async (op: string, payload: any) => {calls.push({op, payload});
    if (op === 'prepare-reference') return {path: `references/${payload.kind}-${payload.id}.png`, sha256: 'a'.repeat(64)};
    if (op === 'submit-shot') return {jobId: `job-${payload.shot.id}`};
    if (op === 'poll-shot') return {terminal: true, status: 'completed'};
    if (op === 'download-shot') return {path: `shots/${payload.shot.id}.mp4`, frames: payload.shot.durationSec * 30};
    if (op === 'assemble') return {path: 'drama-final.mp4', frames: 240, fps: 30};
    throw new Error(`Unexpected ${op}`);
  };
  try {
    const result = await runDramaWorkflow({root, projectId: 'demo', requestId: id, agent, execute, capabilities: {referenceToVideo: true}, costs: {referenceUsd: 0.1, shotUsd: 0.3}});
    assert.equal(result.status, 'complete');
    assert.equal(result.estimate.totalUsd, 0.9);
    assert.deepEqual(result.shots.map((shot: any) => shot.submission.jobId), ['job-shot-1', 'job-shot-2']);
    const submitted = calls.filter(call => call.op === 'submit-shot');
    assert.equal(submitted[0].payload.prompt, script.shots[0].prompt);
    assert.equal(await readFile(path.join(run, 'shot-1-prompt.md'), 'utf8'), script.shots[0].prompt + '\n');
    assert.deepEqual(submitted[1].payload.references.map((ref: any) => ref.role), ['product', 'character:rival', 'character:lead', 'environment']);
    assert.deepEqual(calls.map(call => call.op), ['prepare-reference', 'prepare-reference', 'prepare-reference', 'submit-shot', 'poll-shot', 'download-shot', 'submit-shot', 'poll-shot', 'download-shot', 'assemble']);
    assert.equal(JSON.parse(await readFile(path.join(run, 'drama-state.json'), 'utf8')).assembly.frames, 240);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('resume polls an accepted shot and never resubmits completed references or shots', async () => {
  const {root} = await fixture();
  const calls: string[] = [];
  let firstPoll = true;
  const execute = async (op: string, payload: any) => {
    calls.push(`${op}:${payload.shot?.id ?? payload.id ?? ''}`);
    if (op === 'prepare-reference') return {path: `references/${payload.id}.png`};
    if (op === 'submit-shot') return {jobId: `job-${payload.shot.id}`};
    if (op === 'poll-shot') {if (firstPoll) {firstPoll = false; return {terminal: false, status: 'pending'};} return {terminal: true, status: 'completed'};}
    if (op === 'download-shot') return {path: `shots/${payload.shot.id}.mp4`, frames: 120};
    if (op === 'assemble') return {path: 'final.mp4', frames: 240, fps: 30};
    throw new Error(op);
  };
  try {
    const options = {root, projectId: 'demo', requestId: id, agent: {plan: async () => script}, execute, capabilities: {referenceToVideo: true}, costs: {referenceUsd: 0.1, shotUsd: 0.3}};
    assert.equal((await runDramaWorkflow(options)).status, 'pending');
    assert.equal((await runDramaWorkflow(options)).status, 'complete');
    assert.equal(calls.filter(call => call === 'submit-shot:shot-1').length, 1);
    assert.equal(calls.filter(call => call.startsWith('prepare-reference')).length, 3);
    assert.equal(calls.filter(call => call === 'poll-shot:shot-1').length, 2);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('ambiguous shot submission stays recoverable without buying a duplicate', async () => {
  const {root, run} = await fixture();
  const file = path.join(run, 'drama-state.json');
  const agent = {plan: async () => script};
  const costs = {referenceUsd: 0.1, shotUsd: 0.3};
  try {
    await runDramaWorkflow({root, projectId: 'demo', requestId: id, agent, execute: async () => {throw new Error('No operation expected');}, capabilities: {}, costs});
    const state = JSON.parse(await readFile(file, 'utf8'));
    state.references = {environment: {path: 'references/environment.png'}, lead: {path: 'references/lead.png'}, rival: {path: 'references/rival.png'}};
    state.shots[0].status = 'submission-attempted';
    await writeFile(file, JSON.stringify(state));
    let calls = 0;
    const resumed = await runDramaWorkflow({root, projectId: 'demo', requestId: id, agent, execute: async () => {calls++; throw new Error('Duplicate paid call');}, capabilities: {referenceToVideo: true}, costs});
    assert.equal(resumed.status, 'submission-unknown');
    assert.equal(calls, 0);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('missing reference-conditioned or spoken route and an over-budget plan stop before operations', async () => {
  const scenarios = [
    {capabilities: {}, costs: {referenceUsd: 0.1, shotUsd: 0.3}, reason: /Reference-conditioned/},
    {capabilities: {referenceToVideo: true}, costs: {referenceUsd: 1, shotUsd: 1}, reason: /budget/},
    {capabilities: {referenceToVideo: true}, costs: {referenceUsd: 0.1, shotUsd: 0.3}, script: {...script, shots: [{...script.shots[0], dialogue: 'Hello'}, script.shots[1]]}, reason: /spoken dialogue/},
  ];
  for (const scenario of scenarios) {
    const {root} = await fixture();
    let operations = 0;
    try {
      const state = await runDramaWorkflow({root, projectId: 'demo', requestId: id, agent: {plan: async () => scenario.script ?? script}, execute: async () => {operations++; throw new Error('No operation expected');}, capabilities: scenario.capabilities, costs: scenario.costs});
      assert.equal(state.status, 'unsupported');
      assert.match(state.reason, scenario.reason);
      assert.equal(operations, 0);
    } finally {await rm(root, {recursive: true, force: true});}
  }
});

test('ambiguous reference preparation is not repeated automatically', async () => {
  const {root, run} = await fixture();
  const file = path.join(run, 'drama-state.json');
  const agent = {plan: async () => script};
  const costs = {referenceUsd: 0.1, shotUsd: 0.3};
  try {
    await runDramaWorkflow({root, projectId: 'demo', requestId: id, agent, execute: async () => {throw new Error('No operation expected');}, capabilities: {}, costs});
    const state = JSON.parse(await readFile(file, 'utf8'));
    state.referenceAttempts = {environment: 'attempted'};
    await writeFile(file, JSON.stringify(state));
    let calls = 0;
    const resumed = await runDramaWorkflow({root, projectId: 'demo', requestId: id, agent, execute: async () => {calls++; throw new Error('Duplicate reference call');}, capabilities: {referenceToVideo: true}, costs});
    assert.equal(resumed.status, 'reference-unknown');
    assert.equal(calls, 0);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('a failed shot blocks assembly and preserves the accepted job on resume', async () => {
  const {root} = await fixture();
  const calls: string[] = [];
  const execute = async (op: string, payload: any) => {calls.push(op);
    if (op === 'prepare-reference') return {path: `references/${payload.id}.png`};
    if (op === 'submit-shot') return {jobId: 'accepted-1'};
    if (op === 'poll-shot') return {terminal: true, status: 'failed'};
    throw new Error(`Unexpected ${op}`);
  };
  try {
    const options = {root, projectId: 'demo', requestId: id, agent: {plan: async () => script}, execute, capabilities: {referenceToVideo: true}, costs: {referenceUsd: 0.1, shotUsd: 0.3}};
    const failed = await runDramaWorkflow(options);
    assert.equal(failed.status, 'failed');
    assert.equal(failed.shots[0].submission.jobId, 'accepted-1');
    const before = calls.length;
    assert.equal((await runDramaWorkflow(options)).status, 'failed');
    assert.equal(calls.length, before);
    assert.equal(calls.includes('assemble'), false);
  } finally {await rm(root, {recursive: true, force: true});}
});
