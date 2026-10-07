// Az egyeni Head Spa landing (/egyeni-headspa-budapest-uj) videoi: rovid, hang nelkuli ismetlo-klipek + nyitokepek (poszterek) a MOSAIC meglevo felvetelebol.
// Csak az ujrafuttathatosag miatt van a repoban: az eredmeny (assets/video/egyeni-*.mp4, assets/img/egyeni/*.jpg) be van commitolva, a build nem hasznalja.
//
//   FFMPEG=<ffmpeg.exe utvonala> node tools/egyeni-videok.mjs [--csak nev1,nev2]
//
// A forrasvideok az assets/video mappaban vannak (a sparse worktree-kben a FORRAS kornyezeti valtozoval megadhato masik mappa).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const GYOKER = path.resolve(import.meta.dirname, '..');
const FORRAS = process.env.FORRAS || path.join(GYOKER, 'assets/video');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const KI_VIDEO = path.join(GYOKER, 'assets/video');
const KI_KEP = path.join(GYOKER, 'assets/img/egyeni');

// ismetlo-klipek: ss = kezdet (mp), t = hossz (mp), fade = be-/kiuszas a ket vegen (sotet hatterekhez: a hurok varrata nem latszik)
const KLIPEK = [
  { nev: 'hero', forras: 'c2eb0f_c68f720ea07c4cc6b19dd', ss: 16.5, t: 11, fade: 0.6, poszter: 3 },         // fenygyuruk, aranyiv hatulrol (a MOSAIC zold-arany szinvilaga)
  { nev: 'iv', forras: 'c2eb0f_c68f720ea07c4cc6b19dd', ss: 4, t: 9, fade: 0, poszter: 3 },               // "Elkezdodik": a kezelo, a hajmosoiv
  { nev: 'arc', forras: 'c2eb0f_08e23fa612e846eca8137', ss: 10, t: 10, fade: 0, poszter: 4 },            // arc-, nyak-, vallmasszazs
  { nev: 'meg-sosem', forras: 'c2eb0f_85f266a4010d40aba40c2', ss: 5, t: 10, fade: 0.6, poszter: 4 },     // arcmasszazs, szines fenyek
  { nev: 'ajandek', forras: 'c2eb0f_a772c9222aa949a0888a4', ss: 0.5, t: 10, fade: 0.6, poszter: 3 },     // meleg, gyertyafenyes hajmosas
  { nev: 'zaro', forras: 'c2eb0f_a12ccd3c1d87416987742', ss: 1.5, t: 12, fade: 0.6, poszter: 5 },          // aranyiv, viz a hajon, valto szinu fenyek
  { nev: 'frizura', forras: 'ajandek-headspa', ss: 51.6, t: 5.5, fade: 0, poszter: 2.8 },                // tukor, hajszarito, fodrok: "ugy allsz fel, hogy jol is nezel ki"
];
// nyitokepek meglevo videokbol (a videot magat nem vagjuk)
const POSZTEREK = [
  { nev: 'lelassulsz', forras: 'c2eb0f_c02456fd01664cb59eb59', mp: 3 },
  { nev: 'kienged', forras: 'c2eb0f_cefa94f02ca34e3388845', mp: 6 },
  { nev: 'hajmosas', forras: 'c2eb0f_430fb9fbd2e744b087036', mp: 8 },
  { nev: 'gyogymasszor', forras: 'c2eb0f_bbb818fad4674d2097775', mp: 6 },
  { nev: 'erzes', forras: 'c2eb0f_c68f720ea07c4cc6b19dd', mp: 6 },
];

const csak = (process.argv.find((a) => a.startsWith('--csak=')) || '').slice(7).split(',').filter(Boolean);
const keres = (elo) => { const f = fs.readdirSync(FORRAS).find((x) => x.startsWith(elo) && x.endsWith('.mp4')); if (!f) throw new Error('nincs forras: ' + elo); return path.join(FORRAS, f); };
const ff = (...a) => execFileSync(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', ...a], { stdio: 'inherit' });
fs.mkdirSync(KI_VIDEO, { recursive: true });
fs.mkdirSync(KI_KEP, { recursive: true });

for (const k of KLIPEK) {
  if (csak.length && !csak.includes(k.nev)) continue;
  const be = keres(k.forras);
  const ki = path.join(KI_VIDEO, `egyeni-${k.nev}.mp4`);
  const vf = [`scale='min(1080,iw)':-2`, ...(k.fade ? [`fade=t=in:st=0:d=${k.fade}`, `fade=t=out:st=${(k.t - k.fade).toFixed(2)}:d=${k.fade}`] : [])].join(',');
  ff('-ss', String(k.ss), '-t', String(k.t), '-i', be, '-an', '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', ki);
  ff('-ss', String(k.ss + k.poszter), '-i', be, '-frames:v', '1', '-vf', `scale=1000:-2`, '-q:v', '4', path.join(KI_KEP, `${k.nev}.jpg`));
  console.log(k.nev, (fs.statSync(ki).size / 1e6).toFixed(2) + ' MB');
}
for (const p of POSZTEREK) {
  if (csak.length && !csak.includes(p.nev)) continue;
  ff('-ss', String(p.mp), '-i', keres(p.forras), '-frames:v', '1', '-vf', 'scale=1000:-2', '-q:v', '4', path.join(KI_KEP, `${p.nev}.jpg`));
  console.log('poszter', p.nev);
}
