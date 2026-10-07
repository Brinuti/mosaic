// Hasznalat:  CHROME_UTVONAL="C:/Program Files/Google/Chrome/Application/chrome.exe" node tools/kartya-hatter/oxigen-hatter.mjs   (a bongeszo canvas-aval dolgozik; nincs kulon kepfeldolgozo fuggoseg)
// Leiras: AJANDEK.md ("Oxigenterapia ajandekkartya").
// A nyomtathato A4 kartya hatterenek oxigenes valtozata (kartya-hatter-oxigen.jpg): a bal alsó foto (az arany iv ket oldalan: a nagy resz es a keskeny sarlo) csereje
// az oxigenterapia hajkameras felmeres fotojara (assets/img/oxigen/oxigen-kezeles.jpg); az arany iv, a szovegek, a logo valtozatlanok.
// Modszer: a foto-teruletet soronkent a hatter sotetzold szinehez kepest hatarozzuk meg (0-tol az elso nem-hatter pixelig jobbrol), az uj kepet ide rajzoljuk,
// majd az eredeti arany iv pixeleit visszamasoljuk.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
const R = path.resolve(import.meta.dirname, '..', '..', 'assets', 'img') + path.sep;
const hatter = fs.readFileSync(R + 'ajandek' + path.sep + 'kartya-hatter.jpg').toString('base64');
const foto = fs.readFileSync(R + 'oxigen' + path.sep + 'oxigen-kezeles.jpg').toString('base64');
const b = await chromium.launch({ executablePath: process.env.CHROME_UTVONAL, headless: true });
const p = await b.newPage();
await p.setContent('<canvas id=c></canvas>');
const res = await p.evaluate(async ({ hatter, foto }) => {
  const kep = async (b64) => { const i = new Image(); i.src = 'data:image/jpeg;base64,' + b64; await i.decode(); return i; };
  const bg = await kep(hatter), ph = await kep(foto);
  const c = document.getElementById('c'); c.width = bg.width; c.height = bg.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bg, 0, 0);
  const W = bg.width, H = bg.height, d = x.getImageData(0, 0, W, H).data;
  const aranyI = (i) => d[i] >= 215 && d[i + 1] >= 195 && d[i + 2] <= 160 && d[i] - d[i + 2] >= 65;
  const hatterI = (i) => Math.max(Math.abs(d[i] - 15), Math.abs(d[i + 1] - 39), Math.abs(d[i + 2] - 39)) <= 22;
  const yTop = 2389;
  // a foto-terulet jobb szele soronkent: jobbrol (x=700) az elso nem-hatter pixel
  const xo = new Array(H).fill(0);
  for (let Y = yTop; Y < H; Y++) { let f = 0; for (let X = 700; X >= 0; X--) if (!hatterI((Y * W + X) * 4)) { f = X; break; } xo[Y] = f; }
  const sima = xo.slice();
  for (let Y = yTop; Y < H; Y++) { const v = []; for (let k = -3; k <= 3; k++) if (Y + k >= yTop && Y + k < H) v.push(xo[Y + k]); v.sort((a, b2) => a - b2); sima[Y] = v[Math.floor(v.length / 2)]; }
  const maxX = Math.max(...sima.slice(yTop));
  const szel = maxX + 3, mag = H - yTop;
  const sh = ph.height, sw = Math.round(sh * szel / mag), sx = Math.round(330 - sw / 2);
  x.save();
  x.beginPath(); x.moveTo(0, yTop);
  for (let Y = yTop; Y < H; Y++) x.lineTo(sima[Y] + 1, Y);
  x.lineTo(0, H); x.closePath(); x.clip();
  x.drawImage(ph, Math.max(0, sx), 0, sw, sh, 0, yTop, szel, mag);
  x.restore();
  // az eredeti arany iv visszamasolasa
  const uj = x.getImageData(0, 0, W, H);
  let db = 0;
  for (let Y = yTop; Y < H; Y++) for (let X = 0; X <= sima[Y] + 3 && X < W; X++) { const i = (Y * W + X) * 4; if (aranyI(i)) { uj.data[i] = d[i]; uj.data[i + 1] = d[i + 1]; uj.data[i + 2] = d[i + 2]; db++; } }
  x.putImageData(uj, 0, 0);
  return { W, H, yTop, maxX, szel, mag, sx, sw, aranyPixel: db, jpg: c.toDataURL('image/jpeg', 0.93) };
}, { hatter, foto });
fs.writeFileSync(R + 'ajandek' + path.sep + 'kartya-hatter-oxigen.jpg', Buffer.from(res.jpg.split(',')[1], 'base64'));
delete res.jpg;
console.log(JSON.stringify(res), fs.statSync(R + 'ajandek' + path.sep + 'kartya-hatter-oxigen.jpg').size);
await b.close();
