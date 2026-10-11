export type Camera = [number, number, number];
export type Shot = {
  image: string;
  seconds: number;
  text: string;
  from: Camera;
  to: Camera;
  source: string;
  rights: string;
};
export type Episode = {title: string; shots: Shot[]; audio?: string};

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

export function validateEpisode(value: unknown): Episode {
  if (!value || typeof value !== 'object' || !('shots' in value) ||
      !Array.isArray(value.shots) || value.shots.length === 0) {
    throw new Error('Episode needs shots');
  }
  const episode = record(value);
  text(episode.title, 'title', 80);
  if (episode.audio !== undefined && (typeof episode.audio !== 'string' ||
      !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.(wav|mp3|m4a)$/.test(episode.audio))) {
    throw new Error('Audio must be a local audio path under public/');
  }
  for (const item of value.shots) {
    const shot = record(item);
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
