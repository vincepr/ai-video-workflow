import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {agentStatus, attachAgentExport, freezeAgentRevision, latestAgentRevision, normalizeAgentConfig, readAgentRevision, recordAgentAttempt, runAgentRevision, shareableAgentSummary} from './agent-video.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [command, ...args] = process.argv.slice(2);
try {
  let result;
  if (command === 'plan' || command === 'freeze') {
    const draft = JSON.parse(await readFile(path.resolve(args[0]), 'utf8'));
    result = command === 'plan' ? normalizeAgentConfig(draft) : await freezeAgentRevision(root, draft);
  } else if (command === 'inspect') result = await readAgentRevision(root, args[0], args[1]);
  else if (command === 'latest') result = await latestAgentRevision(root, args[0]);
  else if (command === 'status') result = await agentStatus(root, args[0], args[1]);
  else if (command === 'summary') result = shareableAgentSummary(await agentStatus(root, args[0], args[1]));
  else if (command === 'run' || command === 'resume') result = await runAgentRevision(root, args[0], args[1]);
  else if (command === 'record') result = await recordAgentAttempt(root, args[0], args[1], JSON.parse(await readFile(path.resolve(args[2]), 'utf8')));
  else if (command === 'attach') result = await attachAgentExport(root, args[0], args[1], args[2]);
  else throw new Error('Usage: agent-video <plan|freeze> <draft.json> | <inspect|status|run|resume> <project-id> <revision-id> | record <project-id> <revision-id> <attempt.json>');
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} catch (error) {process.stderr.write(`${error.message}\n`); process.exitCode = 1;}
