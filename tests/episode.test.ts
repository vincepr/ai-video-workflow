import assert from 'node:assert/strict';
import test from 'node:test';
import {validateEpisode} from '../src/episode';
import sample from '../episodes/sample.json';

test('rejects an episode with no shots before rendering', () => {
  assert.throws(() => validateEpisode({title: 'Empty', shots: []}), /shots/);
});

test('preserves a valid episode', () => {
  assert.deepEqual(validateEpisode(sample), sample);
});

test('optional narration accepts local audio paths and rejects remote or traversing paths', () => {
  assert.throws(() => validateEpisode({...sample, audio: '../secret.wav'}), /audio/i);
  assert.throws(() => validateEpisode({...sample, audio: 'https://example.com/voice.wav'}), /audio/i);
  assert.deepEqual(validateEpisode({...sample, audio: 'media/voice.wav'}), {...sample, audio: 'media/voice.wav'});
});

test('rejects invalid timing, camera positions, asset paths and provenance', () => {
  for (const patch of [
    {seconds: 0}, {seconds: Number.NaN}, {seconds: 121},
    {from: [50, 101, 1]}, {to: [50, 50, 0]}, {to: [50, 50]},
    {image: '../secret.png'}, {image: 'https://example.com/a.png'},
    {image: 'a/../../b.png'}, {source: ''}, {rights: ' '}, {text: 'x'.repeat(141)},
  ]) {
    assert.throws(() => validateEpisode({
      ...sample, shots: [{...sample.shots[0], ...patch}],
    }), Error, JSON.stringify(patch));
  }
  assert.throws(() => validateEpisode({...sample, title: ''}));
});
