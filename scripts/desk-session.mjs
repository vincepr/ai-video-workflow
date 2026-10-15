import {createReadStream} from 'node:fs';
import {mkdir, readFile, realpath, rename, stat, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {readRenderHistory, resolveRenderPath} from './render-history.mjs';
import {sendSavedRequest} from './t3-bridge.mjs';
import {projectPaths, sessionDirectory} from './projects.mjs';
import {launchProductVideo, readLaunchStatus, cancelProductVideo} from './product-video/launcher.mjs';
import {refineProductVideo} from './product-video/refine-action.mjs';
import {agentStatus, freezeAgentRevision, latestAgentRevision, shareableAgentSummary} from './agent-video.mjs';

function json(response, status, value) {
  response.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  response.end(JSON.stringify(value));
}

export async function handleSessionRequest(request, response, {root, sessionId, productVideoTransport}) {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (!pathname.startsWith('/api/')) return false;
  if (pathname.startsWith('/api/agent-video')) {
    if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {json(response, 403, {error: 'Origin does not match the local desk'}); return true;}
    try {
      const latest = await latestAgentRevision(root, sessionId);
      if (pathname === '/api/agent-video' && request.method === 'GET') {
        const status = latest ? await agentStatus(root, sessionId, latest.revisionId) : null;
        json(response, 200, {status, shareable: status ? shareableAgentSummary(status) : null}); return true;
      }
      if (pathname === '/api/agent-video/asset' && request.method === 'GET') {
        const name = new URL(request.url, 'http://localhost').searchParams.get('path');
        const status = latest ? await agentStatus(root, sessionId, latest.revisionId) : null;
        const allowed = new Set([...(status?.revision.references.map(ref => ref.path) ?? []), ...(status?.attempts.flatMap(attempt => attempt.outputs.map(output => output.path)) ?? []),
          ...(status?.pending.map(item => item.preview) ?? [])]);
        if (!allowed.has(name)) {json(response, 404, {error: 'Asset is not in this revision'}); return true;}
        const media = await realpath(projectPaths(root, sessionId).media);
        const actual = await realpath(path.resolve(root, name));
        if (!actual.startsWith(media + path.sep)) throw new Error('Asset leaves project media');
        const kind = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'}[path.extname(actual).toLowerCase()];
        if (!kind) throw new Error('Unsupported preview type');
        response.writeHead(200, {'Content-Type': kind, 'Cache-Control': 'no-store'});
        const stream = createReadStream(actual);
        stream.on('error', () => response.destroy());
        response.on('close', () => stream.destroy());
        stream.pipe(response); return true;
      }
      if (pathname === '/api/agent-video/edit' && request.method === 'POST') {
        if (!latest) throw new Error('No agent revision exists for this project');
        if (!request.headers['content-type']?.startsWith('application/json')) {json(response, 415, {error: 'Expected JSON'}); return true;}
        const chunks = []; let bytes = 0;
        for await (const chunk of request) {bytes += chunk.length; if (bytes > 64 * 1024) throw new Error('Edit is too large'); chunks.push(chunk);}
        const edit = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!edit || typeof edit !== 'object' || Object.keys(edit).some(key => !['captions', 'outputFormat'].includes(key)) ||
            !['9:16', '16:9', '1:1'].includes(edit.outputFormat ?? latest.outputFormat) ||
            (edit.captions && (typeof edit.captions !== 'object' || Array.isArray(edit.captions) || Object.values(edit.captions).some(value => typeof value !== 'string' || value.length > 200)))) throw new Error('Invalid direct edit');
        const shots = latest.plan.shots.map(shot => ({...shot, caption: edit.captions?.[shot.id] ?? shot.caption}));
        if (Object.keys(edit.captions ?? {}).some(id => !shots.some(shot => shot.id === id))) throw new Error('Unknown shot');
        const revision = await freezeAgentRevision(root, {...latest, revisionId: randomUUID(), parentId: latest.revisionId,
          change: 'Direct page edit', outputFormat: edit.outputFormat ?? latest.outputFormat,
          references: latest.references.map(ref => ref.path), plan: {...latest.plan, shots}});
        json(response, 200, {revisionId: revision.revisionId}); return true;
      }
      if (pathname === '/api/agent-video/upload' && request.method === 'POST') {
        const extension = new URL(request.url, 'http://localhost').searchParams.get('ext');
        if (!['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.wav', '.mp3'].includes(extension)) throw new Error('Unsupported upload type');
        const media = path.join(root, 'projects', sessionId, 'media', 'uploads');
        await mkdir(media, {recursive: true});
        const name = `${randomUUID()}${extension}`;
        const file = path.join(media, name);
        const chunks = []; let bytes = 0;
        for await (const chunk of request) {bytes += chunk.length; if (bytes > 100 * 1024 * 1024) throw new Error('Upload exceeds 100 MB'); chunks.push(chunk);}
        if (!bytes) throw new Error('Upload is empty');
        await writeFile(file, Buffer.concat(chunks), {flag: 'wx'});
        json(response, 200, {path: `projects/${sessionId}/media/uploads/${name}`}); return true;
      }
      json(response, 405, {error: 'Agent video endpoint does not support this method'}); return true;
    } catch (error) {json(response, 400, {error: error.message}); return true;}
  }
  if (pathname.startsWith('/api/product-video/')) {
    const catalogPath = path.join(root, '.agents/skills/generate-product-video/references/configuration/catalog.json');
    if (pathname === '/api/product-video/catalog' && request.method === 'GET') {
      try {
        const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
        const compact = entry => entry?.label ? {label: entry.label, needsPresenter: entry.needsPresenter ?? false, requiredInputs: entry.requiredInputs ?? []}
          : Object.fromEntries(Object.entries(entry ?? {}).map(([id, child]) => [id, compact(child)]));
        const metadata = Object.fromEntries(Object.entries(catalog.metadata ?? {}).map(([group, entries]) => [group, compact(entries)]));
        json(response, 200, {version: catalog.version, choices: catalog.choices, metadata, destinations: Object.keys(catalog.files.destinations), runtime: {freshSessionAvailable: typeof productVideoTransport?.createFreshSession === 'function'}});
      } catch {json(response, 500, {error: 'Could not read product video catalog'});}
      return true;
    }
    if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {json(response, 403, {error: 'Origin does not match the local desk'}); return true;}
    if (pathname === '/api/product-video/status' && request.method === 'GET') {
      const id = new URL(request.url, 'http://localhost').searchParams.get('requestId');
      try {json(response, 200, await readLaunchStatus(root, sessionId, id));}
      catch {json(response, 404, {error: 'Product video request not found'});}
      return true;
    }
    if (['/api/product-video/generate', '/api/product-video/cancel', '/api/product-video/refine'].includes(pathname) && request.method === 'POST') {
      if (!request.headers['content-type']?.startsWith('application/json')) {json(response, 415, {error: 'Expected JSON'}); return true;}
      const chunks = []; let bytes = 0;
      for await (const chunk of request) {bytes += chunk.length; if (bytes > 1024) {json(response, 413, {error: 'Request is too large'}); return true;} chunks.push(chunk);}
      let body;
      try {body = JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {json(response, 400, {error: 'Invalid JSON'}); return true;}
      if (typeof body?.requestId !== 'string') {json(response, 400, {error: 'Missing request ID'}); return true;}
      try {
        if (pathname.endsWith('/cancel')) {json(response, 200, await cancelProductVideo(root, sessionId, body.requestId)); return true;}
        if (pathname.endsWith('/refine') && (typeof body.refinementId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.refinementId))) {
          json(response, 400, {error: 'Invalid refinement ID'}); return true;
        }
        const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
        const work = await sessionDirectory(root, sessionId);
        const session = JSON.parse(await readFile(path.join(work, 'session.json'), 'utf8'));
        if (session.sessionId !== sessionId || !session.productVideo) throw new Error('No saved product video configuration for this project');
        const draft = {...session.productVideo, id: body.requestId, projectId: sessionId};
        if (pathname.endsWith('/refine')) {
          if (!path.isAbsolute(process.env.FFMPEG_PATH ?? '') || !path.isAbsolute(process.env.FFPROBE_PATH ?? '')) {
            json(response, 409, {error: 'Local finishing requires absolute FFMPEG_PATH and FFPROBE_PATH for full FFmpeg'}); return true;
          }
          try {
            const result = await refineProductVideo({root, projectId: sessionId, requestId: body.requestId,
              refinementId: body.refinementId, draft, catalog, ffmpeg: process.env.FFMPEG_PATH, ffprobe: process.env.FFPROBE_PATH});
            json(response, 200, result);
          } catch (error) {json(response, 409, {error: error.message});}
          return true;
        }
        const selected = draft.workflow === 'direct' ? catalog.metadata?.formats?.[draft.choices?.format]
          : catalog.metadata?.styles?.[draft.workflow]?.[draft.choices?.style];
        for (const role of selected?.requiredInputs ?? []) if (!draft.references?.some(ref => ref.role === role)) throw new Error(`Missing ${role} reference for this choice`);
        json(response, 200, await launchProductVideo(root, draft, {catalog, transport: productVideoTransport}));
      } catch (error) {json(response, 400, {error: error.message});}
      return true;
    }
    json(response, 405, {error: 'Product video endpoint does not support this method'}); return true;
  }
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
