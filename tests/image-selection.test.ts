import assert from 'node:assert/strict';
import test from 'node:test';
import {createSelection, chooseImage, moveImage, exportSelection} from '../desk/image-selection.mjs';
import * as imageSelection from '../desk/image-selection.mjs';

test('a late parent initializes an already loaded picker before reading its stale selection', () => {
  const initialize = (imageSelection as any).readSessionImages;
  assert.equal(typeof initialize, 'function');
  const desired = {selection: {choices: {first: 'street'}}};
  let current = {selection: {choices: {first: 'portrait'}}};
  const desk = {setImageSelection: (value: any) => {current = structuredClone(value);}, getImageSelection: () => current};
  assert.deepEqual(initialize(null, desired, false), {ready: false, value: null});
  assert.deepEqual(initialize(desk, desired, false), {ready: true, value: desired});
  current = {selection: {choices: {first: 'car'}}};
  assert.deepEqual(initialize(desk, desired, true), {ready: true, value: current});
});

test('moving an image keeps commentary order and review choices intact', async () => {
  const catalog = {id: 'test', script: 'First line. Second line.', beats: [
    {id: 'first', commentary: 'First line.', options: [{id: 'portrait'}, {id: 'street'}]},
    {id: 'second', commentary: 'Second line.', options: [{id: 'car'}, {id: 'suit'}]},
  ]};
  let selection = createSelection(catalog);
  selection = chooseImage(selection, catalog, 'first', 'street');
  selection = moveImage(selection, 0, 1);
  const result = exportSelection(selection, catalog);
  assert.deepEqual(result.shots.map((shot: {beatId: string; commentary: string; optionId: string}) => [shot.beatId, shot.commentary, shot.optionId]), [
    ['first', 'First line.', 'car'], ['second', 'Second line.', 'street'],
  ]);
  assert.equal(result.script, catalog.script);
  assert.equal(result.status, 'review');
  assert.equal(selection.choices.first, 'street');
  assert.deepEqual(createSelection(catalog, JSON.parse(JSON.stringify(selection))), selection);
  assert.throws(() => chooseImage(selection, catalog, 'first', 'unknown'), /option/i);
});
