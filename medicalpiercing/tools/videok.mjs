// A Wix-videok tomoritese a kiszolgalashoz (ffmpeg kell hozza).
//
//   node tools/videok.mjs
//
// Forras: tools/eredeti-videok/ (tools/media.mjs), cel: assets/video/ (ugyanazzal a nevvel).
// A Wix a videokat 720p-ben jatssza le (a lejatszo a 720p-s valtozatot kerte), ezert
// legfeljebb 720 px-re (a rovidebb oldal) kicsinyitunk, H.264 + AAC, gyors inditassal
// (faststart). A Cloudflare Pages fajlonkent 25 MB-ot enged; ha a kesz fajl nagyobb,
// erosebb tomoritessel ujrakodoljuk. A mar meglevo fajlokat kihagyja.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const BE = path.join(ROOT, 'tools/eredeti-videok');
const KI = path.join(ROOT, 'assets/video');
fs.mkdirSync(KI, { recursive: true });
const MAX = 24 * 1024 * 1024;
for (const f of fs.readdirSync(BE).filter((x) => x.endsWith('.mp4'))) {
  const cel = path.join(KI, f);
  if (fs.existsSync(cel)) continue;
  for (const crf of [26, 30, 34]) {
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', path.join(BE, f),
      '-vf', "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'",
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', cel]);
    if (fs.statSync(cel).size <= MAX) break;
  }
  console.log(`${f}: ${(fs.statSync(path.join(BE, f)).size / 1e6).toFixed(1)} MB -> ${(fs.statSync(cel).size / 1e6).toFixed(1)} MB`);
}
