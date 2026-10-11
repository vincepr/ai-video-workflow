import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {recordRender, readRenderHistory} from '../scripts/render-history.mjs';

test('music attribution stays with the exact video, sidecars and deleted-video history', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'creator-credits-'));
  try {
    await mkdir(path.join(root,'out'));
    const output=path.join(root,'out','music.mp4');await writeFile(output,'video');
    const attribution='Music track: Kyoto by Nebulite\nSource: https://freetouse.com/music\nNo Copyright Vlog Music for Videos';
    const episode={title:'Test',shots:[],music:{title:'Kyoto',artist:'Nebulite',attribution,license:'Free License; attribution required'}};
    const result=await recordRender(root,{output,episode,sessionId:'test'});
    assert.equal(result.release?.description,attribution);
    assert.equal((await readFile(`${output}.description.txt`,'utf8')).trim(),attribution);
    assert.equal(JSON.parse(await readFile(`${output}.release.json`,'utf8')).renderId,result.id);
    episode.music.attribution='Changed';await rm(output);
    const history=await readRenderHistory(root,'test');
    assert.equal(history[0].release.description,attribution);
    assert.equal(history[0].status,'deleted');
  } finally {assert.equal(path.dirname(root),tmpdir());await rm(root,{recursive:true,force:true});}
});

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
