import assert from 'node:assert/strict';
import test from 'node:test';
import {forbiddenTrackedFiles} from '../scripts/repository-files.mjs';

test('tracked-file checks allow project settings and approved branding but reject local state and media', () => {
  const allowed = ['src/Video.tsx', 'desk/session.mjs', 'projects/alpha/episode.json', 'projects/beta/research.json', 'public/sample/panel.svg', '.env.example', 'hiddenpicks-profile.png', 'hiddenpicks-banner.png'];
  const forbidden = ['.env', 'credentials/t3/alpha.json', 'media/music/song.attribution.json', 'projects/alpha/media/images/panel.svg', 'projects/alpha/work/session.json', 'projects/beta/videos/000001-test/episode.json', 'out/test.json', 'somewhere/clip.mp4', 'another-banner.png'];
  assert.deepEqual(forbiddenTrackedFiles([...allowed, ...forbidden]), forbidden);
});
