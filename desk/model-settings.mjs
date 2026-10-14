// Suggestions for the local desk. Provider discovery remains authoritative before a paid run.
const ratios = ['9:16', '16:9', '1:1', '4:3', '3:4'];
const durations = [4, 5, 6, 8, 10, 12, 15, 20, 30];

export const imagePresets = [
  {label: 'Seedream 5 Pro · product detail', model: 'bytedance-seed/seedream-5-0-pro',
    resolutions: ['1K', '2K'], ratios, defaultResolution: '1K',
    source: 'https://openrouter.ai/bytedance-seed/seedream-5-0-pro'},
  {label: 'Seedream 4.5 · flexible resolution', model: 'bytedance-seed/seedream-4.5',
    resolutions: ['1K', '2K', '4K'], ratios, defaultResolution: '1K',
    source: 'https://openrouter.ai/bytedance-seed/seedream-4.5'},
];

export const videoPresets = [
  {label: 'Wan 3.0 · standard', model: 'alibaba/wan-3.0',
    resolutions: ['480p', '720p', '1080p'], ratios, durations, defaultResolution: '480p', defaultDurationSec: 8,
    source: 'https://openrouter.ai/alibaba/wan-3.0'},
  {label: 'Wan 3.0 Prime · alternate', model: 'alibaba/wan-3.0-prime',
    resolutions: ['480p', '720p', '1080p'], ratios, durations, defaultResolution: '480p', defaultDurationSec: 8,
    source: 'https://openrouter.ai/alibaba/wan-3.0-prime'},
];

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value;
}
function keys(value, allowed, name) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown ${name} field: ${key}`);
}
function string(value, name, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`Invalid ${name}`);
  return value;
}

export function parseModelSettings(text) {
  let value;
  try {value = JSON.parse(text);} catch {throw new Error('Model settings must be valid JSON');}
  object(value, 'Model settings');
  keys(value, ['version', 'image', 'video', 'aspectRatio', 'audio'], 'model settings');
  if (value.version !== 1) throw new Error('Unsupported model settings version');
  object(value.image, 'Image settings'); object(value.video, 'Video settings');
  keys(value.image, ['model', 'resolution'], 'image');
  keys(value.video, ['model', 'resolution', 'durationSec'], 'video');
  const model = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._:-]*$/i;
  const resolution = /^[a-z0-9-]{1,20}$/i;
  const result = {version: 1,
    image: {model: string(value.image.model, 'image model', model), resolution: string(value.image.resolution, 'image resolution', resolution)},
    video: {model: string(value.video.model, 'video model', model), resolution: string(value.video.resolution, 'video resolution', resolution), durationSec: value.video.durationSec},
    aspectRatio: string(value.aspectRatio, 'aspect ratio', /^[1-9]\d?:[1-9]\d?$/), audio: value.audio};
  if (!Number.isInteger(result.video.durationSec) || result.video.durationSec < 1 || result.video.durationSec > 60) throw new Error('Invalid video duration');
  if (typeof result.audio !== 'boolean') throw new Error('Invalid audio setting');
  return result;
}

export function modelSettingsFromExecution(execution) {
  return {version: 1,
    image: {model: execution.models.image, resolution: execution.imageResolution ?? execution.resolution},
    video: {model: execution.models.video, resolution: execution.resolution, durationSec: execution.durationSec},
    aspectRatio: execution.aspectRatio, audio: Boolean(execution.audio)};
}

export function applyModelPreset(execution, stage, model) {
  const preset = (stage === 'image' ? imagePresets : stage === 'video' ? videoPresets : []).find(item => item.model === model);
  if (!preset) throw new Error(`Unknown ${stage} preset`);
  const next = {...execution, models: {...execution.models, [stage]: model}};
  if (stage === 'image') next.imageResolution = preset.defaultResolution;
  else {next.resolution = preset.defaultResolution; next.durationSec = preset.defaultDurationSec;}
  if (!preset.ratios.includes(execution.aspectRatio)) next.aspectRatio = '9:16';
  return next;
}

export function applyModelSettings(execution, config) {
  return {...execution, models: {image: config.image.model, video: config.video.model},
    imageResolution: config.image.resolution, resolution: config.video.resolution,
    durationSec: config.video.durationSec, aspectRatio: config.aspectRatio, audio: config.audio};
}

export function imageResolutionFor(execution, preset) {
  return execution?.imageResolution ?? execution?.resolution ?? preset?.defaultResolution ?? '1K';
}
