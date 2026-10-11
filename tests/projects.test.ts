import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, mkdir, writeFile, readdir, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {reserveIteration, createProject} from '../scripts/projects.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createDraft, approveDraft} from '../desk/workflow.mjs';

test('new projects start with separate empty catalogs and never replace an existing project', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'new-project-'));
  try {
    await createProject(root, 'next-story', 'Next story');
    const directory = path.join(root, 'projects', 'next-story');
    assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'project.json'), 'utf8')), {id: 'next-story', title: 'Next story'});
    const catalog = JSON.parse(await readFile(path.join(directory, 'image-options.json'), 'utf8'));
    assert.equal(catalog.projectId, 'next-story');
    assert.deepEqual(catalog.beats, []);
    await assert.rejects(() => createProject(root, 'next-story', 'Replacement'), /EEXIST/);
    assert.equal(JSON.parse(await readFile(path.join(directory, 'project.json'), 'utf8')).title, 'Next story');
    await assert.rejects(() => createProject(root, '../escape', 'Bad path'), /project ID/);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('two projects prepare the same concept concurrently into separate numbered runs', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'parallel-production-'));
  const repo = fileURLToPath(new URL('../', import.meta.url));
  const concept = {id: 'discovery', title: 'A discovery', drafts: [{text: 'A forgotten story begins with one small discovery. The characters follow a clue and find something worth remembering long after the ending.'}], beats: ['Clue', 'Discovery', 'Ending'], sources: ['https://example.com/story']};
  try {
    for (const id of ['alpha', 'beta']) {
      await mkdir(path.join(root, 'projects', id), {recursive: true});
      await writeFile(path.join(root, 'projects', id, 'project.json'), JSON.stringify({id, title: id}));
      await writeFile(path.join(root, 'projects', id, 'brief.json'), JSON.stringify(approveDraft(createDraft(concept))));
    }
    await Promise.all(['alpha', 'beta'].map(id => promisify(execFile)(process.execPath, [path.join(repo, 'node_modules/tsx/dist/cli.mjs'), path.join(repo, 'scripts/produce.ts'), `projects/${id}/brief.json`, '--project', id, '--silent', '--symbolic', '--prepare-only'], {cwd: root})));
    for (const id of ['alpha', 'beta']) {
      const episode = JSON.parse(await readFile(path.join(root, 'projects', id, 'videos', '000001-a-discovery', 'episode.json'), 'utf8'));
      assert.equal(episode.shots[0].image, 'media/runs/000001/discovery-0.svg');
      assert.match(await readFile(path.join(root, 'projects', id, episode.shots[0].image), 'utf8'), /<svg/);
    }
    await assert.rejects(() => readFile(path.join(root, 'out', 'homunculus-discovery', 'episode.json')));
    await assert.rejects(() => promisify(execFile)(process.execPath, [path.join(repo, 'node_modules/tsx/dist/cli.mjs'), path.join(repo, 'scripts/produce.ts'), 'projects/beta/brief.json', '--project', 'alpha', '--silent', '--symbolic', '--prepare-only'], {cwd: root}), /outside.*project/i);
  } finally {await rm(root, {recursive: true, force: true});}
});

test('concurrent runs reserve increasing numbers per project without reusing deleted exports', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'project-iterations-'));
  try {
    for (const id of ['alpha', 'beta']) {
      await mkdir(path.join(root, 'projects', id), {recursive: true});
      await writeFile(path.join(root, 'projects', id, 'project.json'), JSON.stringify({id, title: id}));
    }
    const runs = await Promise.all(Array.from({length: 12}, () => reserveIteration(root, 'alpha')));
    assert.equal(path.basename(runs[0].directory), `${runs[0].id}-alpha`);
    assert.deepEqual(runs.map(run => run.id).sort(), Array.from({length: 12}, (_, i) => String(i + 1).padStart(6, '0')));
    assert.equal((await reserveIteration(root, 'beta')).id, '000001');
    await writeFile(path.join(runs[11].directory, 'video.mp4'), 'draft');
    await rm(path.join(runs[11].directory, 'video.mp4'));
    const thirteenth = await reserveIteration(root, 'alpha');
    assert.equal(thirteenth.id, '000013');
    assert.equal((await readdir(path.join(root, 'projects', 'alpha', 'videos'))).length, 13);
    await rm(thirteenth.directory, {recursive: true});
    assert.equal((await reserveIteration(root, 'alpha')).id, '000014');
    await assert.rejects(() => reserveIteration(root, '../beta'), /project ID/i);
    await assert.rejects(() => reserveIteration(root, 'missing'), /ENOENT/);
  } finally {await rm(root, {recursive: true, force: true});}
});
