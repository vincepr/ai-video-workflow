export const pickerOptions = {
  movement: [
    {id: 'still', label: 'Still', detail: 'Hold the panel without camera movement.'},
    {id: 'slow', label: 'Slow', detail: 'A gentle push or pan with time to read the image.'},
    {id: 'strong', label: 'Large movement', detail: 'A closer push with a bigger change in framing.'},
  ],
  transition: [
    {id: 'cut', label: 'Cut', detail: 'Change panels immediately.'},
    {id: 'fade', label: 'Crossfade', detail: 'Blend the next panel over the previous one.'},
    {id: 'dip', label: 'Through black', detail: 'Briefly darken between panels.'},
  ],
  captions: [
    {id: 'phrase', label: 'Short phrases', detail: 'Show a few words together, like the current videos.'},
    {id: 'word', label: 'One word', detail: 'Each word appears as it is spoken.'},
    {id: 'highlight', label: 'Highlight the word', detail: 'Keep the phrase visible and highlight the spoken word.'},
    {id: 'none', label: 'No captions', detail: 'Let the panels and narration carry the video.'},
  ],
};

export function createReviewSession(catalog, saved) {
  const defaults = {version: 1, reviewVersion: 2, sessionId: catalog.projectId ?? catalog.id.split('-panels')[0], catalogId: catalog.id, title: catalog.title,
    script: catalog.script, commentaryChoice: 'current', commentaryDrafts: {current: catalog.script},
    images: null, motion: null, captions: null,
    voice: null, requestedPickers: [], extraTabs: [], activeTab: 'videos', notes: ''};
  if (saved?.version !== 1 || saved.catalogId !== catalog.id || saved.sessionId !== defaults.sessionId) return defaults;
  const session = {...defaults, ...structuredClone(saved)};
  if (saved.reviewVersion !== 2) {
    session.reviewVersion = 2;
    session.motion = session.captions = session.voice = null;
    session.activeTab = 'videos';
  }
  for (const picker of ['motion', 'captions']) {
    if (session[picker]) try {updatePicker(defaults, picker, session[picker]);} catch {session[picker] = null;}
  }
  if (!Array.isArray(session.extraTabs)) session.extraTabs = [];
  return session;
}

export function updatePicker(session, picker, changes) {
  if (picker === 'motion') {
    for (const key of ['movement', 'transition']) {
      if (changes[key] !== undefined && !pickerOptions[key].some((option) => option.id === changes[key])) throw new Error('Invalid motion option');
    }
  } else if (picker === 'captions' && changes.mode !== undefined && !pickerOptions.captions.some((option) => option.id === changes.mode)) {
    throw new Error('Invalid caption option');
  }
  if (!['motion', 'captions', 'voice'].includes(picker)) throw new Error('Unknown picker');
  return {...session, [picker]: {...session[picker], ...changes}};
}

export function addComparison(session, label, options) {
  label = label.trim(); options = [...new Set(options.map((option) => option.trim()).filter(Boolean))];
  if (!label || label.length > 60 || options.length < 2 || options.length > 12 || options.some((option) => option.length > 160)) {
    throw new Error('Use a short name and 2 to 12 options');
  }
  if (session.extraTabs.length >= 12) throw new Error('Keep at most 12 extra comparisons');
  const id = `comparison-${crypto.randomUUID()}`;
  return {...session, activeTab: id, extraTabs: [...session.extraTabs, {id, label, options, choice: null, notes: ''}]};
}

export function sessionSnapshot(session) {return structuredClone(session);}

const draftKeys = ['title', 'script', 'commentaryChoice', 'commentaryDrafts', 'notes', 'images', 'motion', 'captions', 'voice', 'requestedPickers', 'extraTabs'];
export function draftState(session) {
  return Object.fromEntries(draftKeys.map((key) => [key, structuredClone(session[key])]));
}
export function initializeReview(session) {
  return {...session, applied: session.applied ?? draftState(session), versions: session.versions ?? [], rebuildRequest: session.rebuildRequest ?? null};
}
export function pendingChanges(session) {
  const applied = session.applied ?? draftState(session);
  const changed = [];
  const scriptChanged=session.script !== applied.script;
  if (scriptChanged || session.notes !== applied.notes) changed.push('commentary');
  for (const key of ['images', 'motion', 'captions', 'voice']) {
    if (JSON.stringify(session[key]) !== JSON.stringify(applied[key])) changed.push(key);
  }
  for (const tab of session.extraTabs) {
    if (tab.choice === null && !applied.extraTabs.find((item) => item.id === tab.id)?.choice) continue;
    if (JSON.stringify(tab) !== JSON.stringify(applied.extraTabs.find((item) => item.id === tab.id))) changed.push(tab.id);
  }
  return {changed, review: scriptChanged ? ['images', 'voice'] : []};
}
export function resetPicker(session, id) {
  const next = {...session, rebuildRequest: null};
  if (id === 'commentary') {
    for (const key of ['script', 'commentaryChoice', 'commentaryDrafts', 'notes']) next[key] = structuredClone(session.applied[key]);
  } else if (['motion', 'captions', 'voice'].includes(id)) next[id] = null;
  else if (id === 'images') next.images = structuredClone(session.applied.images);
  else next.extraTabs = next.extraTabs.map((tab) => tab.id === id ? {...tab, choice: null, notes: ''} : tab);
  if (['motion', 'captions', 'voice'].includes(id)) next.requestedPickers = session.requestedPickers.filter((key) => key !== id);
  return next;
}
export function requestRebuild(session) {
  const changes = pendingChanges(session);
  if (!changes.changed.length) throw new Error('No changes to rebuild');
  const next = saveReviewVersion(session, `Rebuild ${session.versions.length + 1}`);
  return {...next, rebuildRequest: {id: crypto.randomUUID(), status: 'requested', createdAt: new Date().toISOString(), ...changes, state: draftState(next)}};
}

export function saveReviewVersion(session, label) {
  const version = {id: crypto.randomUUID(), label: label.trim() || `Version ${session.versions.length + 1}`, createdAt: new Date().toISOString(), state: draftState(session)};
  return {...session, versions: [...session.versions, version], selectedVersion: version.id};
}
export function restoreReviewVersion(session, id) {
  const version = session.versions.find((item) => item.id === id);
  if (!version) throw new Error('Unknown review version');
  return {...session, ...structuredClone(version.state), workingDraft: session.workingDraft ?? draftState(session), selectedVersion: id, rebuildRequest: null};
}

export function restoreWorkingDraft(session) {
  return {...session, ...structuredClone(session.workingDraft ?? draftState(session)), workingDraft: null, selectedVersion: null, rebuildRequest: null};
}

export function applyRebuild(session, request, renderId) {
  if (!request?.state || !renderId) throw new Error('A rendered request and video record are required');
  return {...session, applied: structuredClone(request.state), lastAppliedRender: renderId,
    rebuildRequest: session.rebuildRequest?.id === request.id ? null : session.rebuildRequest};
}
