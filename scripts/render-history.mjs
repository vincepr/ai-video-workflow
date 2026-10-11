import {mkdir, readFile, readdir, realpath, stat, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

function historyDirectory(root, sessionId) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(sessionId)) throw new Error('Invalid session ID');
  return path.join(root, 'out', 'render-history', sessionId);
}

export async function resolveRenderPath(root, file) {
  if (typeof file !== 'string' || !/^out\/[a-zA-Z0-9_./-]+\.mp4$/.test(file) || file.split('/').includes('..')) {
    throw new Error('Render must be an MP4 under out/');
  }
  const candidate = path.resolve(root, file);
  const resolved = await realpath(candidate);
  const outputRoot = await realpath(path.join(root, 'out'));
  if (!resolved.startsWith(outputRoot + path.sep)) throw new Error('Render is outside out/');
  return resolved;
}

/** @param {string} root
 * @param {{output: string, episode: any, pickers?: object|null, sessionId: string, renderer?: object|null, label?: string}} options */
export async function recordRender(root, {output, episode, pickers = null, sessionId, renderer = null, label}) {
  const file = path.relative(root, path.resolve(output)).split(path.sep).join('/');
  const resolved = await resolveRenderPath(root, file);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new Error('Render is not a file');
  const record = {id: randomUUID(), sessionId, label: label ?? episode.title,
    createdAt: new Date().toISOString(), file,
    fingerprint: {bytes: metadata.size, modifiedAt: metadata.mtimeMs},
    snapshot: {episode: structuredClone(episode), pickers: structuredClone(pickers), renderer: structuredClone(renderer)}};
  const directory = historyDirectory(root, sessionId);
  await mkdir(directory, {recursive: true});
  await writeFile(path.join(directory, `${record.id}.json`), JSON.stringify(record, null, 2) + '\n', {flag: 'wx'});
  return record;
}

export async function readRenderHistory(root, sessionId) {
  const directory = historyDirectory(root, sessionId);
  let files;
  try {files = await readdir(directory);} catch (error) {if (error.code === 'ENOENT') return []; throw error;}
  const records = await Promise.all(files.filter((file) => /^[a-z0-9-]+\.json$/.test(file)).map(async (file) => {
    const record = JSON.parse(await readFile(path.join(directory, file), 'utf8'));
    let status;
    try {
      const metadata = await stat(await resolveRenderPath(root, record.file));
      status = metadata.size === record.fingerprint.bytes && metadata.mtimeMs === record.fingerprint.modifiedAt ? 'available' : 'replaced';
    } catch (error) {status = error.code === 'ENOENT' ? 'deleted' : 'unavailable';}
    return {...record, status, videoUrl: status === 'available' ? `/api/renders/${record.id}/video` : null};
  }));
  return records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
