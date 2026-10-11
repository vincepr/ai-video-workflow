import assert from 'node:assert/strict';
import test from 'node:test';
import sample from '../episodes/sample.json';
import {validateEpisode} from '../src/episode';
import {cameraAt, timeline} from '../src/timing';

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
