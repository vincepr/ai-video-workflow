import assert from 'node:assert/strict';
import test from 'node:test';
import * as bridge from '../scripts/t3-bridge.mjs';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('sends the frozen saved request to the configured T3 thread once, with credentials kept server-side', async () => {
  assert.equal(typeof bridge.sendSavedRequest, 'function');
  const root = await mkdtemp(path.join(tmpdir(), 'desk-t3-'));
  const request = {id: '9a4fec5b-d5d4-4fc6-ae92-df73acd109be', status: 'requested', state: {script: 'Reviewed narration'}};
  const config = {origin:'http://127.0.0.1:3773',cookie:'session=test-secret',threadId:'test-thread'};
  const calls: any[] = [];
  try {
    await mkdir(path.join(root,'credentials')); await mkdir(path.join(root,'out','test'),{recursive:true});
    await writeFile(path.join(root,'credentials','t3.json'),JSON.stringify(config));
    await writeFile(path.join(root,'out','test','session.json'),JSON.stringify({rebuildRequest:request}));
    const transport: typeof fetch = async (url, options) => {calls.push({url,options}); return new Response(JSON.stringify({sequence:42}),{status:200});};
    const result = await bridge.sendSavedRequest(root,'test',request.id,{transport});
    assert.equal(result.status,'sent'); assert.equal(result.sequence,42);
    assert.equal(JSON.stringify(result).includes('test-secret'),false);
    assert.equal(calls.length,1);
    assert.equal(calls[0].url,config.origin+'/api/orchestration/dispatch');
    const command=JSON.parse(calls[0].options.body);
    assert.equal(command.type,'thread.turn.start');assert.equal(command.threadId,'test-thread');
    assert.equal(command.commandId,request.id);
    assert.match(command.message.text,/create-short/);assert.match(command.message.text,/requests/);
    const frozen=JSON.parse(await readFile(path.join(root,'out','test','requests',request.id+'.json'),'utf8'));
    assert.equal(frozen.state.script,'Reviewed narration');
    assert.equal((await bridge.sendSavedRequest(root,'test',request.id,{transport})).sequence,42);
    assert.equal(calls.length,1);
    await assert.rejects(()=>bridge.sendSavedRequest(root,'test','other',{transport}),/saved request/i);
  } finally {assert.equal(path.dirname(root),tmpdir());await rm(root,{recursive:true,force:true});}
});

test('an unconfirmed send keeps the same command on retry and never reports success early', async () => {
  const root=await mkdtemp(path.join(tmpdir(),'desk-t3-retry-'));
  const id='e7d60911-3dcb-47a1-96d1-1bbccf5920da';
  const commands:any[]=[];
  const transport: typeof fetch=async(_url,options)=>{
    commands.push(JSON.parse(String(options?.body)));
    if(commands.length===1)throw Error('Network timeout');
    return new Response(JSON.stringify({sequence:8}),{status:200});
  };
  try {
    await mkdir(path.join(root,'credentials'));await mkdir(path.join(root,'out','test'),{recursive:true});
    await writeFile(path.join(root,'credentials','t3.json'),JSON.stringify({origin:'http://localhost:3773',cookie:'session=test',threadId:'target'}));
    await writeFile(path.join(root,'out','test','session.json'),JSON.stringify({rebuildRequest:{id,state:{script:'Draft'}}}));
    await assert.rejects(()=>bridge.sendSavedRequest(root,'test',id,{transport}),/did not confirm/);
    await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal((await bridge.sendSavedRequest(root,'test',id,{transport})).status,'sent');
    assert.deepEqual(commands[0],commands[1]);
  } finally {assert.equal(path.dirname(root),tmpdir());await rm(root,{recursive:true,force:true});}
});
