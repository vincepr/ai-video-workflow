export function createDraft(concept, variant = 0) {
  return {version: 1, conceptId: concept.id, title: concept.title,
    variant, script: concept.drafts[variant].text, notes: '', seconds: 30,
    beats: [...concept.beats], sources: [...concept.sources], approval: null};
}

export function approvedBrief(draft) {
  if (!draft?.approval || draft.approval.snapshot !== snapshot(draft)) {
    throw new Error('Approval is missing or the draft has changed');
  }
  validateDraft(draft);
  return draft;
}

export function approveDraft(draft) {
  validateDraft(draft);
  return {...draft, approval: {snapshot: snapshot(draft), approvedAt: new Date().toISOString()}};
}

export function reviseDraft(draft, changes) {
  return {...draft, ...changes, approval: null};
}

export function refreshExamples(drafts, concepts) {
  const refreshed = {...drafts};
  for (const concept of concepts) {
    concept.drafts.forEach((example, variant) => {
      const key = `${concept.id}:${variant}`;
      const saved = refreshed[key];
      if (saved && !saved.approval && !saved.notes && saved.title === concept.previousTitle &&
          example.previousText && saved.script === example.previousText) {
        refreshed[key] = {...createDraft(concept, variant), seconds: saved.seconds};
      }
    });
  }
  return refreshed;
}

function snapshot(draft) {
  const {approval, ...content} = draft;
  return JSON.stringify(content);
}

function validateDraft(draft) {
  if (typeof draft.script !== 'string' || draft.script.trim().split(/\s+/).length < 15 || draft.script.length > 4000) {
    throw new Error('Script needs 15 or more words and at most 4,000 characters');
  }
  if (typeof draft.title !== 'string' || !draft.title.trim() || draft.title.length > 80) throw new Error('Invalid title');
  if (!Number.isFinite(draft.seconds) || draft.seconds < 15 || draft.seconds > 60) throw new Error('Duration must be 15 to 60 seconds');
  if (!Array.isArray(draft.beats) || draft.beats.length !== 3 || draft.beats.some((beat) => typeof beat !== 'string' || !beat.trim())) {
    throw new Error('Three visual beats are required');
  }
  if (!Array.isArray(draft.sources) || !draft.sources.length || draft.sources.some((url) => typeof url !== 'string' || !url.startsWith('https://'))) {
    throw new Error('Source links are required');
  }
}
