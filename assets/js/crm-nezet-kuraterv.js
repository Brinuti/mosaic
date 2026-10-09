// 5. Kezeloi kuraterv-szerkeszto (A5 mezok), piszkozat / veglegesites, A5 PDF elonezet + nyomtatas, e-mail kuldes allapota
import { h, tolt, urit, oldalCim, toltes, tabla, kartya, mezo, beviteli, pick, lista, jelveny, gomb, futtat, ertesit, figyelmeztetes, uresAllapot, megerosites, datumIdo, parbeszed, adatsor } from './crm-ui.js';
import { allapotJelveny } from './crm-cimkek.js';

const PDF_BEAGYAZAS = false; // true, ha a CSP_CRM kap frame-src blob: engedelyt
const FAJTA = { plan: 'Személyes A5 kúraterv', review: 'Kontroll-értékelés (3/5/10. alkalom)', closing: 'Kúrazáró összefoglaló (11. alkalom)' };
const HIBA_CIMKE = {
  fo_panasz: 'Fő panasz', megfigyelesek: 'Fejbőr-megfigyelések', cel: 'Személyes cél', ajanlott_terv: 'Ajánlott terv (11 alkalom vagy indokolt egyéni terv)', ritmus_nap: 'Kezelési ritmus (nap)',
  otthoni_apolas: 'Otthoni hajápolás', kezeloi_javaslat_2_3_mondat: 'Kezelői javaslat (2–3 mondat)', kovetkezo_idopont: 'Következő időpont', ertekeles_2_3_mondat: 'Értékelés (2–3 mondat)',
  otthoni_rutin_kontroll: 'Otthoni rutin kontroll', kiindulo_panasz: 'Kiinduló panasz', zaro_ertekeles: 'Záró értékelés', fenntartasi_javaslat: 'Fenntartási javaslat', otthoni_rutin: 'Otthoni rutin',
};

export default async function nezet(ctx) {
  const sid = ctx.alfa[0];
  if (!sid) return valasztas(ctx);
  return szerkeszto(ctx, sid);
}

async function valasztas(ctx) {
  const t = h('div');
  const idBe = beviteli({ id: 'kt-sid', placeholder: 'Kezelés (session) azonosító' });
  tolt(ctx.root, oldalCim('Kúraterv-szerkesztő'),
    h('p', { class: 'halvany' }, 'Válassz egy hiányzó vagy készülő dokumentumot. A tervet a kezelés igazolása után 24 órán belül kell elkészíteni.'), t,
    kartya('Megnyitás azonosítóval', h('form', { class: 'kereso', onsubmit: (e) => { e.preventDefault(); if (idBe.value.trim()) ctx.navigal(`#/kuraterv/${encodeURIComponent(idBe.value.trim())}`); } }, idBe, h('button', { class: 'gomb', type: 'submit' }, 'Megnyitás'))));
  const v = await toltes(t, () => ctx.api.get('/dokumentumok/hianyzo'));
  if (v === undefined) return;
  const sorok = lista(v, 'dokumentumok', 'hianyzo');
  tolt(t, tabla([
    { cim: 'Vendég', ertek: (s) => (s.vendeg && s.vendeg.nev) || pick(s, 'vendeg_nev') || '–' }, { cim: 'Dokumentum', ertek: (s) => FAJTA[pick(s, 'fajta', 'kind')] || pick(s, 'fajta', 'kind') || '–' },
    { cim: 'Kezelő', ertek: (s) => (s.kezelo && s.kezelo.nev) || '–' }, { cim: 'Kezelés ideje', ertek: (s) => datumIdo(s.kezeles_ideje) },
    { cim: 'Állapot', ertek: (s) => allapotJelveny('plan', pick(s, 'allapot', 'status')) },
    { cim: 'Késés', ertek: (s) => { const k = String(pick(s, 'szint', 'riasztas', 'alert') || ''); return /48/.test(k) ? jelveny('+48 óra: Janka értesítve', 'veszely') : /24/.test(k) ? jelveny('+24 óra: kezelői riasztás', 'veszely') : jelveny('határidőn belül', 'ok'); } },
    { cim: '', ertek: (s) => (pick(s, 'kezeles_id', 'session_id') ? h('a', { class: 'gomb gomb-kicsi gomb-fo', href: `#/kuraterv/${encodeURIComponent(pick(s, 'kezeles_id', 'session_id'))}` }, 'Szerkesztés') : '') },
  ], sorok, { ures: 'Nincs 24 órán túl hiányzó dokumentum.', felirat: 'Hiányzó dokumentumok' }));
  // a meg hataridon beluli piszkozatok / hianyzo dokumentumok: az attekintesbol (vendegprofil -> Dokumentumok fulon nyithatok meg)
  const d = await ctx.api.get('/dashboard', { nezet: 'kezelo' }).catch(() => null);
  const kesz = lista(d && d.keszulo_a5);
  if (kesz.length) tolt(t, ...[...t.childNodes], kartya(`Készülő dokumentumok (${kesz.length})`, tabla([
    { cim: 'Vendég', ertek: (s) => (s.vendeg && s.vendeg.id ? h('a', { href: `#/vendegek/${encodeURIComponent(s.vendeg.id)}` }, s.vendeg.nev || 'Vendég') : '–') }, { cim: 'Dokumentum', ertek: (s) => FAJTA[s.fajta] || s.fajta || '–' },
    { cim: 'Állapot', ertek: (s) => allapotJelveny('plan', s.allapot) }, { cim: 'Határidő', ertek: (s) => datumIdo(s.hatarido) },
  ], kesz), h('p', { class: 'halvany kicsi' }, 'A vendégprofil „Dokumentumok” fülén a „Megnyitás” gombbal szerkeszthető.')));
}

async function szerkeszto(ctx, sid) {
  const { api, root } = ctx;
  const cel = h('div');
  tolt(root, oldalCim('Kúraterv-szerkesztő', h('a', { class: 'gomb', href: '#/kuraterv' }, '← Lista')), cel);
  const v = await toltes(cel, () => api.get(`/kezelesek/${encodeURIComponent(sid)}/terv`));
  if (v === undefined) return;
  const t = v.terv || v;
  const planId = pick(t, 'id', 'plan_id');
  const fajta = pick(t, 'fajta', 'kind') || 'plan';
  let mezok = { ...(pick(t, 'mezok', 'fields') || {}) };
  let allapot = pick(t, 'allapot', 'status') || 'draft';
  const lev = v.levezetett || {};
  const zart = allapot === 'sent';
  const ur = {}; // kulcs -> {olvas:()=>ertek}
  const f = (kulcs, felirat, tipus = 'szoveg', sugo, valasztott) => {
    const ertek = valasztott !== undefined ? valasztott : mezok[kulcs];
    let el;
    if (tipus === 'szoveg') el = h('textarea', { 'data-mezo': kulcs, disabled: zart }); else if (tipus === 'egysor') el = beviteli({ 'data-mezo': kulcs, disabled: zart }); else if (tipus === 'szam') el = h('input', { type: 'number', min: '1', max: '120', 'data-mezo': kulcs, disabled: zart });
    else if (tipus === 'lista') el = h('textarea', { 'data-mezo': kulcs, disabled: zart, placeholder: 'Soronként egy megfigyelés' });
    el.value = tipus === 'lista' ? (Array.isArray(ertek) ? ertek.join('\n') : '') : (ertek ?? '');
    ur[kulcs] = { el, tipus };
    return mezo(felirat, el, sugo);
  };
  const jelo = (kulcs, felirat, alap) => {
    const el = h('input', { type: 'checkbox', 'data-mezo': kulcs, checked: mezok[kulcs] ?? alap, disabled: zart });
    ur[kulcs] = { el, tipus: 'jelolo' };
    return h('label', { class: 'jelolo' }, el, felirat);
  };
  const kj = h('div', { class: 'sugo', 'aria-live': 'polite' });
  const mondatok = (s) => String(s || '').split(/[.!?]+(?:\s+|$)/).map((x) => x.trim()).filter((x) => x.length >= 2).length;
  const mezoBlokk = () => {
    if (fajta === 'review') return [f('ertekeles', 'Értékelés (2–3 mondat, tényszerű, nem diagnosztikus)', 'szoveg'), f('otthoni_rutin_kontroll', 'Otthoni rutin kontroll', 'szoveg')];
    if (fajta === 'closing') return [f('kiindulo_panasz', 'Kiinduló panasz', 'szoveg'), f('cel', 'Személyes cél', 'szoveg'), f('zaro_ertekeles', 'Kezelői záró értékelés (mi figyelhető meg és mi nem; nem diagnózis)', 'szoveg'), f('fenntartasi_javaslat', 'Egyéni fenntartási javaslat', 'szoveg'), f('otthoni_rutin', 'Személyre szabott otthoni rutin', 'szoveg')];
    const oa = mezok.otthoni_apolas || {}; const ki = mezok.kovetkezo_idopont || {};
    const oaT = beviteli({ 'data-mezo': 'otthoni_apolas.termek', value: oa.termek || '', disabled: zart }); const oaH = beviteli({ 'data-mezo': 'otthoni_apolas.hasznalat', value: oa.hasznalat || '', disabled: zart });
    const kiB = beviteli({ 'data-mezo': 'kovetkezo_idopont.booking_id', value: ki.booking_id || '', disabled: zart }); const kiI = beviteli({ 'data-mezo': 'kovetkezo_idopont.javasolt_intervallum', value: ki.javasolt_intervallum || '', disabled: zart, placeholder: 'pl. 2 hét múlva' });
    ur['otthoni_apolas.termek'] = { el: oaT, tipus: 'egysor' }; ur['otthoni_apolas.hasznalat'] = { el: oaH, tipus: 'egysor' }; ur['kovetkezo_idopont.booking_id'] = { el: kiB, tipus: 'egysor' }; ur['kovetkezo_idopont.javasolt_intervallum'] = { el: kiI, tipus: 'egysor' };
    return [
      kartya('Kiinduló állapot', f('fo_panasz', 'Fő panasz', 'szoveg'), f('megfigyelesek', 'Látható fejbőr-megfigyelések (2–3, szakmai, nem diagnosztikus)', 'lista')),
      kartya('Cél és terv', f('cel', 'Személyes cél', 'szoveg'), jelo('teljes_kura_11', 'Javasolt teljes kúra: 11 alkalom', true), f('egyeni_terv_indok', 'Szakmailag eltérő egyéni terv indoklása (ha nem 11 alkalom)', 'szoveg'), f('ritmus_nap', 'Kezdeti ritmus (nap, alap: 14)', 'szam')),
      kartya('Otthoni hajápolás', mezo('Oxygeni termék neve', oaT), mezo('Használat', oaH), h('p', { class: 'halvany kicsi' }, 'Erős ajánlás, nem kötelező termékvásárlás; csak szalonos vásárlás.')),
      kartya('Kezelői javaslat', f('kezeloi_javaslat', '2–3 konkrét, nem diagnosztikus mondat: mi látható, mi nem, mit figyelünk, mikor jelezzen problémát', 'szoveg'), kj),
      kartya('Következő időpont', mezo('Salonic foglalási azonosító (ha le van foglalva)', kiB), mezo('Ha nincs foglalás: javasolt időszak', kiI)),
    ];
  };
  const kiolvas = () => {
    const o = { ...mezok };
    for (const [k, { el, tipus }] of Object.entries(ur)) {
      let val;
      if (tipus === 'jelolo') val = el.checked; else if (tipus === 'lista') val = el.value.split('\n').map((x) => x.trim()).filter(Boolean); else if (tipus === 'szam') val = el.value === '' ? null : Number(el.value); else val = el.value.trim();
      if (k.includes('.')) { const [a, b] = k.split('.'); o[a] = { ...(o[a] || {}), [b]: val }; } else o[k] = val;
    }
    if (fajta === 'plan' && o.ritmus_nap == null) o.ritmus_nap = 14;
    return o;
  };
  const allapotSor = h('div', { id: 'kt-allapot' });
  const hibaHely = h('div', { 'aria-live': 'assertive' });
  const pdfHely = h('div');
  const frissitAllapot = () => { if (typeof gKuld !== 'undefined') gKuld.disabled = !planId || !['therapist_final', 'generated_pdf', 'sent'].includes(allapot); frissitAllapotSor(); };
  const frissitAllapotSor = () => tolt(allapotSor, h('div', { class: 'suly' }, h('div', null, allapotJelveny('plan', allapot), ' ', h('span', { class: 'halvany kicsi' }, FAJTA[fajta] || fajta, t.hatarido ? ` · határidő: ${datumIdo(t.hatarido)}` : '')),
    t.elkuldve || allapot === 'sent' || t.email_allapot ? h('div', null, 'E-mail: ', jelveny(t.email_allapot || (ctx.uzemmod() === 'eles' ? 'Elküldve' : 'Sorba állítva (dry-run, valódi küldés nincs)'), 'ok'), t.elkuldve ? ` ${datumIdo(t.elkuldve)}` : '') : h('div', { class: 'halvany kicsi' }, 'E-mail: még nem küldtük el')));
  const mutatHianyok = (e) => {
    const h_ = Array.isArray(e.reszlet) ? e.reszlet : [];
    tolt(hibaHely, figyelmeztetes('veszely', h('strong', null, e.message), h_.length ? h('ul', null, h_.map((x) => h('li', null, HIBA_CIMKE[x] || x))) : null));
  };
  const ment = async () => { const r = await api.put(`/kezelesek/${encodeURIComponent(sid)}/terv`, { mezok: kiolvas() }); mezok = kiolvas(); allapot = pick(r, 'status', 'allapot') || 'draft'; urit(hibaHely); frissitAllapot(); return r; };
  const gMent = h('button', { type: 'button', class: 'gomb', id: 'kt-ment', disabled: zart }, 'Piszkozat mentése');
  gMent.addEventListener('click', futtat(gMent, async () => { await ment(); ertesit('Piszkozat mentve.'); }));
  const gVeg = h('button', { type: 'button', class: 'gomb gomb-fo', id: 'kt-vegleges', disabled: zart || !planId }, 'Véglegesítés (kezelő)');
  gVeg.addEventListener('click', futtat(gVeg, async () => {
    try { await ment(); await api.post(`/tervek/${encodeURIComponent(planId)}/veglegesit`, {}); allapot = 'therapist_final'; urit(hibaHely); frissitAllapot(); ertesit('A dokumentum véglegesítve (kezelő által).'); } catch (e) { if (e.status === 401) throw e; mutatHianyok(e); }
  }));
  const gPdf = h('button', { type: 'button', class: 'gomb', id: 'kt-pdf', disabled: !planId }, 'A5 PDF előnézet');
  gPdf.addEventListener('click', futtat(gPdf, async () => {
    const blob = await api.blob(`/tervek/${encodeURIComponent(planId)}/a5.pdf`);
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    // A /crm oldal CSP-je (frame-src nincs, a fajl-valaszok sandbox CSP-t kapnak) nem engedi a beagyazast: az elonezet uj lapon nyilik, onnan nyomtathato.
    if (PDF_BEAGYAZAS) {
      tolt(pdfHely, kartya('A5 előnézet (148×210 mm)', h('iframe', { class: 'pdf-keret', src: url, title: 'A5 PDF előnézet' })));
      return;
    }
    const uj = window.open(url, '_blank', 'noopener');
    tolt(pdfHely, kartya('A5 PDF előnézet (148×210 mm)',
      figyelmeztetes(uj ? 'ok' : 'figyelem', uj ? 'Az A5 PDF új lapon megnyílt; ott nyomtatható (A5, 100%-os méret, szegély nélkül).' : 'A böngésző letiltotta az új lapot. Használd az alábbi gombokat.'),
      h('div', { class: 'gombsor' }, h('a', { class: 'gomb', href: url, target: '_blank', rel: 'noopener', id: 'kt-pdf-link' }, 'Megnyitás új lapon / nyomtatás'), h('a', { class: 'gomb', href: url, download: `a5-kuraterv-${planId}.pdf`, id: 'kt-pdf-letolt' }, 'PDF letöltése'))));
  }));
  const gKuld = h('button', { type: 'button', class: 'gomb gomb-arany', id: 'kt-kuld', disabled: !planId || !['therapist_final', 'generated_pdf', 'sent'].includes(allapot) }, 'E-mail küldése a vendégnek');
  gKuld.addEventListener('click', futtat(gKuld, async () => {
    if (!(await megerosites('E-mail küldése', 'A személyes dokumentum e-mailben megy a vendégnek (az üzenetküldő során át). Üzemmód: ' + (ctx.uzemmod() === 'eles' ? 'ÉLES – valódi e-mail megy ki!' : 'dry-run, valódi küldés nincs.'), { megerosit: 'Küldés' }))) return;
    try { const r = await api.post(`/tervek/${encodeURIComponent(planId)}/kuld`, {}); allapot = 'sent'; t.elkuldve = Math.floor(Date.now() / 1000); t.email_allapot = (r && r.kuldes_mod === 'eles') ? 'Elküldve (éles)' : 'Sorba állítva (dry-run, valódi küldés nincs)'; urit(hibaHely); frissitAllapot(); ertesit('Az e-mail a küldési sorba került.'); } catch (e) { if (e.status === 401) throw e; mutatHianyok(e); }
  }));
  tolt(cel, lev.vendeg_nev ? kartya('Dokumentum adatai (automatikus)', adatsor([['Vendég', lev.vendeg_nev], ['Kezelés dátuma', lev.datum ? datumIdo(lev.datum) : '–'], ['Kezelő', lev.kezelo_nev || '–'], ['Salonic foglalási azonosító', lev.foglalas_azonosito || '–'], ['Kezelés sorszáma', v.kezeles && v.kezeles.sorszam ? `${v.kezeles.sorszam}.` : '–']])) : null, allapotSor, zart ? figyelmeztetes('info', 'Az elküldött dokumentum nem szerkeszthető.') : figyelmeztetes('info', 'Véglegesítés után módosítva a dokumentum visszakerül piszkozat állapotba, és a PDF-et újra kell generálni.'), hibaHely, ...mezoBlokk(),
    h('div', { class: 'gombsor' }, gMent, gVeg, gPdf, gKuld), pdfHely);
  frissitAllapot();
  const kjFrissit = () => { const e = ur.kezeloi_javaslat || ur.ertekeles; if (!e) return; const n = mondatok(e.el.value); tolt(kj, `Mondatok száma: ${n} `, n >= 2 && n <= 3 ? jelveny('rendben', 'ok') : jelveny('2–3 mondat kell', 'figyelem')); };
  (ur.kezeloi_javaslat || ur.ertekeles)?.el.addEventListener('input', kjFrissit); kjFrissit();
}
