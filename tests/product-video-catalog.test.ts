import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile, stat, mkdtemp, mkdir, writeFile, rm, copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {normalizeRequest} from '../scripts/product-video/request.mjs';
import {resolveContext} from '../scripts/product-video/context.mjs';

const root = path.resolve('.');
const catalog = JSON.parse(await readFile(path.join(root, '.agents/skills/generate-product-video/references/configuration/catalog.json'), 'utf8'));
const exact = (items: string[], expected: string[]) => assert.deepEqual([...items].sort(), [...expected].sort());

test('catalog preserves the pinned choice IDs and separates recipes from metadata', async () => {
  assert.equal(catalog.version, 1);
  exact(catalog.choices.direct.formats, ['ugc','direct-to-camera','selfie-testimonial','gadget-saved-me','secret-hack','review','unboxing','unboxing-asmr','try-on','couple-sharing','tvspot','hypermotion','giant-product','crush-test','camera-pov','mess-to-fresh']);
  exact(catalog.choices.direct.hooks, ['none','conflict','suspense','painpoint','number','contrast','identity','bizarre','freebie','pov','controversial','authority']);
  exact(catalog.choices.direct.settings, ['auto','office','livingroom','kitchen','bedroom','bathroom','street','outdoor','studio','car','cafe','seamless']);
  exact(catalog.choices.skit.styles, ['funny','reversal','skit','warm','luxury','urgent']);
  exact(catalog.choices.drama.styles, ['epic','palace','wuxia','family','office','hero']);
  assert.equal(catalog.metadata.settings.auto.upstreamId, 'none');
  assert.equal(catalog.files.hooks.none, undefined);
  assert.equal(catalog.files.settings.auto, undefined);
  const files = [catalog.files.router, catalog.files.common, ...Object.values(catalog.files.workflows), ...Object.values(catalog.files.formats), ...Object.values(catalog.files.hooks), ...Object.values(catalog.files.settings), ...Object.values(catalog.files.destinations), ...Object.values(catalog.files.styles.skit), ...Object.values(catalog.files.styles.drama)] as string[];
  assert.equal(new Set(files).size, files.length);
  for (const file of files) {
    assert.match(file, /^\.agents\/skills\/generate-product-video\//);
    assert.ok((await stat(path.join(root, file))).isFile(), file);
  }
  for (const [kind, ids] of Object.entries({formats: catalog.choices.direct.formats, hooks: catalog.choices.direct.hooks, settings: catalog.choices.direct.settings})) {
    for (const id of ids as string[]) {
      const entry = catalog.metadata[kind][id];
      assert.equal(entry.version, 1);
      assert.equal(entry.source.commit, '18ec178052f6f97612813997613d88ce34b02fc5');
      assert.equal(entry.source.reuse, 'independently-authored');
      assert.ok(entry.label && entry.requiredInputs?.length);
    }
  }
});

test('real resolver selects Hyper Motion and Bizarre without unrelated recipes', async () => {
  const temp = await mkdtemp(path.join(tmpdir(), 'pv-catalog-'));
  try {
    await mkdir(path.join(temp, 'projects/demo/media'), {recursive: true});
    await writeFile(path.join(temp, 'projects/demo/media/product.png'), 'synthetic product');
    await writeFile(path.join(temp, 'projects/demo/project.json'), '{}');
    const selected = [catalog.files.router, catalog.files.common, catalog.files.workflows.direct, catalog.files.formats.hypermotion, catalog.files.hooks.bizarre, catalog.files.destinations.private];
    for (const file of selected) {
      await mkdir(path.dirname(path.join(temp, file)), {recursive: true});
      await copyFile(path.join(root, file), path.join(temp, file));
    }
    const draft = {id: '9a4fec5b-d5d4-4fc6-ae92-df73acd109be', projectId: 'demo', action: 'plan', workflow: 'direct', choices: {format: 'hypermotion', hook: 'bizarre', setting: 'auto'}, language: 'en', destination: 'private', references: [{role: 'product', path: 'projects/demo/media/product.png'}], brief: {product: 'Synthetic block', facts: [], brand: '', cta: ''}, execution: {provider: 'offline', models: {}, durationSec: 5, aspectRatio: '9:16', resolution: '720p', audio: false, budget: {currency: 'USD', maxUsd: 0}}};
    const manifest = await resolveContext(temp, normalizeRequest(draft, catalog), catalog);
    exact(manifest.files.map((f: any) => f.role), ['router','common','workflow','format','hook','destination','reference:product','project']);
    assert.deepEqual(manifest.files.filter((f: any) => ['format','hook'].includes(f.role)).map((f: any) => f.path), [catalog.files.formats.hypermotion, catalog.files.hooks.bizarre]);
    assert.equal(manifest.files.some((f: any) => f.path.includes('/settings/') || f.path.includes('/styles/')), false);
  } finally {await rm(temp, {recursive: true, force: true});}
});
