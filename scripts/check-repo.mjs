import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {forbiddenTrackedFiles, trackedFiles} from './repository-files.mjs';

const files = new Set(execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z'])
  .toString().split('\0').filter(Boolean));
const phrases = [['as', 'an', 'ai'], ['delve', 'into'], ['leverage', 'the'],
  ['game', 'changer'], ['seam' + 'lessly'], ['unlock', 'the', 'power']].map((parts) => parts.join(' '));
const failures = forbiddenTrackedFiles(trackedFiles()).map(file => `${file}: local-only file is tracked`);
for (const file of files) {
  if (file === 'package-lock.json' || !/\.(md|json|tsx?|mjs|ya?ml|svg)$/.test(file)) continue;
  const content = readFileSync(file, 'utf8');
  if (content.includes(String.fromCodePoint(0x2014))) failures.push(`${file}: em dash`);
  for (const phrase of phrases) {
    if (content.toLowerCase().includes(phrase)) failures.push(`${file}: stock phrase: ${phrase}`);
  }
  const budget = file === 'AGENTS.md' ? 20 : file === 'README.md' ? 80 : /^adr\/.*\.md$/.test(file) ? 40 : null;
  if (budget && content.split(/\r?\n/).filter((line) => line.trim()).length > budget) {
    failures.push(`${file}: exceeds ${budget} nonempty lines`);
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log('Repository text checks passed.');
