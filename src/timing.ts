import type {Camera, Episode} from './episode';

export const FPS = 30;
export function timeline(episode: Episode) {
  let cursor = 0;
  return episode.shots.map((shot) => {
    const frames = Math.round(shot.seconds * FPS);
    const entry = {shot, from: cursor, frames};
    cursor += frames;
    return entry;
  });
}
export function cameraAt(from: Camera, to: Camera, progress: number): Camera {
  const t = Math.max(0, Math.min(1, progress));
  return from.map((n, i) => n + (to[i] - n) * t) as Camera;
}
