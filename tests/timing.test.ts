import assert from 'node:assert/strict';
import test from 'node:test';
import sample from '../episodes/sample.json';
import {validateEpisode} from '../src/episode';
import {cameraAt, timeline} from '../src/timing';
import * as timing from '../src/timing';

test('music fades at both ends while keeping the requested quiet level in the middle', () => {
  const volume=(timing as any).musicVolume;
  assert.equal(typeof volume,'function');
  assert.equal(volume(0,1214,0.08),0);
  assert.equal(volume(15,1214,0.08),0.04);
  assert.equal(volume(300,1214,0.08),0.08);
  assert.equal(volume(1183,1214,0.08),0.04);
  assert.equal(volume(1213,1214,0.08),0);
});

test('shots occupy consecutive frame ranges with per-shot rounding', () => {
  const episode = validateEpisode(sample);
  episode.shots = episode.shots.slice(0, 2).map((shot) => ({...shot, seconds: 1.25}));
  assert.deepEqual(timeline(episode).map(({from, frames}) => [from, frames]), [[0, 38], [38, 38]]);
});

test('camera reaches both endpoints and clamps progress', () => {
  assert.deepEqual(cameraAt([0, 20, 1], [100, 80, 2], 0.5), [50, 50, 1.5]);
  assert.deepEqual(cameraAt([0, 20, 1], [100, 80, 2], 2), [100, 80, 2]);
  assert.deepEqual(cameraAt([0, 20, 1], [100, 80, 2], -1), [0, 20, 1]);
});
