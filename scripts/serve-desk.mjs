import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const files = new Map([
  ['/', ['index.html', 'text/html']], ['/index.html', ['index.html', 'text/html']],
  ['/app.mjs', ['app.mjs', 'text/javascript']], ['/workflow.mjs', ['workflow.mjs', 'text/javascript']],
  ['/art.mjs', ['art.mjs', 'text/javascript']], ['/style.css', ['style.css', 'text/css']],
  ['/concepts.json', ['concepts.json', 'application/json']],
  ['/images.html', ['images.html', 'text/html']], ['/images.css', ['images.css', 'text/css']],
  ['/images.mjs', ['images.mjs', 'text/javascript']], ['/image-selection.mjs', ['image-selection.mjs', 'text/javascript']],
  ['/image-options.json', ['image-options.json', 'application/json']],
]);

export function createDeskServer() {
  return createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {response.writeHead(405); response.end(); return;}
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const entry = files.get(pathname) ?? (/^\/panel-options\/[a-z-]+\.jpg$/.test(pathname)
      ? [pathname.slice(1), 'image/jpeg'] : undefined);
    if (!entry) {response.writeHead(404); response.end(); return;}
    try {
      const content = await readFile(new URL(`../sites/creator-desk/app/${entry[0]}`, import.meta.url));
      response.writeHead(200, {'Content-Type': `${entry[1]}; charset=utf-8`, 'Cache-Control': 'no-store'});
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch {response.writeHead(500); response.end('Could not load the desk.');}
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.DESK_PORT ?? 4173);
  createDeskServer().listen(port, '127.0.0.1', () => console.log(`Creator Desk: http://localhost:${port}`));
}
