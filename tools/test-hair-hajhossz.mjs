// A fodraszati foglalo hajhossz-lepesenek (HA2B) bongeszos vizsgalata, ELO Salonic-adattal (Betti-eset, 2026-10-22).
//   node tools/netlify-build.mjs && node tools/serve-dist.mjs 4191      (egyik terminal)
//   node tools/test-hair-hajhossz.mjs [http://localhost:4191]          (masik terminal; hálózat kell: a Salonic oldalait a teszt Node-bol kerdezi le, CORS-fejjel adja a lapnak)
// Mit er: (1) ha a valasztott fodraszhoz egy kezelesnek csak EGY hajhossza foglalhato (Betti: teljes szokites = csak extra hosszu), a vendeg akkor is latja az osszes hosszt
// (a nem foglalhatok szurkulnek, indokkal), nem ugrik rogton a naptarra; (2) ahol tobb hossz foglalhato / a fodrasz mind a negyet vallalja, nincs szurke kartya;
// (3) az egyetlen hosszu kezelesek (ferfi hajvagas, pothaj leszedes) tovabbra is rogton a naptarra visznek. A fodraszok kiosztasa a Salonicbol jon: ha a Salonicban valtozik,
// a teszt 1-3. pontjai a valtozashoz igazitandok.
import { createRequire } from 'node:module';
const req = createRequire('/opt/node22/lib/node_modules/');
let pw; try { pw = createRequire(import.meta.url)('playwright'); } catch { pw = req('playwright'); }
const { chromium } = pw;
const S = process.env.TMPDIR || '/tmp/';
const BASE = process.argv[2] || 'http://localhost:4191';
// minden *.salonic.hu keres: szerver-oldali (Node) lekeres, CORS-fejjel (a helyi oldal nem a mosaicheadspa.hu eredetrol fut)
export async function oldal(b, { w = 390, h = 844 } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  p.zar = () => ctx.close();
  const hibak = [];
  p.on('pageerror', (e) => hibak.push('pageerror: ' + e));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|aborted/.test(m.text())) hibak.push('console: ' + m.text().slice(0, 200)); });
  await p.route(/googletagmanager|google-analytics|doubleclick|stape|facebook|tiktok|clarity|hotjar|cookieyes/, (r) => r.abort());
  await p.route(/salonic\.hu/, async (r) => {
    const q = r.request();
    try {
      const resp = await fetch(q.url(), { method: q.method(), headers: { 'user-agent': 'Mozilla/5.0', 'content-type': q.headers()['content-type'] || undefined, accept: q.headers().accept || '*/*' }, body: q.method() === 'GET' || q.method() === 'HEAD' ? undefined : q.postData(), redirect: 'follow' });
      const body = Buffer.from(await resp.arrayBuffer());
      await r.fulfill({ status: resp.status, headers: { 'content-type': resp.headers.get('content-type') || 'text/html', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body });
    } catch (e) { await r.abort(); }
  });
  p.hibak = hibak;
  p.txt = async () => (await p.evaluate(() => { const r = [...document.querySelectorAll('*')].find((e) => e.shadowRoot && e.shadowRoot.querySelector('.be-shell')); return (r ? r.shadowRoot : document).body?.innerText ?? (r ? r.shadowRoot.textContent : document.body.innerText); })).replace(/\s*\n+\s*/g, ' | ').replace(/\u00a0/g, ' ').slice(0, 2500);
  return p;
}

const b = await chromium.launch();
let hiba = 0;
const ok = (nev, felt, info = '') => { console.log((felt ? 'OK   ' : 'HIBA ') + nev + (felt ? '' : '  ' + info)); if (!felt) hiba++; };
async function indit(fod) {
  const p = await oldal(b);
  await p.goto(`${BASE}/foglalo-motor?business=hair&_=${Date.now()}`, { waitUntil: 'load' });
  await p.waitForSelector('.be-choice', { timeout: 30000, state: 'attached' }).catch(() => {});
  await p.waitForTimeout(1500);
  return p;
}
const kattint = async (p, re) => { await p.getByRole('button', { name: re }).first().click(); await p.waitForTimeout(1800); };
const gombok = (p) => p.evaluate(() => [...document.querySelectorAll('.be-choice')].map((e) => ({ t: e.innerText.replace(/\s+/g, ' ').trim(), tilt: e.disabled })));
const FOD = { betti: /Betti/i, noel: /Noel/i, evelin: /Evelin/i };
async function ut(p, fod, szandek, kezeles) { if (fod) await kattint(p, FOD[fod]); else await kattint(p, /Mindegy/i); await kattint(p, szandek); if (kezeles) await kattint(p, kezeles); }

// 1. Betti / teljes szokites: 4 hossz, csak az extra hosszu valaszthato, magyarazat + gomb
{ const p = await indit(); await ut(p, 'betti', /Balayage \/ sz/i, /Teljes sz/i);
  const g = await gombok(p); const t = await p.txt();
  ok('1 Betti / Teljes szokites: a hajhossz-lepes megjelenik', /Milyen hosszú a hajad/.test(t), t);
  ok('1 4 hajhossz latszik (3 tiltott, 1 valaszthato)', g.length === 4 && g.filter((x) => x.tilt).length === 3 && g.filter((x) => !x.tilt).length === 1, JSON.stringify(g));
  ok('1 a valaszthato az Extra hosszu, arral', g.find((x) => !x.tilt)?.t.includes('Extra') && /64 950/.test(g.find((x) => !x.tilt).t), JSON.stringify(g));
  ok('1 a tiltottaknal indok: "Betti ennel nem foglalhato"', g.filter((x) => x.tilt).every((x) => /Betti ennél nem foglalható/.test(x.t)), JSON.stringify(g));
  ok('1 magyarazat + "Masik fodraszt valasztok" gomb', /Másik fodrászt választok/i.test(t) && /Noel és Evelin foglalható/.test(t), t.slice(-420));
  await p.screenshot({ path: S + 'h1.png' });
  await kattint(p, /Másik fodrászt választok/i); const t2 = await p.txt();
  ok('1 a gomb a fodrasz-valasztora visz', /Melyik fodrászt választod/.test(t2), t2);
  await kattint(p, /Noel/i); await kattint(p, /Balayage \/ sz/i); await kattint(p, /Teljes sz/i);
  const g2 = await gombok(p); ok('1 Noel-nel mind a 4 hossz valaszthato', g2.length === 4 && g2.every((x) => !x.tilt), JSON.stringify(g2));
  ok('1 nincs hiba a konzolon', !p.hibak.length, p.hibak.join(' | ')); await p.close(); }
// 2. Betti valasztja az extra hosszut -> naptar
{ const p = await indit(); await ut(p, 'betti', /Balayage \/ sz/i, /Teljes sz/i); await kattint(p, /Extra hosszú/i); const t = await p.txt();
  ok('2 Betti / extra hosszu: naptar, 5 ora, 64 950 Ft, Betti', /Válassz időpontot/.test(t) && /5 óra/.test(t) && /64 950/.test(t) && /Betti/.test(t), t.slice(0, 300)); await p.close(); }
// 3. Betti / Hajfestes / Teljes festes: a Hosszu hiany
{ const p = await indit(); await ut(p, 'betti', /Hajfestés/i, /Teljes festés/i); const g = await gombok(p);
  ok('3 Betti / Teljes festes: 4 hossz, a Hosszu tiltott', g.length === 4 && g.filter((x) => x.tilt).length === 1 && /Hosszú haj/.test(g.find((x) => x.tilt).t) && !/Extra/.test(g.find((x) => x.tilt).t), JSON.stringify(g)); await p.close(); }
// 4. Noel / Evelin / Mindegy: 4 hossz valaszthato
for (const fod of ['noel', 'evelin', null]) { const p = await indit(); await ut(p, fod, /Balayage \/ sz/i, /Teljes sz/i); const g = await gombok(p), t = await p.txt();
  ok(`4 ${fod || 'Mindegy'} / Teljes szokites: 4 hossz mind valaszthato, nincs magyarazat`, g.length === 4 && g.every((x) => !x.tilt) && !/Másik fodrászt választok/.test(t), JSON.stringify(g)); await p.close(); }
// 5. egyetlen hosszu kezeles (Ferfi hajvagas) rogton a naptar
{ const p = await indit(); await ut(p, 'betti', /Hajvágás/i, /Férfi/i); const t = await p.txt();
  ok('5 Betti / Ferfi hajvagas (egy hossz letezik): rogton a naptar', /Válassz időpontot/.test(t), t.slice(0, 200)); await p.close(); }
// 6. Poth aj: Betti csak a leszedest latja -> rogton a naptar (egy kezeles, egy hossz sem letezik)
{ const p = await indit(); await ut(p, 'betti', /Póthaj/i); const t = await p.txt();
  ok('6 Betti / Pothaj leszedes: rogton a naptar', /Válassz időpontot/.test(t) && /leszedés/i.test(t), t.slice(0, 200)); await p.close(); }
// 7. Betti / Balayage (Kozepes, Hosszu, Extra - nincs Rovid senkinel): mind valaszthato
{ const p = await indit(); await ut(p, 'betti', /Balayage \/ sz/i, /^.*Balayage \/ ombre \/ babylight \+ vágás/i); const g = await gombok(p);
  ok('7 Betti / Balayage: 3 hossz mind valaszthato', g.length === 3 && g.every((x) => !x.tilt), JSON.stringify(g)); await p.close(); }
// 8. Betti / Joico
{ const p = await indit(); await ut(p, 'betti', /Joico/i); const g = await gombok(p);
  ok('8 Betti / Joico: 3 hossz valaszthato', g.length === 3 && g.every((x) => !x.tilt), JSON.stringify(g)); await p.close(); }
// 9. Betti sajat oldala (?staff=betti: a fodrasz a linkben): ugyanaz, es a "Masik fodraszt valasztok" nem ugrik vissza Bettihez
{ const p = await oldal(b);
  await p.goto(`${BASE}/foglalo-motor?business=hair&staff=betti&_=${Date.now()}`, { waitUntil: 'load' });
  await p.waitForSelector('.be-choice', { timeout: 30000, state: 'attached' }).catch(() => {}); await p.waitForTimeout(1500);
  await kattint(p, /Balayage \/ sz/i); await kattint(p, /Teljes sz/i);
  const t = await p.txt(); ok('9 ?staff=betti: a hajhossz-lepes tiltott hosszakkal + gombbal', /Betti ennél nem foglalható/.test(t) && /Másik fodrászt választok/i.test(t), t.slice(-300));
  await kattint(p, /Másik fodrászt választok/i); const t2 = await p.txt();
  ok('9 ?staff=betti: a gomb a fodrasz-valasztora visz (nem ugrik vissza Bettihez)', /Melyik fodrászt választod/.test(t2) && /Noel/.test(t2) && /Evelin/.test(t2), t2.slice(0, 300)); await p.close(); }
console.log(hiba ? `${hiba} HIBA` : 'minden rendben');
await b.close();
process.exit(hiba ? 1 : 0);
