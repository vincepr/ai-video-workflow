import {createServer} from 'node:http';
import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {handleSessionRequest} from './desk-session.mjs';
import {createCodexProductVideoTransport} from './product-video/codex-transport.mjs';
import {listProjects, readProject, projectPaths} from './projects.mjs';

const files = new Map([
  ['/', ['session.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/app.mjs', ['app.mjs', 'text/javascript']], ['/workflow.mjs', ['workflow.mjs', 'text/javascript']],
  ['/art.mjs', ['art.mjs', 'text/javascript']], ['/style.css', ['style.css', 'text/css']],
  ['/concepts.json', ['concepts.json', 'application/json']],
  ['/images.html', ['images.html', 'text/html']], ['/images.css', ['images.css', 'text/css']],
  ['/images.mjs', ['images.mjs', 'text/javascript']], ['/image-selection.mjs', ['image-selection.mjs', 'text/javascript']],
  ['/image-options.json', ['image-options.json', 'application/json']],
  ['/session.html', ['session.html', 'text/html']], ['/session.css', ['session.css', 'text/css']],
  ['/session.mjs', ['session.mjs', 'text/javascript']], ['/review-session.mjs', ['review-session.mjs', 'text/javascript']],
  ['/model-settings.mjs', ['model-settings.mjs', 'text/javascript']],
  ['/session-history.json', ['session-history.json', 'application/json']],
]);

/** @param {{root?: string, sessionId?: string, productVideoTransport?: {createFreshSession: (seed: any) => Promise<{sessionId: string, executionId: string}>}}} options */
export function createDeskServer({root = fileURLToPath(new URL('../', import.meta.url)), sessionId = 'sample', productVideoTransport} = {}) {
  productVideoTransport ??= createCodexProductVideoTransport(root);
  return createServer(async (request, response) => {
    let pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/api/projects' && request.method === 'GET') {
      try {response.writeHead(200, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); response.end(JSON.stringify({projects: await listProjects(root)}));}
      catch {response.writeHead(500); response.end();}
      return;
    }
    const projectRoute = /^\/projects\/([a-z0-9][a-z0-9-]{0,79})(\/.*)?$/.exec(pathname);
    let activeProject;
    if (projectRoute) {
      try {activeProject = await readProject(root, projectRoute[1]);}
      catch {response.writeHead(404); response.end('Project not found'); return;}
      if (!projectRoute[2]) {response.writeHead(302, {Location: `${pathname}/`}); response.end(); return;}
      pathname = projectRoute[2];
      request.url = pathname + new URL(request.url, 'http://localhost').search;
    } else if (['/', '/session.html', '/images.html', '/index.html'].includes(pathname) && ['GET', 'HEAD'].includes(request.method)) {
      const projects = await listProjects(root);
      if (projects.length) {response.writeHead(302, {Location: `/projects/${projects.find(item => item.id === sessionId)?.id ?? projects[0].id}${pathname}`}); response.end(); return;}
    }
    let requestSession = activeProject?.id ?? sessionId;
    if (!activeProject && pathname.startsWith('/api/')) {
      const projects = await listProjects(root);
      requestSession = projects.find(item => item.id === sessionId)?.id ?? projects[0]?.id ?? sessionId;
    }
    if (await handleSessionRequest(request, response, {root, sessionId: requestSession, productVideoTransport})) return;
    if (!['GET', 'HEAD'].includes(request.method)) {response.writeHead(405); response.end(); return;}
    const entry = files.get(pathname) ?? (/^\/panel-options\/[a-z-]+\.jpg$/.test(pathname)
      ? [pathname.slice(1), 'image/jpeg'] : undefined);
    if (!entry) {response.writeHead(404); response.end(); return;}
    try {
      const projectFile = activeProject && ['concepts.json', 'image-options.json'].includes(entry[0]);
      let location = projectFile ? path.join(projectPaths(root, activeProject.id).directory, entry[0])
        : new URL(`../desk/${entry[0]}`, import.meta.url);
      if (activeProject && pathname.startsWith('/panel-options/')) {
        const mediaRoot = await realpath(projectPaths(root, activeProject.id).media);
        location = await realpath(path.join(mediaRoot, 'previews', pathname.split('/').at(-1)));
        if (!location.startsWith(mediaRoot + path.sep)) throw new Error('Preview is outside project media');
      }
      const content = await readFile(location);
      response.writeHead(200, {'Content-Type': `${entry[1]}; charset=utf-8`, 'Cache-Control': 'no-store'});
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch (error) {response.writeHead(error.code === 'ENOENT' ? 404 : 500); response.end('Could not load the desk.');}
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.DESK_PORT ?? 4173);
  createDeskServer().listen(port, '127.0.0.1', () => console.log(`Creator Desk: http://localhost:${port}`));
}
