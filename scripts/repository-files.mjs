import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export function forbiddenTrackedFiles(files) {
  const branding = new Set(['hiddenpicks-profile.png', 'hiddenpicks-banner.png']);
  return files.filter(file => {
    if (branding.has(file) || file === '.env.example') return false;
    return /^(media|credentials|secrets|out|final|node_modules|tmp|temp|\.cache|\.sites)\//.test(file)
      || /^projects\/[^/]+\/(media|work|videos)\//.test(file)
      || /(^|\/)\.env(?:\.|$)/.test(file)
      || /\.(mp4|mov|mkv|webm|avi|m4v|wav|mp3|m4a|aac|flac|ogg|png|jpe?g|webp|gif|psd|pdf|safetensors|ckpt|pt|pth|onnx|gguf|pem|key|p12|zip|7z)$/i.test(file);
  });
}

export function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z']).toString().split('\0').filter(Boolean).sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = trackedFiles();
  for (const file of files) console.log(file);
  const forbidden = forbiddenTrackedFiles(files);
  console.log('\nLocal only: media/, projects/*/{media,work,videos}/, .env, credentials/, out/');
  if (forbidden.length) {console.error(`Tracked files outside the allowed boundaries:\n${forbidden.join('\n')}`); process.exitCode = 1;}
  else console.log(`Boundary check passed (${files.length} tracked files).`);
}
