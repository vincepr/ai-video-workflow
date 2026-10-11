import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {recordRender, readRenderHistory} from '../scripts/render-history.mjs';

test('render history preserves its snapshot when settings change or a video disappears', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'creator-history-'));
  try {
    await mkdir(path.join(root, 'out'));
    const output = path.join(root, 'out', 'comparison.mp4');
    await writeFile(output, 'first recording');
    const episode = {title: 'Test', shots: [{image: 'media/panel.jpg', text: 'Original script'}]};
    const pickers = {captions: 'phrase', motion: 'slow'};
    const record = await recordRender(root, {output, episode, pickers, sessionId: 'test'});
    episode.shots[0].text = 'Changed script'; pickers.captions = 'word';
    let history = await readRenderHistory(root, 'test');
    assert.equal(history[0].status, 'available');
    assert.equal(history[0].snapshot.episode.shots[0].text, 'Original script');
    assert.equal(history[0].snapshot.pickers.captions, 'phrase');
    await writeFile(output, 'replacement recording with different contents');
    history = await readRenderHistory(root, 'test');
    assert.equal(history[0].status, 'replaced');
    await rm(output);
    history = await readRenderHistory(root, 'test');
    assert.equal(history.length, 1);
    assert.equal(history[0].id, record.id);
    assert.equal(history[0].status, 'deleted');
    assert.equal(history[0].snapshot.pickers.captions, 'phrase');
  } finally {
    assert.equal(path.dirname(root), tmpdir());
    await rm(root, {recursive: true, force: true});
  }
});
