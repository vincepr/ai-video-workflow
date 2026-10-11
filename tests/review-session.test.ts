import assert from 'node:assert/strict';
import test from 'node:test';
import * as review from '../sites/creator-desk/app/review-session.mjs';
import {createReviewSession, updatePicker, addComparison, sessionSnapshot} from '../sites/creator-desk/app/review-session.mjs';

test('a session keeps independent picker choices and added comparison tabs across reloads', async () => {
  const catalog = {id: 'homunculus-panels-v1', title: 'Homunculus', script: 'Original narration'};
  let session = createReviewSession(catalog);
  session = updatePicker(session, 'captions', {mode: 'word'});
  session = addComparison(session, 'Music', ['Silence', 'Quiet ambience']);
  session.extraTabs[0].choice = 'Quiet ambience';
  const restored = createReviewSession(catalog, JSON.parse(JSON.stringify(session)));
  assert.deepEqual(restored, session);
  assert.equal(restored.motion, null);
  assert.equal(restored.captions.mode, 'word');
  assert.equal(restored.script, 'Original narration');
  const snapshot = sessionSnapshot(restored);
  restored.captions.mode = 'none';
  assert.equal(snapshot.captions.mode, 'word');
  assert.equal(restored.extraTabs[0].choice, 'Quiet ambience');
  assert.throws(() => updatePicker(restored, 'captions', {mode: 'invalid'}), /caption/i);
});

test('rebuild captures changes together, flags dependent images and resets one tab without applying anything', () => {
  assert.equal(typeof review.pendingChanges, 'function');
  let session = createReviewSession({id: 'test', title: 'Test', script: 'Original'});
  session.images = {selection: {choices: {first: 'a'}}, shots: []};
  session = review.initializeReview(session);
  session.script = 'Revised';
  session = updatePicker(session, 'motion', {movement: 'strong'});
  assert.deepEqual(review.pendingChanges(session), {changed: ['commentary', 'motion'], review: ['images', 'voice']});
  const requested = review.requestRebuild(session);
  assert.equal(requested.versions.length, 1);
  assert.deepEqual(requested.versions[0].state, requested.rebuildRequest.state);
  assert.equal(requested.rebuildRequest.state.script, 'Revised');
  assert.equal(requested.applied.script, 'Original');
  session = review.resetPicker(requested, 'motion');
  assert.equal(session.motion, null);
  assert.equal(session.script, 'Revised');
  assert.equal(session.rebuildRequest, null);
  session = review.resetPicker(session, 'commentary');
  assert.deepEqual(review.pendingChanges(session), {changed: [], review: []});
});

test('optional pickers have no choice until requested, including migration of old defaults', () => {
  const catalog = {id: 'test', title: 'Test', script: 'Narration'};
  const session = createReviewSession(catalog);
  assert.equal(session.motion, null);
  assert.equal(session.captions, null);
  assert.equal(session.voice, null);
  assert.equal(session.activeTab, 'videos');
  const old = {...session, reviewVersion: undefined, motion: {movement: 'slow', transition: 'cut'}, captions: {mode: 'phrase'}, voice: {option: 'elevenlabs'}};
  assert.equal(createReviewSession(catalog, old).motion, null);
});

test('restoring a review version leaves the applied state and video history separate', () => {
  assert.equal(typeof review.saveReviewVersion, 'function');
  let session = review.initializeReview(createReviewSession({id: 'test', title: 'Test', script: 'Original'}));
  session = review.saveReviewVersion(session, 'First draft');
  const versionId = session.versions[0].id;
  session.script = 'Later draft';
  session.motion = {movement: 'strong'};
  session = review.saveReviewVersion(session, 'Later draft');
  const applied = structuredClone(session.applied);
  session = review.restoreReviewVersion(session, versionId);
  assert.equal(session.script, 'Original');
  assert.equal(session.motion, null);
  assert.equal(session.versions.length, 2);
  assert.deepEqual(session.applied, applied);
  assert.equal('versions' in session.versions[0].state, false);
  assert.equal('history' in session.versions[0].state, false);
  session.script = 'Fork';
  assert.equal(session.versions[0].state.script, 'Original');
  assert.equal(typeof review.restoreWorkingDraft, 'function');
  session = review.restoreWorkingDraft(session);
  assert.equal(session.script, 'Later draft');
  assert.equal(session.motion.movement, 'strong');
});

test('finishing a rebuild applies its frozen state and preserves edits made afterward', () => {
  assert.equal(typeof review.applyRebuild, 'function');
  let session = review.initializeReview(createReviewSession({id: 'test', title: 'Test', script: 'Original'}));
  session.script = 'Rendered';
  session = review.requestRebuild(session);
  const request = structuredClone(session.rebuildRequest);
  session.script = 'New draft';
  session = review.applyRebuild(session, request, 'render-id');
  assert.equal(session.applied.script, 'Rendered');
  assert.equal(session.script, 'New draft');
  assert.deepEqual(review.pendingChanges(session).changed, ['commentary']);
  assert.equal(session.lastAppliedRender, 'render-id');
});

test('commentary notes can be saved and sent without inventing a changed script', () => {
  let session=review.initializeReview(createReviewSession({id:'test',title:'Test',script:'Original'}));
  session.notes='Make the opening shorter';
  assert.deepEqual(review.pendingChanges(session),{changed:['commentary'],review:[]});
  const request=review.requestRebuild(session);
  assert.equal(request.rebuildRequest.state.notes,'Make the opening shorter');
  assert.equal(request.rebuildRequest.state.script,'Original');
});
