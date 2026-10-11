import assert from 'node:assert/strict';
import test from 'node:test';
import {createDraft, approvedBrief, approveDraft, reviseDraft, refreshExamples} from '../sites/creator-desk/app/workflow.mjs';

const concept = {id: 'test', title: 'Test concept', drafts: [{label: 'Analysis', text:
  'A short commentary with enough words to test the approval boundary before any rendering work can begin.'}],
  beats: ['Opening', 'Detail', 'Close'], sources: ['https://example.com/source']};

test('a draft cannot enter production without explicit approval', () => {
  assert.throws(() => approvedBrief(createDraft(concept)), /approval/i);
});

test('updated examples replace untouched saved scripts and preserve personal edits', () => {
  const original = createDraft(concept);
  const updated = {...concept, previousTitle: concept.title, title: 'Revised concept',
    drafts: [{...concept.drafts[0], previousText: original.script, text: original.script + ' New angle.'}]};
  const saved = {'test:0': original};
  assert.equal(refreshExamples(saved, [updated])['test:0'].script, updated.drafts[0].text);
  const edited = {...original, script: original.script + ' My edit.'};
  assert.deepEqual(refreshExamples({'test:0': edited}, [updated])['test:0'], edited);
  const approved = approveDraft(original);
  assert.deepEqual(refreshExamples({'test:0': approved}, [updated])['test:0'], approved);
});

test('approval freezes the exact script and later edits revoke it', () => {
  const draft = createDraft(concept);
  const approved = approveDraft(draft);
  assert.equal(approvedBrief(approved).script, concept.drafts[0].text);
  assert.throws(() => approvedBrief(reviseDraft(approved, {script: draft.script + ' Changed.'})), /approval/i);
  assert.throws(() => approvedBrief({...approved, script: 'Changed outside the editor.'}), /approval/i);
  assert.throws(() => approveDraft({...draft, script: ' '}), /script/i);
});
