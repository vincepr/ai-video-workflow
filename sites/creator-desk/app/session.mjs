import {createReviewSession, updatePicker, addComparison, pickerOptions, sessionSnapshot, initializeReview, pendingChanges, resetPicker, requestRebuild, draftState, saveReviewVersion, restoreReviewVersion, restoreWorkingDraft, applyRebuild} from './review-session.mjs';
const [catalog, concepts] = await Promise.all(['image-options.json', 'concepts.json'].map((file) => fetch(file).then((response) => response.json())));
const $ = (id) => document.getElementById(id);
const storageKey = `creator-desk:session:${catalog.id}`;
let local = false, saved, history = [], saveTimer, sampleTick = 0, paused = false;
try {saved = JSON.parse(localStorage.getItem(storageKey));} catch {}
try {
  const response = await fetch('/api/session');
  if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
    const result = await response.json(); local = true;
    if (result.session && (!saved || Date.parse(result.session.updatedAt ?? 0) > Date.parse(saved.updatedAt ?? 0))) saved = result.session;
    history = result.history;
  }
} catch {}
if (!local) {
  try {history = (await fetch('./session-history.json').then((response) => response.json())).history;} catch {}
}
let session = createReviewSession(catalog, saved);
const initialImageStorage = `creator-desk:images:${catalog.id}`;
if (session.images?.selection && !localStorage.getItem(initialImageStorage)) localStorage.setItem(initialImageStorage, JSON.stringify(session.images.selection));
function node(tag, text, className) {
  const element = document.createElement(tag); if (text) element.textContent = text; if (className) element.className = className; return element;
}
function button(text, action, className) {const element = node('button', text, className); element.type = 'button'; element.onclick = action; return element;}
function save(edited = true) {
  if (edited) {session.selectedVersion = null; session.workingDraft = null;}
  if (session.rebuildRequest && JSON.stringify(session.rebuildRequest.state) !== JSON.stringify(draftState(session))) session.rebuildRequest = null;
  session.updatedAt = new Date().toISOString();
  try {localStorage.setItem(storageKey, JSON.stringify(session)); $('save-status').textContent = local ? 'Saved in browser; saving locally' : 'Saved in this browser';}
  catch {$('save-status').textContent = 'Download the session to keep these choices';}
  clearTimeout(saveTimer);
  if (local) saveTimer = setTimeout(async () => {
    try {
      const response = await fetch('/api/session', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(sessionSnapshot(session))});
      if (!response.ok) throw new Error(); $('save-status').textContent = 'Saved in browser and local session';
    } catch {$('save-status').textContent = 'Saved in browser; local save unavailable';}
  }, 350);
  renderTabs(); renderChanges(); renderVersions();
}
function syncImages() {
  const value = $('image-picker').contentWindow?.creatorDesk?.getImageSelection?.();
  if (value && JSON.stringify(value) !== JSON.stringify(session.images)) {
    session.images = value;
    if (!session.applied.images) session.applied.images = structuredClone(value);
    save(); updatePreviews();
  }
}
function cards(container, options, choice, action) {
  $(container).replaceChildren(...options.map((option) => {
    const card = button('', () => action(option.id), 'picker-card'); card.setAttribute('aria-pressed', String(option.id === choice));
    card.append(node('strong', option.label), node('span', option.detail)); return card;
  }));
}
const tabs = [['videos', 'Videos'], ['commentary', 'Commentary'], ['images', 'Images'], ['motion', 'Motion'], ['captions', 'Captions'], ['voice', 'Voice']];
const optional = ['motion', 'captions', 'voice'];
function inactive(id) {return optional.includes(id) && !session.requestedPickers.includes(id) && !session[id];}
function renderTabs() {
  const changes = pendingChanges(session);
  const visible = tabs.filter(([id]) => !['captions', 'voice'].includes(id) || !inactive(id));
  if (!session.extraTabs.some((tab) => tab.label.toLowerCase() === 'music')) visible.push(['music', 'Music']);
  $('session-tabs').replaceChildren(...[...visible, ...session.extraTabs.map((tab) => [tab.id, tab.label]), ['add', '+ Add comparison']].map(([id, label]) => {
    const tab = button(label, () => openTab(id)); tab.id = `tab-${id}`; tab.setAttribute('role', 'tab');
    tab.className = id === 'videos' ? 'video-tab' : inactive(id) || id === 'music' ? 'inactive-tab' : '';
    const status = changes.changed.includes(id) ? 'Changed' : changes.review.includes(id) ? 'Review' : null;
    if (status) tab.append(node('span', status, 'tab-status'));
    tab.setAttribute('aria-selected', String(session.activeTab === id)); tab.setAttribute('aria-controls', `panel-${session.extraTabs.some((item) => item.id === id) ? 'extra' : id}`); return tab;
  }));
}
function openTab(id) {
  syncImages(); session.activeTab = id; save(false);
  document.querySelectorAll('.session-panel').forEach((panel) => {panel.hidden = true;});
  const extra = session.extraTabs.find((tab) => tab.id === id);
  const disabled = inactive(id) || id === 'music';
  const panel = $(disabled ? 'panel-inactive' : extra ? 'panel-extra' : `panel-${id}`) ?? $('panel-images'); panel.hidden = false;
  if (disabled) {
    $('inactive-title').textContent = id === 'music' ? 'Music' : tabs.find(([key]) => key === id)?.[1];
    $('enable-picker').onclick = () => {
      if (id === 'music') {openTab('add'); $('comparison-label').value = 'Music';}
      else {session.requestedPickers = [...new Set([...session.requestedPickers, id])]; save(); renderPickers(); openTab(id);}
    };
  }
  panel.setAttribute('aria-labelledby', `tab-${id}`);
  if (extra) renderExtra(extra);
  if (id === 'videos') refreshHistory();
  updatePreviews();
}
function renderPickers() {
  for (const key of ['movement', 'transition']) cards(`${key}-options`, pickerOptions[key], session.motion?.[key], (choice) => {
    session = updatePicker(session, 'motion', {[key]: choice}); save(); renderPickers(); updatePreviews();
  });
  cards('caption-options', pickerOptions.captions, session.captions?.mode, (mode) => {
    session = updatePicker(session, 'captions', {mode}); save(); renderPickers(); sampleTick = 0; updateCaption();
  });
  cards('voice-options', [
    {id: 'browser', label: 'First browser recording', detail: 'Free Voice Reader / 36.4 seconds'},
    {id: 'multilingual', label: 'Multilingual recording', detail: 'Second browser recording / 35.7 seconds'},
    {id: 'elevenlabs', label: 'ElevenLabs: Rob', detail: 'Supplied ElevenLabs recording / 40.5 seconds'},
  ], session.voice?.option, (option) => {session = updatePicker(session, 'voice', {option}); save(); renderPickers();});
  $('optional-pickers').replaceChildren(...optional.filter(inactive).map((id) => button(`Add ${tabs.find(([key]) => key === id)[1]}`, () => {
    session.requestedPickers.push(id); save(); renderPickers(); openTab(id);
  }, 'secondary')));
}
const angle = concepts.concepts.find((concept) => concept.id === 'perception') ?? concepts.concepts[0];
for (const [index, draft] of angle.drafts.entries()) session.commentaryDrafts[`draft-${index}`] ??= draft.text;
session = initializeReview(session);
function renderCommentary() {
  cards('commentary-options', [{id: 'current', label: 'Current narration', detail: session.commentaryDrafts.current},
    ...angle.drafts.map((draft, index) => ({id: `draft-${index}`, label: `Draft ${String.fromCharCode(65 + index)} / ${draft.label}`, detail: session.commentaryDrafts[`draft-${index}`]}))], session.commentaryChoice, (choice) => {
    session.commentaryDrafts[session.commentaryChoice] = session.script; session.commentaryChoice = choice;
    session.script = session.commentaryDrafts[choice]; save(); renderCommentary(); updateCaption();
  });
  $('session-script').value = session.script; $('commentary-notes').value = session.notes;
}
function updatePreviews() {
  const shots = session.images?.shots;
  const first = shots?.[0]?.preview ?? catalog.beats[0].options[0].preview;
  const second = shots?.[1]?.preview ?? catalog.beats[1].options[0].preview;
  document.querySelectorAll('.preview-first').forEach((image) => {image.src = first;});
  document.querySelector('.preview-second').src = second;
  $('motion-preview').className = `style-preview movement-${session.motion?.movement ?? 'still'} transition-${session.motion?.transition ?? 'cut'}`;
  updateCaption();
}
function updateCaption() {
  const words = session.script.trim().split(/\s+/).slice(0, 7);
  const word = sampleTick % Math.max(1, words.length);
  const mode = session.captions?.mode;
  const sample = $('caption-sample'); sample.className = `caption-sample ${mode ?? 'none'}`;
  if (!mode || mode === 'none') sample.replaceChildren();
  else if (mode === 'word') sample.textContent = words[word] ?? '';
  else if (mode === 'highlight') sample.replaceChildren(...words.map((text, index) => node('span', text + ' ', index === word ? 'spoken' : '')));
  else sample.textContent = words.join(' ');
}
function renderExtra(tab) {
  const panel = $('panel-extra'); panel.replaceChildren(node('h2', tab.label), node('p', 'Keep this comparison with the rest of the session.', 'hint'));
  const options = node('div', '', 'picker-cards');
  options.append(...tab.options.map((option) => {
    const card = button(option, () => {tab.choice = option; save(); renderExtra(tab);}, 'picker-card'); card.setAttribute('aria-pressed', String(option === tab.choice)); return card;
  }));
  const label = node('label', 'Notes'); label.htmlFor = 'extra-notes';
  const notes = node('textarea'); notes.id = 'extra-notes'; notes.rows = 3; notes.maxLength = 2000; notes.value = tab.notes;
  notes.oninput = () => {tab.notes = notes.value; save();};
  panel.append(options, label, notes);
}
function renderChanges() {
  const {changed, review} = pendingChanges(session);
  const label = (id) => tabs.find(([key]) => key === id)?.[1] ?? session.extraTabs.find((tab) => tab.id === id)?.label ?? id;
  $('change-summary').textContent = changed.length ? `Pending: ${changed.map(label).join(', ')}.${review.length ? ` Review ${review.map(label).join(' and ')} against the changed narration.` : ''}` : 'No pending changes. Inactive pickers leave the current video as it is.';
  $('rebuild-session').disabled = !changed.length;
  $('reset-tab').hidden = ['videos', 'add', 'music'].includes(session.activeTab) || inactive(session.activeTab);
  $('rebuild-status').textContent = session.rebuildRequest?.status === 'requested' ? 'Rebuild request saved with all changes. Tell the agent to process it; this page cannot start an agent turn.' : '';
}
function renderVersions() {
  const current = node('option', 'Working draft'); current.value = '';
  $('review-version').replaceChildren(current, ...session.versions.map((version, index) => {
    const option = node('option', `${index + 1}. ${version.label} / ${new Date(version.createdAt).toLocaleTimeString()}`); option.value = version.id; return option;
  }));
  $('review-version').value = session.selectedVersion ?? '';
}
function refreshDraft() {
  $('image-picker').contentWindow?.creatorDesk?.setImageSelection?.(session.images);
  $('voice-notes').value = session.voice?.notes ?? '';
  renderPickers(); renderCommentary(); updatePreviews(); openTab(session.activeTab);
}
$('reset-tab').onclick = () => {syncImages(); session = resetPicker(session, session.activeTab); save(); refreshDraft();};
$('review-version').onchange = () => {
  const id = $('review-version').value;
  if (!id) {session = restoreWorkingDraft(session); save(false); refreshDraft(); return;}
  syncImages();
  if (!session.selectedVersion) session = saveReviewVersion(session, 'Before restore');
  session = restoreReviewVersion(session, id); save(false); refreshDraft();
};
$('rebuild-session').onclick = () => {
  syncImages();
  session = requestRebuild(session); save(false);
};
function download(value, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], {type: 'application/json'}));
  const link = node('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderHistory() {
  $('history-note').textContent = local ? 'File checks are live. Deleted or replaced files stay listed with their original snapshots.'
    : 'These videos are stored locally. Open the local desk for playback and live file checks; this hosted list reflects the last update.';
  $('render-history').replaceChildren(...history.map((record) => {
    const unavailable = ['deleted', 'replaced', 'unavailable'].includes(record.status);
    const card = node('article', '', `render-card${unavailable ? ' unavailable' : ''}`);
    const episode = record.snapshot.episode;
    const seconds = episode.shots.reduce((total, shot) => total + shot.seconds, 0);
    card.append(node('h3', record.label), node('p', `${seconds.toFixed(1)} seconds / ${new Date(record.createdAt).toLocaleString()}`), node('span', record.status === 'local' ? 'Local file' : record.status, 'status'));
    if (record.status === 'available') {const video = node('video'); video.controls = true; video.preload = 'metadata'; video.src = record.videoUrl; card.append(video);}
    else if (record.status === 'local') {const link = node('a', 'Open in local desk ↗'); link.href = 'http://localhost:4173/session.html#videos'; card.append(link);}
    card.append(node('p', `Voice: ${episode.audio?.split('/').pop() ?? 'None'}`));
    if (!record.snapshot.pickers) card.append(node('p', 'Older render: episode settings are preserved; picker choices were not captured.'));
    const details = node('details'); details.append(node('summary', 'State when this video was rendered'), node('pre', JSON.stringify(record.snapshot, null, 2)));
    card.append(details, button('Download snapshot', () => download(record.snapshot, `${record.id}.snapshot.json`), 'secondary'));
    return card;
  }));
  if (!history.length) $('render-history').append(node('p', 'No renders have been recorded for this session yet.'));
}
async function refreshHistory() {
  if (!local) {renderHistory(); return;}
  try {
    const next = (await fetch('/api/session').then((response) => response.json())).history;
    if (JSON.stringify(next) !== JSON.stringify(history)) {history = next; renderHistory();}
  } catch {$('history-note').textContent = 'Local file checks are temporarily unavailable.';}
}
$('session-script').oninput = () => {session.script = $('session-script').value; session.commentaryDrafts[session.commentaryChoice] = session.script; save(); updateCaption();};
$('commentary-notes').oninput = () => {session.notes = $('commentary-notes').value; save();};
$('voice-notes').value = session.voice?.notes ?? '';
$('voice-notes').oninput = () => {session = updatePicker(session, 'voice', {notes: $('voice-notes').value}); save();};
$('pause-preview').onclick = () => {paused = !paused; $('pause-preview').textContent = paused ? 'Play sample' : 'Pause sample';};
$('download-session').onclick = () => {syncImages(); download(sessionSnapshot(session), 'homunculus.session.json');};
$('refresh-history').onclick = () => refreshHistory();
$('add-comparison').onsubmit = (event) => {
  event.preventDefault();
  try {session = addComparison(session, $('comparison-label').value, $('comparison-options').value.split('\n')); save(); $('add-comparison').reset(); $('comparison-error').textContent = ''; openTab(session.activeTab);}
  catch (error) {$('comparison-error').textContent = error.message;}
};
$('image-picker').onload = () => {
  if (session.images) $('image-picker').contentWindow?.creatorDesk?.setImageSelection?.(session.images);
  syncImages();
};
window.creatorDesk = {
  getReviewSession: () => {syncImages(); return sessionSnapshot(session);},
  getImageSelection: () => {syncImages(); return structuredClone(session.images);},
  applyRenderedVersion: async (recordId) => {
    await refreshHistory();
    const record = history.find((item) => item.id === recordId && item.status === 'available');
    if (!record?.snapshot.pickers?.rebuildRequest) throw new Error('No completed video with a rebuild snapshot');
    session = applyRebuild(session, record.snapshot.pickers.rebuildRequest, recordId); save(false);
  },
  revise: (changes) => {session = {...session, ...changes}; if (changes.script) session.commentaryDrafts[session.commentaryChoice] = changes.script; save(); renderCommentary(); updatePreviews();},
};
renderPickers(); renderCommentary(); renderHistory(); openTab(location.hash === '#videos' ? 'videos' : session.activeTab);
setInterval(() => {if (!paused && session.activeTab === 'captions') {sampleTick++; updateCaption();}}, 450);
setInterval(() => {if (session.activeTab === 'images') syncImages();}, 1000);
setInterval(() => {if (session.activeTab === 'videos') refreshHistory();}, 10000);
window.addEventListener('focus', () => {if (session.activeTab === 'videos') refreshHistory();});
