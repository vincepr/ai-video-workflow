import {createReviewSession, updatePicker, addComparison, pickerOptions, sessionSnapshot, initializeReview, pendingChanges, resetPicker, requestRebuild, draftState, saveReviewVersion, restoreReviewVersion, restoreWorkingDraft, applyRebuild, productVideoImpact} from './review-session.mjs';
import {readSessionImages} from './image-selection.mjs';
import {imagePresets, videoPresets, parseModelSettings, modelSettingsFromExecution, applyModelPreset, applyModelSettings, imageResolutionFor} from './model-settings.mjs';
const [catalog, concepts] = await Promise.all(['image-options.json', 'concepts.json'].map((file) => fetch(file).then((response) => response.json())));
let productCatalog = null;
try {const response = await fetch('./api/product-video/catalog'); if (response.ok) productCatalog = await response.json();} catch {}
const $ = (id) => document.getElementById(id);
const storageKey = `creator-desk:session:${catalog.projectId ?? catalog.id}:${catalog.id}`;
let local = false, saved, history = [], saveTimer, sampleTick = 0, paused = false, submitting = false, refining = false, imagePickerReady = false;
try {saved = JSON.parse(localStorage.getItem(storageKey) ?? localStorage.getItem(`creator-desk:session:${catalog.id}`));} catch {}
try {
  const response = await fetch('./api/session');
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
document.title = `${catalog.title} | Creator Desk`;
$('project-title').textContent = catalog.title;
try {
  const {projects} = await fetch('/api/projects').then(response => response.json());
  $('project-picker').replaceChildren(...projects.map(project => {const option = document.createElement('option'); option.value = project.id; option.textContent = project.title; return option;}));
  $('project-picker').value = session.sessionId;
  $('project-picker').onchange = async () => {
    syncImages(); clearTimeout(saveTimer);
    if (local) {
      const response = await fetch('./api/session', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(sessionSnapshot(session))});
      if (!response.ok) {$('save-status').textContent = 'Could not save this project before switching'; $('project-picker').value = session.sessionId; return;}
    }
    location.href = `/projects/${$('project-picker').value}/#videos`;
  };
} catch {$('project-picker').hidden = true;}
const initialImageStorage = `creator-desk:images:${catalog.projectId ?? catalog.id}:${catalog.id}`;
if (session.images?.selection && !localStorage.getItem(initialImageStorage)) localStorage.setItem(initialImageStorage, JSON.stringify(session.images.selection));
function node(tag, text, className) {
  const element = document.createElement(tag); if (text) element.textContent = text; if (className) element.className = className; return element;
}
function button(text, action, className) {const element = node('button', text, className); element.type = 'button'; element.onclick = action; return element;}
function save(edited = true) {
  if (edited) {session.selectedVersion = null; session.workingDraft = null; session.lastAction = null;}
  if (session.rebuildRequest && JSON.stringify(session.rebuildRequest.state) !== JSON.stringify(draftState(session))) session.rebuildRequest = null;
  session.updatedAt = new Date().toISOString();
  try {localStorage.setItem(storageKey, JSON.stringify(session)); $('save-status').textContent = local ? 'Saved in browser; saving locally' : 'Saved in this browser';}
  catch {$('save-status').textContent = 'Download the session to keep these choices';}
  clearTimeout(saveTimer);
  if (local) saveTimer = setTimeout(async () => {
    try {
      const response = await fetch('./api/session', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(sessionSnapshot(session))});
      if (!response.ok) throw new Error(); $('save-status').textContent = 'Saved in browser and local session';
    } catch {$('save-status').textContent = 'Saved in browser; local save unavailable';}
  }, 350);
  renderTabs(); renderChanges(); renderVersions();
}
function syncImages() {
  const result = readSessionImages($('image-picker').contentWindow?.creatorDesk, session.images, imagePickerReady);
  imagePickerReady = result.ready;
  const value = result.value;
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
const tabs = [['agent-video', 'Project video'], ['videos', 'Videos'], ['product-video', 'Product video'], ['commentary', 'Commentary'], ['images', 'Images'], ['motion', 'Motion'], ['captions', 'Captions'], ['voice', 'Voice']];
const optional = ['motion', 'captions', 'voice'];
function inactive(id) {return optional.includes(id) && !session.requestedPickers.includes(id) && !session[id];}
function renderTabs() {
  const changes = pendingChanges(session);
  const visible = tabs.filter(([id]) => (id !== 'product-video' || session.productVideo || session.productVideoLaunch) && (!['captions', 'voice'].includes(id) || !inactive(id)));
  if (!session.extraTabs.some((tab) => tab.label.toLowerCase() === 'music')) visible.push(['music', 'Music']);
  $('session-tabs').replaceChildren(...[...visible, ...session.extraTabs.map((tab) => [tab.id, tab.label]), ['add', '+ Add comparison']].map(([id, label]) => {
    const tab = button(label, () => openTab(id)); tab.id = `tab-${id}`; tab.setAttribute('role', 'tab');
    tab.className = id === 'videos' ? 'video-tab' : inactive(id) || id === 'music' ? 'inactive-tab' : '';
    const status = changes.changed.includes(id) ? 'Changed' : changes.review.includes(id) ? 'Review' : null;
    if (status) tab.append(node('span', status, 'tab-status'));
    tab.setAttribute('aria-selected', String(session.activeTab === id)); tab.setAttribute('aria-controls', `panel-${session.extraTabs.some((item) => item.id === id) ? 'extra' : id}`);
    const item = node('div', '', 'session-tab-item'); item.append(tab);
    if (changes.changed.includes(id) && !inactive(id)) {
      const reset = button('↺', (event) => {event.stopPropagation(); resetTab(id);}, 'tab-reset');
      reset.setAttribute('aria-label', `Reset ${label}`); reset.title = `Reset ${label}`; item.append(reset);
    }
    return item;
  }));
}
function openTab(id) {
  if (id === 'product-video' && !session.productVideo && !session.productVideoLaunch) id = 'agent-video';
  syncImages(); session.activeTab = id; save(false);
  $('save-session').parentElement.hidden = id === 'agent-video';
  document.querySelector('.session-footer').hidden = id === 'agent-video';
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
  if (id === 'agent-video') refreshAgentVideo();
  if (id === 'product-video') {renderProductVideo(); refreshProductVideoStatus();}
  updatePreviews();
}
function renderPickers() {
  for (const key of ['movement', 'transition']) cards(`${key}-options`, pickerOptions[key], session.motion?.[key], (choice) => {
    session = updatePicker(session, 'motion', {[key]: choice}); save(); renderPickers(); updatePreviews();
  });
  cards('caption-options', pickerOptions.captions, session.captions?.mode, (mode) => {
    session = updatePicker(session, 'captions', {mode}); save(); renderPickers(); sampleTick = 0; updateCaption();
  });
  cards('voice-options', catalog.voices ?? [], session.voice?.option, (option) => {session = updatePicker(session, 'voice', {option}); save(); renderPickers();});
  $('optional-pickers').replaceChildren(...optional.filter(inactive).map((id) => button(`Add ${tabs.find(([key]) => key === id)[1]}`, () => {
    session.requestedPickers.push(id); save(); renderPickers(); openTab(id);
  }, 'secondary')));
}
let agentVideo = null;
async function refreshAgentVideo() {
  try {
    const response = await fetch('./api/agent-video');
    if (!response.ok) throw new Error('Project video status is unavailable');
    const {status, shareable} = await response.json();
    agentVideo = status;
    $('av-plan').replaceChildren();
    $('av-save').disabled = !status;
    $('av-summary').textContent = shareable ? JSON.stringify(shareable, null, 2) : 'No revision yet.';
    $('av-private').textContent = status ? JSON.stringify(status, null, 2) : 'No revision yet.';
    if (!status) {$('av-status').textContent = 'No agent video revision yet. Give the agent a brief and spending cap to begin.'; return;}
    const revision = status.revision;
    $('av-status').textContent = `Revision ${revision.revisionId}: ${status.status}. ${status.blocked ?? ''} Cap $${revision.budgetUsd.toFixed(2)}, planned $${revision.estimateUsd.toFixed(2)}, recorded $${status.spentUsd.toFixed(2)}.`;
    $('av-plan').append(node('h3', 'Concept'), node('p', revision.plan.concept), node('h3', 'Shots'));
    for (const shot of revision.plan.shots) {
      const label = node('label', `${shot.id}: ${shot.description}`);
      const input = document.createElement('input'); input.value = shot.caption; input.maxLength = 200; input.dataset.shot = shot.id;
      label.append(input); $('av-plan').append(label);
    }
    const format = node('label', 'Output format');
    const select = document.createElement('select'); select.id = 'av-format';
    for (const value of ['9:16', '16:9', '1:1']) {const option = node('option', value); option.value = value; select.append(option);}
    select.value = revision.outputFormat; format.append(select); $('av-plan').append(format, node('h3', 'Stages'));
    for (const stage of revision.plan.stages) $('av-plan').append(node('p', `${stage.id}: ${stage.kind} via ${stage.provider} / ${stage.model}, estimate $${stage.estimateUsd.toFixed(2)}`));
    if (revision.references.length) $('av-plan').append(node('p', `References: ${revision.references.map(ref => ref.path).join(', ')}`));
    const previews = [...revision.references.map(ref => ref.path), ...status.attempts.flatMap(attempt => attempt.outputs.map(output => output.path))];
    if (previews.length) $('av-plan').append(node('h3', 'Previews'));
    for (const name of [...new Set(previews)]) {
      const extension = name.split('.').at(-1)?.toLowerCase();
      const media = ['png', 'jpg', 'jpeg', 'webp'].includes(extension) ? document.createElement('img') : extension === 'mp4' ? document.createElement('video') : ['mp3', 'wav'].includes(extension) ? document.createElement('audio') : null;
      if (!media) continue;
      media.src = `./api/agent-video/asset?path=${encodeURIComponent(name)}`;
      media.alt = name.split('/').at(-1); media.controls = media.tagName !== 'IMG'; media.style.maxWidth = '240px';
      const figure = node('figure'); figure.append(media, node('figcaption', name.split('/').at(-1))); $('av-plan').append(figure);
    }
  } catch (error) {$('av-status').textContent = error.message;}
}
$('av-refresh').onclick = refreshAgentVideo;
$('av-save').onclick = async () => {
  if (!agentVideo) return;
  const captions = Object.fromEntries([...$('av-plan').querySelectorAll('input[data-shot]')].map(input => [input.dataset.shot, input.value]));
  try {
    const response = await fetch('./api/agent-video/edit', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({captions, outputFormat: $('av-format').value})});
    const result = await response.json(); if (!response.ok) throw new Error(result.error);
    await refreshAgentVideo();
  } catch (error) {$('av-status').textContent = error.message;}
};
$('av-upload').onchange = async () => {
  const file = $('av-upload').files?.[0]; if (!file) return;
  const extension = `.${file.name.split('.').at(-1).toLowerCase()}`;
  if (file.size > 100 * 1024 * 1024) {$('av-upload-status').textContent = 'Upload exceeds 100 MB'; return;}
  try {
    const response = await fetch(`./api/agent-video/upload?ext=${encodeURIComponent(extension)}`, {method: 'POST', body: file});
    const result = await response.json(); if (!response.ok) throw new Error(result.error);
    $('av-upload-status').textContent = `Saved ${result.path}. Tell the agent to use this reference in the next revision.`;
    const preview = file.type.startsWith('image/') ? document.createElement('img') : file.type.startsWith('video/') ? document.createElement('video') : document.createElement('audio');
    preview.src = URL.createObjectURL(file); preview.alt = file.name; preview.controls = true; preview.style.maxWidth = '240px';
    $('av-upload-preview').replaceChildren(preview);
  } catch (error) {$('av-upload-status').textContent = error.message;}
};
function productOptions(id, values, labels, selected) {
  const select = $(id);
  select.replaceChildren(...values.map(value => {const option = node('option', labels?.[value]?.label ?? value); option.value = value; return option;}));
  select.value = values.includes(selected) ? selected : values[0] ?? '';
}
function modelChoices(id, choices, selected) {
  const available = new Set(choices.map(String));
  const values = [...available];
  if (selected !== undefined && selected !== null && !available.has(String(selected))) values.push(String(selected));
  const select = $(id);
  select.replaceChildren(...values.map(value => {
    const option = node('option', available.has(value) ? value : `Custom: ${value}`);
    option.value = value; return option;
  }));
  select.value = String(selected ?? values[0] ?? '');
}
function renderProductVideo() {
  if (!productCatalog) {$('pv-status').textContent = 'Product video configuration is available in the local desk.'; $('pv-generate').disabled = true; $('pv-refine').disabled = true; return;}
  const draft = session.productVideo ?? {};
  const workflow = draft.workflow ?? 'direct';
  productOptions('pv-workflow', Object.keys(productCatalog.choices), {direct: {label: 'Direct ad'}, skit: {label: 'Ad skit'}, drama: {label: 'AI drama'}, 'reference-remake': {label: 'Reference remake'}}, workflow);
  const selectedWorkflow = $('pv-workflow').value;
  const choices = productCatalog.choices[selectedWorkflow] ?? {};
  productOptions('pv-format', choices.formats ?? [], productCatalog.metadata.formats, draft.choices?.format);
  productOptions('pv-hook', choices.hooks ?? [], productCatalog.metadata.hooks, draft.choices?.hook ?? 'none');
  productOptions('pv-setting', choices.settings ?? [], productCatalog.metadata.settings, draft.choices?.setting ?? 'auto');
  productOptions('pv-style', choices.styles ?? [], productCatalog.metadata.styles?.[selectedWorkflow], draft.choices?.style);
  for (const id of ['format', 'hook', 'setting']) $(`pv-${id}`).closest('label').hidden = selectedWorkflow !== 'direct';
  $('pv-style').closest('label').hidden = selectedWorkflow === 'direct' || !(choices.styles?.length);
  productOptions('pv-destination', productCatalog.destinations, {}, draft.destination ?? 'private');
  const imageModel = draft.execution?.models?.image ?? imagePresets[0].model;
  const videoModel = draft.execution?.models?.video ?? videoPresets[0].model;
  const imagePreset = imagePresets.find(item => item.model === imageModel);
  const videoPreset = videoPresets.find(item => item.model === videoModel);
  productOptions('pv-image-preset', [...imagePresets.map(item => item.model), 'custom'], Object.fromEntries([...imagePresets.map(item => [item.model, item]), ['custom', {label: 'Custom model ID'}]]), imagePreset?.model ?? 'custom');
  productOptions('pv-video-preset', [...videoPresets.map(item => item.model), 'custom'], Object.fromEntries([...videoPresets.map(item => [item.model, item]), ['custom', {label: 'Custom model ID'}]]), videoPreset?.model ?? 'custom');
  modelChoices('pv-image-resolution', imagePreset?.resolutions ?? ['1K', '2K', '4K'], imageResolutionFor(draft.execution, imagePreset));
  modelChoices('pv-resolution', videoPreset?.resolutions ?? ['480p', '720p', '1080p'], draft.execution?.resolution ?? videoPreset?.defaultResolution ?? '480p');
  modelChoices('pv-duration', videoPreset?.durations ?? [4, 5, 6, 8, 10, 12, 15, 20, 30], draft.execution?.durationSec ?? videoPreset?.defaultDurationSec ?? 8);
  const ratios = (imagePreset?.ratios ?? ['9:16', '16:9', '1:1', '4:3', '3:4']).filter(ratio => (videoPreset?.ratios ?? ['9:16', '16:9', '1:1', '4:3', '3:4']).includes(ratio));
  modelChoices('pv-aspect', ratios, draft.execution?.aspectRatio ?? '9:16');
  const values = {language: draft.language ?? 'en', product: draft.brief?.product ?? '', 'product-path': draft.references?.find(ref => ref.role === 'product')?.path ?? '', 'presenter-path': draft.references?.find(ref => ref.role === 'presenter')?.path ?? '', 'reference-video-path': draft.references?.find(ref => ref.role === 'reference-video')?.path ?? '', facts: (draft.brief?.facts ?? []).join('\n'), brand: draft.brief?.brand ?? '', cta: draft.brief?.cta ?? '', caption: draft.finishing?.caption ?? '', provider: draft.execution?.provider ?? 'openrouter', 'image-model': imageModel, 'video-model': videoModel, duration: draft.execution?.durationSec ?? videoPreset?.defaultDurationSec ?? 8, aspect: draft.execution?.aspectRatio ?? '9:16', 'image-resolution': imageResolutionFor(draft.execution, imagePreset), resolution: draft.execution?.resolution ?? videoPreset?.defaultResolution ?? '480p', budget: draft.execution?.budget?.maxUsd ?? 0};
  for (const [id, value] of Object.entries(values)) $(`pv-${id}`).value = value;
  $('pv-audio').checked = draft.execution?.audio ?? false;
  const format = productCatalog.metadata.formats?.[$('pv-format').value];
  const choiceHint = selectedWorkflow === 'reference-remake' ? 'Reference remake is unsupported until a verified video-edit provider route is available.' : format?.needsPresenter ? 'This format needs a presenter reference.' : 'No presenter reference is required by this format.';
  $('pv-applicability').textContent = `${choiceHint} ${productCatalog.runtime?.freshSessionAvailable ? '' : 'Fresh production sessions are unavailable here. Generate can freeze the request, but cannot start an isolated worker.'}`;
  for (const field of $('product-video-form').querySelectorAll('input, textarea, select')) field.disabled = refining;
  $('pv-generate').disabled = refining || !local || selectedWorkflow === 'reference-remake';
  const canRefine = local && selectedWorkflow === 'direct' && session.productVideoLaunch?.draft?.workflow === 'direct' && !!session.productVideoLaunch?.id;
  $('pv-refine').disabled = refining || !canRefine;
  $('pv-refine-status').textContent = session.productVideoRefinement?.message ?? (canRefine ? 'A prior direct request is selected. Local finishing requires its prepared footage.' : 'A saved direct run is required.');
  $('pv-request-details').textContent = session.productVideoLaunch ? JSON.stringify(session.productVideoLaunch, null, 2) : 'No frozen request yet.';
}
function readProductVideoForm() {
  const workflow = $('pv-workflow').value;
  const choices = workflow === 'direct' ? {format: $('pv-format').value, hook: $('pv-hook').value, setting: $('pv-setting').value} : {style: $('pv-style').value};
  const references = [{role: 'product', path: $('pv-product-path').value.trim()}];
  if ($('pv-presenter-path').value.trim()) references.push({role: 'presenter', path: $('pv-presenter-path').value.trim()});
  if ($('pv-reference-video-path').value.trim()) references.push({role: 'reference-video', path: $('pv-reference-video-path').value.trim()});
  return {action: 'generate', workflow, choices, language: $('pv-language').value.trim(), destination: $('pv-destination').value,
    references, brief: {product: $('pv-product').value.trim(), facts: $('pv-facts').value.split('\n').map(line => line.trim()).filter(Boolean), brand: $('pv-brand').value.trim(), cta: $('pv-cta').value.trim()},
    execution: {provider: $('pv-provider').value.trim(), models: {image: $('pv-image-model').value.trim(), video: $('pv-video-model').value.trim()}, durationSec: Number($('pv-duration').value), aspectRatio: $('pv-aspect').value.trim(), imageResolution: $('pv-image-resolution').value.trim(), resolution: $('pv-resolution').value.trim(), audio: $('pv-audio').checked, budget: {currency: 'USD', maxUsd: Number($('pv-budget').value)}},
    finishing: {caption: $('pv-caption').value.trim()}};
}
for (const field of $('product-video-form').querySelectorAll('input, textarea, select')) field.addEventListener('change', () => {
  if (field.id === 'pv-image-preset' && field.value === 'custom') {$('pv-image-model').focus(); return;}
  if (field.id === 'pv-video-preset' && field.value === 'custom') {$('pv-video-model').focus(); return;}
  const draft = readProductVideoForm();
  if (field.id === 'pv-image-preset' && field.value !== 'custom') draft.execution = applyModelPreset(draft.execution, 'image', field.value);
  if (field.id === 'pv-video-preset' && field.value !== 'custom') draft.execution = applyModelPreset(draft.execution, 'video', field.value);
  session.productVideo = draft; save(); renderProductVideo();
});
$('pv-export-model-json').onclick = () => {
  $('pv-model-json').value = JSON.stringify(modelSettingsFromExecution(readProductVideoForm().execution), null, 2);
  $('pv-model-json-status').textContent = 'Current model settings shown. Editing this JSON does not call a provider.';
};
$('pv-apply-model-json').onclick = () => {
  try {
    const config = parseModelSettings($('pv-model-json').value);
    const draft = readProductVideoForm();
    draft.execution = applyModelSettings(draft.execution, config);
    session.productVideo = draft; save(); renderProductVideo();
    $('pv-model-json-status').textContent = 'Model settings applied to the local draft. Provider support is checked before a paid run.';
  } catch (error) {$('pv-model-json-status').textContent = error.message;}
};
async function refreshProductVideoStatus() {
  const id = session.productVideoLaunch?.id;
  if (!id || !local) return;
  try {
    const response = await fetch(`./api/product-video/status?requestId=${encodeURIComponent(id)}`);
    if (!response.ok) return;
    const {launch, worker} = await response.json();
    session.productVideoLaunch = {...session.productVideoLaunch, launch, worker};
    $('pv-status').textContent = launch?.status === 'unsupported' ? `Unavailable: ${launch.reason}. The request is frozen; no provider call was made.` : `Dispatch: ${launch?.status ?? 'pending'}. Worker: ${worker?.status ?? 'not started'}. A dispatched request is not a finished video.`;
    $('pv-request-details').textContent = JSON.stringify(session.productVideoLaunch, null, 2);
  } catch {$('pv-status').textContent = 'Progress is temporarily unavailable.';}
}
$('pv-generate').onclick = async () => {
  session.productVideo = readProductVideoForm();
  const old = session.productVideoLaunch;
  const id = old && JSON.stringify(old.draft) === JSON.stringify(session.productVideo) ? old.id : crypto.randomUUID();
  session.productVideoLaunch = {id, draft: structuredClone(session.productVideo)};
  session = saveReviewVersion(session, `Product video ${session.versions.length + 1}`); save(false);
  $('pv-status').textContent = 'Freezing request and checking launch capability...';
  clearTimeout(saveTimer);
  try {
    const saved = await fetch('./api/session', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(sessionSnapshot(session))});
    if (!saved.ok) throw new Error('Could not save configuration');
    const response = await fetch('./api/product-video/generate', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({requestId: id})});
    const result = await response.json(); if (!response.ok) throw new Error(result.error ?? 'Could not freeze request');
    session.productVideoLaunch = {...session.productVideoLaunch, launch: result}; save(false);
    await refreshProductVideoStatus();
  } catch (error) {$('pv-status').textContent = error.message;}
};
$('pv-refresh').onclick = refreshProductVideoStatus;
$('pv-cancel').onclick = async () => {
  if (!session.productVideoLaunch?.id) return;
  const response = await fetch('./api/product-video/cancel', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({requestId: session.productVideoLaunch.id})});
  if (!response.ok) {$('pv-status').textContent = 'Could not cancel this request.'; return;}
  await refreshProductVideoStatus();
};
$('pv-refine').onclick = async () => {
  if (refining || !session.productVideoLaunch?.id || session.productVideoLaunch.draft?.workflow !== 'direct') return;
  session.productVideo = readProductVideoForm();
  if (session.productVideo.workflow !== 'direct') return;
  const requestId = session.productVideoLaunch.id;
  const finish = {requestId, brand: session.productVideo.brief.brand, cta: session.productVideo.brief.cta, caption: session.productVideo.finishing.caption};
  const old = session.productVideoRefinement;
  const refinementId = old && JSON.stringify(old.finish) === JSON.stringify(finish) ? old.id : crypto.randomUUID();
  session.productVideoRefinement = {id: refinementId, finish, message: 'Saving refinement before local finishing...'};
  refining = true; renderProductVideo(); save(false); clearTimeout(saveTimer);
  try {
    const saved = await fetch('./api/session', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(sessionSnapshot(session))});
    if (!saved.ok) throw new Error('Could not save the refinement. Nothing was finished.');
    const response = await fetch('./api/product-video/refine', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({requestId, refinementId})});
    const result = await response.json();
    if (!response.ok || result.status === 'unsupported') throw new Error(result.error ?? result.reason ?? 'Local finishing is unavailable for this request.');
    session.productVideoRefinement = {...session.productVideoRefinement, result, message: 'Local refinement exported. Review the new numbered video in Videos before marking it selected.'};
    save(false); await refreshHistory(); openTab('videos');
  } catch (error) {
    session.productVideoRefinement = {...session.productVideoRefinement, message: `Local finishing unavailable: ${error.message}`};
    save(false);
  } finally {refining = false; renderProductVideo();}
};
const angle = concepts.concepts.find((concept) => concept.id === concepts.selectedConcept) ?? concepts.concepts[0] ?? {drafts: []};
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
  const first = shots?.[0]?.preview ?? catalog.beats[0]?.options[0]?.preview;
  const second = shots?.[1]?.preview ?? catalog.beats[1]?.options[0]?.preview ?? first;
  document.querySelectorAll('.preview-first').forEach((image) => {if (first) image.src = first; else image.removeAttribute('src');});
  const nextImage = document.querySelector('.preview-second');
  if (second) nextImage.src = second; else nextImage.removeAttribute('src');
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
  const hint = /music/i.test(tab.label) ? 'Review choices only. This tab does not play or mix audio. Videos lists the music actually used in each render.' : 'Keep this comparison with the rest of the session.';
  const panel = $('panel-extra'); panel.replaceChildren(node('h2', tab.label), node('p', hint, 'hint'));
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
  $('rebuild-session').disabled = submitting || !local || !changed.some(id => id !== 'product-video');
  $('save-session').disabled = submitting;
  $('rebuild-status').textContent = session.lastAction?.message ?? '';
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
  renderPickers(); renderCommentary(); renderProductVideo(); updatePreviews(); openTab(session.activeTab);
}
function resetTab(id) {syncImages(); session = resetPicker(session, id); save(); refreshDraft();}
$('review-version').onchange = () => {
  const id = $('review-version').value;
  if (!id) {session = restoreWorkingDraft(session); save(false); refreshDraft(); return;}
  syncImages();
  if (!session.selectedVersion) session = saveReviewVersion(session, 'Before restore');
  session = restoreReviewVersion(session, id); save(false); refreshDraft();
};
$('save-session').onclick = () => {
  syncImages(); session = saveReviewVersion(session,`Saved ${session.versions.length + 1}`);
  session.lastAction = {status:'saved',message:'Version saved. Nothing sent to T3.'}; save(false);
};
$('rebuild-session').onclick = async () => {
  if(submitting) return;
  syncImages();
  if (!session.rebuildRequest || JSON.stringify(session.rebuildRequest.state) !== JSON.stringify(draftState(session))) session = requestRebuild(session);
  const requestId=session.rebuildRequest.id;submitting=true;
  session.lastAction={status:'sending',requestId,message:'Saving version and sending to T3...'};save(false);
  clearTimeout(saveTimer);
  try {
    const saved=await fetch('./api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sessionSnapshot(session))});
    if(!saved.ok)throw new Error('Could not save locally. Nothing was sent to T3.');
    const response=await fetch('./api/session/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId})});
    const result=await response.json();if(!response.ok)throw new Error(result.error ?? 'T3 did not confirm delivery');
    session.lastAction={status:'sent',requestId,sequence:result.sequence,message:session.rebuildRequest?.id === requestId ? 'Version saved and accepted by T3. Follow the turn in the chat.' : 'The earlier saved version was accepted by T3. Newer draft edits were not sent.'};
  } catch(error) {session.lastAction={status:'failed',requestId,message:`Saved version kept. ${error.message}`};}
  finally {submitting=false;save(false);}
};
function download(value, name) {
  const url = URL.createObjectURL(new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n'], {type: typeof value === 'string' ? 'text/plain' : 'application/json'}));
  const link = node('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function renderHistory() {
  $('history-note').textContent = local ? 'File checks are live. Deleted or replaced files stay listed with their original snapshots.'
    : 'These videos are stored locally. Open the local desk for playback and live file checks; this hosted list reflects the last update.';
  $('render-history').replaceChildren(...history.map((record) => {
    const unavailable = ['deleted', 'replaced', 'unavailable'].includes(record.status);
    const card = node('article', '', `render-card${unavailable ? ' unavailable' : ''}`);
    const episode = record.snapshot.episode;
    const seconds = record.snapshot.productVideo && record.snapshot.renderer?.fps ? record.snapshot.renderer.frames / record.snapshot.renderer.fps
      : episode.shots.reduce((total, shot) => total + shot.seconds, 0);
    const name = `${record.iteration ? record.iteration + ' / ' : ''}${record.label}`;
    const selected = record.id === session.lastAppliedRender;
    card.append(node('h3', name), node('p', `${seconds.toFixed(1)} seconds / ${new Date(record.createdAt).toLocaleString()}`), node('span', selected ? `${record.status} / Selected` : record.status === 'local' ? 'Local file' : record.status, 'status'), node('p', record.file, 'quiet'));
    if (record.status === 'available') {const video = node('video'); video.controls = true; video.preload = 'metadata'; video.src = record.videoUrl; card.append(video);}
    else if (record.status === 'local') {const link = node('a', 'Open in local desk ↗'); link.href = 'http://localhost:4173/session.html#videos'; card.append(link);}
    card.append(node('p', `Voice: ${episode.audio?.split('/').pop() ?? 'None'}`));
    if (episode.music) card.append(node('p', `Music: ${episode.music.title} by ${episode.music.artist}`));
    if (record.release?.description) {
      const credits=node('details');credits.append(node('summary','Upload description'),node('pre',record.release.description));
      card.append(credits,button('Download description',()=>download(record.release.description,`${record.id}.description.txt`),'secondary'));
    }
    const provenance = node('details');
    provenance.append(node('summary', 'How this was made'), node('pre', record.provenance ? JSON.stringify(record.provenance.summary, null, 2) : 'Detailed provenance was not recorded for this export.'));
    card.append(provenance);
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
    const next = (await fetch('./api/session').then((response) => response.json())).history;
    if (JSON.stringify(next) !== JSON.stringify(history)) {history = next; renderHistory();}
  } catch {$('history-note').textContent = 'Local file checks are temporarily unavailable.';}
}
$('session-script').oninput = () => {session.script = $('session-script').value; session.commentaryDrafts[session.commentaryChoice] = session.script; save(); updateCaption();};
$('commentary-notes').oninput = () => {session.notes = $('commentary-notes').value; save();};
$('voice-notes').value = session.voice?.notes ?? '';
$('voice-notes').oninput = () => {session = updatePicker(session, 'voice', {notes: $('voice-notes').value}); save();};
$('pause-preview').onclick = () => {paused = !paused; $('pause-preview').textContent = paused ? 'Play sample' : 'Pause sample';};
$('download-session').onclick = () => {syncImages(); download(sessionSnapshot(session), `${session.sessionId}.session.json`);};
$('refresh-history').onclick = () => refreshHistory();
$('add-comparison').onsubmit = (event) => {
  event.preventDefault();
  try {session = addComparison(session, $('comparison-label').value, $('comparison-options').value.split('\n')); save(); $('add-comparison').reset(); $('comparison-error').textContent = ''; openTab(session.activeTab);}
  catch (error) {$('comparison-error').textContent = error.message;}
};
$('image-picker').onload = () => {
  imagePickerReady = false;
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
syncImages(); renderPickers(); renderCommentary(); renderHistory(); openTab(location.hash === '#videos' ? 'videos' : session.activeTab);
setInterval(() => {if (!paused && session.activeTab === 'captions') {sampleTick++; updateCaption();}}, 450);
setInterval(() => {if (session.activeTab === 'images') syncImages();}, 1000);
setInterval(() => {if (session.activeTab === 'videos') refreshHistory();}, 10000);
window.addEventListener('focus', () => {if (session.activeTab === 'videos') refreshHistory();});
