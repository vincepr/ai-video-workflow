import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {readRenderHistory} from '../render-history.mjs';

const active = new Map();

export function createCodexProductVideoTransport(root, command = process.env.CODEX_CLI || (process.platform === 'win32' ? 'codex.exe' : 'codex')) {
  function run(seed, sessionId) {
    const executionId = randomUUID();
    const directory = path.join(root, 'projects', seed.projectId, 'work', 'product-video', seed.requestId);
    const workflowInstruction = seed.request?.workflow === 'direct'
      ? 'Create separate image and motion prompts, then generate and inspect the first frame and video. Keep direct-state.json compatible with scripts/product-video/direct.mjs; the first text edit belongs in finishPlan.captions. In first-frame review mode, save the inspected state with status first-frame-review and stop before video submission.'
      : 'Follow the selected frozen workflow. Do not assume it uses image-to-video or a first-frame checkpoint.';
    const instruction = sessionId
      ? `Continue frozen product-video request ${seed.requestId} in project ${seed.projectId}. The user approved the first frame in frame-approval.json. Verify its frame hash, use the approved motion prompt, finish and inspect the video, then produce a local first text edit and numbered export. Check the original USD cap before every paid stage. Stop clearly if a stage is unsupported.`
      : `Run the frozen request at projects/${seed.projectId}/work/product-video/${seed.requestId}/request.json. Its hashed input snapshots, including the skill router and selected recipes, are the creative authority. The user selected Generate with the frozen USD cap; obey it and provider checks. ${workflowInstruction} Inspect every result and make a first local text edit when footage is accepted. On success register a numbered export. Keep changes inside this project's ignored media/work/videos folders. Do not ask the user to guide routine creative choices; report unsupported or missing input clearly.`;
    const args = sessionId ? ['exec', 'resume', '--ignore-user-config', '--json', sessionId, '-']
      : ['exec', '--ignore-user-config', '--json', '--approve-for-me', '-C', root, '-'];
    const child = spawn(command, args, {cwd: root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
    active.set(executionId, child);
    child.stdin.on('error', () => {});
    child.stdin.end(instruction);
    let output = '', errors = '', resolved = false;
    let resolveStart, rejectStart;
    const started = new Promise((resolve, reject) => {resolveStart = resolve; rejectStart = reject;});
    const update = async (status, message) => {
      const file = path.join(directory, 'worker.json');
      const worker = {requestId: seed.requestId, projectId: seed.projectId, executionId, status, message: String(message ?? '').slice(-2000)};
      await writeFile(file, JSON.stringify(worker, null, 2) + '\n');
    };
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      output += chunk;
      for (let i; (i = output.indexOf('\n')) !== -1;) {
        const line = output.slice(0, i); output = output.slice(i + 1);
        let event; try {event = JSON.parse(line);} catch {continue;}
        if (event.type === 'thread.started' && !resolved) {resolved = true; resolveStart({sessionId: event.thread_id, executionId}); void update('running', 'Codex agent is working').catch(() => {});}
        if (event.type === 'item.completed' && event.item?.type === 'agent_message') errors = event.item.text;
      }
    });
    child.stderr.on('data', chunk => {errors = (errors + chunk).slice(-2000);});
    child.on('error', error => {if (!resolved) {resolved = true; rejectStart(error);} void update('failed', error.message).catch(() => {}); active.delete(executionId);});
    child.on('close', async code => {
      active.delete(executionId);
      if (!resolved) {resolved = true; rejectStart(new Error(errors || `Codex exited ${code} before starting`)); return;}
      try {
        const exported = code === 0 && (await readRenderHistory(root, seed.projectId)).some(record => record.status === 'available' && record.snapshot?.episode?.productVideo?.requestId === seed.requestId);
        let state = null;
        try {state = JSON.parse(await readFile(path.join(directory, 'direct-state.json'), 'utf8'));}
        catch (error) {if (error.code !== 'ENOENT') throw error;}
        await update(exported ? 'complete' : code === 0 && state?.status === 'first-frame-review' ? 'first-frame-review' : code === 0 && state?.status === 'finishing-ready' ? 'raw-artifact' : /unsupported/i.test(errors) ? 'unsupported' : 'failed', errors || `Codex exited ${code} without a registered video`);
      } catch (error) {await update('failed', error.message);}
    });
    return started;
  }
  return {
    createFreshSession: seed => run(seed),
    resumeSession: (seed, sessionId) => run(seed, sessionId),
    cancelSession: executionId => {const child = active.get(executionId); if (child) child.kill(); return Boolean(child);},
  };
}
