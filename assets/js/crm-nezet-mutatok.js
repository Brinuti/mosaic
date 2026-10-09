// 14. Operativ / marketing mutatok (/merok): SHOW1, R2/R5/R10/R11 stb.; ures / "kohorsz nem ert meg" allapotok
import { h, tolt, oldalCim, toltes, tabla, kartya, szamKartya, isoNap, napEltolas, mezo, pick, lista, szazalek, humanizal, jelveny, figyelmeztetes, uresAllapot, rvJelzo } from './crm-ui.js';

const NEVEK = {
  BOOK_FIRST: ['BOOK_FIRST – első kezelési foglalások', 'Vendégenként az első first_hair foglalás.'], SHOW1: ['SHOW1 – igazolt első kezelések', 'Az első kezelői igazolt kezelést teljesítő vendégek.'],
  SHOW_RATE: ['SHOW_RATE – megjelenési arány', ''], R2: ['R2 – 2. alkalom', 'Az 1. kezelés után 2. alkalomra visszajövők aránya.'], R5: ['R5 – 5. alkalom', ''], R10: ['R10 – 10. alkalom', ''], R11: ['R11 – 11. alkalom (teljes kúra)', ''],
  NEXT_BOOKED_ON_SITE: ['Következő időpont a helyszínen', 'A kezelés végén lefoglalt következő időpont aránya.'], PACKAGE_RATE_5: ['5-ös bérlet konverzió', ''], PACKAGE_RATE_10: ['10-es bérlet konverzió', ''],
  ASSESS_TO_FIRST: ['Felmérés → első kezelés (30 nap)', ''], CREDIT_REDEEM: ['Beszámítás felhasználás', ''], CONSENT_EMAIL: ['E-mail hozzájárulási arány', ''], CONSENT_SMS: ['SMS hozzájárulási arány', ''],
  MESSAGE_DELIVERY: ['Üzenet-kézbesítés', ''], COMPLAINT_RESOLUTION_24H: ['Panasz 24 órás kapcsolatfelvétel', ''], DOC_COMPLETION_24H: ['Dokumentáció 24 órán belül', ''], SALONIC_SYNC_LATENCY: ['Salonic-szinkron késés', ''], MERGE_REVIEW_PENDING: ['Összevonásra váró profilok', ''],
};
const DARAB = new Set(['MERGE_REVIEW_PENDING', 'SHOW1', 'BOOK_FIRST']);
const IDO = new Set(['SALONIC_SYNC_LATENCY']);

export default async function nezet(ctx) {
  const ig = ctx.params.get('ig') || isoNap(); const tol = ctx.params.get('tol') || napEltolas(ig, -90);
  const tolEl = h('input', { type: 'date', id: 'mt-tol', value: tol }); const igEl = h('input', { type: 'date', id: 'mt-ig', value: ig });
  const t = h('div', { 'aria-live': 'polite' });
  tolt(ctx.root, oldalCim('Operatív és marketing mutatók'),
    h('form', { class: 'kereso', onsubmit: (e) => { e.preventDefault(); ctx.navigal(`#/mutatok?tol=${tolEl.value}&ig=${igEl.value}`); } }, mezo('Mettől', tolEl), mezo('Meddig', igEl), h('button', { type: 'submit', class: 'gomb gomb-fo', style: 'align-self:flex-end' }, 'Frissítés')),
    figyelmeztetes('info', 'A mutatók a megjelent (kezelői igazolt) alkalmakból számolnak, kohorsz-érvényesítéssel. Nincs becsült retenció: amíg egy kohorsz nem ért meg, nem mutatunk számot. Aggregált adat, nyers egészségi adat nélkül.'), t);
  const v = await toltes(t, () => ctx.api.get('/merok', { tol, ig }));
  if (v === undefined) return;
  const bontas = lista(pick(v, 'kezelo_bontas', 'kezelok'));
  const forras = (v && v.merok && typeof v.merok === 'object') ? v.merok : v;
  const kartyak = [];
  const SKIP = new Set(['kezelo_bontas', 'kezelok', 'tol', 'ig', 'idoszak', 'most', 'kezelo', 'kampany_bontas']);
  for (const [k, m] of Object.entries(forras)) {
    if (SKIP.has(k) || Array.isArray(m) || m === null || m === undefined) continue;
    const ob = typeof m === 'object' ? m : { ertek: m, ok: 'ok' };
    const [cim, sugo] = NEVEK[k] || [humanizal(k), ''];
    const nemEret = ob.ok === 'kohorsz_nem_ert_meg' || ob.kohorsz_erett === false || ob.megerett === false;
    const ures = ob.ertek === null || ob.ertek === undefined;
    let szoveg;
    if (nemEret) szoveg = 'Még nem ért meg'; else if (ures) szoveg = 'Nincs adat'; else if (IDO.has(k)) szoveg = idoSzoveg(ob.ertek); else if (DARAB.has(k) || ob.egyseg === 'db') szoveg = String(ob.ertek); else szoveg = szazalek(ob.ertek);
    const reszl = [];
    if (nemEret) reszl.push(`Kohorsz: ${ob.kohorsz ?? '–'} vendég; az érettségi idő ${ob.eres_nap ?? '?'} nap, egyik sem ért még meg. Nincs becsült szám.`);
    else if (ob.nevezo !== undefined && ob.nevezo !== null && !DARAB.has(k)) reszl.push(`${ob.szamlalo ?? 0} / ${ob.nevezo}`);
    if (!nemEret && ob.ok === 'ok' && ob.nem_ert_meg > 0) reszl.push(`${ob.nem_ert_meg} vendég kohorsza még nem ért meg (nincs a nevezőben)`);
    if (ob.median_mp !== undefined) reszl.push(`medián ${idoSzoveg(ob.median_mp)}, p95 ${idoSzoveg(ob.p95_mp)}`);
    if (sugo) reszl.push(sugo);
    kartyak.push(szamKartya(cim, szoveg, reszl.join(' · ') || null, nemEret ? 'figyelem' : ''));
  }
  const kamp = v.kampany_bontas;
  tolt(t, kartyak.length ? h('div', { class: 'racs-szam', style: 'grid-template-columns:repeat(auto-fill,minmax(230px,1fr))' }, ...kartyak) : uresAllapot('Az időszakban még nincs számolható mutató.', 'Foglalások és kezelői igazolások után jelennek meg.'),
    kamp && kamp.ok ? figyelmeztetes('figyelem', rvJelzo('REQUIRES_VERIFICATION'), ' Kampány-bontás: nincs forrásadat. ', kamp.megjegyzes || '') : null,
    bontas.length ? kartya('Kezelőnkénti bontás', tabla([{ cim: 'Kezelő', ertek: (s) => pick(s, 'nev', 'kezelo_nev', 'kezelo') || '–' }, { cim: 'SHOW1', ertek: (s) => ertekSzoveg(s.SHOW1, true), osztaly: 'jobbra' }, { cim: 'SHOW_RATE', ertek: (s) => ertekSzoveg(s.SHOW_RATE), osztaly: 'jobbra' }, { cim: 'R2', ertek: (s) => ertekSzoveg(s.R2), osztaly: 'jobbra' }, { cim: 'R5', ertek: (s) => ertekSzoveg(s.R5), osztaly: 'jobbra' }, { cim: 'R10', ertek: (s) => ertekSzoveg(s.R10), osztaly: 'jobbra' }, { cim: 'R11', ertek: (s) => ertekSzoveg(s.R11), osztaly: 'jobbra' }, { cim: 'Dokumentáció 24 óra', ertek: (s) => ertekSzoveg(s.DOC_COMPLETION_24H), osztaly: 'jobbra' }], bontas)) : null);
}
function idoSzoveg(mp) { const x = Number(mp); if (!Number.isFinite(x)) return '–'; return x >= 7200 ? `${(x / 3600).toFixed(1).replace('.', ',')} óra` : x >= 120 ? `${Math.round(x / 60)} perc` : `${Math.round(x)} mp`; }
function ertekSzoveg(m, darab = false) {
  if (m === null || m === undefined) return '–';
  if (typeof m !== 'object') return darab ? String(m) : szazalek(m);
  if (m.ok === 'kohorsz_nem_ert_meg') return 'nem ért meg';
  if (m.ertek === null || m.ertek === undefined) return 'nincs adat';
  return darab ? String(m.ertek) : szazalek(m.ertek);
}
