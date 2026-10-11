import {mkdir, readFile, readdir, realpath, stat, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {projectPaths, readProject} from './projects.mjs';

async function historyDirectory(root, sessionId) {
  const paths = projectPaths(root, sessionId);
  try {await readProject(root, sessionId); return paths.history;}
  catch (error) {if (error.code !== 'ENOENT') throw error; return path.join(root, 'out', 'render-history', sessionId);}
}

export async function resolveRenderPath(root, file) {
  const project = typeof file === 'string' && /^projects\/([a-z0-9][a-z0-9-]{0,79})\/videos\/([0-9]{6})(?:-[a-z0-9-]+)?\/video\.mp4$/.exec(file);
  if (typeof file !== 'string' || (!project && !/^out\/[a-zA-Z0-9_./-]+\.mp4$/.test(file)) || file.split('/').includes('..')) {
    throw new Error('Render must be a numbered project video or an MP4 under out/');
  }
  const candidate = path.resolve(root, file);
  const resolved = await realpath(candidate);
  const outputRoot = await realpath(project ? projectPaths(root, project[1]).videos : path.join(root, 'out'));
  if (!resolved.startsWith(outputRoot + path.sep)) throw new Error('Render is outside its output directory');
  return resolved;
}

/** @param {string} root
 * @param {{output: string, episode: any, pickers?: object|null, sessionId: string, renderer?: object|null, label?: string}} options */
export async function recordRender(root, {output, episode, pickers = null, sessionId, renderer = null, label}) {
  const file = path.relative(root, path.resolve(output)).split(path.sep).join('/');
  const project = /^projects\/([^/]+)\/videos\/([0-9]{6})(?:-[a-z0-9-]+)?\/video\.mp4$/.exec(file);
  if (project && project[1] !== sessionId) throw new Error('Render belongs to a different project');
  if (project) await readProject(root, sessionId);
  const resolved = await resolveRenderPath(root, file);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error('Render is not a file');
  const release = episode.music ? {description: episode.music.attribution, music: structuredClone(episode.music)} : null;
  const record = {id: randomUUID(), sessionId, label: label ?? episode.title,
    ...(project ? {iteration: project[2]} : {}),
    release,
    createdAt: new Date().toISOString(), file,
    fingerprint: {bytes: metadata.size, modifiedAt: metadata.mtimeMs},
    snapshot: {episode: structuredClone(episode), pickers: structuredClone(pickers), renderer: structuredClone(renderer)}};
  if (release) {
    await writeFile(`${resolved}.description.txt`, release.description + '\n');
    await writeFile(`${resolved}.release.json`, JSON.stringify({renderId: record.id, file, ...release},null,2) + '\n');
  }
  const directory = await historyDirectory(root, sessionId);
  await mkdir(directory, {recursive: true});
  await writeFile(path.join(directory, `${record.id}.json`), JSON.stringify(record, null, 2) + '\n', {flag: 'wx'});
  return record;
}

export async function readRenderHistory(root, sessionId) {
  const directory = await historyDirectory(root, sessionId);
  let files;
  try {files = await readdir(directory);} catch (error) {if (error.code === 'ENOENT') return []; throw error;}
  const records = await Promise.all(files.filter((file) => /^[a-z0-9-]+\.json$/.test(file)).map(async (file) => {
    const record = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
    if (record.sessionId !== sessionId || (record.file.startsWith('projects/') && !record.file.startsWith(`projects/${sessionId}/videos/`))) throw new Error('History belongs to a different project');
    let status;
    try {
      const metadata = await stat(await resolveRenderPath(root, record.file));
      status = metadata.size === record.fingerprint.bytes && metadata.mtimeMs === record.fingerprint.modifiedAt ? 'available' : 'replaced';
    } catch (error) {status = error.code === 'ENOENT' ? 'deleted' : 'unavailable';}
    return {...record, status, videoUrl: status === 'available' ? `/api/renders/${record.id}/video` : null};
  }));
  return records.sort((a, b) => (b.iteration ?? '').localeCompare(a.iteration ?? '') || b.createdAt.localeCompare(a.createdAt));
}
