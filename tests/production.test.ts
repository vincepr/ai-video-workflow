import assert from 'node:assert/strict';
import test from 'node:test';
import {createDraft, approveDraft} from '../desk/workflow.mjs';
import {buildEpisode} from '../src/production';
import {validateEpisode} from '../src/episode';

const concept = {id: 'perception', title: 'A question about sight', drafts: [{label: 'Analysis',
  text: 'What happens when sight becomes uncertain? A quiet opening gives the viewer time to look. Then a changed silhouette makes the same image feel different.'}],
  beats: ['Eye', 'Silhouette', 'Question'], sources: ['https://example.com/source']};

test('a new topic can use its own concept and source assets without Homunculus rules', () => {
  const brief = approveDraft(createDraft({...concept, id: 'forgotten-city'}));
  const assets = [
    {image: 'media/images/city.jpg', from: [50, 30, 1], to: [50, 60, 1.1], source: 'https://example.com/city', rights: 'Test fixture'},
    {image: 'media/images/ruins.jpg', from: [40, 50, 1.2], to: [60, 50, 1.4], source: 'https://example.com/ruins', rights: 'Test fixture'},
  ];
  const episode = buildEpisode(brief, 30, undefined, assets);
  assert.deepEqual(episode.shots.map(shot => shot.image), ['media/images/city.jpg', 'media/images/ruins.jpg']);
});

test('production rejects an unapproved brief before preparing media', () => {
  assert.throws(() => buildEpisode(createDraft(concept), 30), /approval/i);
});

test('an approved script becomes valid shots with the full commentary and matching duration', () => {
  const episode = validateEpisode(buildEpisode(approveDraft(createDraft(concept)), 30, undefined, 'symbolic'));
  assert.equal(episode.title, concept.title);
  assert.equal(episode.shots.map((shot) => shot.text).join(' '), concept.drafts[0].text);
  assert.ok(Math.abs(episode.shots.reduce((n, shot) => n + shot.seconds, 0) - 30) < 0.001);
  assert.ok(episode.shots.every((shot) => shot.image.startsWith('media/generated/') && shot.rights && shot.source));
});

test('selected source panels and camera paths reach the rendered episode unchanged', () => {
  const brief = approveDraft(createDraft(concept));
  const assets = [
    {image: 'media/homunculus/park.jpg', from: [50, 30, 1], to: [50, 60, 1.1], source: 'https://example.com/park', rights: 'Private commentary draft; permission unconfirmed'},
    {image: 'media/homunculus/face.jpg', from: [40, 50, 1.2], to: [60, 50, 1.4], source: 'https://example.com/face', rights: 'Private commentary draft; permission unconfirmed'},
  ];
  const episode = buildEpisode(brief, 30, undefined, assets);
  assert.deepEqual(episode.shots.map(({image, from, to, source, rights}) => ({image, from, to, source, rights})), assets);
  assert.equal(episode.shots.map((shot) => shot.text).join(' '), brief.script);
});

test('production requires source images unless symbolic artwork is explicitly selected', () => {
  const brief = approveDraft(createDraft(concept));
  assert.throws(() => buildEpisode(brief, 30), /source images/i);
  assert.doesNotThrow(() => buildEpisode(brief, 30, undefined, 'symbolic'));
});

test('incomplete image selections cannot fall back to symbolic assets or source records', () => {
  const brief = approveDraft(createDraft(concept));
  assert.throws(() => buildEpisode(brief, 30, undefined, [{}, {}]), /image/i);
  assert.throws(() => buildEpisode(brief, 30, undefined, [
    {image: 'media/one.jpg', from: [50, 50, 1], to: [50, 50, 1]},
    {image: 'media/two.jpg', from: [50, 50, 1], to: [50, 50, 1]},
  ]), /source/i);
});
