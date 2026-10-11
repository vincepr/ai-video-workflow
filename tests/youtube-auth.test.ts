import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {callbackCode, createAuthorization, exchangeCode, startConnection} from '../scripts/youtube-auth.mjs';

test('YouTube connection requests only upload access with state and PKCE', () => {
  const flow = createAuthorization({client_id: 'desktop-client'}, 'http://127.0.0.1:4567/oauth/callback');
  assert.ok(flow, 'connection must provide an authorization flow');
  const url = new URL(flow.url);
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/youtube.upload');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:4567/oauth/callback');
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('state'), flow.state);
  assert.ok(flow.state.length >= 32);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), createHash('sha256').update(flow.verifier).digest('base64url'));
});

test('connection rejects callbacks without the matching state and never reflects secrets', () => {
  assert.throws(() => callbackCode('/oauth/callback?code=secret&state=wrong', 'expected'), /state/i);
  assert.throws(() => callbackCode('/oauth/callback?code=secret', 'expected'), /state/i);
  assert.throws(() => callbackCode('/oauth/callback?error=secret&state=expected', 'expected'), /denied/i);
  assert.equal(callbackCode('/oauth/callback?code=approved-code&state=expected', 'expected'), 'approved-code');
});

test('code exchange uses Google with PKCE and requires upload permission and a refresh token', async () => {
  const flow = createAuthorization({client_id: 'desktop-client'}, 'http://127.0.0.1:4567/oauth/callback');
  const client = {client_id: 'desktop-client', client_secret: 'local-secret'};
  const request: typeof fetch = async (input, options) => {
    assert.equal(input, 'https://oauth2.googleapis.com/token');
    assert.equal(options?.method, 'POST');
    const body = new URLSearchParams(String(options?.body));
    assert.equal(body.get('code'), 'approved-code');
    assert.equal(body.get('client_secret'), 'local-secret');
    assert.equal(body.get('code_verifier'), flow.verifier);
    assert.equal(body.get('redirect_uri'), flow.redirectUri);
    return Response.json({access_token: 'access', refresh_token: 'refresh', expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/youtube.upload'});
  };
  const token = await exchangeCode(client, flow, 'approved-code', request);
  assert.ok(token, 'code exchange must return usable tokens');
  assert.equal(token.refresh_token, 'refresh');
  const denied: typeof fetch = async () => Response.json({error_description: 'local-secret'}, {status: 400});
  await assert.rejects(exchangeCode(client, flow, 'approved-code', denied), (error: Error) => {
    assert.match(error.message, /HTTP 400/);
    assert.ok(!error.message.includes('local-secret'));
    return true;
  });
  const incomplete: typeof fetch = async () => Response.json({access_token: 'access', scope: 'wrong'});
  await assert.rejects(exchangeCode(client, flow, 'approved-code', incomplete), /permission|refresh/i);
});

test('local connection saves tokens only after an authorized callback and then closes', async () => {
  let saved: unknown = null;
  const tokenRequest: typeof fetch = async () => Response.json({access_token: 'access', refresh_token: 'refresh',
    scope: 'https://www.googleapis.com/auth/youtube.upload', expires_in: 3600});
  const connection = await startConnection({client_id: 'desktop', client_secret: 'secret'},
    async (token: unknown) => {saved = token;}, tokenRequest);
  assert.ok(connection, 'connection must start a local callback server');
  try {
    const auth = new URL(connection.url);
    const callback = new URL(auth.searchParams.get('redirect_uri')!);
    assert.equal(callback.hostname, '127.0.0.1');
    assert.equal((await fetch(callback)).status, 400);
    assert.equal(saved, null);
    callback.search = new URLSearchParams({code: 'code', state: auth.searchParams.get('state')!}).toString();
    assert.equal((await fetch(callback)).status, 200);
    await connection.completion;
    assert.ok(saved);
  } finally {
    connection.close();
  }
});

test('credential status reports local setup without starting authorization or printing secrets', () => {
  const output = execFileSync(process.execPath, ['scripts/youtube-auth.mjs', 'status'], {encoding: 'utf8'});
  assert.match(output, /YouTube client: (missing|present)/);
  assert.match(output, /YouTube token: (missing|present)/);
  assert.ok(!output.includes('accounts.google.com'));
  assert.ok(!output.includes('client_secret'));
  assert.ok(!output.includes('refresh_token'));
});

test('a tracked client file prevents credential use even if the token file is ignored', () => {
  const root = mkdtempSync(join(tmpdir(), 'youtube-auth-'));
  try {
    execFileSync('git', ['init', '--quiet', root]);
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'credentials', 'youtube'), {recursive: true});
    copyFileSync('scripts/youtube-auth.mjs', join(root, 'scripts', 'youtube-auth.mjs'));
    writeFileSync(join(root, '.gitignore'), 'credentials/\n');
    writeFileSync(join(root, 'credentials', 'youtube', 'client.json'), '{}');
    execFileSync('git', ['add', '-f', 'credentials/youtube/client.json'], {cwd: root});
    assert.throws(() => execFileSync(process.execPath, ['scripts/youtube-auth.mjs', 'status'],
      {cwd: root, encoding: 'utf8', stdio: 'pipe'}), (error: any) => {
      assert.match(error.stderr, /ignored and untracked/i);
      return true;
    });
  } finally {rmSync(root, {recursive: true, force: true});}
});
