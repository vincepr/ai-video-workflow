export function createSelection(catalog, saved) {
  const ids = catalog.beats.map((beat) => beat.id);
  const valid = saved?.catalogId === catalog.id && Array.isArray(saved.order) &&
    saved.order.length === ids.length && new Set(saved.order).size === ids.length &&
    saved.order.every((id) => ids.includes(id)) &&
    catalog.beats.every((beat) => beat.options.some((option) => option.id === saved.choices?.[beat.id]));
  return valid ? structuredClone(saved) : {catalogId: catalog.id, order: ids,
    choices: Object.fromEntries(catalog.beats.map((beat) => [beat.id, beat.options[0].id])), notes: ''};
}

export function chooseImage(selection, catalog, beatId, optionId) {
  if (!catalog.beats.find((beat) => beat.id === beatId)?.options.some((option) => option.id === optionId)) {
    throw new Error('Unknown image option');
  }
  return {...selection, choices: {...selection.choices, [beatId]: optionId}};
}

export function moveImage(selection, from, to) {
  if (![from, to].every((index) => Number.isInteger(index) && index >= 0 && index < selection.order.length)) {
    throw new Error('Invalid image position');
  }
  const order = [...selection.order];
  order.splice(to, 0, order.splice(from, 1)[0]);
  return {...selection, order};
}

export function exportSelection(selection, catalog) {
  return {version: 1, catalogId: catalog.id, status: 'review', script: catalog.script,
    notes: selection.notes, selection: structuredClone(selection),
    shots: selection.order.map((imageBeatId, index) => {
      const imageBeat = catalog.beats.find((beat) => beat.id === imageBeatId);
      const option = imageBeat.options.find((item) => item.id === selection.choices[imageBeatId]);
      return {beatId: catalog.beats[index].id, commentary: catalog.beats[index].commentary,
        imageBeatId, optionId: option.id, ...option};
    })};
}
