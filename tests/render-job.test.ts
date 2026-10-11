import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {prepareRender} from '../scripts/render-job';

test('render preparation freezes project inputs, selects its media and never overwrites a video', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'project-render-'));
  const directory = path.join(root, 'projects', 'alpha');
  const episode = {title: 'A first look', shots: [{image: 'media/images/panel.svg', seconds: 1, text: 'A first look', from: [50, 50, 1], to: [50, 50, 1], source: 'Test fixture', rights: 'Test fixture'}]};
  try {
    await mkdir(path.join(directory, 'media', 'images'), {recursive: true});
    await writeFile(path.join(directory, 'project.json'), JSON.stringify({id: 'alpha', title: 'Alpha'}));
    await writeFile(path.join(directory, 'episode.json'), JSON.stringify(episode));
    await writeFile(path.join(directory, 'media', 'images', 'panel.svg'), '<svg/>');
    const job = await prepareRender(root, {projectId: 'alpha'});
    assert.equal(job.publicDirectory, directory);
    assert.equal(path.relative(directory, job.output).split(path.sep).join('/'), 'videos/000001-a-first-look/video.mp4');
    episode.shots[0].text = 'Changed';
    await writeFile(path.join(directory, 'episode.json'), JSON.stringify(episode));
    assert.equal(JSON.parse(await readFile(path.join(path.dirname(job.output), 'episode.json'), 'utf8')).shots[0].text, 'A first look');
    await writeFile(job.output, 'existing-video');
    await assert.rejects(() => prepareRender(root, {projectId: 'alpha', output: job.output}), /exists|overwrite/i);
    assert.equal(await readFile(job.output, 'utf8'), 'existing-video');
    await assert.rejects(() => prepareRender(root, {projectId: 'alpha', output: 'projects/beta/videos/000001/video.mp4'}), /project/i);
    await assert.rejects(() => prepareRender(root, {projectId: 'alpha', output: 'projects/alpha/videos/000050-unreserved/video.mp4'}), /reserved/i);
    await writeFile(path.join(directory, 'wrong-session.json'), JSON.stringify({sessionId: 'beta'}));
    await assert.rejects(() => prepareRender(root, {projectId: 'alpha', session: 'projects/alpha/wrong-session.json'}), /project/i);
    await rm(path.join(directory, 'media', 'images', 'panel.svg'));
    await assert.rejects(() => prepareRender(root, {projectId: 'alpha'}), /ENOENT/);
  } finally {await rm(root, {recursive: true, force: true});}
});
