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

test('background music requires a local recording, sensible volume and saved attribution', () => {
  const music = {audio: 'media/music/kyoto.mp3', volume: 0.08, title: 'Kyoto', artist: 'Nebulite', source: 'https://freetouse.com/music/nebulite/kyoto', license: 'Free To Use Free License; attribution required', attribution: 'Music track: Kyoto by Nebulite\nSource: https://freetouse.com/music\nNo Copyright Vlog Music for Videos'};
  assert.deepEqual(validateEpisode({...sample, music}), {...sample, music});
  for (const patch of [{audio:'../secret.mp3'}, {audio:'https://example.com/song.mp3'}, {volume:-1}, {volume:1.1}, {volume:NaN}, {attribution:''}, {license:''}, {source:''}, {artist:''}]) {
    assert.throws(() => validateEpisode({...sample, music:{...music,...patch}}), Error);
  }
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
