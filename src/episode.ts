export type Camera = [number, number, number];
export type ImageShot = {
  image: string;
  seconds: number;
  text: string;
  from: Camera;
  to: Camera;
  source: string;
  rights: string;
};
export type VideoShot = {video: string; startFrame: number; endFrame: number; text: string; source: string; rights: string};
export type Shot = ImageShot | VideoShot;
export type ImageEpisode = {title: string; shots: ImageShot[]; audio?: string; music?: BackgroundMusic};
export type BackgroundMusic = {audio: string; volume: number; title: string; artist: string; source: string; license: string; attribution: string};
export type Episode = {version?: 2; title: string; shots: Shot[]; audio?: string; music?: BackgroundMusic};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected an object');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, max = 500): void {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`Invalid ${field}`);
  }
}

function camera(value: unknown): void {
  if (!Array.isArray(value) || value.length !== 3 ||
      value.some((n) => typeof n !== 'number' || !Number.isFinite(n)) ||
      value[0] < 0 || value[0] > 100 || value[1] < 0 || value[1] > 100 ||
      value[2] < 1 || value[2] > 2) {
    throw new Error('Camera must be [x: 0..100, y: 0..100, zoom: 1..2]');
  }
}

export function validateEpisode(value: ImageEpisode): ImageEpisode;
export function validateEpisode(value: unknown): Episode;
export function validateEpisode(value: unknown): Episode {
  if (!value || typeof value !== 'object' || !('shots' in value) ||
      !Array.isArray(value.shots) || value.shots.length === 0) {
    throw new Error('Episode needs shots');
  }
  const episode = record(value);
  if (episode.version !== undefined && episode.version !== 2) throw new Error('Unsupported episode version');
  text(episode.title, 'title', 80);
  if (episode.music !== undefined) {
    const music = record(episode.music);
    if (typeof music.audio !== 'string' || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(wav|mp3|m4a)$/.test(music.audio)) throw new Error('Music must be a local audio path');
    if (typeof music.volume !== 'number' || !Number.isFinite(music.volume) || music.volume < 0 || music.volume > 1) throw new Error('Music volume must be between 0 and 1');
    for (const key of ['title','artist','source','license','attribution']) text(music[key], `music ${key}`, 1500);
  }
  if (episode.audio !== undefined && (typeof episode.audio !== 'string' ||
      !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(wav|mp3|m4a)$/.test(episode.audio))) {
    throw new Error('Audio must be a local audio path under public/');
  }
  for (const item of value.shots) {
    const shot = record(item);
    if ('video' in shot) {
      if (episode.version !== 2 || 'image' in shot || typeof shot.video !== 'string' ||
          !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(mp4|mov|webm)$/.test(shot.video)) throw new Error('Video shot needs version 2 and a local video path');
      if (!Number.isInteger(shot.startFrame) || !Number.isInteger(shot.endFrame) ||
          (shot.startFrame as number) < 0 || (shot.endFrame as number) <= (shot.startFrame as number) ||
          (shot.endFrame as number) - (shot.startFrame as number) > 3600) throw new Error('Invalid video frame range');
      if (typeof shot.text !== 'string' || shot.text.length > 140) throw new Error('Invalid video text');
      text(shot.source, 'source'); text(shot.rights, 'rights');
      continue;
    }
    text(shot.image, 'image');
    if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(png|jpg|jpeg|webp|svg)$/.test(shot.image as string)) {
      throw new Error('Image must be a local path under public/');
    }
    if (typeof shot.seconds !== 'number' || !Number.isFinite(shot.seconds) ||
        shot.seconds < 0.1 || shot.seconds > 120) {
      throw new Error('Shot seconds must be between 0.1 and 120');
    }
    text(shot.text, 'text', 140);
    text(shot.source, 'source');
    text(shot.rights, 'rights');
    camera(shot.from);
    camera(shot.to);
  }
  return value as Episode;
}
