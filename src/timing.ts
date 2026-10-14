import type {Camera, Episode} from './episode';

export const FPS = 30;
export function musicVolume(frame: number, totalFrames: number, volume: number) {
  return volume * Math.max(0, Math.min(1, frame / FPS, (totalFrames - 1 - frame) / (FPS * 2)));
}
export function timeline(episode: Episode) {
  let cursor = 0;
  return episode.shots.map((shot) => {
    const frames = 'video' in shot ? shot.endFrame - shot.startFrame : Math.round(shot.seconds * FPS);
    const entry = {shot, from: cursor, frames};
    cursor += frames;
    return entry;
  });
}
export function cameraAt(from: Camera, to: Camera, progress: number): Camera {
  const t = Math.max(0, Math.min(1, progress));
  return from.map((n, i) => n + (to[i] - n) * t) as Camera;
}
