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
  exact(catalog.choices.direct.avatars, ['none','custom','cn-female-young','cn-male-young','female-mature','male-fit','girl-cute','mom-warm','senior-expert']);
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
  for (const id of catalog.choices.direct.avatars) {
    const avatar = catalog.metadata.avatars[id];
    assert.ok(avatar.label);
    assert.equal(typeof avatar.castingDescription, 'string');
    assert.equal(avatar.source.path, 'src/lib/marketing-studio/avatars.ts');
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

test('direct request freezes an optional catalog avatar and review mode while preserving legacy omission', () => {
  const base = {id: '9a4fec5b-d5d4-4fc6-ae92-df73acd109be', projectId: 'demo', action: 'plan', workflow: 'direct', choices: {format: 'ugc'}, language: 'en', destination: 'private', references: [{role: 'product', path: 'projects/demo/media/product.png'}], brief: {product: 'Synthetic block'}, execution: {provider: 'offline', durationSec: 5, aspectRatio: '9:16', resolution: '720p', audio: false, budget: {currency: 'USD', maxUsd: 0}}};
  const legacy = normalizeRequest(base, catalog);
  assert.equal('avatar' in legacy.choices, false);
  assert.equal('presenterDescription' in legacy, false);
  assert.equal('reviewMode' in legacy.execution, false);
  assert.equal('direction' in legacy.brief, false);

  const preset = normalizeRequest({...base, choices: {...base.choices, avatar: 'senior-expert'}, execution: {...base.execution, reviewMode: 'first-frame'}}, catalog);
  assert.equal((preset.choices as any).avatar, 'senior-expert');
  assert.equal(preset.presenterDescription, catalog.metadata.avatars['senior-expert'].castingDescription);
  assert.equal(preset.execution.reviewMode, 'first-frame');
  assert.equal(normalizeRequest({...base, brief: {...base.brief, direction: '  Bright, playful pacing  '}}, catalog).brief.direction, 'Bright, playful pacing');
  assert.equal(normalizeRequest({...base, execution: {...base.execution, reviewMode: 'full'}}, catalog).execution.reviewMode, 'full');
  assert.doesNotThrow(() => normalizeRequest({...base, choices: {...base.choices, avatar: 'none'}}, catalog));
  assert.throws(() => normalizeRequest({...base, choices: {...base.choices, avatar: 'unknown'}}, catalog), /Unknown or inapplicable avatar/);
  assert.throws(() => normalizeRequest({...base, choices: {...base.choices, avatar: 'custom'}}, catalog), /Custom avatar requires a presenter reference/);
  assert.doesNotThrow(() => normalizeRequest({...base, choices: {...base.choices, avatar: 'custom'}, references: [...base.references, {role: 'presenter', path: 'projects/demo/media/presenter.png'}]}, catalog));
  assert.throws(() => normalizeRequest({...base, execution: {...base.execution, reviewMode: 'image'}}, catalog), /Unknown or inapplicable review mode/);
  assert.throws(() => normalizeRequest({...base, brief: {...base.brief, direction: 'x'.repeat(2001)}}, catalog), /Invalid creative direction/);
});
