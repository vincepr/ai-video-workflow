import assert from 'node:assert/strict';
import test from 'node:test';
import {createDraft, approveDraft} from '../sites/creator-desk/app/workflow.mjs';
import {buildEpisode} from '../src/production';
import {validateEpisode} from '../src/episode';

const concept = {id: 'perception', title: 'A question about sight', drafts: [{label: 'Analysis',
  text: 'What happens when sight becomes uncertain? A quiet opening gives the viewer time to look. Then a changed silhouette makes the same image feel different.'}],
  beats: ['Eye', 'Silhouette', 'Question'], sources: ['https://example.com/source']};

test('production rejects an unapproved brief before preparing media', () => {
  assert.throws(() => buildEpisode(createDraft(concept), 30), /approval/i);
});

test('an approved script becomes valid shots with the full commentary and matching duration', () => {
  const episode = validateEpisode(buildEpisode(approveDraft(createDraft(concept)), 30));
  assert.equal(episode.title, concept.title);
  assert.equal(episode.shots.map((shot) => shot.text).join(' '), concept.drafts[0].text);
  assert.ok(Math.abs(episode.shots.reduce((n, shot) => n + shot.seconds, 0) - 30) < 0.001);
  assert.ok(episode.shots.every((shot) => shot.image.startsWith('media/homunculus/') && shot.rights && shot.source));
});
