import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {normalizeRequest, freezeRequest, readFrozenRequest} from '../scripts/product-video/request.mjs';
import {resolveContext} from '../scripts/product-video/context.mjs';

const id = '9a4fec5b-d5d4-4fc6-ae92-df73acd109be';
const skill = '.agents/skills/generate-product-video';
const catalog = {
  version: 1,
  files: {
    router: `${skill}/SKILL.md`, common: `${skill}/references/execution.md`,
    workflows: {direct: `${skill}/references/workflows/direct.md`},
    formats: {hypermotion: `${skill}/references/configuration/formats/hypermotion.md`},
    hooks: {bizarre: `${skill}/references/configuration/hooks/bizarre.md`},
    settings: {seamless: `${skill}/references/configuration/settings/seamless.md`},
    destinations: {organic: `${skill}/references/destinations/organic.md`},
  },
  choices: {direct: {formats: ['hypermotion'], hooks: ['none', 'bizarre'], settings: ['auto', 'seamless']}, skit: {styles: ['funny']}},
};
const draft = {
  id, projectId: 'alpha', action: 'generate', workflow: 'direct',
  choices: {format: 'hypermotion', hook: 'bizarre', setting: 'seamless'},
  language: 'en', destination: 'organic',
  references: [{role: 'product', path: 'projects/alpha/media/product.png'}],
  brief: {product: 'Synthetic cube', facts: ['Blue plastic shell'], brand: 'Example', cta: 'Learn more'},
  execution: {provider: 'openrouter', models: {image: 'example/image', video: 'example/video'}, durationSec: 5, aspectRatio: '9:16', resolution: '720p', audio: false, budget: {currency: 'USD', maxUsd: 2}},
};

test('browser and agent inputs normalize to the same canonical request', () => {
  const browser = normalizeRequest({...draft, source: 'browser'}, catalog);
  const agent = normalizeRequest({...draft, source: 'agent', choices: {setting: 'seamless', hook: 'bizarre', format: 'hypermotion'}}, catalog);
  assert.deepEqual(browser, agent);
  assert.equal(browser.schemaVersion, 1);
  assert.deepEqual(browser.choices, {format: 'hypermotion', hook: 'bizarre', setting: 'seamless'});
});

test('unknown choices and foreign or traversing media fail before launch', () => {
  assert.throws(() => normalizeRequest({...draft, choices: {...draft.choices, hook: 'mystery'}}, catalog), /hook/);
  assert.throws(() => normalizeRequest({...draft, references: [{role: 'product', path: 'projects/beta/media/product.png'}]}, catalog), /Foreign/);
  assert.throws(() => normalizeRequest({...draft, references: [{role: 'product', path: 'projects/alpha/media/../secret.png'}]}, catalog), /Foreign/);
  assert.throws(() => normalizeRequest({...draft, references: []}, catalog), /Missing product/);
});

test('selected context contains only the chosen recipes and hashed project inputs', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pv-contract-'));
  try {
    const paths = [catalog.files.router, catalog.files.common, catalog.files.workflows.direct, catalog.files.formats.hypermotion,
      catalog.files.hooks.bizarre, catalog.files.settings.seamless, catalog.files.destinations.organic,
      'projects/alpha/media/product.png', 'projects/alpha/project.json'];
    for (const file of paths) {await mkdir(path.dirname(path.join(root, file)), {recursive: true}); await writeFile(path.join(root, file), file);}
    const manifest = await resolveContext(root, normalizeRequest(draft, catalog), catalog);
    assert.deepEqual(manifest.files.map((entry: any) => entry.path), paths);
    assert.ok(manifest.files.every((entry: any) => /^[0-9a-f]{64}$/.test(entry.sha256)));
    const auto = await resolveContext(root, normalizeRequest({...draft, choices: {format: 'hypermotion', hook: 'none', setting: 'auto'}}, catalog), catalog);
    assert.equal(auto.files.some((entry: any) => entry.path.includes('/hooks/') || entry.path.includes('/settings/')), false);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('freeze is write once and retains selected input bytes after source changes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'pv-freeze-'));
  try {
    const paths = [catalog.files.router, catalog.files.common, catalog.files.workflows.direct, catalog.files.formats.hypermotion,
      catalog.files.hooks.bizarre, catalog.files.settings.seamless, catalog.files.destinations.organic,
      'projects/alpha/media/product.png', 'projects/alpha/project.json'];
    for (const file of paths) {await mkdir(path.dirname(path.join(root, file)), {recursive: true}); await writeFile(path.join(root, file), file);}
    const request = normalizeRequest(draft, catalog);
    const manifest = await resolveContext(root, request, catalog);
    const frozen = await freezeRequest(root, request, manifest);
    assert.deepEqual(frozen.request, request);
    assert.equal(frozen.context.files.length, 9);
    await writeFile(path.join(root, catalog.files.hooks.bizarre), 'Changed recipe');
    await writeFile(path.join(root, 'projects/alpha/media/product.png'), 'Changed product image');
    assert.deepEqual(await readFrozenRequest(root, 'alpha', id), frozen);
    const copied = path.join(root, 'projects/alpha/work/product-video', id, frozen.context.files[4].snapshotPath);
    assert.equal(await readFile(copied, 'utf8'), catalog.files.hooks.bizarre);
    await assert.rejects(() => freezeRequest(root, {...request, language: 'de'}, manifest), /different request/);
  } finally {await rm(root, {recursive: true, force: true});}
});
