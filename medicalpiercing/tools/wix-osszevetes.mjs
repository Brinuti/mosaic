// Oldalankenti, funkcionkenti osszevetes az ELES WIX-OLDALLAL (nem csak "mukodik-e", hanem
// "ugyanugy nez-e ki es ugyanugy viselkedik-e").
//
//   node tools/wix-osszevetes.mjs [--mobil] [kulcs...]      (alapbol minden oldal)
//   KLON=https://<ag>.medicalpiercing.pages.dev node tools/wix-osszevetes.mjs ...
//
// Minden oldalon, a Wixen es a klonon ugyanabban a bongeszoben:
//   1. minden lathato link es gomb: megvan-e mindket helyen, hova visz, es a betu / szin /
//      hatter / keret / atlatszosag nyugalmi allapotban es RAMUTATASKOR (a Wixnel sokszor JS
//      allitja: ezt csak igy lehet elkapni);
//   2. kepernyokep azonos gorgetesi helyzetekben (nezetablakonkent), pixelre osszevetve;
//   3. a kattintasra mukodo gombok (galeria, diavetites, ful, video, megosztas, urlap):
//      ugyanaz a kattintas mindket helyen, utana a szekcio kepe osszevetve.
// Az idofuggo tartalmat (diavetites, video, kulso beagyazasok) a kep-elteresnel kulon jelzi,
// ezeket a mentett kepeken (tools/osszevetes/<nezet>/) kell szemmel atnezni.
//
// Merokeres egyik oldalrol sem megy ki (tools/meres-tiltas.mjs). Eredmeny:
// tools/osszevetes/<nezet>/eredmeny.json es kepek a nagyobb elteresekrol.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from './pw.mjs';
import { mindenOldal } from './oldalak.mjs';
import { meresTiltas } from './meres-tiltas.mjs';

const MOBIL = process.argv.includes('--mobil');
const NEZET = MOBIL ? 'mobil' : 'asztali';
const KLON = (process.env.KLON || 'http://localhost:4290').replace(/\/+$/, '');
const WIX = 'https://www.medicalpiercing.hu';
const PARHUZAMOS = +process.env.PARHUZAMOS || 3;
const KEP_HATAR = +process.env.KEP_HATAR || 0.01; // ennyi elterő kepponttol (aranyban) jelez
const kertek = process.argv.slice(2).filter((a) => !a.startsWith('--'));
// a koszonooldalak a Wixen is ugyanazok, de megnyitasuk a Wixen meresi esemenyt keltene: kimaradnak
const oldalak = mindenOldal().filter((o) => o.kulcs !== '404' && !o.kulcs.startsWith('foglalas-ok') && (!kertek.length || kertek.includes(o.kulcs)));
const OUT = path.join(import.meta.dirname, 'osszevetes', NEZET);
fs.mkdirSync(OUT, { recursive: true });

const ctxOpt = MOBIL ? { ...devices['Pixel 5'] }
  : { viewport: { width: 1440, height: 900 }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' };
const b = await chromium.launch();

// --- kepek osszevetese a bongeszoben (canvas) ----------------------------------
const kepCtx = await b.newContext();
const kepLap = await kepCtx.newPage();
await kepLap.setContent('<canvas id="a"></canvas><canvas id="b"></canvas><canvas id="c"></canvas>');
async function kepElteres(pngA, pngB, mentes) {
  return kepLap.evaluate(async ({ a, b, mentes }) => {
    const betolt = (s) => new Promise((ok, nem) => { const i = new Image(); i.onload = () => ok(i); i.onerror = nem; i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = await Promise.all([betolt(a), betolt(b)]);
    // negyedere kicsinyitve vetjuk ossze: a betuk rajzolatanak apro kulonbsege (a klon szabad
    // licencu betuket hasznal) igy elmosodik, a hianyzo / mas szinu / elcsuszott elem nem
    const K = 4;
    const w = Math.floor(Math.min(ia.width, ib.width) / K), h = Math.floor(Math.min(ia.height, ib.height) / K);
    const rajz = (id, img) => { const c = document.getElementById(id); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, img.width / K, img.height / K); return x.getImageData(0, 0, w, h).data; };
    const da = rajz('a', ia), db = rajz('b', ib);
    let rossz = 0;
    for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 60) rossz++;
    const arany = rossz / (w * h || 1);
    let kep = null;
    if (mentes) { // egymas melle: Wix | klon
      const c = document.getElementById('c'); c.width = ia.width + ib.width + 10; c.height = Math.max(ia.height, ib.height);
      const x = c.getContext('2d'); x.fillStyle = '#f0f'; x.fillRect(0, 0, c.width, c.height); x.drawImage(ia, 0, 0); x.drawImage(ib, ia.width + 10, 0);
      kep = c.toDataURL('image/png').split(',')[1];
    }
    return { arany, meret: [ia.width, ia.height, ib.width, ib.height], kep };
  }, { a: pngA.toString('base64'), b: pngB.toString('base64'), mentes });
}

// --- az oldalon: interaktiv elemek, stilusok ---------------------------------
const GYUJT = () => {
  const STIL = ['color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-decoration-line', 'border-top-color', 'border-top-width', 'border-radius', 'opacity', 'box-shadow', 'visibility'];
  const lathato = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('#POPUPS_ROOT, template, [hidden]'); };
  const elemek = [...document.querySelectorAll('a[href], button, [role="button"], input:not([type="hidden"]), textarea, select, [data-popupid]')].filter(lathato);
  const szamlalo = {};
  return elemek.map((e, i) => {
    const horgony = e.closest('[id]');
    const hid = horgony ? horgony.id.replace(/__[0-9a-f-]{36}$/, '__ITEM') : 'body';
    const alap = `${hid}|${e.tagName}|${(e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}`;
    szamlalo[alap] = (szamlalo[alap] || 0) + 1;
    const kulcs = `${alap}|${szamlalo[alap]}`;
    // a szoveget hordozo legbelso elem (a szin gyakran azon van)
    let sz = e; for (const x of e.querySelectorAll('*')) if (x.childNodes.length && [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) { sz = x; break; }
    const st = (x) => { const cs = getComputedStyle(x); return Object.fromEntries(STIL.map((p) => [p, p === 'font-family' ? cs.getPropertyValue(p).split(',')[0].replace(/"/g, '').trim() : cs.getPropertyValue(p)])); };
    const r = e.getBoundingClientRect();
    e.setAttribute('data-mp-ossz', String(i));
    return { kulcs, i, href: e.getAttribute('href'), tag: e.tagName, rect: [r.left, r.top + scrollY, r.width, r.height].map(Math.round), elem: st(e), szoveg: st(sz) };
  });
};
const RAMUTATAS = (i) => {
  const e = document.querySelector(`[data-mp-ossz="${i}"]`);
  if (!e) return null;
  const STIL = ['color', 'background-color', 'text-decoration-line', 'border-top-color', 'opacity', 'box-shadow'];
  let sz = e; for (const x of e.querySelectorAll('*')) if (x.childNodes.length && [...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) { sz = x; break; }
  const st = (x) => { const cs = getComputedStyle(x); return Object.fromEntries(STIL.map((p) => [p, cs.getPropertyValue(p)])); };
  return { elem: st(e), szoveg: st(sz) };
};

const normHref = (h) => {
  if (!h) return h;
  try { const u = new URL(h, WIX + '/'); if (/^(www\.)?medicalpiercing\.hu$/i.test(u.hostname) || u.origin === KLON) return decodeURI(u.pathname.replace(/^\/post\//, '/').replace(/\/+$/, '') || '/') + u.search + u.hash; return u.href.replace(/\/+$/, ''); } catch { return h; }
};
// szamoknal (atlatszosag, atmenet kozben) kis tures
const egyezik = (x, y) => x === y || (/^[\d.]+$/.test(x) && /^[\d.]+$/.test(y) && Math.abs(+x - +y) < 0.05);
const kul = (a, b) => Object.keys(a).filter((k) => !egyezik(a[k], b[k])).map((k) => `${k}: ${a[k]} -> ${b[k]}`);

async function megnyit(cim) {
  const ctx = await b.newContext(ctxOpt);
  await meresTiltas(ctx);
  const p = await ctx.newPage();
  await p.goto(cim, { waitUntil: 'load', timeout: 90000 });
  await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } scrollTo(0, 0); });
  // (az animaciokat nem allitjuk meg: a Wix beuszo elemei a rejtett kezdoallapotban maradnanak)
  await p.waitForTimeout(cim.startsWith(WIX) ? 3500 : 1200);
  // a fejlec gorgeteskor eltunik (Wix-effekt, a klonban klon.js 10.); a Wixen csak a JS lassu
  // betoltese utan mukodik, ezert a kepeken mindket helyen rogzitjuk (kulon teszt meri)
  await p.addStyleTag({ content: '#SITE_HEADER{transform:none!important;transition:none!important}' });
  return { ctx, p };
}

const latottRamutatas = new Map(); // azonos (fejlec / lablec) elemeket egyszer
const latottKattintas = new Set();
const eredmeny = [];

async function oldal(o) {
  const hibak = [];
  const [w, k] = await Promise.all([megnyit(WIX + encodeURI(o.ut)), megnyit(KLON + encodeURI(o.ut))]);
  try {
    const [ew, ek] = await Promise.all([w.p.evaluate(GYUJT), k.p.evaluate(GYUJT)]);
    const mk = new Map(ek.map((x) => [x.kulcs, x]));
    const mw = new Map(ew.map((x) => [x.kulcs, x]));
    for (const x of ew) if (!mk.has(x.kulcs)) hibak.push(`hianyzik a klonbol: ${x.kulcs} (${x.href || ''})`);
    for (const x of ek) if (!mw.has(x.kulcs)) hibak.push(`csak a klonban van: ${x.kulcs} (${x.href || ''})`);
    const parok = ew.filter((x) => mk.has(x.kulcs)).map((x) => [x, mk.get(x.kulcs)]);
    for (const [a, c] of parok) {
      if (normHref(a.href) !== normHref(c.href)) hibak.push(`mas link-cel: ${a.kulcs}: ${normHref(a.href)} -> ${normHref(c.href)}`);
      const d = [...kul(a.elem, c.elem).map((s) => 'elem ' + s), ...kul(a.szoveg, c.szoveg).map((s) => 'szoveg ' + s)];
      if (d.length) hibak.push(`mas stilus: ${a.kulcs}: ${d.join('; ')}`);
    }
    // ramutatas: minden kulonbozo elem egyszer (a fejlec / lablec elemei minden oldalon ugyanazok)
    for (const [a, c] of parok) {
      const sig = a.kulcs + JSON.stringify(a.elem) + JSON.stringify(a.szoveg);
      if (latottRamutatas.has(sig)) continue;
      latottRamutatas.set(sig, true);
      const ra = await ramutat(w.p, a.i), rc = await ramutat(k.p, c.i);
      if (!ra || !rc) continue;
      const d = [...kul(ra.elem, rc.elem).map((s) => 'elem ' + s), ...kul(ra.szoveg, rc.szoveg).map((s) => 'szoveg ' + s)];
      if (d.length) hibak.push(`mas ramutataskor: ${a.kulcs}: ${d.join('; ')}`);
    }
    await Promise.all([w.p.mouse.move(1, 1), k.p.mouse.move(1, 1)]);
    // kepek: azonos gorgetesi helyzetekben a nezetablak (a fejlec mindket helyen ugyanott van)
    const [hw, hk] = await Promise.all([w.p.evaluate(() => document.documentElement.scrollHeight), k.p.evaluate(() => document.documentElement.scrollHeight)]);
    if (Math.abs(hw - hk) > 20) hibak.push(`mas oldalmagassag: ${hw} -> ${hk}`);
    const vh = ctxOpt.viewport ? ctxOpt.viewport.height : 800;
    for (let y = 0; y < Math.min(hw, hk); y += vh) {
      await Promise.all([w.p.evaluate((y) => scrollTo(0, y), y), k.p.evaluate((y) => scrollTo(0, y), y)]);
      await Promise.all([w.p.waitForTimeout(1500), k.p.waitForTimeout(1500)]);
      const [ia, ib] = await Promise.all([w.p.screenshot(), k.p.screenshot()]);
      const r = await kepElteres(ia, ib, false);
      if (r.arany > KEP_HATAR) {
        const m = await kepElteres(ia, ib, true);
        const f = `${o.kulcs.replace(/\//g, '__')}--y${y}.png`;
        fs.writeFileSync(path.join(OUT, f), Buffer.from(m.kep, 'base64'));
        hibak.push(`mas kep: ${y}px-nel: ${(r.arany * 100).toFixed(1)}% elter -> osszevetes/${NEZET}/${f}`);
      }
    }
    await Promise.all([w.p.evaluate(() => scrollTo(0, 0)), k.p.evaluate(() => scrollTo(0, 0))]);
    // kattintasra mukodo gombok (nem link), fajtankent egyszer
    for (const [a, c] of parok.filter(([a]) => !a.href && a.tag !== 'INPUT' && a.tag !== 'TEXTAREA' && a.tag !== 'SELECT')) {
      const fajta = a.kulcs.replace(/\|\d+$/, '');
      if (latottKattintas.has(fajta)) continue;
      latottKattintas.add(fajta);
      const [ka, kc] = await Promise.all([kattint(w.p, a.i), kattint(k.p, c.i)]);
      if (!ka || !kc) { if (ka !== kc) hibak.push(`kattintas: ${a.kulcs}: a Wixen ${ka ? 'mukodik' : 'nem kattinthato'}, a klonban ${kc ? 'mukodik' : 'nem kattinthato'}`); continue; }
      if (ka.url !== kc.url.replace(KLON, WIX)) hibak.push(`kattintas utan mas cim: ${a.kulcs}: ${ka.url} -> ${kc.url}`);
      if (ka.kep && kc.kep) {
        const r = await kepElteres(ka.kep, kc.kep, false);
        if (r.arany > KEP_HATAR * 3) {
          const m = await kepElteres(ka.kep, kc.kep, true);
          const f = `${o.kulcs.replace(/\//g, '__')}--kattintas-${a.i}.png`;
          fs.writeFileSync(path.join(OUT, f), Buffer.from(m.kep, 'base64'));
          hibak.push(`kattintas utan mas kep: ${a.kulcs}: ${(r.arany * 100).toFixed(1)}% -> osszevetes/${NEZET}/${f}`);
        }
      }
      if (w.p.url() !== WIX + encodeURI(o.ut)) await w.p.goto(WIX + encodeURI(o.ut), { waitUntil: 'load' }).catch(() => {});
      if (k.p.url() !== KLON + encodeURI(o.ut)) await k.p.goto(KLON + encodeURI(o.ut), { waitUntil: 'load' }).catch(() => {});
      await Promise.all([w.p.evaluate(GYUJT), k.p.evaluate(GYUJT)]);
    }
  } catch (e) {
    hibak.push(`osszevetes megszakadt: ${e.message.split('\n')[0]}`);
  }
  await w.ctx.close(); await k.ctx.close();
  eredmeny.push({ oldal: o.ut, hibak });
  // menet kozben is mentjuk (egy megszakadt futas eredmenye se vesszen el)
  fs.writeFileSync(path.join(OUT, 'eredmeny.json'), JSON.stringify([...eredmeny].sort((a, c) => a.oldal.localeCompare(c.oldal)), null, 1));
  console.log(`${hibak.length ? 'HIBA' : 'OK  '} ${NEZET} ${o.ut}${hibak.length ? `  (${hibak.length})` : ''}`);
  for (const h of hibak.slice(0, 12)) console.log('       ' + h);
  if (hibak.length > 12) console.log(`       ... +${hibak.length - 12}`);
}

async function ramutat(p, i) {
  const e = p.locator(`[data-mp-ossz="${i}"]`).first();
  try {
    await e.scrollIntoViewIfNeeded({ timeout: 3000 });
    const r = await e.boundingBox();
    if (!r) return null;
    await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 3 });
    await p.waitForTimeout(450);
    return await p.evaluate(RAMUTATAS, i);
  } catch { return null; }
}
async function kattint(p, i) {
  const e = p.locator(`[data-mp-ossz="${i}"]`).first();
  try {
    // ketszer kozepre (a Wixen a kesve betolto tartalom az elso gorgetes utan elcsusztathatja)
    for (let k = 0; k < 2; k++) { await e.evaluate((x) => x.scrollIntoView({ block: 'center' })); await p.waitForTimeout(700); }
    const elotte = p.url();
    await e.click({ timeout: 3000, noWaitAfter: true });
    await p.waitForTimeout(1300);
    const kepp = p.url() === elotte ? await p.screenshot() : null;
    await p.keyboard.press('Escape').catch(() => {});
    return { url: p.url(), kep: kepp };
  } catch { return null; }
}

const sor = [...oldalak];
await Promise.all(Array.from({ length: PARHUZAMOS }, async () => { while (sor.length) await oldal(sor.shift()); }));
await b.close();
eredmeny.sort((a, c) => a.oldal.localeCompare(c.oldal));
fs.writeFileSync(path.join(OUT, 'eredmeny.json'), JSON.stringify(eredmeny, null, 1));
const db = eredmeny.reduce((s, x) => s + x.hibak.length, 0);
console.log(`\n${eredmeny.length} oldal (${NEZET}), ${db} elteres; reszletek: tools/osszevetes/${NEZET}/eredmeny.json`);
process.exit(db ? 1 : 0);
