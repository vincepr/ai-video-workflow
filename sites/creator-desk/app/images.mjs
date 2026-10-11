import {createSelection, chooseImage, moveImage, exportSelection} from './image-selection.mjs';
const catalog = await fetch('./image-options.json').then((response) => {
  if (!response.ok) throw new Error('Image options are unavailable');
  return response.json();
});
const $ = (id) => document.getElementById(id);
const storageKey = `creator-desk:images:${catalog.id}`;
let saved;
try {saved = JSON.parse(localStorage.getItem(storageKey));} catch {}
let selection = createSelection(catalog, saved);
let draggedIndex;
const selectedOption = (beat) => beat.options.find((option) => option.id === selection.choices[beat.id]);
function enlarge(option) {
  $('large-image').src = option.preview; $('large-image').alt = option.title;
  $('large-image-title').textContent = option.title; $('image-dialog').showModal();
}
function save() {
  try {localStorage.setItem(storageKey, JSON.stringify(selection));}
  catch {$('image-feedback').textContent = 'Browser storage is unavailable. Download the selection to keep it.';}
}
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, action, className) {
  const node = element('button', text, className); node.type = 'button'; node.onclick = action; return node;
}
function changeOrder(from, to) {
  selection = moveImage(selection, from, to); save(); render();
  $('image-feedback').textContent = 'Image order saved. Check the commentary beneath each image.';
}
function render() {
  $('sequence').replaceChildren(...selection.order.map((id, index) => {
    const beat = catalog.beats.find((item) => item.id === id);
    const option = selectedOption(beat);
    const li = element('li', '', 'sequence-item'); li.draggable = true;
    const image = element('img'); image.src = option.preview; image.alt = option.title;
    image.draggable = false;
    const enlargeImage = button('', () => enlarge(option), 'sequence-enlarge');
    enlargeImage.setAttribute('aria-label', `Enlarge sequence image ${index + 1}`);
    enlargeImage.append(image);
    const controls = element('div', '', 'sequence-controls');
    const up = button('←', () => changeOrder(index, index - 1)); up.disabled = index === 0;
    up.setAttribute('aria-label', `Move image ${index + 1} earlier`);
    const down = button('→', () => changeOrder(index, index + 1)); down.disabled = index === selection.order.length - 1;
    down.setAttribute('aria-label', `Move image ${index + 1} later`);
    controls.append(up, down);
    li.append(enlargeImage, element('strong', `${index + 1}. ${option.title}`), controls, element('p', catalog.beats[index].commentary));
    li.ondragstart = (event) => {draggedIndex = index; event.dataTransfer.setData('text/plain', String(index));};
    li.ondragover = (event) => event.preventDefault();
    li.ondrop = (event) => {event.preventDefault(); if (Number.isInteger(draggedIndex)) changeOrder(draggedIndex, index); draggedIndex = undefined;};
    li.ondragend = () => {draggedIndex = undefined;};
    return li;
  }));
  $('image-beats').replaceChildren(...catalog.beats.map((beat, index) => {
    const section = element('section', '', 'image-beat'); section.id = `beat-${beat.id}`;
    section.append(element('span', `IMAGE ${index + 1} / THREE OPTIONS`, 'eyebrow'), element('h2', beat.title), element('p', beat.commentary, 'commentary-quote'));
    if (beat.gap) section.append(element('p', beat.gap, 'image-gap'));
    const options = element('div', '', 'image-options');
    options.append(...beat.options.map((option, optionIndex) => {
      const chosen = selection.choices[beat.id] === option.id;
      const card = element('article', '', `image-option${chosen ? ' selected' : ''}`);
      const enlargeButton = button('', () => enlarge(option), 'option-image');
      enlargeButton.setAttribute('aria-label', `Enlarge ${option.title}`);
      const image = element('img'); image.src = option.preview; image.alt = option.title; image.loading = 'lazy'; enlargeButton.append(image);
      const copy = element('div', '', 'option-copy');
      const link = element('a', 'Source ↗'); link.href = option.source; link.target = '_blank'; link.rel = 'noopener noreferrer';
      const pick = button(chosen ? 'Selected ✓' : 'Choose this image', () => {
        selection = chooseImage(selection, catalog, beat.id, option.id); save(); render();
        $('image-feedback').textContent = 'Choice saved. Nothing is being generated.';
      }, 'pick-option');
      pick.setAttribute('aria-pressed', String(chosen)); pick.setAttribute('aria-label', `Choose ${option.title}`);
      copy.append(element('h3', `${String.fromCharCode(65 + optionIndex)} / ${option.title}`), element('p', option.fit),
        element('p', `${option.language}. ${option.note}`, 'option-meta'), link, pick);
      card.append(enlargeButton, copy); return card;
    }));
    section.append(options); return section;
  }));
}
$('catalog-note').textContent = catalog.note;
$('beat-links').replaceChildren(...catalog.beats.map((beat, index) => {
  const link = element('a', `${index + 1}. ${beat.title}`); link.href = `#beat-${beat.id}`; return link;
}));
$('image-notes').value = selection.notes;
$('image-notes').oninput = () => {selection = {...selection, notes: $('image-notes').value}; save();};
$('reset-order').onclick = () => {selection = {...selection, order: catalog.beats.map((beat) => beat.id)}; save(); render();};
$('save-images').onclick = () => {save(); $('image-feedback').textContent = 'Choices saved. Tell the agent to use this selection when you are ready.';};
$('download-images').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(exportSelection(selection, catalog), null, 2) + '\n'], {type: 'application/json'}));
  const link = element('a'); link.href = url; link.download = 'homunculus-image-selection.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$('close-image').onclick = () => $('image-dialog').close();
window.creatorDesk = {getImageSelection: () => exportSelection(selection, catalog)};
if (new URLSearchParams(location.search).has('embedded')) document.body.classList.add('embedded');
render(); save();
