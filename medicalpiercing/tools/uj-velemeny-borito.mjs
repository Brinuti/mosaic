// A vendegek videos beszamoloinak tervezett boritoja (a tulajdonos kerese, 2026-10-16: a 09-es proba mintajara mind a 37 videora;
// alul a vendeg keresztnevevel: "Katinak így segített a migrén piercing"). A kep: GPT-vel tervezett hatter (tools/kep-forras/velemeny-borito-hatter.webp)
// + a video valodi, felirat nelkuli kepkockaja (a vendeg arcat nem modositjuk) + a vendeg legerosebb, valoban elhangzott mondata.
//
// A vendegek neve es a mondatok a repoba NEM kerulnek (csak a kesz kepen latszanak): az adatfajl a repon kivul van.
//   node tools/uj-velemeny-borito.mjs <adat.json>   ->   assets/img/uj-velemeny-<nn>-terv.webp (540 x 960)
//   adat.json: [{ "nn": "09", "foto": "/abs/ut/kocka.png", "cimke": "Migrén piercing", "idezet": "„… <em>…</em> …”", "lab": "Bernadettnek így segített a migrén piercing" }, …]
// Ugyanez a sablon a beagyazott, allo Facebook-videok boritoja is (a tulajdonos kerese, 2026-10-16): tools/kep-forras/fb-boritok.json
// ("ki": a kimeneti nev, pl. "uj-fb-<video-azonosito>"; "csillag": false - nem vendegvelemeny; a "foto" a repo gyokerehez kepest is megadhato).
// A kepkocka 860:1060 aranyu kivagas (arcfelismeressel, a felso logosav nelkul). A tools/uj-video-velemenyek.mjs a -terv boritot hasznalja, ha letezik.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from './pw.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const F = 'file://' + path.join(ROOT, 'assets/fonts') + '/';
const HATTER = 'file://' + path.join(ROOT, 'tools/kep-forras/velemeny-borito-hatter.webp');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// az idezetben csak az <em> kiemeles maradhat
const idezetHtml = (s) => esc(s).replace(/&lt;(\/?)em&gt;/g, '<$1em>');

const lap = (v) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:PJ;src:url(${F}plus-jakarta-sans-latin-ext.woff2) format('woff2');unicode-range:U+0100-024F;font-weight:200 800}
@font-face{font-family:PJ;src:url(${F}plus-jakarta-sans-latin.woff2) format('woff2');font-weight:200 800}
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1920px;overflow:hidden;font-family:PJ,sans-serif}
.k{position:relative;width:1080px;height:1920px;background:radial-gradient(circle at 85% 92%,rgba(215,171,168,.55),transparent 32%),radial-gradient(circle at 8% 78%,rgba(215,171,168,.35),transparent 28%),linear-gradient(180deg,#fbf4ef 0%,#f6e9e2 100%)}
.vonal{position:absolute;inset:0;background:url(${HATTER}) 0 0/1080px 1620px no-repeat;opacity:.6}
.cimke{position:absolute;left:50%;top:92px;transform:translateX(-50%);padding:16px 34px;border-radius:99px;background:#fff;color:#ab6354;font-weight:800;font-size:38px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;box-shadow:0 8px 22px rgba(171,99,84,.16)}
.foto{position:absolute;left:110px;top:200px;width:860px;height:1060px;border-radius:60px;overflow:hidden;box-shadow:0 0 0 12px #fff,0 30px 60px rgba(120,70,62,.30)}
.foto img{width:100%;height:100%;object-fit:cover;object-position:50% 50%}
.lej{position:absolute;left:468px;top:1030px;width:144px;height:144px;border-radius:50%;background:rgba(255,255,255,.95);box-shadow:0 12px 34px rgba(0,0,0,.30);display:grid;place-items:center}
.lej i{display:block;width:0;height:0;margin-left:12px;border-style:solid;border-width:32px 0 32px 52px;border-color:transparent transparent transparent #ab6354}
.idezet{position:absolute;left:80px;right:80px;top:1322px;text-align:center;color:#2f3044;font-weight:800;font-size:76px;line-height:1.12;letter-spacing:-.02em;text-wrap:balance}
.idezet em{font-style:normal;color:#c27a6a}
.lab{position:absolute;left:70px;right:70px;bottom:78px;text-align:center;color:#454659;font-weight:700;font-size:42px;line-height:1.2;text-wrap:balance}
.lab b{display:block;margin-bottom:8px;color:#e2a33b;font-size:40px;letter-spacing:.12em}
</style></head><body><div class="k"><div class="vonal"></div>
<span class="cimke">${esc(v.cimke)}</span>
<div class="foto"><img src="file://${path.resolve(ROOT, v.foto)}" alt=""></div><div class="lej"><i></i></div>
<p class="idezet">${idezetHtml(v.idezet)}</p>
<p class="lab">${v.csillag === false ? '' : '<b>★★★★★</b>'}${esc(v.lab)}</p>
</div></body></html>`;
// a meretezes a betuk betoltese UTAN (kulonben a tartalek betu meretevel szamolna): a lab legfeljebb ket sor, az idezet nem log a lab fole, a cimke egy sor
const igazit = () => {
  const l = document.querySelector('.lab'); let g = 42;
  const csillag = l.querySelector('b');
  const sorok = () => Math.round((l.getBoundingClientRect().height - (csillag ? csillag.getBoundingClientRect().height + 8 : 0)) / (g * 1.2));
  while (sorok() > 2 && g > 30) { g -= 1; l.style.fontSize = g + 'px'; }
  const hatar = l.getBoundingClientRect().top - 34;
  // (a rovid cim - nem vendegvelemeny - nagyobb betuvel, a szabad hely kozepen)
  const cim = !csillag;
  const q = document.querySelector('.idezet'); let f = cim ? 96 : 76; q.style.fontSize = f + 'px';
  while (q.getBoundingClientRect().bottom > hatar && f > 44) { f -= 2; q.style.fontSize = f + 'px'; }
  if (cim) q.style.top = Math.round(1322 + (hatar - q.getBoundingClientRect().bottom) / 2) + 'px';
  const c = document.querySelector('.cimke'); let h = 38;
  while (c.getBoundingClientRect().width > 1000 && h > 26) { h -= 1; c.style.fontSize = h + 'px'; }
  return { lab: g, idezet: f, alja: Math.round(q.getBoundingClientRect().bottom), hatar: Math.round(hatar) };
};

const adat = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const tmp = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'velemeny-borito-'));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
for (const v of adat) {
  const nev = v.ki || `uj-velemeny-${v.nn}-terv`;
  if (!/^[a-z0-9-]+$/.test(nev) || !fs.existsSync(path.resolve(ROOT, v.foto))) throw new Error(`hibas sor: ${nev}`);
  fs.writeFileSync(path.join(tmp, 'lap.html'), lap(v));
  await p.goto('file://' + path.join(tmp, 'lap.html'));
  await p.evaluate(() => document.fonts.ready);
  const m = await p.evaluate(igazit);
  if (m.alja > m.hatar) throw new Error(`${nev}: az idezet nem fer el (${JSON.stringify(m)})`);
  await p.waitForTimeout(150);
  const png = path.join(tmp, `${nev}.png`);
  await p.screenshot({ path: png });
  // 540 x 960 webp (a sav 270 px szeles kartyain 2x-es kijelzon is eles)
  execFileSync('python3', ['-I', '-c', `from PIL import Image; Image.open(${JSON.stringify(png)}).convert('RGB').resize((540,960), Image.LANCZOS).save(${JSON.stringify(path.join(ROOT, `assets/img/${nev}.webp`))}, 'WEBP', quality=86, method=6)`]);
  console.log(`${nev}.webp`);
}
await b.close();
fs.rmSync(tmp, { recursive: true, force: true });
