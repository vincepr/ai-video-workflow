import {validateEpisode, type Episode} from './episode';
import {approvedBrief} from '../sites/creator-desk/app/workflow.mjs';

export function buildEpisode(brief: unknown, seconds: number, audio?: string, assets?: unknown): Episode {
  const draft = approvedBrief(brief);
  if (assets === undefined) throw new Error('Source images are required. Select symbolic artwork explicitly for a smoke test.');
  if (!['perception', 'car', 'observer'].includes(draft.conceptId)) throw new Error('Unknown Homunculus concept');
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 180) throw new Error('Duration must be 1 to 180 seconds');
  const words = (draft.script as string).trim().split(/\s+/);
  const captions: string[] = [];
  for (const word of words) {
    if (word.length > 120) throw new Error('A script word is too long for a caption');
    const last = captions.at(-1);
    if (last && last.length + word.length + 1 <= 120 && last.split(' ').length < 16) captions[captions.length - 1] += ' ' + word;
    else captions.push(word);
  }
  if (assets !== 'symbolic' && (!Array.isArray(assets) || assets.length !== captions.length)) {
    throw new Error(`Provide one source image per caption: ${captions.length} required`);
  }
  const episode = {title: draft.title, ...(audio ? {audio} : {}), shots: captions.map((text, i) => ({
    ...(assets === 'symbolic' ? {
      image: `media/homunculus/${draft.conceptId}-${i % 3}.svg`,
      from: [50, 35, 1], to: [50, 65, 1.08],
      source: 'Original symbolic artwork prepared by scripts/produce.ts',
      rights: 'Original geometric graphics; no manga panels or third-party footage.',
    } : (assets as Record<string, unknown>[])[i]),
    seconds: seconds * text.split(' ').length / words.length,
    text,
  }))};
  return validateEpisode(episode);
}
