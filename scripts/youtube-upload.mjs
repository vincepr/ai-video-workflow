import {createHash} from 'node:crypto';
import {createReadStream, existsSync} from 'node:fs';
import {mkdir, readFile, realpath, stat, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export async function uploadPrivate({file, metadata, token, receipt, privacyStatus = 'private', request = fetch}) {
  if (!['private', 'unlisted'].includes(privacyStatus)) throw new Error('Unsupported privacy status.');
  const size = (await stat(file)).size;
  const sha256 = createHash('sha256').update(await readFile(file)).digest('hex');
  const requestedStatus = {privacyStatus, selfDeclaredMadeForKids: false, containsSyntheticMedia: true};
  const record = {file, sha256, bytes: size, metadata, requestedStatus, startedAt: new Date().toISOString(), state: 'started'};
  await writeFile(receipt, JSON.stringify(record, null, 2) + '\n', {flag: 'wx', mode: 0o600});
  const save = async () => writeFile(receipt, JSON.stringify(record, null, 2) + '\n', {mode: 0o600});
  const url = new URL('https://www.googleapis.com/upload/youtube/v3/videos');
  url.search = new URLSearchParams({uploadType: 'resumable', part: 'snippet,status', notifySubscribers: 'false'}).toString();
  try {
    const init = await request(url.toString(), {method: 'POST', headers: {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size)},
    body: JSON.stringify({snippet: metadata, status: requestedStatus}),
    signal: AbortSignal.timeout(30_000)});
    if (!init.ok) throw new Error(`Upload initialization failed (HTTP ${init.status}).`);
    const sessionUrl = init.headers.get('location');
    if (!sessionUrl) throw new Error('YouTube did not return a resumable upload session.');
    const session = new URL(sessionUrl);
    if (session.protocol !== 'https:' || session.hostname !== 'www.googleapis.com' || session.username || session.password) {
      throw new Error('YouTube returned an untrusted upload session URL host.');
    }
    record.sessionUrl = sessionUrl;
    record.state = 'session-created';
    await save();
    const response = await request(sessionUrl, {method: 'PUT', headers: {
      Authorization: `Bearer ${token}`, 'Content-Type': 'video/mp4', 'Content-Length': String(size)},
    body: createReadStream(file), duplex: 'half', signal: AbortSignal.timeout(300_000)});
    if (!response.ok) throw new Error(`Video transfer failed (HTTP ${response.status}). Inspect saved session before retrying.`);
    const video = await response.json();
    if (!video.id || video.status?.privacyStatus !== privacyStatus) throw new Error('YouTube did not confirm the requested visibility. Inspect the saved session.');
    const completed = Object.assign(record, {state: 'uploaded', videoId: video.id, url: `https://www.youtube.com/watch?v=${video.id}`,
      channelId: video.snippet?.channelId, privacyStatus: video.status.privacyStatus,
      uploadStatus: video.status.uploadStatus, returnedSnippet: video.snippet, completedAt: new Date().toISOString()});
    await save();
    return completed;
  } catch (error) {
    record.state = 'needs-inspection';
    await save();
    throw error;
  }
}

export async function accessToken(client, token, request = fetch) {
  if (token.access_token && token.expires_at > Date.now() + 60_000) return token;
  if (!token.refresh_token) throw new Error('YouTube account connection is missing. Run youtube-auth.mjs connect.');
  const response = await request('https://oauth2.googleapis.com/token', {method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({client_id: client.client_id, client_secret: client.client_secret,
      grant_type: 'refresh_token', refresh_token: token.refresh_token}), signal: AbortSignal.timeout(30_000)});
  if (!response.ok) throw new Error(`YouTube token refresh failed (HTTP ${response.status}). Reconnect before uploading.`);
  const fresh = await response.json();
  if (!fresh.access_token || !(fresh.expires_in > 0)) throw new Error('Google returned an invalid token response.');
  return {...token, ...fresh, expires_at: Date.now() + Number(fresh.expires_in) * 1000};
}

export async function setThumbnail({videoId, file, token, request = fetch}) {
  const image = await readFile(file);
  const url = new URL('https://www.googleapis.com/upload/youtube/v3/thumbnails/set');
  url.search = new URLSearchParams({videoId, uploadType: 'media'}).toString();
  const response = await request(url.toString(), {method: 'POST', headers: {
    Authorization: `Bearer ${token}`, 'Content-Type': file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'},
  body: image, signal: AbortSignal.timeout(30_000)});
  if (!response.ok) throw new Error(`Thumbnail update failed (HTTP ${response.status}). Check channel verification and Shorts thumbnail access.`);
  const result = await response.json();
  if (!result.items?.length) throw new Error('YouTube did not confirm a saved thumbnail.');
  return result;
}

async function main() {
  const [command, fileArg, metadataArg, receiptArg, extra] = process.argv.slice(2);
  if (!['upload-private', 'upload-unlisted'].includes(command) || !fileArg || !metadataArg || !receiptArg || extra) {
    throw new Error('Usage: node scripts/youtube-upload.mjs upload-private|upload-unlisted <video.mp4> <metadata.json> <receipt.json>');
  }
  const root = fileURLToPath(new URL('../', import.meta.url));
  const file = await realpath(resolve(root, fileArg));
  const project = relative(root, file).replaceAll('\\', '/').match(/^projects\/([a-z0-9-]+)\/videos\/[^/]+\/video\.mp4$/)?.[1];
  if (!project) throw new Error('Select a numbered video.mp4 inside projects/<id>/videos/.');
  const uploads = join(root, 'projects', project, 'work', 'uploads');
  const receipt = resolve(root, receiptArg);
  const metadataPath = resolve(root, metadataArg);
  if (dirname(receipt) !== uploads || dirname(metadataPath) !== uploads) {
    throw new Error('Keep metadata and receipt in the selected project work/uploads/ folder.');
  }
  if (existsSync(receipt)) throw new Error('An upload receipt already exists. Inspect it before retrying.');
  await mkdir(uploads, {recursive: true});
  if (await realpath(uploads) !== uploads) throw new Error('Upload records cannot use a redirected directory.');
  const clientPath = join(root, 'credentials', 'youtube', 'client.json');
  const tokenPath = join(root, 'credentials', 'youtube', 'token.json');
  for (const path of [clientPath, tokenPath, metadataPath, receipt]) {
    try {execFileSync('git', ['check-ignore', path], {cwd: root, stdio: 'ignore'});} catch {
      throw new Error('Credentials and upload records must be ignored and untracked.');
    }
  }
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  if (!metadata.title?.trim() || metadata.title.length > 100 || !metadata.description?.trim() ||
    !Array.isArray(metadata.tags) || metadata.tags.some(tag => typeof tag !== 'string')) {
    throw new Error('Metadata needs a title up to 100 characters, a description and string tags.');
  }
  const release = JSON.parse(await readFile(file + '.release.json', 'utf8'));
  if (release.music?.attribution && !metadata.description.includes(release.music.attribution)) {
    throw new Error('The description must preserve the exact required music credit.');
  }
  let client;
  let stored;
  try {
    client = JSON.parse(await readFile(clientPath, 'utf8')).installed;
    stored = JSON.parse(await readFile(tokenPath, 'utf8'));
  } catch {throw new Error('YouTube credentials are missing or invalid. Run youtube-auth.mjs connect.');}
  const token = await accessToken(client, stored);
  if (token !== stored) await writeFile(tokenPath, JSON.stringify(token, null, 2) + '\n', {mode: 0o600});
  const result = await uploadPrivate({file, metadata, token: token.access_token, receipt,
    privacyStatus: command === 'upload-unlisted' ? 'unlisted' : 'private'});
  console.log(JSON.stringify({videoId: result.videoId, url: result.url, channelId: result.channelId,
    privacyStatus: result.privacyStatus, uploadStatus: result.uploadStatus, receipt: relative(root, receipt)}, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {console.error(error.message); process.exitCode = 1;});
}
