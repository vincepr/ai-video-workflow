import {createProject, listProjects} from './projects.mjs';

const [command, id, ...title] = process.argv.slice(2);
if (command === 'create') {
  await createProject(process.cwd(), id, title.join(' ') || id);
  console.log(`Created projects/${id}/. Review: http://localhost:4173/projects/${id}/`);
} else if (command === 'list') {
  for (const project of await listProjects(process.cwd())) console.log(`${project.id}: ${project.title}`);
} else throw new Error('Usage: npm run project -- create <id> [title] | list');
