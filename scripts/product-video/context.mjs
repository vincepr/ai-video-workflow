import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const skillPrefix = '.agents/skills/generate-product-video/';
function relativeFile(file, prefix) {
  if (typeof file !== 'string' || !file.startsWith(prefix) || file.includes('\\') || file.split('/').some(part => part === '..' || part === '.' || !part)) throw new Error(`Invalid context path: ${file}`);
  return file;
}
async function hashEntry(root, file, role) {
  const absolute = path.resolve(root, file);
  const actual = await realpath(absolute);
  const expectedRoot = await realpath(path.resolve(root, file.startsWith('projects/') ? `projects/${file.split('/')[1]}` : skillPrefix));
  const within = path.relative(expectedRoot, actual);
  if (within.startsWith('..') || path.isAbsolute(within)) throw new Error(`Context path leaves allowed directory: ${file}`);
  const sha256 = createHash('sha256').update(await readFile(actual)).digest('hex');
  return {role, path: file, sha256};
}

export async function resolveContext(root, request, catalog) {
  if (request.schemaVersion !== 1 || catalog.version !== 1) throw new Error('Unsupported request or catalog version');
  const selected = [
    ['router', catalog.files.router], ['common', catalog.files.common],
    ['workflow', catalog.files.workflows?.[request.workflow]],
  ];
  const {format, hook, setting, style} = request.choices;
  if (format) selected.push(['format', catalog.files.formats?.[format]]);
  if (hook && hook !== 'none') selected.push(['hook', catalog.files.hooks?.[hook]]);
  if (setting && setting !== 'auto') selected.push(['setting', catalog.files.settings?.[setting]]);
  if (style) selected.push(['style', catalog.files.styles?.[request.workflow]?.[style]]);
  selected.push(['destination', catalog.files.destinations?.[request.destination]]);
  for (const [, file] of selected) relativeFile(file, skillPrefix);
  for (const ref of request.references) selected.push([`reference:${ref.role}`, relativeFile(ref.path, `projects/${request.projectId}/media/`)]);
  selected.push(['project', `projects/${request.projectId}/project.json`]);
  const files = [];
  for (const [role, file] of selected) files.push(await hashEntry(root, file, role));
  return {schemaVersion: 1, requestId: request.id, projectId: request.projectId, catalogVersion: catalog.version, files};
}
