import assert from 'node:assert/strict';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import test from 'node:test';
import {accessToken, setThumbnail, uploadPrivate} from '../scripts/youtube-upload.mjs';

test('upload sends the selected bytes privately with metadata and saves a confirmed receipt', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'youtube-upload-'));
  try {
    const file = join(directory, 'video.mp4');
    const receipt = join(directory, 'receipt.json');
    await writeFile(file, 'selected-export');
    const metadata = {title: 'Homunculus', description: 'Synopsis\nExact music credit', tags: ['manga'], categoryId: '24', defaultLanguage: 'en'};
    let calls = 0;
    const request: typeof fetch = async (input, options) => {
      calls++;
      if (calls === 1) {
        const url = new URL(String(input));
        assert.equal(url.searchParams.get('notifySubscribers'), 'false');
        assert.equal(url.searchParams.get('uploadType'), 'resumable');
        const body = JSON.parse(String(options?.body));
        assert.equal(body.status.privacyStatus, 'private');
        assert.equal(body.status.selfDeclaredMadeForKids, false);
        assert.equal(body.status.containsSyntheticMedia, true);
        assert.equal(body.status.publishAt, undefined);
        assert.deepEqual(body.snippet, metadata);
        return new Response(null, {status: 200, headers: {Location: 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test'}});
      }
      assert.equal(options?.method, 'PUT');
      const body = options?.body as unknown as AsyncIterable<Uint8Array>;
      const chunks = [];
      for await (const chunk of body) chunks.push(Buffer.from(chunk));
      assert.equal(Buffer.concat(chunks).toString(), 'selected-export');
      return Response.json({id: 'video-id', snippet: {...metadata, channelId: 'channel-id'}, status: {privacyStatus: 'private', uploadStatus: 'uploaded'}});
    };
    const result = await uploadPrivate({file, metadata, token: 'local-token', receipt, request});
    assert.ok(result, 'upload must return a confirmed receipt');
    assert.equal(result.videoId, 'video-id');
    assert.equal(result.privacyStatus, 'private');
    const saved = JSON.parse(await readFile(receipt, 'utf8'));
    assert.equal(saved.requestedStatus.containsSyntheticMedia, true);
    assert.equal(saved.channelId, 'channel-id');
    assert.equal(saved.metadata.description, metadata.description);
    assert.ok(!JSON.stringify(saved).includes('local-token'));
    assert.equal(calls, 2);
  } finally {await rm(directory, {recursive: true, force: true});}
});

test('unlisted upload requests and confirms unlisted visibility', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'youtube-unlisted-'));
  try {
    const file = join(directory, 'video.mp4');
    const receipt = join(directory, 'receipt.json');
    await writeFile(file, 'selected-export');
    let calls = 0;
    const request: typeof fetch = async (_input, options) => {
      calls++;
      if (calls === 1) {
        assert.equal(JSON.parse(String(options?.body)).status.privacyStatus, 'unlisted');
        return new Response(null, {headers: {Location: 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test'}});
      }
      return Response.json({id: 'unlisted-video', status: {privacyStatus: 'unlisted', uploadStatus: 'uploaded'}});
    };
    const result = await uploadPrivate({file, metadata: {title: 'Test'}, token: 'token', receipt, privacyStatus: 'unlisted', request});
    assert.equal(result.privacyStatus, 'unlisted');
    assert.equal(JSON.parse(await readFile(receipt, 'utf8')).requestedStatus.privacyStatus, 'unlisted');
    assert.equal(calls, 2);
  } finally {await rm(directory, {recursive: true, force: true});}
});

test('an existing attempt prevents any duplicate upload request', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'youtube-upload-'));
  try {
    const file = join(directory, 'video.mp4');
    const receipt = join(directory, 'receipt.json');
    await writeFile(file, 'selected-export');
    await writeFile(receipt, '{"state":"session-created"}');
    let called = false;
    const request: typeof fetch = async () => {called = true; return Response.json({});};
    await assert.rejects(uploadPrivate({file, metadata: {title: 'Test'}, token: 'token', receipt, request}), /existing|inspect|EEXIST/i);
    assert.equal(called, false);
  } finally {await rm(directory, {recursive: true, force: true});}
});

test('a redirect to an untrusted upload host is rejected without sending credentials', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'youtube-upload-'));
  try {
    const file = join(directory, 'video.mp4');
    const receipt = join(directory, 'receipt.json');
    await writeFile(file, 'selected-export');
    let calls = 0;
    const request: typeof fetch = async () => {calls++; return new Response(null, {headers: {Location: 'https://untrusted.example/upload'}});};
    await assert.rejects(uploadPrivate({file, metadata: {title: 'Test'}, token: 'token', receipt, request}), /host|session URL/i);
    assert.equal(calls, 1);
    assert.equal(JSON.parse(await readFile(receipt, 'utf8')).state, 'needs-inspection');
  } finally {await rm(directory, {recursive: true, force: true});}
});

test('failed transfers persist their session and do not retry', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'youtube-upload-'));
  try {
    const file = join(directory, 'video.mp4');
    const receipt = join(directory, 'receipt.json');
    await writeFile(file, 'selected-export');
    let calls = 0;
    const request: typeof fetch = async () => {
      calls++;
      if (calls === 1) return new Response(null, {headers: {Location: 'https://www.googleapis.com/upload/youtube/v3/videos?upload_id=test'}});
      return new Response('server failure', {status: 503});
    };
    await assert.rejects(uploadPrivate({file, metadata: {title: 'Test'}, token: 'token', receipt, request}), /HTTP 503/);
    assert.equal(calls, 2);
    const saved = JSON.parse(await readFile(receipt, 'utf8'));
    assert.equal(saved.state, 'needs-inspection');
    assert.ok(saved.sessionUrl);
  } finally {await rm(directory, {recursive: true, force: true});}
});

test('an expired token is refreshed without losing its refresh token', async () => {
  const request: typeof fetch = async (input, options) => {
    assert.equal(input, 'https://oauth2.googleapis.com/token');
    const body = new URLSearchParams(String(options?.body));
    assert.equal(body.get('grant_type'), 'refresh_token');
    assert.equal(body.get('refresh_token'), 'refresh');
    return Response.json({access_token: 'fresh', expires_in: 3600});
  };
  const result = await accessToken({client_id: 'client', client_secret: 'secret'},
    {access_token: 'old', refresh_token: 'refresh', expires_at: 0}, request);
  assert.ok(result, 'refresh must return a usable token');
  assert.equal(result.access_token, 'fresh');
  assert.equal(result.refresh_token, 'refresh');
  assert.ok(result.expires_at > Date.now());
});

test('the upload command requires an explicit file, metadata and receipt before accessing credentials', () => {
  assert.throws(() => execFileSync(process.execPath, ['scripts/youtube-upload.mjs'], {encoding: 'utf8', stdio: 'pipe'}),
    (error: any) => {assert.match(error.stderr, /Usage.*upload-private/); return true;});
});

test('a thumbnail update sends the selected image to the existing video without creating another upload', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'youtube-thumbnail-'));
  try {
    const file = join(directory, 'thumbnail.png');
    await writeFile(file, 'selected-thumbnail');
    let calls = 0;
    const request: typeof fetch = async (input, options) => {
      calls++;
      const url = new URL(String(input));
      assert.equal(url.pathname, '/upload/youtube/v3/thumbnails/set');
      assert.equal(url.searchParams.get('videoId'), 'existing-video');
      assert.equal(url.searchParams.get('uploadType'), 'media');
      assert.equal(options?.method, 'POST');
      assert.equal(Buffer.from(options?.body as Uint8Array).toString(), 'selected-thumbnail');
      return Response.json({kind: 'youtube#thumbnailSetResponse', items: [{high: {url: 'https://i.ytimg.com/thumbnail.jpg'}}]});
    };
    const result = await setThumbnail({videoId: 'existing-video', file, token: 'token', request});
    assert.ok(result, 'thumbnail update must return the saved thumbnail');
    assert.equal(result.items[0].high.url, 'https://i.ytimg.com/thumbnail.jpg');
    assert.equal(calls, 1);
  } finally {await rm(directory, {recursive: true, force: true});}
});
