import {createDraft, reviseDraft, approveDraft, approvedBrief, refreshExamples} from './workflow.mjs';
import {art} from './art.mjs';

const data = await fetch('./concepts.json').then((r) => r.json());
const storageKey = `creator-desk:concepts:${data.projectId ?? data.topic}:v1`;
const $ = (id) => document.getElementById(id);
let drafts = {};
let selection = data.concepts[0].id;
let variant = 0;
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (stored && data.concepts.some((c) => c.id === stored.selection)) {
    ({drafts, selection, variant} = stored);
    if (![0, 1].includes(variant) || !drafts || typeof drafts !== 'object') throw new Error('Invalid saved draft');
  }
} catch {drafts = {}; selection = data.concepts[0].id; variant = 0;}
drafts = refreshExamples(drafts, data.concepts);

const concept = () => data.concepts.find((c) => c.id === selection);
const draftKey = () => `${selection}:${variant}`;
const draft = () => drafts[draftKey()] ??= createDraft(concept(), variant);
function save() {
  try {localStorage.setItem(storageKey, JSON.stringify({drafts, selection, variant}));}
  catch {$('feedback').textContent = 'Browser storage is unavailable. Download the brief to keep your work.';}
}

function refreshStatus() {
  const d = draft();
  const words = d.script.trim().split(/\s+/).filter(Boolean).length;
  const estimate = Math.round(words / 2.3);
  $('word-count').textContent = `${words} words / about ${estimate}s spoken`;
  let approved = false;
  try {approvedBrief(d); approved = true;} catch {}
  $('status').textContent = approved ? 'Approved' : 'Draft';
  $('status').classList.toggle('approved', approved);
  $('download').disabled = !approved;
  $('approve').textContent = approved ? 'Draft approved ✓' : 'Approve this draft ↗';
  $('preview-hook').textContent = d.title;
}

function render() {
  const d = draft();
  $('concepts').replaceChildren(...data.concepts.map((c, i) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `concept ${selection === c.id ? 'selected' : ''}`;
    button.setAttribute('aria-pressed', String(selection === c.id));
    button.innerHTML = `<div class="concept-art">${art(c.motif)}<span class="concept-number">0${i + 1}</span><span class="selection-dot">${selection === c.id ? '✓' : ''}</span></div><div class="concept-copy"><span class="concept-tag"></span><h3></h3><p></p></div><div class="concept-footer"><span></span><b>Explore this angle ↗</b></div>`;
    button.querySelector('.concept-tag').textContent = c.tag;
    button.querySelector('h3').textContent = c.title;
    button.querySelector('p').textContent = c.angle;
    button.querySelector('.concept-footer span').textContent = c.spoilers;
    button.onclick = () => {selection = c.id; variant = 0; save(); render();};
    return button;
  }));
  $('variants').replaceChildren(...concept().drafts.map((v, i) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = i === variant ? 'active' : '';
    button.setAttribute('aria-pressed', String(i === variant));
    button.textContent = `${i === 0 ? 'A' : 'B'} / ${v.label}`;
    const small = document.createElement('small'); small.textContent = i === 0 ? 'Build around an idea' : 'Build around your reaction'; button.append(small);
    button.onclick = () => {variant = i; save(); render();};
    return button;
  }));
  $('comparison').replaceChildren(...concept().drafts.map((v) => {
    const article = document.createElement('article');
    const h = document.createElement('h3'); h.textContent = v.label;
    const p = document.createElement('p'); p.textContent = v.text;
    article.append(h, p); return article;
  }));
  for (const field of ['title', 'script', 'notes', 'seconds']) $(field).value = d[field];
  $('preview-art').innerHTML = art(concept().motif);
  $('beats').replaceChildren(...d.beats.map((beat) => {const li = document.createElement('li'); li.textContent = beat; return li;}));
  refreshStatus();
  $('feedback').textContent = d.approval
    ? 'Approved. Tell the agent “Make the approved draft” to start production.'
    : 'Saved in this browser. Nothing is being generated.';
}

for (const field of ['title', 'script', 'notes', 'seconds']) {
  $(field).addEventListener('input', () => {
    drafts[draftKey()] = reviseDraft(draft(), {[field]: field === 'seconds' ? Number($(field).value) : $(field).value});
    save(); refreshStatus();
    $('feedback').textContent = 'Changes saved. Review the draft before approving it.';
  });
}
$('approve').onclick = () => {
  try {
    drafts[draftKey()] = approveDraft(draft()); save(); refreshStatus();
    $('feedback').textContent = 'Approved. Tell the agent “Make the approved draft” to start production. No video has been generated yet.';
  } catch (error) {$('feedback').textContent = error.message;}
};
$('download').onclick = () => {
  try {
    const brief = approvedBrief(draft());
    const url = URL.createObjectURL(new Blob([JSON.stringify(brief, null, 2) + '\n'], {type: 'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = `${data.projectId ?? 'project'}-${selection}.brief.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {$('feedback').textContent = error.message;}
};
$('listen').onclick = () => {
  if (!('speechSynthesis' in window)) {$('feedback').textContent = 'Voice preview is unavailable in this browser.'; return;}
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(draft().script); utterance.lang = 'en-US'; utterance.rate = 0.95;
  speechSynthesis.speak(utterance);
};
$('sources').replaceChildren(...data.sources.map((source) => {
  const link = document.createElement('a'); link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.textContent = source.label + ' ↗'; return link;
}));
// The skill reads this interface through the shared browser after the user's request.
window.creatorDesk = {
  getDraft: () => structuredClone(draft()),
  getApprovedBrief: () => structuredClone(approvedBrief(draft())),
  revise: (changes) => {drafts[draftKey()] = reviseDraft(draft(), changes); save(); render();},
};
render(); save();
