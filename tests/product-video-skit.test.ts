import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {runSkitWorkflow} from '../scripts/product-video/skit.mjs';

const id = '22222222-2222-4222-8222-222222222222';
const prefix = '.agents/skills/generate-product-video/';

async function fixture(style = 'funny') {
  const root = await mkdtemp(path.join(tmpdir(), 'pv-skit-'));
  const run = path.join(root, 'projects/demo/work/product-video', id);
  await mkdir(path.join(run, 'inputs'), {recursive: true});
  const files = [
    {role: 'router', path: `${prefix}SKILL.md`, content: 'router'},
    {role: 'common', path: `${prefix}references/common.md`, content: 'common'},
    {role: 'workflow', path: `${prefix}references/workflows/skit.md`, content: 'skit mechanics'},
    {role: 'style', path: `${prefix}references/configuration/styles/skit/${style}.md`, content: `${style} style`},
    {role: 'reference:product', path: 'projects/demo/media/product.png', content: 'synthetic product'},
    {role: 'reference:presenter', path: 'projects/demo/media/presenter.png', content: 'synthetic presenter'},
  ];
  const context = [];
  for (const [index, entry] of files.entries()) {
    const snapshotPath = `inputs/${String(index).padStart(3, '0')}`;
    await writeFile(path.join(run, snapshotPath), entry.content);
    context.push({role: entry.role, path: entry.path, snapshotPath, sha256: createHash('sha256').update(entry.content).digest('hex')});
  }
  const request = {schemaVersion: 1, id, projectId: 'demo', action: 'generate', workflow: 'skit', choices: {style}, language: 'en', destination: 'private',
    references: [{role: 'product', path: 'projects/demo/media/product.png'}, {role: 'presenter', path: 'projects/demo/media/presenter.png'}],
    brief: {product: 'Synthetic cube', facts: ['Blue surface'], brand: 'Example', cta: 'See details'},
    execution: {provider: 'offline', models: {script: 'fixture/script', image: 'fixture/image', video: 'fixture/video'}, durationSec: 5,
      aspectRatio: '9:16', resolution: '720p', audio: true, budget: {currency: 'USD', maxUsd: 2}}};
  await writeFile(path.join(run, 'request.json'), JSON.stringify({request, context: {files: context}}));
  return {root, run, request};
}

function script(style = 'funny') {
  return {version: 1, style, language: 'en', idea: `A ${style} reversal about the cube`, productReferenceRole: 'product',
    cast: [{id: 'a', name: 'A', role: 'confident'}, {id: 'b', name: 'B', role: 'skeptic'}],
    beats: [
      {kind: 'hook', fromFrame: 0, toFrame: 45, action: 'A shows a messy desk', dialogue: [{speaker: 'a', text: 'Look at this.'}]},
      {kind: 'conflict', fromFrame: 45, toFrame: 105, action: 'B doubts the setup', dialogue: [{speaker: 'b', text: 'Will it work?'}]},
      {kind: 'payoff', fromFrame: 105, toFrame: 150, action: 'A shows the cube', usesProduct: true, dialogue: [{speaker: 'a', text: 'Here is the cube.'}]}],
    imagePrompt: 'Two characters with the same blue cube', videoPrompt: 'Reference the product and presenter; show setup, conflict and payoff', caption: 'See the cube'};
}

const capabilities = {referenceVideo: true, speech: true, castGeneration: true, stages: {script: 0.1, image: 0.2, video: 0.7}};

test('selected style produces a structured two-character script and automatic stages', async () => {
  const {root, run} = await fixture('funny');
  const calls: string[] = [];
  const agent = {plan: async ({context, request}: any) => {
    calls.push('plan'); assert.equal(context.find((entry: any) => entry.role === 'style').text, 'funny style');
    assert.equal(request.choices.style, 'funny'); return script('funny');
  }, inspectFrame: async () => {calls.push('inspect-frame'); return {accepted: true, product: 'matched', cast: 'consistent'};},
  inspectVideo: async () => {calls.push('inspect-video'); return {accepted: true, acceptedRanges: [{fromFrame: 0, toFrame: 150}], dialogue: 'clear', product: 'visible'};}};
  const execute = async (operation: string, input: any) => {calls.push(operation);
    if (operation === 'prepare-image') {assert.deepEqual(input.references.map((ref: any) => ref.role), ['product', 'presenter']); await writeFile(path.join(run, 'skit-frame.bin'), 'frame'); return {file: 'skit-frame.bin'};}
    if (operation === 'submit-video') {assert.equal(input.script.productReferenceRole, 'product'); assert.equal(input.speech, true); return {jobId: 'skit-job-1'};}
    if (operation === 'poll') return {terminal: true, status: 'completed'};
    if (operation === 'download') {await writeFile(path.join(run, 'skit-raw.mp4'), 'raw'); return {file: 'skit-raw.mp4'};}
    throw new Error(`Unexpected ${operation}`);
  };
  try {
    const state = await runSkitWorkflow({root, projectId: 'demo', requestId: id, agent, execute, capabilities});
    assert.equal(state.status, 'finishing-ready');
    assert.deepEqual(calls, ['plan', 'prepare-image', 'inspect-frame', 'submit-video', 'poll', 'download', 'inspect-video']);
    assert.deepEqual(state.stagePlan.map((stage: any) => stage.name), ['script', 'image', 'video']);
    assert.equal(state.stagePlan.reduce((sum: number, stage: any) => sum + stage.estimatedUsd, 0), 1);
    assert.equal(JSON.parse(await readFile(path.join(run, 'skit-script.json'), 'utf8')).style, 'funny');
    assert.equal(await readFile(path.join(run, 'skit-video-prompt.md'), 'utf8'), script().videoPrompt);
    const resumed = await runSkitWorkflow({root, projectId: 'demo', requestId: id, agent, execute, capabilities});
    assert.equal(resumed.status, 'finishing-ready');
    assert.equal(calls.length, 7);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('missing reference or speech support is recorded as unsupported before planning', async () => {
  const {root, run} = await fixture('warm');
  let calls = 0;
  const agent = {plan: async () => {calls++; return script('warm');}, inspectFrame: async () => ({}), inspectVideo: async () => ({})};
  const execute = async () => {calls++; throw new Error('No operation should run');};
  try {
    const state = await runSkitWorkflow({root, projectId: 'demo', requestId: id, agent, execute,
      capabilities: {...capabilities, referenceVideo: false}});
    assert.equal(state.status, 'unsupported');
    assert.match(state.reason, /reference conditioning/i);
    assert.equal(calls, 0);
    assert.equal(JSON.parse(await readFile(path.join(run, 'skit-state.json'), 'utf8')).status, 'unsupported');
  } finally {await rm(root, {recursive: true, force: true});}
});

test('speech and total planned cost are checked before agent work', async () => {
  const noSpeech = await fixture();
  const tooExpensive = await fixture();
  let calls = 0;
  const agent = {plan: async () => {calls++; return script();}, inspectFrame: async () => ({}), inspectVideo: async () => ({})};
  const execute = async () => {calls++; return {};};
  try {
    const speech = await runSkitWorkflow({root: noSpeech.root, projectId: 'demo', requestId: id, agent, execute, capabilities: {...capabilities, speech: false}});
    const budget = await runSkitWorkflow({root: tooExpensive.root, projectId: 'demo', requestId: id, agent, execute, capabilities: {...capabilities, stages: {script: 1, image: 1, video: 1}}});
    assert.equal(speech.status, 'unsupported');
    assert.match(speech.reason, /spoken dialogue/i);
    assert.equal(budget.status, 'unsupported');
    assert.match(budget.reason, /budget/i);
    assert.equal(calls, 0);
  } finally {await Promise.all([rm(noSpeech.root, {recursive: true, force: true}), rm(tooExpensive.root, {recursive: true, force: true})]);}
});

test('pending video resumes the accepted job without another image or submission', async () => {
  const {root, run} = await fixture('reversal');
  const calls: string[] = [];
  let polls = 0;
  const agent = {plan: async () => {calls.push('plan'); return script('reversal');},
    inspectFrame: async () => {calls.push('frame'); return {accepted: true};},
    inspectVideo: async () => {calls.push('video'); return {accepted: true, acceptedRanges: [{fromFrame: 0, toFrame: 150}]};}};
  const execute = async (operation: string, input: any) => {calls.push(operation);
    if (operation === 'prepare-image') {await writeFile(path.join(run, 'skit-frame.bin'), 'frame'); return {file: 'skit-frame.bin'};}
    if (operation === 'submit-video') return {jobId: 'accepted-job'};
    if (operation === 'poll') {assert.equal(input.submission.jobId, 'accepted-job'); return ++polls === 1 ? {terminal: false, status: 'pending'} : {terminal: true, status: 'completed'};}
    if (operation === 'download') {await writeFile(path.join(run, 'skit-raw.mp4'), 'raw'); return {file: 'skit-raw.mp4'};}
    throw new Error(`Unexpected ${operation}`);
  };
  try {
    const pending = await runSkitWorkflow({root, projectId: 'demo', requestId: id, agent, execute, capabilities});
    assert.equal(pending.status, 'video-pending');
    const done = await runSkitWorkflow({root, projectId: 'demo', requestId: id, agent, execute, capabilities});
    assert.equal(done.status, 'finishing-ready');
    assert.equal(calls.filter(call => call === 'submit-video').length, 1);
    assert.equal(calls.filter(call => call === 'prepare-image').length, 1);
    assert.equal(calls.filter(call => call === 'poll').length, 2);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('style choice changes the saved script while script checkpoint stops before media', async () => {
  const first = await fixture('funny');
  const second = await fixture('warm');
  const agent = {plan: async ({request, context}: any) => {
    assert.match(context.find((entry: any) => entry.role === 'style').text, new RegExp(request.choices.style));
    return script(request.choices.style);
  }, inspectFrame: async () => ({}), inspectVideo: async () => ({})};
  const execute = async () => {throw new Error('Checkpoint must stop before media');};
  try {
    const a = await runSkitWorkflow({root: first.root, projectId: 'demo', requestId: id, agent, execute, capabilities, checkpoint: 'script' as any});
    const b = await runSkitWorkflow({root: second.root, projectId: 'demo', requestId: id, agent, execute, capabilities, checkpoint: 'script' as any});
    assert.equal(a.status, 'script-ready');
    assert.equal(b.status, 'script-ready');
    assert.notEqual(a.script.idea, b.script.idea);
    assert.notEqual((await readFile(path.join(first.run, 'skit-script.json'), 'utf8')), (await readFile(path.join(second.run, 'skit-script.json'), 'utf8')));
  } finally {await Promise.all([rm(first.root, {recursive: true, force: true}), rm(second.root, {recursive: true, force: true})]);}
});

test('uncertain accepted submission never buys a second video job', async () => {
  const {root, run} = await fixture();
  let submissions = 0;
  const agent = {plan: async () => script(), inspectFrame: async () => ({accepted: true}), inspectVideo: async () => ({accepted: true, acceptedRanges: []})};
  const execute = async (operation: string) => {
    if (operation === 'prepare-image') {await writeFile(path.join(run, 'skit-frame.bin'), 'frame'); return {file: 'skit-frame.bin'};}
    if (operation === 'submit-video') {submissions++; return {accepted: true};}
    throw new Error(`Unexpected ${operation}`);
  };
  try {
    const uncertain = await runSkitWorkflow({root, projectId: 'demo', requestId: id, agent, execute, capabilities});
    assert.equal(uncertain.status, 'submission-uncertain');
    const resumed = await runSkitWorkflow({root, projectId: 'demo', requestId: id, agent, execute, capabilities});
    assert.equal(resumed.status, 'submission-uncertain');
    assert.equal(submissions, 1);
  } finally {await rm(root, {recursive: true, force: true});}
});
