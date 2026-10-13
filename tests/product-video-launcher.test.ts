import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {launchProductVideo, readLaunchStatus, cancelProductVideo, recordWorkerUpdate} from '../scripts/product-video/launcher.mjs';

const base = '.agents/skills/generate-product-video';
const catalog = {version: 1, files: {
  router: `${base}/SKILL.md`, common: `${base}/references/common.md`,
  workflows: {direct: `${base}/references/workflows/direct.md`},
  formats: {hypermotion: `${base}/references/configuration/formats/hypermotion.md`},
  hooks: {bizarre: `${base}/references/configuration/hooks/bizarre.md`},
  settings: {seamless: `${base}/references/configuration/settings/seamless.md`},
  destinations: {private: `${base}/references/private.md`},
}, choices: {direct: {formats: ['hypermotion'], hooks: ['none', 'bizarre'], settings: ['auto', 'seamless']}}};
const request = {id: '9a4fec5b-d5d4-4fc6-ae92-df73acd109be', projectId: 'alpha', action: 'plan', workflow: 'direct', choices: {format: 'hypermotion', hook: 'bizarre', setting: 'seamless'}, language: 'en', destination: 'private', references: [{role: 'product', path: 'projects/alpha/media/cube.png'}], brief: {product: 'Synthetic cube', facts: ['Blue shell']}, execution: {provider: 'openrouter', models: {}, durationSec: 5, aspectRatio: '9:16', resolution: '720p', audio: false, budget: {currency: 'USD', maxUsd: 0}}};

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'pv-launch-'));
  const files = [catalog.files.router, catalog.files.common, catalog.files.workflows.direct, catalog.files.formats.hypermotion, catalog.files.hooks.bizarre, catalog.files.settings.seamless, catalog.files.destinations.private, 'projects/alpha/media/cube.png', 'projects/alpha/project.json'];
  for (const file of files) {await mkdir(path.dirname(path.join(root, file)), {recursive: true}); await writeFile(path.join(root, file), file);}
  return root;
}

test('agent and browser launch the same frozen request into selected fresh context', async () => {
  const root = await fixture();
  const calls: any[] = [];
  const transport = {createFreshSession: async (seed: any) => {calls.push(seed); return {sessionId: 'fresh-1', executionId: 'run-1'};}};
  try {
    const first = await launchProductVideo(root, {...request, source: 'browser'}, {catalog, transport});
    const second = await launchProductVideo(root, {...request, source: 'agent'}, {catalog, transport});
    assert.deepEqual(first, second);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].requestId, request.id);
    assert.equal(calls[0].projectId, 'alpha');
    assert.equal(calls[0].files.length, 9);
    assert.equal(JSON.stringify(calls[0]).includes('unrelated conversation'), false);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('an uncertain dispatch retries with the same command and frozen inputs', async () => {
  const root = await fixture();
  const calls: any[] = [];
  const transport = {createFreshSession: async (seed: any) => {
    calls.push(seed);
    if (calls.length === 1) throw new Error('timeout');
    return {sessionId: 'fresh-1', executionId: 'run-1'};
  }};
  try {
    await assert.rejects(() => launchProductVideo(root, request, {catalog, transport}), /timeout/);
    const state = await launchProductVideo(root, request, {catalog, transport});
    assert.equal(state.status, 'dispatched');
    assert.deepEqual(calls[0], calls[1]);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('concurrent sends for one request create only one fresh session', async () => {
  const root = await fixture();
  let calls = 0;
  const transport = {createFreshSession: async () => {calls++; await new Promise(resolve => setTimeout(resolve, 20)); return {sessionId: 'fresh-1', executionId: 'run-1'};}};
  try {
    const [a, b] = await Promise.all([launchProductVideo(root, request, {catalog, transport}), launchProductVideo(root, request, {catalog, transport})]);
    assert.deepEqual(a, b);
    assert.equal(calls, 1);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('concurrent reuse of an ID with changed inputs is rejected', async () => {
  const root = await fixture();
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  const transport = {createFreshSession: async () => {await gate; return {sessionId: 'fresh-1', executionId: 'run-1'};}};
  try {
    const first = launchProductVideo(root, request, {catalog, transport});
    await assert.rejects(() => launchProductVideo(root, {...request, language: 'de'}, {catalog, transport}), /different request/);
    release();
    await first;
  } finally {release(); await rm(root, {recursive: true, force: true});}
});

test('worker updates stay bound to the originating run and cancellation retains receipts', async () => {
  const root = await fixture();
  const transport = {createFreshSession: async () => ({sessionId: 'fresh-1', executionId: 'run-1'})};
  try {
    await launchProductVideo(root, request, {catalog, transport});
    await assert.rejects(() => recordWorkerUpdate(root, 'beta', request.id, {executionId: 'run-1', status: 'accepted'}), /project|request/i);
    const worker = await recordWorkerUpdate(root, 'alpha', request.id, {executionId: 'run-1', status: 'accepted', receipt: {jobId: 'job-1'}});
    assert.equal(worker.receipt.jobId, 'job-1');
    await assert.rejects(() => recordWorkerUpdate(root, 'alpha', request.id, {executionId: 'run-1', status: 'raw-artifact', artifacts: [{kind: 'raw', path: 'projects/beta/media/clip.mp4'}]}), /foreign|artifact/i);
    const stopped = await cancelProductVideo(root, 'alpha', request.id);
    assert.equal(stopped.status, 'cancelled');
    assert.equal((await readLaunchStatus(root, 'alpha', request.id)).worker.receipt.jobId, 'job-1');
    await assert.rejects(() => recordWorkerUpdate(root, 'alpha', request.id, {executionId: 'run-1', status: 'complete'}), /cancelled/);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('missing fresh-session runtime is reported as unsupported after freezing', async () => {
  const root = await fixture();
  try {
    const state = await launchProductVideo(root, request, {catalog});
    assert.equal(state.status, 'unsupported');
    assert.equal(state.isolation, 'unavailable');
    assert.equal((await readLaunchStatus(root, 'alpha', request.id)).launch.status, 'unsupported');
  } finally {await rm(root, {recursive: true, force: true});}
});
