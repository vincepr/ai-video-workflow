import {createHash, randomBytes} from 'node:crypto';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {join, resolve as resolvePath} from 'node:path';
import {fileURLToPath} from 'node:url';

export const uploadScope = 'https://www.googleapis.com/auth/youtube.upload';

export function createAuthorization(client, redirectUri) {
  const verifier = randomBytes(32).toString('base64url');
  const state = randomBytes(32).toString('base64url');
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({client_id: client.client_id, redirect_uri: redirectUri,
    response_type: 'code', scope: uploadScope, access_type: 'offline', prompt: 'consent',
    state, code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256'}).toString();
  return {url: url.toString(), state, verifier, redirectUri};
}

export function callbackCode(requestUrl, state) {
  const url = new URL(requestUrl, 'http://127.0.0.1');
  if (url.searchParams.get('state') !== state) throw new Error('OAuth state did not match.');
  if (url.searchParams.has('error')) throw new Error('Google authorization was denied.');
  const code = url.searchParams.get('code');
  if (!code) throw new Error('Google did not return an authorization code.');
  return code;
}

export async function exchangeCode(client, flow, code, request = fetch) {
  const response = await request('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({client_id: client.client_id, client_secret: client.client_secret,
      code, code_verifier: flow.verifier, redirect_uri: flow.redirectUri, grant_type: 'authorization_code'}),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Google token exchange failed (HTTP ${response.status}).`);
  const token = await response.json();
  if (!token.access_token || !token.refresh_token || !token.scope?.split(' ').includes(uploadScope)) {
    throw new Error('Google did not grant upload permission with a refresh token. Reconnect.');
  }
  return {...token, expires_at: Date.now() + Number(token.expires_in) * 1000};
}

export async function startConnection(client, saveToken, request = fetch) {
  let resolve;
  let reject;
  const completion = new Promise((yes, no) => {resolve = yes; reject = no;});
  // The caller can attach its handler after receiving the authorization URL.
  completion.catch(() => {});
  let flow;
  let busy = false;
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET' || new URL(req.url, 'http://127.0.0.1').pathname !== '/oauth/callback') {
      res.writeHead(404).end('Not found.');
      return;
    }
    let code;
    try {code = callbackCode(req.url, flow.state);} catch {
      res.writeHead(400).end('Authorization callback was rejected. Restart connection if needed.');
      return;
    }
    if (busy) {res.writeHead(409).end('Connection is already being completed.'); return;}
    busy = true;
    clearTimeout(timer);
    try {
      await saveToken(await exchangeCode(client, flow, code, request));
      res.end('YouTube connected. No video was uploaded. You can close this tab.');
      resolve();
    } catch {
      res.writeHead(502).end('YouTube connection failed. No video was uploaded.');
      reject(new Error('YouTube connection failed. Check API configuration and reconnect.'));
    } finally {server.close();}
  });
  await new Promise((yes, no) => {server.once('error', no); server.listen(0, '127.0.0.1', yes);});
  flow = createAuthorization(client, `http://127.0.0.1:${server.address().port}/oauth/callback`);
  const timer = setTimeout(() => {
    server.close();
    reject(new Error('YouTube sign-in timed out after five minutes. Reconnect when ready.'));
  }, 300_000);
  return {url: flow.url, completion, close() {
    clearTimeout(timer);
    server.close();
    reject(new Error('YouTube connection closed.'));
  }};
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const directory = join(root, 'credentials', 'youtube');
  const clientPath = join(directory, 'client.json');
  const tokenPath = join(directory, 'token.json');
  try {
    for (const path of [clientPath, tokenPath]) {
      execFileSync('git', ['check-ignore', path], {cwd: root, stdio: 'ignore'});
    }
  } catch {throw new Error('YouTube credentials must be ignored and untracked in Git.');}
  const command = process.argv[2];
  if (command === 'status') {
    console.log(`YouTube client: ${existsSync(clientPath) ? 'present' : 'missing'}`);
    console.log(`YouTube token: ${existsSync(tokenPath) ? 'present' : 'missing'}`);
    console.log('Credentials are ignored by Git. File presence does not verify account access.');
    return;
  }
  if (command !== 'connect') throw new Error('Usage: node scripts/youtube-auth.mjs status|connect');
  if (!existsSync(clientPath)) throw new Error('Save the Google Desktop app OAuth download as credentials/youtube/client.json first.');
  let client;
  try {client = JSON.parse(await readFile(clientPath, 'utf8')).installed;} catch {
    throw new Error('YouTube client.json is not valid JSON. Download the Desktop app OAuth client again.');
  }
  if (!client || typeof client.client_id !== 'string' || !client.client_id ||
    typeof client.client_secret !== 'string' || !client.client_secret) {
    throw new Error('YouTube client.json must contain a Google Desktop app OAuth client.');
  }
  const connection = await startConnection(client, async (token) => {
    await mkdir(directory, {recursive: true});
    const temporary = join(directory, `token-${randomBytes(8).toString('hex')}.tmp`);
    await writeFile(temporary, JSON.stringify(token, null, 2) + '\n', {mode: 0o600, flag: 'wx'});
    await rename(temporary, tokenPath);
  });
  try {
    console.log('Open this URL in your system browser and choose the intended YouTube account/channel:');
    console.log(connection.url);
    await connection.completion;
    console.log('YouTube connected. Tokens saved locally. No video was uploaded.');
  } finally {connection.close();}
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {console.error(error.message); process.exitCode = 1;});
}
