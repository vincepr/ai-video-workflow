import assert from 'node:assert/strict';
import test from 'node:test';
import {createDraft, approvedBrief, approveDraft, reviseDraft} from '../sites/creator-desk/app/workflow.mjs';

const concept = {id: 'test', title: 'Test concept', drafts: [{label: 'Analysis', text:
  'A short commentary with enough words to test the approval boundary before any rendering work can begin.'}],
  beats: ['Opening', 'Detail', 'Close'], sources: ['https://example.com/source']};

test('a draft cannot enter production without explicit approval', () => {
  assert.throws(() => approvedBrief(createDraft(concept)), /approval/i);
});

test('approval freezes the exact script and later edits revoke it', () => {
  const draft = createDraft(concept);
  const approved = approveDraft(draft);
  assert.equal(approvedBrief(approved).script, concept.drafts[0].text);
  assert.throws(() => approvedBrief(reviseDraft(approved, {script: draft.script + ' Changed.'})), /approval/i);
  assert.throws(() => approvedBrief({...approved, script: 'Changed outside the editor.'}), /approval/i);
  assert.throws(() => approveDraft({...draft, script: ' '}), /script/i);
});
