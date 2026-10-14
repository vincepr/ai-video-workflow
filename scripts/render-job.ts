import {readFile, writeFile, mkdir, access, realpath} from 'node:fs/promises';
import path from 'node:path';
import {validateEpisode} from '../src/episode';
import {projectPaths, readProject, reserveIteration} from './projects.mjs';

export async function prepareRender(root: string, options: {projectId?: string; input?: string; output?: string; session?: string}) {
  const project = options.projectId;
  if (project) await readProject(root, project);
  const publicDirectory = project ? projectPaths(root, project).directory : path.join(root, 'public');
  const input = path.resolve(root, options.input ?? (project ? `projects/${project}/episode.json` : 'episodes/sample.json'));
  if (project && !input.startsWith(publicDirectory + path.sep)) throw new Error('Episode is outside this project');
  const episode = validateEpisode(JSON.parse(await readFile(input, 'utf8')));
  const pickers = options.session ? JSON.parse(await readFile(path.resolve(root, options.session), 'utf8')) : null;
  if (project && pickers && pickers.sessionId !== project) throw new Error('Review session belongs to a different project');
  const mediaRoot = await realpath(project ? projectPaths(root, project).media : publicDirectory);
  for (const asset of [...episode.shots.map(shot => 'video' in shot ? shot.video : shot.image), episode.audio, episode.music?.audio].filter(Boolean) as string[]) {
    const resolved = await realpath(path.join(publicDirectory, asset));
    if (!resolved.startsWith(mediaRoot + path.sep)) throw new Error('Asset is outside project media');
    await access(resolved);
  }
  let output = options.output ? path.resolve(root, options.output) : undefined;
  if (project && output) {
    const relative = path.relative(projectPaths(root, project).videos, output).split(path.sep).join('/');
    if (!/^[0-9]{6}(?:-[a-z0-9-]+)?\/video\.mp4$/.test(relative)) throw new Error('Output is outside this project\'s numbered videos');
    try {
      const run = JSON.parse(await readFile(path.join(path.dirname(output), 'run.json'), 'utf8'));
      if (run.projectId !== project || run.id !== relative.slice(0, 6)) throw new Error('Invalid reservation');
      await access(path.join(projectPaths(root, project).work, 'iteration-ids', run.id));
    } catch {throw new Error('Output must belong to a reserved project iteration');}
  }
  if (!output) output = project ? (await reserveIteration(root, project, episode.title)).output : path.join(root, 'out', 'sample.mp4');
  try {await access(output); throw new Error('Video already exists; reserve a new iteration instead of overwriting it');}
  catch (error) {if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;}
  await mkdir(path.dirname(output), {recursive: true});
  const propsFile = `${output}.props.json`;
  await writeFile(propsFile, JSON.stringify({episode}, null, 2) + '\n', {flag: 'wx'});
  if (project && path.resolve(input) !== path.join(path.dirname(output), 'episode.json')) {
    await writeFile(path.join(path.dirname(output), 'episode.json'), JSON.stringify(episode, null, 2) + '\n', {flag: 'wx'});
  }
  if (pickers) await writeFile(`${output}.session.json`, JSON.stringify(pickers, null, 2) + '\n', {flag: 'wx'});
  return {episode, pickers, output, propsFile, publicDirectory};
}
