import assert from 'node:assert/strict';
import test from 'node:test';
import {createReviewSession, updatePicker, addComparison, sessionSnapshot} from '../sites/creator-desk/app/review-session.mjs';

test('a session keeps independent picker choices and added comparison tabs across reloads', async () => {
  const catalog = {id: 'homunculus-panels-v1', title: 'Homunculus', script: 'Original narration'};
  let session = createReviewSession(catalog);
  session = updatePicker(session, 'captions', {mode: 'word'});
  session = addComparison(session, 'Music', ['Silence', 'Quiet ambience']);
  session.extraTabs[0].choice = 'Quiet ambience';
  const restored = createReviewSession(catalog, JSON.parse(JSON.stringify(session)));
  assert.deepEqual(restored, session);
  assert.equal(restored.motion.movement, 'slow');
  assert.equal(restored.captions.mode, 'word');
  assert.equal(restored.script, 'Original narration');
  const snapshot = sessionSnapshot(restored);
  restored.captions.mode = 'none';
  assert.equal(snapshot.captions.mode, 'word');
  assert.equal(restored.extraTabs[0].choice, 'Quiet ambience');
  assert.throws(() => updatePicker(restored, 'captions', {mode: 'invalid'}), /caption/i);
});
