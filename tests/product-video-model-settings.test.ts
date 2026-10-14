import assert from 'node:assert/strict';
import test from 'node:test';
import {imagePresets, videoPresets, parseModelSettings, modelSettingsFromExecution, applyModelPreset, applyModelSettings, imageResolutionFor} from '../desk/model-settings.mjs';

const custom = {version: 1, image: {model: 'example/custom-image', resolution: '2K'},
  video: {model: 'example/custom-video', resolution: '720p', durationSec: 6}, aspectRatio: '9:16', audio: false};

test('guided image and video presets have separate model choices and controls', () => {
  assert.ok(imagePresets.some(preset => preset.model === 'bytedance-seed/seedream-5-0-pro' && preset.resolutions.includes('1K')));
  assert.ok(videoPresets.some(preset => preset.model === 'alibaba/wan-3.0' && preset.resolutions.includes('480p') && preset.durations.includes(8)));
});

test('custom JSON round trips standard controls for a browser or agent', () => {
  assert.deepEqual(parseModelSettings(JSON.stringify(custom)), custom);
  assert.deepEqual(modelSettingsFromExecution({models: {image: custom.image.model, video: custom.video.model},
    imageResolution: '2K', resolution: '720p', durationSec: 6, aspectRatio: '9:16', audio: false}), custom);
});

test('custom JSON rejects unknown fields and invalid controls rather than silently ignoring them', () => {
  assert.throws(() => parseModelSettings(JSON.stringify({...custom, image: {...custom.image, effort: 'high'}})), /Unknown.*effort/);
  assert.throws(() => parseModelSettings(JSON.stringify({...custom, video: {...custom.video, durationSec: 0}})), /duration/i);
});

test('choosing a model preset updates its model and safe starting controls', () => {
  const execution = {models: {image: 'example/image', video: 'example/video'}, imageResolution: '4K',
    resolution: '1080p', durationSec: 30, aspectRatio: '9:16', audio: false, budget: {currency: 'USD', maxUsd: 1}};
  const image = applyModelPreset(execution, 'image', 'bytedance-seed/seedream-5-0-pro');
  assert.equal(image.models.image, 'bytedance-seed/seedream-5-0-pro');
  assert.equal(image.imageResolution, '1K');
  const video = applyModelPreset(image, 'video', 'alibaba/wan-3.0');
  assert.equal(video.models.video, 'alibaba/wan-3.0');
  assert.equal(video.resolution, '480p');
  assert.equal(video.durationSec, 8);
  assert.deepEqual(video.budget, execution.budget);
});

test('applying JSON changes only model controls and keeps the project spending cap', () => {
  const before = {provider: 'openrouter', models: {image: 'old/image', video: 'old/video'},
    imageResolution: '1K', resolution: '480p', durationSec: 8, aspectRatio: '1:1', audio: true,
    budget: {currency: 'USD', maxUsd: 0.75}};
  const after = applyModelSettings(before, custom);
  assert.deepEqual(modelSettingsFromExecution(after), custom);
  assert.deepEqual(after.budget, before.budget);
  assert.equal(after.provider, 'openrouter');
});

test('an older saved draft keeps its shared resolution when reopened', () => {
  assert.equal(imageResolutionFor({resolution: '720p'}, imagePresets[0]), '720p');
  assert.equal(imageResolutionFor({}, imagePresets[0]), '1K');
});
