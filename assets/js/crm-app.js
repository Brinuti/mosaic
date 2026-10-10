// MOSAIC belso CRM: egy oldalas alkalmazas (hash-router, lazy ES-modul nezetek). Nincs build, nincs kulso konyvtar, nincs merokod.
import { api, csrfBeallit, lejaratFigyelo } from './crm-api.js';
import { SZEREPEK } from './crm-cimkek.js';
import { h, tolt, urit, hibaAllapot, betoltAllapot, mezo, ertesit, futtat } from './crm-ui.js';

const GYOKER = document.getElementById('gyoker');

const KEZELOI = ['therapist', 'clinical_lead'];
const MIND = Object.keys(SZEREPEK);

// A menu a szerepkor-matrix (crm/lib/rbac.js) szerint; a backend ugyis ellenoriz minden vegponton.
export const NAV = [
  { kulcs: 'kezeles', szam: 16, cim: 'Kezelés közben', modul: 'kezeles', szerepek: KEZELOI, csoport: 'Napi munka' },   // telefonra szabott, vezetett folyamat
  { kulcs: 'dashboard', szam: 1, cim: 'Áttekintés', modul: 'dashboard', szerepek: [...KEZELOI, 'salon_manager', 'marketing', 'admin'], csoport: 'Napi munka' },   // recepcio: nincs dashboard-jog (assessment.read / stats_aggregate.read)
  { kulcs: 'munkalista', szam: 3, cim: 'Napi munkalista', modul: 'munkalista', szerepek: [...KEZELOI, 'reception', 'salon_manager'], csoport: 'Napi munka' },
  { kulcs: 'vendegek', szam: 2, cim: 'Vendégkereső', modul: 'vendeg', szerepek: ['therapist', 'clinical_lead', 'reception', 'salon_manager', 'admin'] },
  { kulcs: 'felmero', szam: 4, cim: 'Állapotfelmérő', modul: 'felmero', szerepek: KEZELOI, csoport: 'Kezelés' },
  { kulcs: 'kuraterv', szam: 5, cim: 'Kúraterv (A5)', modul: 'kuraterv', szerepek: KEZELOI },
  { kulcs: 'kepek', szam: 6, cim: 'Kameraképek', modul: 'kepek', szerepek: KEZELOI },
  { kulcs: 'kurazaro', szam: 12, cim: 'Kúrazáró dokumentum', modul: 'kurazaro', szerepek: KEZELOI },
  { kulcs: 'berletek', szam: 7, cim: 'Bérletek és ajándékok', modul: 'berletek', szerepek: [...KEZELOI, 'reception', 'salon_manager'], csoport: 'Kereskedelem' },
  { kulcs: 'credit', szam: 8, cim: 'Hajkamera-beszámítás', modul: 'credit', szerepek: [...KEZELOI, 'reception', 'salon_manager'] },
  { kulcs: 'panasz', szam: 11, cim: 'Elégedettség és panasz', modul: 'panasz', szerepek: [...KEZELOI, 'salon_manager'], csoport: 'Vendégkapcsolat' },
  { kulcs: 'kuldes', szam: 9, cim: 'Küldési vezérlő', modul: 'kuldes', szerepek: [...KEZELOI, 'reception', 'marketing', 'admin'] },
  { kulcs: 'hozzajarulas', szam: 10, cim: 'Hozzájárulások', modul: 'hozzajarulas', szerepek: [...KEZELOI, 'reception'] },
  { kulcs: 'osszevonas', szam: 13, cim: 'Összevonási sor', modul: 'osszevonas', szerepek: [...KEZELOI, 'salon_manager'] },
  { kulcs: 'mutatok', szam: 14, cim: 'Mutatók', modul: 'mutatok', szerepek: ['salon_manager', 'marketing', 'admin'], csoport: 'Vezetés' },
  { kulcs: 'beallitasok', szam: 15, cim: 'Hozzáférés és beállítások', modul: 'beallitasok', szerepek: ['salon_manager', 'admin'] },
];

const all = { felhasznalo: null, uzemmod: null, demo: false };
const tarol = {
  olvas(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  ir(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* nincs tarhely */ } },
};

// ---- indulas ----------------------------------------------------------------------------------------------------------------------------
lejaratFigyelo(() => { if (all.felhasznalo) { all.felhasznalo = null; csrfBeallit(null); belepesNezet('A munkamenet lejárt, jelentkezz be újra.'); } });
window.addEventListener('hashchange', () => { if (all.felhasznalo) utvalaszt(); });

(async function indul() {
  tolt(GYOKER, h('div', { class: 'belepes-hatter' }, betoltAllapot('Betöltés…')));
  try {
    const v = await api.elo.get('/auth/en');
    if (v && v.felhasznalo) { belepve(v); return; }
  } catch { /* nincs belepve / nincs szerver */ }
  belepesNezet();
})();

async function belepve(v) {
  all.felhasznalo = v.felhasznalo; csrfBeallit(v.csrf || null);
  all.demo = tarol.olvas('crm_demo') === '1' || !!v.felhasznalo.demo || /(^|[._-])demo([._@-]|$)/i.test(v.felhasznalo.email || '');
  keretEpit();
  await uzemmodBetolt();
  if (!location.hash || location.hash === '#' || location.hash === '#/') location.hash = `#/${NAV.find((n) => van(n.szerepek))?.kulcs || 'dashboard'}`;
  else utvalaszt();
}
const szerepei = () => (all.felhasznalo && all.felhasznalo.szerepek) || [];
const van = (lista) => szerepei().some((r) => lista.includes(r));

// ---- belepes ----------------------------------------------------------------------------------------------------------------------------
async function demoElerheto() {
  // a /auth/demo letezik, ha nem 404/501 (ervenytelen szerepre 4xx-et ad); eles domainen soha nem probaljuk
  if (/(^|\.)mosaicheadspa\.hu$/.test(location.hostname)) return false;
  try { await api.elo.post('/auth/demo', { szerep: '__proba__' }); return true; } catch (e) { return !(e.nemElerheto || e.status === 0); }
}

async function belepesNezet(uzenet) {
  tarol.ir('crm_demo', null);
  const hiba = h('div', { class: 'figyelem figyelem-veszely', role: 'alert', hidden: !uzenet }, uzenet || '');
  const emailBe = h('input', { type: 'email', id: 'be-email', autocomplete: 'username', inputmode: 'email', required: true, autofocus: true });
  const kodBe = h('input', { type: 'text', id: 'be-kod', class: 'kod', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', pattern: '[0-9]{6}', 'aria-label': '6 jegyű kód' });
  const kodMezo = h('div', { hidden: true }, mezo('6 jegyű belépőkód', kodBe, 'A kódot e-mailben küldtük, 10 percig érvényes.'));
  const gomb = h('button', { type: 'submit', class: 'gomb gomb-fo' }, 'Kód küldése');
  let lepes = 1;
  const demoHely = h('div', { class: 'demo-hely' });
  const urlap = h('form', { novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    hiba.hidden = true; gomb.disabled = true;
    try {
      if (lepes === 1) {
        await api.elo.post('/auth/kod-keres', { email: emailBe.value.trim() });
        lepes = 2; kodMezo.hidden = false; gomb.textContent = 'Belépés'; kodBe.focus();
      } else {
        const v = await api.elo.post('/auth/kod-ellenoriz', { email: emailBe.value.trim(), kod: kodBe.value.trim() });
        belepve(v);
      }
    } catch (e) { hiba.textContent = e.message; hiba.hidden = false; } finally { gomb.disabled = false; }
  } }, mezo('E-mail-cím', emailBe), kodMezo, gomb);
  tolt(GYOKER, h('div', { class: 'belepes-hatter' }, h('main', { class: 'belepes-doboz', id: 'fo' },
    h('div', { class: 'logo' }, 'MOSAIC'), h('h1', null, 'Belső felület – belépés'), hiba, urlap, demoHely,
    h('p', { class: 'halvany kicsi kozep', style: 'margin-top:16px' }, 'Csak munkatársaknak. A belépés egyéni és naplózott.'))));
  emailBe.focus();
  if (await demoElerheto()) {
    tolt(demoHely, h('div', { class: 'elvalaszto' }, 'Demo belépés (csak előnézeten)'),
      h('div', { class: 'demo-gombok' }, Object.entries(SZEREPEK).map(([k, nev]) => {
        const b = h('button', { type: 'button', class: 'gomb', 'data-demo': k }, `Demo: ${nev}`);
        b.addEventListener('click', futtat(b, async () => {
          const v = await api.elo.post('/auth/demo', { szerep: k });
          tarol.ir('crm_demo', '1'); belepve(v);
        }));
        return b;
      })));
  }
}

// ---- keret ------------------------------------------------------------------------------------------------------------------------------
let fo; let oldalsavEl; let uzemmodEl; let menuGomb;
function keretEpit() {
  const f = all.felhasznalo;
  uzemmodEl = h('span', { class: 'uzemmod uzemmod-ismeretlen', id: 'uzemmod', title: 'Üzenetküldési üzemmód' }, 'ÜZEMMÓD: …');
  menuGomb = h('button', { type: 'button', class: 'menugomb', 'aria-label': 'Menü', 'aria-expanded': 'false', 'aria-controls': 'oldalsav', onclick: () => menuValt() }, '☰');
  const kilepGomb = h('button', { type: 'button', class: 'gomb gomb-kicsi', id: 'kilep' }, 'Kilépés');
  kilepGomb.addEventListener('click', futtat(kilepGomb, async () => {
    try { await api.post('/auth/kilep', {}); } catch { /* mar nincs session */ }
    all.felhasznalo = null; csrfBeallit(null); tarol.ir('crm_demo', null); location.hash = ''; belepesNezet();
  }));
  const szerepNev = (f.szerepek || []).map((r) => SZEREPEK[r] || r).join(', ') || 'nincs szerepkör';
  let csoport = null;
  const linkek = [];
  for (const n of NAV.filter((x) => van(x.szerepek))) {
    if (n.csoport && n.csoport !== csoport) { csoport = n.csoport; linkek.push(h('div', { class: 'csoport' }, n.csoport)); }
    linkek.push(h('a', { href: `#/${n.kulcs}`, 'data-nav': n.kulcs, onclick: () => menuValt(false) }, h('span', { class: 'sz', 'aria-hidden': 'true' }, n.szam), n.cim));
  }
  oldalsavEl = h('nav', { class: 'oldalsav', id: 'oldalsav', 'aria-label': 'Fő navigáció' }, linkek);
  fo = h('main', { class: 'fo', id: 'fo', tabindex: '-1', onclick: () => { if (oldalsavEl && oldalsavEl.classList.contains('nyitva')) menuValt(false); } });
  const demoSav = all.demo ? h('div', { class: 'demo-sav', role: 'note' }, 'DEMO adatok és demo fiók: a vendégek és az üzenetek nem valósak.') : null;
  tolt(GYOKER, h('div', { class: 'alkalmazas' },
    h('header', { class: 'felso' }, menuGomb, h('div', { class: 'logo' }, 'MOSAIC', h('small', null, 'belső CRM')), h('div', { class: 'terkoz' }), uzemmodEl,
      h('div', { class: 'felhasznalo' }, h('strong', { id: 'felh-nev' }, f.nev || f.email), h('span', { id: 'felh-szerep' }, szerepNev)), kilepGomb),
    demoSav, oldalsavEl, fo));
}
function menuValt(nyit) {
  const uj = nyit === undefined ? !oldalsavEl.classList.contains('nyitva') : nyit;
  oldalsavEl.classList.toggle('nyitva', uj); menuGomb.setAttribute('aria-expanded', String(uj));
}
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && oldalsavEl && oldalsavEl.classList.contains('nyitva')) { menuValt(false); menuGomb.focus(); } });

async function uzemmodBetolt() {
  // az uzemmod olvasasa a 'message' jogot kerik; marketing / szalonvezeto ezt nem kapja (a backend 403-at adna)
  const olvashat = van(['therapist', 'clinical_lead', 'reception', 'admin']);
  try {
    if (!olvashat) throw new Error('nincs jog');
    const u = await api.get('/uzenetek/uzemmod');
    const m = String(u.kuldes || u.mod || '').toLowerCase();
    all.uzemmod = m === 'eles' ? 'eles' : m === 'dry' ? 'dry' : null;
  } catch { all.uzemmod = null; }
  if (!uzemmodEl) return;
  uzemmodEl.className = `uzemmod uzemmod-${all.uzemmod === 'eles' ? 'eles' : all.uzemmod === 'dry' ? 'dry' : 'ismeretlen'}`;
  const [hosszu, rovid] = all.uzemmod === 'eles' ? ['ÉLES KÜLDÉS', 'ÉLES'] : all.uzemmod === 'dry' ? ['DRY-RUN: nincs éles küldés', 'DRY-RUN'] : (olvashat ? ['ÜZEMMÓD: ismeretlen', 'ÜZEMMÓD: ?'] : ['ÜZEMMÓD: nem látható', 'ÜZEMMÓD: –']);
  tolt(uzemmodEl, h('span', { class: 'um-hosszu' }, hosszu), h('span', { class: 'um-rovid', 'aria-hidden': 'true' }, rovid));
  uzemmodEl.title = all.uzemmod === 'dry' ? 'Az üzenetek nem mennek ki valódi vendégeknek (dry-run).' : all.uzemmod === 'eles' ? 'Az üzenetek valódi vendégeknek mennek!' : 'Az üzemmód ebben a szerepkörben nem olvasható.';
}

// ---- router -----------------------------------------------------------------------------------------------------------------------------
let navSzam = 0;
async function utvalaszt() {
  const nyers = location.hash.replace(/^#\/?/, '');
  const [kulcs, qsz = ''] = nyers.split('?');
  const nav = NAV.find((n) => n.kulcs === (kulcs.split('/')[0] || ''));
  const alfa = kulcs.split('/').slice(1);
  const sz = ++navSzam;
  for (const a of oldalsavEl.querySelectorAll('a')) { if (nav && a.dataset.nav === nav.kulcs) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  const uj = h('div', { class: 'nezet', 'data-nezet': nav ? nav.kulcs : '404' });
  tolt(fo, uj);
  if (!nav || !van(nav.szerepek)) {
    tolt(uj, h('h1', { id: 'oldalcim', tabindex: '-1' }, nav ? 'Nincs jogosultság' : 'Az oldal nem található'),
      h('p', null, nav ? 'A szerepköröd ehhez a képernyőhöz nem ad hozzáférést.' : 'Válassz a menüből.'));
    return;
  }
  document.title = `${nav.cim} – MOSAIC CRM`;
  const ctx = {
    root: uj, api, felhasznalo: all.felhasznalo, szerepek: szerepei(), van, alfa, params: new URLSearchParams(qsz),
    uzemmod: () => all.uzemmod, demo: all.demo, navigal: (hash) => { location.hash = hash; },
    frissit: () => utvalaszt(), ertesit,
  };
  tolt(uj, betoltAllapot());
  try {
    const mod = await import(`./crm-nezet-${nav.modul}.js`);
    if (sz !== navSzam) return;
    urit(uj);
    await mod.default(ctx);
  } catch (e) {
    if (sz !== navSzam || (e && e.status === 401)) return;
    const hiba = e && e.status !== undefined ? e : Object.assign(new Error('A képernyő nem tölthető be.'), { status: 0, nemElerheto: false });
    tolt(uj, h('h1', { id: 'oldalcim', tabindex: '-1' }, nav.cim), hibaAllapot(hiba, () => utvalaszt()));
    console.warn('nezet-hiba', nav.kulcs, e && e.message);
  }
  if (sz === navSzam) { const c = document.getElementById('oldalcim'); if (c) c.focus({ preventScroll: true }); }
}
