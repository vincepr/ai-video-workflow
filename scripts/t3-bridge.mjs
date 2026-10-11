import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';

const pending = new Map();
export async function sendSavedRequest(root, sessionId, requestId, {transport = fetch} = {}) {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(sessionId) || !/^[a-f0-9-]{36}$/.test(requestId)) throw new Error('Invalid saved request ID');
  const key = `${root}:${sessionId}:${requestId}`;
  if (pending.has(key)) return pending.get(key);
  const work = dispatchSaved(root, sessionId, requestId, transport);
  pending.set(key, work);
  try {return await work;} finally {pending.delete(key);}
}

async function dispatchSaved(root, sessionId, requestId, transport) {
  const directory = path.join(root,'out',sessionId,'requests');
  const receiptPath = path.join(directory,`${requestId}.receipt.json`);
  try {return JSON.parse(await readFile(receiptPath,'utf8'));} catch(error) {if(error.code !== 'ENOENT') throw error;}
  const session = JSON.parse(await readFile(path.join(root,'out',sessionId,'session.json'),'utf8'));
  const request = session.rebuildRequest;
  if (request?.id !== requestId || !request.state) throw new Error('No saved request matches this send');
  let config;
  try {config = JSON.parse(await readFile(path.join(root,'credentials','t3.json'),'utf8'));} catch {throw new Error('The local T3 connection is not configured');}
  const url = new URL(config.origin);
  if (url.protocol !== 'http:' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.pathname !== '/' || url.search || url.username || url.password) throw new Error('T3 must use a local HTTP origin');
  if (!config.threadId || !config.cookie || /[\r\n]/.test(config.cookie)) throw new Error('The local T3 connection is incomplete');
  if (config.expiresAt && Date.parse(config.expiresAt) <= Date.now()) throw new Error('The T3 connection expired; pair the desk again');
  await mkdir(directory,{recursive:true});
  const snapshotPath = path.join(directory,`${requestId}.json`);
  try {await writeFile(snapshotPath,JSON.stringify(request,null,2)+'\n',{flag:'wx'});} catch(error) {if(error.code !== 'EEXIST') throw error;}
  let command = {type:'thread.turn.start',commandId:requestId,threadId:config.threadId,
    message:{messageId:requestId,role:'user',attachments:[],text:`Creator Desk: process saved request ${requestId}. Use the repo's create-short skill. Read the frozen request at ${snapshotPath}. Apply the reviewed changes together, resolve dependencies and create a local video when the saved state supports production. Leave inactive pickers without overrides. Preserve existing exports and video history. Use existing narration where it still matches. Follow the repo's API cost rules; do not publish or add paid services. Report any missing assets or recording instead of silently substituting them.`},
    runtimeMode:config.runtimeMode ?? 'full-access',interactionMode:config.interactionMode ?? 'default',createdAt:new Date().toISOString()};
  const commandPath=path.join(directory,`${requestId}.command.json`);
  try {await writeFile(commandPath,JSON.stringify(command,null,2)+'\n',{flag:'wx'});} catch(error) {
    if(error.code!=='EEXIST')throw error;
    command=JSON.parse(await readFile(commandPath,'utf8'));
    if(command.threadId!==config.threadId)throw new Error('This saved request belongs to a different T3 thread');
  }
  let response;
  try {response = await transport(new URL('/api/orchestration/dispatch',url).href,{method:'POST',headers:{'Content-Type':'application/json',Cookie:config.cookie},body:JSON.stringify(command),signal:AbortSignal.timeout(10000)});} catch {throw new Error('T3 did not confirm delivery. Retry sends the same request ID');}
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'T3 rejected the connection; pair the desk again' : `T3 rejected the request (HTTP ${response.status})`);
  const result = await response.json();
  if (!Number.isInteger(result.sequence)) throw new Error('T3 returned no delivery receipt');
  const receipt = {status:'sent',requestId,threadId:config.threadId,sequence:result.sequence,sentAt:new Date().toISOString()};
  await writeFile(receiptPath,JSON.stringify(receipt,null,2)+'\n');
  return receipt;
}
