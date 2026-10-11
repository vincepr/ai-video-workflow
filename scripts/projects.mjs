import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

export function projectPaths(root, id) {
  if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(id)) throw new Error('Invalid project ID');
  const directory = path.join(root, 'projects', id);
  return {directory, media: path.join(directory, 'media'), work: path.join(directory, 'work'),
    videos: path.join(directory, 'videos'), history: path.join(directory, 'work', 'history')};
}

export async function readProject(root, id) {
  const data = JSON.parse(await readFile(path.join(projectPaths(root, id).directory, 'project.json'), 'utf8'));
  if (data.id !== id || typeof data.title !== 'string' || !data.title.trim()) throw new Error('Invalid project metadata');
  return data;
}

export async function listProjects(root) {
  let entries;
  try {entries = await readdir(path.join(root, 'projects'), {withFileTypes: true});}
  catch (error) {if (error.code === 'ENOENT') return []; throw error;}
  const projects = [];
  for (const entry of entries.filter(item => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    try {projects.push(await readProject(root, entry.name));} catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
  return projects;
}

export async function sessionDirectory(root, id) {
  try {await readProject(root, id); return projectPaths(root, id).work;}
  catch (error) {if (error.code !== 'ENOENT') throw error; return path.join(root, 'out', id);}
}

export async function createProject(root, id, title) {
  const paths = projectPaths(root, id);
  if (typeof title !== 'string' || !title.trim() || title.length > 80) throw new Error('Project title must be 1 to 80 characters');
  await mkdir(path.join(root, 'projects'), {recursive: true});
  await mkdir(paths.directory);
  for (const directory of [paths.media, paths.work, paths.videos]) await mkdir(directory);
  const files = {'concepts.json': {projectId: id, topic: title, description: '', sources: [], concepts: []},
    'image-options.json': {projectId: id, id: `${id}-panels-v1`, title, script: '', note: 'Research and image choices have not been prepared yet.', beats: []},
    'project.json': {id, title}};
  for (const [file, data] of Object.entries(files)) await writeFile(path.join(paths.directory, file), JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
  return {id, title};
}

export async function reserveIteration(root, id, label) {
  const project = await readProject(root, id);
  const slug = String(label ?? project.title).normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '') || 'video';
  const {videos, work} = projectPaths(root, id);
  const reservations = path.join(work, 'iteration-ids');
  await mkdir(videos, {recursive: true});
  await mkdir(reservations, {recursive: true});
  const previous = [...await readdir(videos), ...await readdir(reservations)].filter(name => /^[0-9]{6}(?:-[a-z0-9-]+)?$/.test(name)).map(name => Number(name.slice(0, 6)));
  let number = previous.reduce((highest, value) => Math.max(highest, value), 0) + 1;
  while (number <= 999999) {
    const iteration = String(number).padStart(6, '0');
    const directory = path.join(videos, `${iteration}-${slug}`);
    try {await writeFile(path.join(reservations, iteration), '', {flag: 'wx'});}
    catch (error) {if (error.code === 'EEXIST') {number++; continue;} throw error;}
    await mkdir(directory);
    await writeFile(path.join(directory, 'run.json'), JSON.stringify({id: iteration, projectId: id, createdAt: new Date().toISOString()}, null, 2) + '\n', {flag: 'wx'});
    return {id: iteration, directory, output: path.join(directory, 'video.mp4')};
  }
  throw new Error('Project has exhausted its six-digit iteration IDs');
}
