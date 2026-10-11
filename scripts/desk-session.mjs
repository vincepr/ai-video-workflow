import {createReadStream} from 'node:fs';
import {mkdir, readFile, rename, stat, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {readRenderHistory, resolveRenderPath} from './render-history.mjs';
import {sendSavedRequest} from './t3-bridge.mjs';
import {sessionDirectory} from './projects.mjs';

function json(response, status, value) {
  response.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  response.end(JSON.stringify(value));
}

export async function handleSessionRequest(request, response, {root, sessionId}) {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (!pathname.startsWith('/api/')) return false;
  if (pathname === '/api/session/send') {
    if (request.method !== 'POST') {json(response,405,{error:'Expected POST'});return true;}
    if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {json(response,403,{error:'Origin does not match the local desk'});return true;}
    if (!request.headers['content-type']?.startsWith('application/json')) {json(response,415,{error:'Expected JSON'});return true;}
    const chunks=[];let bytes=0;
    for await(const chunk of request) {bytes+=chunk.length;if(bytes>1024){json(response,413,{error:'Send request is too large'});return true;}chunks.push(chunk);}
    let body;
    try {body=JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {json(response,400,{error:'Invalid JSON'});return true;}
    if(typeof body?.requestId!=='string'){json(response,400,{error:'Missing saved request ID'});return true;}
    try {json(response,200,await sendSavedRequest(root,sessionId,body.requestId));}
    catch(error){json(response,502,{error:error.message});}
    return true;
  }
  try {
    const history = await readRenderHistory(root, sessionId);
    const work = await sessionDirectory(root, sessionId);
    const sessionPath = path.join(work, 'session.json');
    if (work === path.join(root, 'projects', sessionId, 'work')) {
      for (const record of history) if (record.videoUrl) record.videoUrl = `/projects/${sessionId}${record.videoUrl}`;
    }
    if (pathname === '/api/session') {
      if (['GET', 'HEAD'].includes(request.method)) {
        let session = null;
        try {session = JSON.parse(await readFile(sessionPath, 'utf8'));} catch (error) {if (error.code !== 'ENOENT') throw error;}
        json(response, 200, {session, history});
      } else if (request.method === 'POST') {
        if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
          json(response, 403, {error: 'Origin does not match the local desk'}); return true;
        }
        if (!request.headers['content-type']?.startsWith('application/json')) {
          json(response, 415, {error: 'Expected JSON'}); return true;
        }
        const chunks = []; let bytes = 0;
        for await (const chunk of request) {
          bytes += chunk.length;
          if (bytes > 2 * 1024 * 1024) {json(response, 413, {error: 'Session is too large'}); return true;}
          chunks.push(chunk);
        }
        let session;
        try {session = JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {json(response, 400, {error: 'Invalid JSON'}); return true;}
        if (session?.version !== 1 || session.sessionId !== sessionId || Array.isArray(session)) {
          json(response, 400, {error: 'Session ID or version does not match'}); return true;
        }
        await mkdir(path.dirname(sessionPath), {recursive: true});
        const temporary = `${sessionPath}.${randomUUID()}.tmp`;
        await writeFile(temporary, JSON.stringify(session, null, 2) + '\n');
        await rename(temporary, sessionPath);
        json(response, 200, {saved: true});
      } else json(response, 405, {error: 'Method not supported'});
      return true;
    }
    const match = /^\/api\/renders\/([a-z0-9-]+)\/video$/.exec(pathname);
    const record = match && history.find((item) => item.id === match[1] && item.status === 'available');
    if (!record) {json(response, 404, {error: 'Video is unavailable'}); return true;}
    if (!['GET', 'HEAD'].includes(request.method)) {json(response, 405, {error: 'Method not supported'}); return true;}
    const file = await resolveRenderPath(root, record.file);
    const {size} = await stat(file);
    let start = 0, end = size - 1, status = 200;
    const headers = {'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store'};
    if (request.headers.range) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      if (range && (range[1] || range[2])) {
        start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
        end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      }
      if (!range || (!range[1] && !range[2]) || start >= size || end < start) {
        response.writeHead(416, {'Content-Range': `bytes */${size}`}); response.end(); return true;
      }
      status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    }
    headers['Content-Length'] = String(end - start + 1);
    response.writeHead(status, headers);
    if (request.method === 'HEAD') response.end();
    else {
      const stream = createReadStream(file, {start, end});
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    }
  } catch {if (!response.headersSent) json(response, 500, {error: 'Could not read the local session'}); else response.destroy();}
  return true;
}
