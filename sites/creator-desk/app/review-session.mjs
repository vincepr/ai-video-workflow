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
  const defaults = {version: 1, sessionId: 'homunculus', catalogId: catalog.id, title: catalog.title,
    script: catalog.script, commentaryChoice: 'current', commentaryDrafts: {current: catalog.script},
    images: null, motion: {movement: 'slow', transition: 'cut'}, captions: {mode: 'phrase'},
    voice: {option: 'elevenlabs', notes: ''}, extraTabs: [], activeTab: 'images', notes: ''};
  if (saved?.version !== 1 || saved.catalogId !== catalog.id) return defaults;
  const session = {...defaults, ...structuredClone(saved)};
  for (const picker of ['motion', 'captions']) {
    try {updatePicker(defaults, picker, session[picker]);} catch {session[picker] = defaults[picker];}
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
  return {...session, activeTab: id, extraTabs: [...session.extraTabs, {id, label, options, choice: options[0], notes: ''}]};
}

export function sessionSnapshot(session) {return structuredClone(session);}
