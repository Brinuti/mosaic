// 1. Dashboard: kezeloi nezet (sajat vendegek; a szakmai vezeto az osszes kezelore lat) es menedzsment nezet (csak aggregalt szamok)
import { h, tolt, oldalCim, toltes, szamKartya, uresAllapot, kartya, tabla, humanizal, lista, pick, datumIdo, ido, ft, valaszto, mezo, jelveny, figyelmeztetes } from './crm-ui.js';
import { allapotJelveny, szolgNev, BERLET } from './crm-cimkek.js';

export default async function nezet(ctx) {
  const { root, api } = ctx;
  const kezeloi = ctx.van(['therapist', 'clinical_lead']);
  const mened = ctx.van(['salon_manager', 'admin', 'marketing']);
  let mod = ctx.params.get('nezet') || (kezeloi ? 'kezelo' : 'menedzsment');
  if (!kezeloi) mod = 'menedzsment';
  if (!mened && kezeloi) mod = 'kezelo';
  const valasztoEl = kezeloi && mened ? mezo('Nézet', valaszto([['kezelo', 'Kezelői (saját vendégek)'], ['menedzsment', 'Menedzsment (összesített)']], mod, { onchange: (e) => ctx.navigal(`#/dashboard?nezet=${e.target.value}`) })) : null;
  const tartalom = h('div');
  tolt(root, oldalCim(mod === 'kezelo' ? 'Kezelői áttekintés' : 'Menedzsment-áttekintés', valasztoEl), mod === 'menedzsment' ? h('p', { class: 'halvany' }, 'Összesített számok, nyers egészségi adat és vendégnév nélkül.') : null, tartalom);
  const adat = await toltes(tartalom, () => api.get('/dashboard', { nezet: mod }));
  if (adat === undefined) return;
  const ki = mod === 'kezelo' ? kezeloRajz(adat, ctx) : menedzsmentRajz(adat);
  tolt(tartalom, ...(ki.length ? ki : [uresAllapot('Nincs megjeleníthető adat.', 'Amint lesznek foglalások és vendégek, itt jelennek meg a napi számok.')]));
}

const db = (x) => (Array.isArray(x) ? x.length : (typeof x === 'number' ? x : 0));
const racs = (...k) => h('div', { class: 'racs-szam' }, ...k);
const vendegLink = (v) => (v && v.id ? h('a', { href: `#/vendegek/${encodeURIComponent(v.id)}` }, v.nev || 'Vendég') : (v && v.nev) || '–');
const idopont = (t) => (t === undefined || t === null ? '–' : datumIdo(t));

function kezeloRajz(a, ctx) {
  const ki = [];
  const mai = lista(a.ma && a.ma.foglalasok); const holnapi = lista(a.holnap && a.holnap.foglalasok);
  const stop = a.stopok || {}; const klin = lista(stop.klinikai); const riaszt = lista(stop.ellenjavallati_riasztasok); const panaszok = lista(stop.nyitott_panaszok);
  const a5 = lista(a.keszulo_a5); const hibak = lista(a.kuldesi_hibak); const lejaro = lista(a.lejaro_berletek); const igvar = lista(a.igazolasra_var);
  const tel = a.teljesitett_alkalmak || {};
  const stopDb = klin.length + riaszt.length + panaszok.length;
  if (a.hatokor === 'osszes') ki.push(h('p', { class: 'halvany kicsi' }, 'Szakmai vezetői nézet: az összes kezelő vendégei.'));
  if (riaszt.length) ki.push(figyelmeztetes('veszely', h('strong', null, `${riaszt.length} nyitott ellenjavallati riasztás. `), 'A kezelés csak szakmai ellenőrzés után indulhat (Állapotfelmérő).'));
  ki.push(racs(
    szamKartya('Mai foglalások', mai.length, `holnap: ${holnapi.length}`),
    szamKartya('Új első kezelések', db(lista(a.uj_elso_kezelesek && a.uj_elso_kezelesek.ma)), `holnap: ${db(lista(a.uj_elso_kezelesek && a.uj_elso_kezelesek.holnap))}`),
    szamKartya('Hajkamerás felmérések', db(lista(a.felmeresek && a.felmeresek.ma)), `holnap: ${db(lista(a.felmeresek && a.felmeresek.holnap))}`),
    szamKartya('Teljesített alkalmak (ma)', tel.ma ?? 0, `7 nap: ${tel.het ?? 0} · 30 nap: ${tel.honap ?? 0}`),
    szamKartya('Igazolásra vár', igvar.length, 'elmúlt foglalás, nincs igazolva', igvar.length ? 'figyelem' : ''),
    szamKartya('Készülő A5 / dokumentum', a5.length, `késett: ${a5.filter((x) => x.kesett).length}`, a5.some((x) => x.kesett) ? 'veszely' : ''),
    szamKartya('Lejáró bérletek', lejaro.length, '30 napon belül', lejaro.length ? 'figyelem' : ''),
    szamKartya('STOP / nyitott ügy', stopDb, `panasz: ${panaszok.length} · klinikai: ${klin.length}`, stopDb ? 'veszely' : ''),
    szamKartya('Küldési hibák', hibak.length, null, hibak.length ? 'veszely' : ''),
  ));
  const foglTabla = (sorok) => tabla([
    { cim: 'Idő', ertek: (s) => h('strong', null, ido(s.kezdet)) }, { cim: 'Vendég', ertek: (s) => vendegLink(s.vendeg) }, { cim: 'Szolgáltatás', ertek: (s) => szolgNev(s.szolgaltatas) },
    { cim: 'Kérdőív', ertek: (s) => allapotJelveny('felmero', s.kerdoiv || 'missing') }, { cim: 'Jelzés', ertek: (s) => (s.kontraindikacio_jelzes ? jelveny('Kontraindikáció', 'veszely') : '') },
    { cim: 'Kamera', ertek: (s) => (s.kamera_kotelezo ? jelveny(`${s.kezeles_sorszam}. alkalom: kép kell`, 'info') : '') }, { cim: 'Állapot', ertek: (s) => allapotJelveny('booking', s.allapot) },
  ], sorok, { ures: 'Nincs foglalás.' });
  ki.push(kartya(`Mai foglalások (${mai.length})`, foglTabla(mai), h('p', null, h('a', { href: '#/munkalista' }, 'Teljes munkalista →'))));
  if (holnapi.length) ki.push(kartya(`Holnapi foglalások (${holnapi.length})`, foglTabla(holnapi)));
  if (igvar.length) ki.push(kartya(`Igazolásra vár (${igvar.length})`, tabla([{ cim: 'Időpont', ertek: (s) => idopont(s.kezdet) }, { cim: 'Szolgáltatás', ertek: (s) => szolgNev(s.szolgaltatas) }], igvar), h('p', null, h('a', { href: '#/munkalista' }, 'Igazolás a munkalistán →'))));
  ki.push(kartya(`Készülő A5 és dokumentumok (${a5.length})`, tabla([{ cim: 'Vendég', ertek: (s) => vendegLink(s.vendeg) }, { cim: 'Állapot', ertek: (s) => allapotJelveny('plan', s.allapot) }, { cim: 'Határidő', ertek: (s) => idopont(s.hatarido) },
    { cim: 'Késés', ertek: (s) => (s.szint === 'DOC48' ? jelveny('+48 óra: szakmai vezető értesítve', 'veszely') : s.szint === 'DOC24' ? jelveny('+24 óra', 'veszely') : jelveny('határidőn belül', 'ok')) }], a5, { ures: 'Nincs hiányzó dokumentum.' }), h('p', null, h('a', { href: '#/kuraterv' }, 'Kúraterv-szerkesztő →'))));
  if (lejaro.length) ki.push(kartya(`Lejáró bérletek (${lejaro.length})`, tabla([{ cim: 'Vendég', ertek: (s) => vendegLink(s.vendeg) }, { cim: 'Típus', ertek: (s) => BERLET[s.tipus] || s.tipus }, { cim: 'Lejárat', ertek: (s) => idopont(s.lejarat) }, { cim: 'Hátra', ertek: (s) => `${s.maradek_nap} nap`, osztaly: 'jobbra' }, { cim: 'Szabad alkalom', ertek: (s) => s.szabad_alkalom, osztaly: 'jobbra' }], lejaro)));
  if (stopDb) ki.push(kartya(`STOP és nyitott ügyek (${stopDb})`, tabla([{ cim: 'Vendég', ertek: (s) => vendegLink(s.vendeg) }, { cim: 'Típus', ertek: (s) => s.tipus }, { cim: 'Részlet', ertek: (s) => s.reszlet }],
    [...klin.map((s) => ({ vendeg: s.vendeg, tipus: jelveny('Klinikai STOP', 'veszely'), reszlet: s.ok })), ...riaszt.map((s) => ({ vendeg: s.vendeg, tipus: jelveny('Ellenjavallati riasztás', 'veszely'), reszlet: s.allapot })), ...panaszok.map((s) => ({ vendeg: s.vendeg, tipus: jelveny('Nyitott panasz', 'figyelem'), reszlet: s.kesett ? 'a 24 órás határidő lejárt' : `határidő: ${idopont(s.hatarido)}` }))])));
  if (hibak.length) ki.push(kartya(`Küldési hibák (${hibak.length})`, tabla([{ cim: 'Sablon', ertek: (s) => h('code', null, s.sablon) }, { cim: 'Csatorna', ertek: (s) => s.csatorna }, { cim: 'Állapot', ertek: (s) => allapotJelveny('job', s.allapot) }, { cim: 'Ok', ertek: (s) => s.ok || '–' }], hibak), h('p', null, h('a', { href: '#/kuldes' }, 'Küldési vezérlő →'))));
  return ki;
}

function menedzsmentRajz(a) {
  if (!a || typeof a !== 'object') return [];
  const ki = [];
  const f = a.foglalasok || {}; const mai = f.ma || {}; const holnap = f.holnap || {};
  const tel = a.teljesitett_alkalmak || {}; const dok = a.dokumentacio || {}; const lej = a.lejaro_berletek || {}; const stop = a.stopok || {}; const hib = a.kuldesi_hibak || {}; const uz = a.uzenetek_utolso_24h || {};
  const szam = (x) => (typeof x === 'number' ? x : 0);
  ki.push(racs(
    szamKartya('Mai foglalások', szam(mai.osszes), `első kezelés: ${szam(mai.first_hair)} · folytató: ${szam(mai.followup_hair)} · felmérés: ${szam(mai.camera_assessment)}`),
    szamKartya('Holnapi foglalások', szam(holnap.osszes), `első kezelés: ${szam(holnap.first_hair)} · felmérés: ${szam(holnap.camera_assessment)}`),
    szamKartya('Teljesített alkalmak (ma)', szam(tel.ma), `7 nap: ${szam(tel.het)} · 30 nap: ${szam(tel.honap)}`),
    szamKartya('Hiányzó dokumentum', szam(dok.hianyzo), `+24 óra késés: ${szam(dok.kesett_24h)} · +48 óra: ${szam(dok.kesett_48h)}`, szam(dok.kesett_24h) ? 'veszely' : ''),
    szamKartya('Lejáró bérletek (30 nap)', szam(lej.harminc_napon_belul), `7 napon belül: ${szam(lej.het_napon_belul)} · szabad alkalom: ${szam(lej.szabad_alkalom_osszes)}`, szam(lej.harminc_napon_belul) ? 'figyelem' : ''),
    szamKartya('Nyitott panasz', szam(stop.nyitott_panasz_db), `késett: ${szam(stop.kesett_panasz_db)}`, szam(stop.nyitott_panasz_db) ? 'veszely' : ''),
    szamKartya('Klinikai STOP', szam(stop.klinikai_stop_db), `nyitott ellenjavallati riasztás: ${szam(stop.nyitott_ellenjavallati_riasztas_db)}`, szam(stop.klinikai_stop_db) ? 'veszely' : ''),
    szamKartya('Függő jóváhagyás', szam(stop.fuggo_kompenzacio_db) + szam(stop.fuggo_osszevonas_db), `kompenzáció: ${szam(stop.fuggo_kompenzacio_db)} · összevonás: ${szam(stop.fuggo_osszevonas_db)}`),
    szamKartya('Küldési hibák', szam(hib.dead) + szam(hib.failed) + szam(hib.blocked), `elakadt: ${szam(hib.dead)} · hibás: ${szam(hib.failed)} · blokkolt: ${szam(hib.blocked)} · függő: ${szam(hib.fuggo)}`, szam(hib.dead) + szam(hib.failed) ? 'veszely' : ''),
    szamKartya('Üzenetek (24 óra)', szam(uz.kikuldve) + szam(uz.dry_run), `kiküldve: ${szam(uz.kikuldve)} · dry-run: ${szam(uz.dry_run)} · kihagyva: ${szam(uz.kihagyva)}`),
  ));
  const kez = lista(tel.kezelonkent_30_nap);
  ki.push(kartya('Kezelőnkénti teljesített alkalmak (30 nap)', tabla([{ cim: 'Kezelő', ertek: (s) => s.kezelo || '–' }, { cim: 'Igazolt alkalom', ertek: (s) => s.db, osztaly: 'jobbra' }], kez, { ures: 'Az elmúlt 30 napban nincs igazolt alkalom.' })));
  return ki;
}
