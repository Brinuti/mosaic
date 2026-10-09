// 4. Digitalis allapotfelmero: kezeloi attekintes (kontraindikacio kezeles) + kerdoiv-verzio kezeles / jovahagyas
import { h, tolt, oldalCim, toltes, tabla, fulek, kartya, adatsor, isoNap, pick, lista, jelveny, rvJelzo, gomb, futtat, ertesit, figyelmeztetes, uresAllapot, megerosites, urlapParbeszed, beviteli, valaszto, humanizal, datumIdo, ido } from './crm-ui.js';
import { allapotJelveny, szolgNev } from './crm-cimkek.js';
import * as N from './crm-normal.js';

const EREDMENY = [['cleared', 'Feloldva – a kezelés mehet'], ['consult', 'Egyeztetés szükséges'], ['postponed', 'Halasztás'], ['contraindicated', 'Ellenjavallt – klinikai STOP']];

export default async function nezet(ctx) {
  const lehetJovahagy = ctx.van(['clinical_lead']);
  tolt(ctx.root, oldalCim('Digitális állapotfelmérő'),
    figyelmeztetes('figyelem', rvJelzo(), ' A kérdőív kérdéseit az Oxygeni hivatalos gyártói protokolljából kell validálni. Amíg a szakmai vezető (clinical_lead) nem hagyja jóvá a verziót, a kérdések NEM végleges klinikai kérdések, és a verzió vendégnek nem adható ki.'),
    fulek([{ cim: 'Beadott kérdőívek átnézése', tolt: (c) => attekintes(c, ctx) }, { cim: 'Kérdőív-verziók', tolt: (c) => verziok(c, ctx, lehetJovahagy) }], ctx.params.get('ful') === 'verziok' ? 1 : 0));
}

async function attekintes(cel, ctx) {
  const { api } = ctx;
  const nap = /^\d{4}-\d{2}-\d{2}$/.test(ctx.params.get('nap') || '') ? ctx.params.get('nap') : isoNap();
  const reszlet = h('div', { 'aria-live': 'polite' });
  const lista_ = h('div');
  tolt(cel, h('div', { class: 'kereso' }, h('input', { type: 'date', value: nap, 'aria-label': 'Nap', id: 'fm-nap', onchange: (e) => betolt(e.target.value) })), lista_, reszlet);
  async function betolt(n) {
    const v = await toltes(lista_, () => api.get('/munkalista', { nap: n }));
    if (v === undefined) return;
    const sorok = lista(v, 'foglalasok').map(N.munkalistaSor);
    tolt(lista_, tabla([
      { cim: 'Idő', ertek: (s) => ido(s.kezdes) }, { cim: 'Vendég', ertek: (s) => s.vendegNev },
      { cim: 'Szolgáltatás', ertek: (s) => szolgNev(s.szolgaltatas) },
      { cim: 'Kérdőív', ertek: (s) => allapotJelveny('felmero', s.felmero || 'missing') },
      { cim: 'Jelzés', ertek: (s) => (s.jelzes ? jelveny('Kontraindikáció-gyanú', 'veszely') : '') },
      { cim: '', ertek: (s) => gomb('Megnyitás', () => reszletBetolt(s), { tipus: 'kicsi', 'data-felmero': s.id }) },
    ], sorok, { ures: 'Erre a napra nincs foglalás.', felirat: 'Foglalások kérdőív-állapottal' }));
  }
  async function reszletBetolt(s) {
    const v = await toltes(reszlet, () => api.get(`/foglalasok/${encodeURIComponent(s.id)}/felmero`));
    if (v === undefined) return;
    const subId = pick(v, 'beadas_id', 'submission_id', 'id');
    const valaszok = v.valaszok || {};
    const jelzesek = lista(v.jelzett_kerdesek || v.jelzesek || []);
    const kerdesek = lista(v.kerdoiv && v.kerdoiv.csoportok).flatMap((cs) => cs.kerdesek || []);
    const rv = /REQUIRES_VERIFICATION/i.test(String(v.verzio || '')) || kerdesek.some((k) => k.requires_verification);
    const beadott = v.kitoltve === true || Object.keys(valaszok).length > 0;
    const eredmeny = valaszto(EREDMENY, 'cleared', { id: 'fm-eredmeny' });
    const megj = h('textarea', { id: 'fm-megj', 'aria-label': 'Megjegyzés', placeholder: 'Rövid szakmai megjegyzés (kötelező ellenjavallat vagy egyeztetés esetén)' });
    const ment = h('button', { type: 'button', class: 'gomb gomb-fo', disabled: !subId || !beadott }, 'Átnézés rögzítése');
    ment.addEventListener('click', futtat(ment, async () => {
      if (eredmeny.value === 'contraindicated' && !(await megerosites('Klinikai STOP', 'Ellenjavallat esetén a kúra szünetel, és a vendégnek nem ajánlható kúra vagy bérlet. Biztosan?', { megerosit: 'Igen, STOP', veszely: true }))) return;
      await api.post(`/felmero/${encodeURIComponent(subId)}/attekint`, { eredmeny: eredmeny.value, megjegyzes: megj.value.trim() || null });
      ertesit('Az átnézés rögzítve.'); ctx.frissit();
    }));
    tolt(reszlet, kartya(`Kérdőív: ${s.vendegNev}`,
      rv ? figyelmeztetes('figyelem', rvJelzo(), ' Ennek a kérdőív-verziónak a kérdései még szakmai ellenőrzésre várnak.') : null,
      jelzesek.length ? figyelmeztetes('veszely', h('strong', null, 'Biztonsági jelzés: '), jelzesek.map((j) => (typeof j === 'string' ? kerdesSzoveg(kerdesek, j) : pick(j, 'kerdes', 'kulcs', 'szoveg') || JSON.stringify(j))).join('; ')) : null,
      v.attekintes ? figyelmeztetes('info', h('strong', null, 'Már átnézve: '), `${v.attekintes.eredmeny || ''} (${datumIdo(v.attekintes.ido)})${v.attekintes.megjegyzes ? ' – ' + v.attekintes.megjegyzes : ''}`) : null,
      Object.keys(valaszok).length ? adatsor(Object.entries(valaszok).map(([k, val]) => [kerdesSzoveg(kerdesek, k), Array.isArray(val) ? val.join(', ') : (val === true ? 'Igen' : val === false ? 'Nem' : String(val ?? ''))])) : uresAllapot('A vendég még nem adta be a kérdőívet.'),
      subId && beadott ? h('div', null, h('h4', null, 'Kezelői átnézés'), h('div', { class: 'mezok-sor' }, h('div', { class: 'mezo' }, h('label', { for: 'fm-eredmeny' }, 'Eredmény'), eredmeny), h('div', { class: 'mezo' }, h('label', { for: 'fm-megj' }, 'Megjegyzés'), megj)), h('div', { class: 'gombsor' }, ment)) : null));
  }
  betolt(nap);
}
function kerdesSzoveg(kerdesek, kulcs) {
  const k = Array.isArray(kerdesek) ? kerdesek.find((x) => x.kulcs === kulcs) : (kerdesek && kerdesek[kulcs]);
  return (k && (k.szoveg || (typeof k === 'string' ? k : ''))) || humanizal(kulcs);
}

async function verziok(cel, ctx, lehetJovahagy) {
  const { api } = ctx;
  const t = h('div');
  const nev = beviteli({ id: 'fm-verzio-nev', 'aria-label': 'Új verzió azonosítója', placeholder: 'pl. v1-vazlat-REQUIRES_VERIFICATION', value: 'v1-vazlat-REQUIRES_VERIFICATION' });
  tolt(cel, t);
  const v = await toltes(t, () => api.get('/felmero/verziok'));
  if (v === undefined) return;
  const sorok = lista(v, 'verziok');
  const csoportok = (def) => { const d = typeof def === 'string' ? safeJson(def) : def; return (d && d.csoportok) || []; };
  tolt(t,
    tabla([
      { cim: 'Verzió', ertek: (s) => h('code', null, pick(s, 'verzio', 'version', 'question_version', 'id')) },
      { cim: 'Állapot', ertek: (s) => { const j = jovahagyott(s); return [j ? jelveny('Jóváhagyva (clinical_lead)', 'ok') : jelveny('Jóváhagyásra vár – nem adható ki', 'figyelem'), ' ', rvJelzo()]; } },
      { cim: 'Kérdések', ertek: (s) => `${csoportok(pick(s, 'kerdesek', 'questions', 'definicio')).reduce((a, c) => a + (c.kerdesek || []).length, 0)} db` },
      { cim: 'Létrehozva', ertek: (s) => datumIdo(pick(s, 'letrehozva', 'created_at')) },
      { cim: '', ertek: (s) => (lehetJovahagy && !jovahagyott(s) ? (() => { const b = h('button', { type: 'button', class: 'gomb gomb-arany gomb-kicsi', 'data-jovahagy': pick(s, 'verzio', 'version', 'question_version', 'id') }, 'Jóváhagyás (szakmai)'); b.addEventListener('click', futtat(b, async () => { if (!(await megerosites('Kérdőív-verzió jóváhagyása', 'Jóváhagyás előtt a kérdéseket a gyártói protokoll alapján ellenőrizted? A jóváhagyott verzió kiadhatóvá válik a vendégeknek.', { megerosit: 'Jóváhagyom' }))) return; await api.post(`/felmero/verziok/${encodeURIComponent(s.id)}/jovahagy`, {}); ertesit('Verzió jóváhagyva.'); verziok(cel, ctx, lehetJovahagy); })); return b; })() : '') },
    ], sorok, { ures: 'Még nincs kérdőív-verzió.', felirat: 'Kérdőív-verziók' }),
    ...sorok.slice(0, 3).map((s) => kartya(`Kérdések: ${pick(s, 'verzio', 'version', 'question_version')}`, csoportok(pick(s, 'kerdesek', 'questions', 'definicio')).map((c) => h('div', null, h('h4', null, c.cim || c.kulcs), h('ul', { class: 'kerdes-lista' }, (c.kerdesek || []).map((k) => h('li', null, k.szoveg || k.kulcs, ' ', k.requires_verification ? rvJelzo() : null))))))),
    lehetJovahagy ? kartya('Új vázlat-verzió', h('p', { class: 'halvany kicsi' }, 'Új verzió az alap kérdéskészletből (REQUIRES_VERIFICATION). Jóváhagyásig nem adható ki vendégnek.'), h('div', { class: 'kereso' }, nev, (() => { const b = h('button', { type: 'button', class: 'gomb', id: 'fm-uj-verzio' }, 'Vázlat létrehozása'); b.addEventListener('click', futtat(b, async () => { if (!nev.value.trim()) { ertesit('Add meg a verzió azonosítóját.', 'hiba'); return; } await api.post('/felmero/verziok', { verzio: nev.value.trim() }); ertesit('Vázlat-verzió létrehozva.'); verziok(cel, ctx, lehetJovahagy); })); return b; })())) : h('p', { class: 'halvany kicsi' }, 'Verziót létrehozni és jóváhagyni csak a szakmai vezető (clinical_lead) tud.'));
}
const jovahagyott = (s) => !!(s.jovahagyva === true || s.approved_by_clinical_lead === 1 || s.approved_by_clinical_lead === true || s.jovahagyva_ekkor || s.approved_at || s.allapot === 'approved');
function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }
