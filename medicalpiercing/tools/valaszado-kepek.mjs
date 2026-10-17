// Valaszado kepek az uj oldalakon (a build hivja, tools/build.mjs; gyorsitas, 2026-10-17): a Lighthouse / PageSpeed minden oldalon a
// "Properly size images" tetelt jelezte (pl. a blogcikkek 2560 px-es fotoi, a szalon-galeria 1936 px-es kepei egy 300 px-es helyen).
// A <img src="/assets/img/<kep>"> kap egy srcset-et a kisebb valtozatokkal (tools/kep-valtozatok.py -> assets/img/valtozat/, jegyzek.json)
// es egy sizes-t a kep valodi megjelenesi szelessegebol (tools/kep-meretek.mjs -> uj-oldalak/kep-meretek.json, lapankent, asztali / mobil):
// a bongeszo a kepernyohoz (es a pixelsuruseghez) illo meretet tolti. A src marad az eredeti (a kepnagyito is azt nyitja, uj-oldalak.js).
// A JPG / PNG kepek WebP-valtozatot is kapnak az eredeti meretben (modern formatum). Ahol nincs mert meret (uj kep, uj lap), a kep valtozatlan marad.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TARTALEK = 1.15;   // a mert szelesseg folott ennyivel nagyobb helyre szamolunk (kis elrendezes-valtozas ne tegye homalyossa a kepet)

// A feliratos abrak / szoveges kepek (uj-oldalak/teljes-kepek.json, tools/teljes-kepek.py) soha nem vagodnak le (a tulajdonos kerese, 2026-10-17):
// az uj lapokon data-teljes jelet kapnak (uj-egyseges.css: egeszben, a doboz a kep aranyat koveti; fix keretben a maradek savot a kep szelenek szine tolti ki).
const ujLapok = (DIST) => ['_a', '_m'].flatMap((ki) => fs.readdirSync(path.join(DIST, ki), { recursive: true }).filter((x) => x.endsWith('.html') && !/^regi[\\/]/.test(x)).map((x) => path.join(DIST, ki, x)));
export function teljesKepek(ROOT, DIST) {
  const jp = path.join(ROOT, 'uj-oldalak/teljes-kepek.json');
  if (!fs.existsSync(jp)) return 'nincs lista: kihagyva';
  const lista = JSON.parse(fs.readFileSync(jp, 'utf8'));
  let lapDb = 0, kepDb = 0;
  for (const fajl of ujLapok(DIST)) {
    const h = fs.readFileSync(fajl, 'utf8');
    const u = h.replace(/<img\b[^>]*>/g, (tag) => {
      const m = tag.match(/\ssrc="\/assets\/img\/([^"?#]+)/);
      if (!m || !(m[1] in lista) || /\sdata-teljes\b/.test(tag)) return tag;
      kepDb++;
      const szin = /^#[0-9a-f]{6}$/i.test(lista[m[1]]) ? lista[m[1]] : '#ffffff';
      const t = /\sstyle="/.test(tag) ? tag.replace(/\sstyle="([^"]*)"/, (x, s) => ` style="${s.replace(/;?\s*$/, ';')}background-color:${szin}"`) : tag.replace(/^<img\b/, `<img style="background-color:${szin}"`);
      return t.replace(/^<img\b/, '<img data-teljes');
    });
    if (u !== h) { fs.writeFileSync(fajl, u); lapDb++; }
  }
  return `${lapDb} lapon ${kepDb} feliratos kep egeszben`;
}

// A borítós (poster) videók az új lapokon csak indításkor töltődnek (preload="none"; gyorsítás, 2026-10-17: a hős álló videója preload="metadata"-val
// mobilon a lap megnyitásakor akár 650 KB-ot is letöltött; a borító a tervezett kép, a doboz méretét a CSS adja).
export function videoElotoltes(DIST) {
  let db = 0;
  for (const fajl of ujLapok(DIST)) {
    const h = fs.readFileSync(fajl, 'utf8');
    const u = h.replace(/<video\b[^>]*>/g, (tag) => (/\sposter="[^"]+"/.test(tag) && /\spreload="metadata"/.test(tag) && !/\sautoplay\b/.test(tag) ? (db++, tag.replace(/\spreload="metadata"/, ' preload="none"')) : tag));
    if (u !== h) fs.writeFileSync(fajl, u);
  }
  return `${db} boritos video preload="none"`;
}

// A kep valodi merete a fajl fejlecebol (PNG, GIF, JPEG, WebP; mas formatum / hibas fajl: null).
function fajlMeret(p) {
  let b;
  try { b = fs.readFileSync(p); } catch { return null; }
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.length > 10 && b.toString('latin1', 0, 3) === 'GIF') return [b.readUInt16LE(6), b.readUInt16LE(8)];
  if (b.length > 30 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    const t = b.toString('latin1', 12, 16);
    if (t === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (t === 'VP8L') { const n = b.readUInt32LE(21); return [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1]; }
    if (t === 'VP8X') return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
    return null;
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

// A kepek doboza a betoltes elott is a vegleges meretu (gyorsitas, 2026-10-17: a Lighthouse a varos- es allasajanlat-lapokon elrendezes-csuszast mert):
// ahol a CSS a kep sajat meretet hasznalja (width:auto, pl. .verem>.kep, .kep-ikon, .stat-kep, .kat-video-img, a feliratos kepek), a doboz a betoltes elott
// 0 x 0 volt, es a kep megerkezesekor lejjebb tolta a tartalmat. Minden uj lapon az <img> a fajl valodi szelesseget es aranyat kapja (--kw, --ka; inline stilus),
// az uj-egyseges.css vege ebbol adja meg a szelesseget (min(--kw, max-height * --ka)) es az aranyt (aspect-ratio: auto --ka) – ugyanazt, amit betoltes utan.
export function kepDobozok(ROOT, DIST) {
  const meretek = new Map();
  let db = 0, nincs = 0;
  for (const fajl of ujLapok(DIST)) {
    const h = fs.readFileSync(fajl, 'utf8');
    const u = h.replace(/<img\b[^>]*>/g, (tag) => {
      const m = tag.match(/\ssrc="\/assets\/img\/([^"?#]+)/);
      if (!m || /--kw:/.test(tag)) return tag;
      if (!meretek.has(m[1])) meretek.set(m[1], fajlMeret(path.join(ROOT, 'assets/img', m[1])));
      const mr = meretek.get(m[1]);
      if (!mr || !mr[0] || !mr[1]) { nincs++; return tag; }
      db++;
      const jel = `--kw:${mr[0]}px;--ka:${+(mr[0] / mr[1]).toFixed(4)}`;
      return /\sstyle="/.test(tag) ? tag.replace(/\sstyle="([^"]*)"/, (x, s) => ` style="${s.replace(/;?\s*$/, ';')}${jel}"`) : tag.replace(/^<img\b/, `<img style="${jel}"`);
    });
    if (u !== h) fs.writeFileSync(fajl, u);
  }
  return `${db} kep kapott dobozmeretet${nincs ? `, ${nincs} meret nelkul (nem PNG/GIF/JPEG/WebP)` : ''}`;
}

export function valaszadoKepek(ROOT, DIST) {
  const jp = path.join(ROOT, 'assets/img/valtozat/jegyzek.json'), mp = path.join(ROOT, 'uj-oldalak/kep-meretek.json');
  if (!fs.existsSync(jp) || !fs.existsSync(mp)) return 'nincs valtozat-jegyzek vagy mert meret: kihagyva';
  const jegyzek = JSON.parse(fs.readFileSync(jp, 'utf8')), meretek = JSON.parse(fs.readFileSync(mp, 'utf8'));
  const jelek = new Map();
  const jel = (f) => {
    if (!jelek.has(f)) { const p = path.join(DIST, 'assets/img/valtozat', f); jelek.set(f, fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 8) : null); }
    return jelek.get(f);
  };
  let lapDb = 0, kepDb = 0;
  for (const [kulcs, kepek] of Object.entries(meretek)) {
    const fajl = path.join(DIST, kulcs + '.html');
    if (!fs.existsSync(fajl)) continue;
    const mobil = kulcs.startsWith('_m/');
    const h = fs.readFileSync(fajl, 'utf8');
    const kapott = new Map();   // kep -> [srcset, sizes]: a lap <link rel="preload" as="image"> sora is ezt kapja (kulonben az eredetit is letoltene)
    let u = h.replace(/<img\b[^>]*>/g, (tag) => {
      if (/\ssrcset=/.test(tag)) return tag;
      const m = tag.match(/\ssrc="\/assets\/img\/([^"?#]+)((?:\?[^"#]*)?)"/);
      if (!m) return tag;
      const nev = m[1], j = jegyzek[nev], w = kepek[nev];
      if (!j || !w) return tag;
      const alap = nev.replace(/\.[^./]+$/, '');
      const elemek = [];
      for (const vw of j.valtozatok) { const v = jel(`${alap}-${vw}.webp`); if (v) elemek.push(`/assets/img/valtozat/${alap}-${vw}.webp?v=${v} ${vw}w`); }
      if (!elemek.length) return tag;
      if (!j.valtozatok.includes(j.w)) elemek.push(`/assets/img/${nev}${m[2]} ${j.w}w`);
      const vw = (px, szeles) => Math.min(100, Math.ceil((px * TARTALEK / szeles) * 100));
      const sizes = mobil ? `${vw(w[0], 390)}vw` : `(max-width: 1000px) ${vw(w[1], 820)}vw, (min-width: 1440px) ${Math.ceil(w[0] * TARTALEK)}px, ${vw(w[0], 1440)}vw`;
      kepDb++;
      kapott.set(nev, [elemek.join(', '), sizes]);
      return tag.replace(/\ssrc="/, ` srcset="${elemek.join(', ')}" sizes="${sizes}" src="`);
    });
    u = u.replace(/<link\b(?=[^>]*\srel="preload")(?=[^>]*\sas="image")[^>]*>/g, (tag) => {
      const m = tag.match(/\shref="\/assets\/img\/([^"?#]+)/);
      const k = m && kapott.get(m[1]);
      return k && !/imagesrcset=/.test(tag) ? tag.replace(/\shref="/, ` imagesrcset="${k[0]}" imagesizes="${k[1]}" href="`) : tag;
    });
    if (u !== h) { fs.writeFileSync(fajl, u); lapDb++; }
  }
  return `${lapDb} lapon ${kepDb} kep kapott valaszado meretet`;
}
