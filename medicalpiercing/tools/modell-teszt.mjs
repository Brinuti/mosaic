// A modellkereso napok foglalorendszerenek tesztje (D1 helyett node:sqlite): beosztas, foglalas, versenyhelyzet, lemondas, varolista, levelek, API, "A foglalasod" oldal.
// Futtatas: node tools/modell-teszt.mjs
import { savok, sav, NAPOK, TIPUSOK, kezdesEpoch, erkezesIdo, elerhetoseg } from '../lib/modell/beosztas.js';
import * as T from '../lib/modell/tarolo.js';
import { level } from '../lib/modell/levelek.js';
import { api, foglalasOldal, kuldEsedekes, tick } from '../lib/modell/vegpont.js';

let ok = 0, rossz = 0;
const ellenorzes = (feltetel, uzenet, reszlet) => { if (feltetel) ok += 1; else { rossz += 1; console.error('HIBA:', uzenet, reszlet === undefined ? '' : JSON.stringify(reszlet)); } };
const egyenlo = (a, b, uzenet) => ellenorzes(JSON.stringify(a) === JSON.stringify(b), uzenet, { kapott: a, vart: b });

import { d1 } from './modell-d1.mjs';

const E = (n) => `vendeg${n}@example.hu`;
const TEL = (n) => `0630${String(1000000 + n)}`;
const ADAT = (n, extra = {}) => ({ korny: 'eles', nev: `Teszt Vendég ${n}`, email: E(n), telefon: TEL(n), ...extra });
const MOST = Math.floor(Date.UTC(2026, 10, 1, 9, 0, 0) / 1000);   // 2026. nov. 1. 10:00 (CET)

// ---- 1. beosztas ---------------------------------------------------------------------------------------------------------------------------------------
{
  const a = savok('2026-11-25'), b = savok('2026-11-30');
  egyenlo([a.length, a.filter((s) => s.szerep === 'elsodleges').length], [20, 10], '25-en 10 elsodleges + 10 tartalek');
  egyenlo([b.length, b.filter((s) => s.szerep === 'elsodleges').length], [30, 15], '30-an 15 elsodleges + 15 tartalek');
  for (const d of ['2026-11-25', '2026-11-30']) {
    const k = savok(d).map((s) => `${s.tipus}|${s.ido}`);
    ellenorzes(new Set(k).size === k.length, `${d}: nincs ket azonos (tipus, ido) sav`);
    for (const t of TIPUSOK) {
      const el = savok(d).filter((s) => s.tipus === t.kulcs && s.szerep === 'elsodleges').length;
      egyenlo(el, NAPOK.find((n) => n.datum === d).piercerek, `${d} ${t.kulcs}: piercerenkent egy elsodleges`);
    }
    // egy piercer szurasai nem fedik egymast: elsodleges savok 24 percenkent
    const p1 = savok(d).filter((s) => s.piercer === 1 && s.szerep === 'elsodleges').map((s) => s.ido).sort();
    egyenlo(p1, ['10:00', '10:24', '10:48', '11:12', '11:36'], `${d}: az 1. piercer 24 percenkent szur`);
  }
  egyenlo(sav('2026-11-25', 'szemoldok', '10:12')?.szerep, 'tartalek', 'a 10:12 szemoldok sav tartalek');
  egyenlo(erkezesIdo('10:00'), '09:30', 'erkezes: 30 perccel elotte');
  egyenlo(kezdesEpoch('2026-11-25', '10:00'), 1795597200, 'kezdes epoch (UTC+1)');
  const el = elerhetoseg([{ nap: '2026-11-25', tipus: 'orr', ido: savok('2026-11-25').find((s) => s.tipus === 'orr' && s.szerep === 'elsodleges').ido }]);
  egyenlo(el[0].szabadFo, 9, 'egy foglalas utan 9 szabad elsodleges');
  egyenlo(el[0].tipusok.orr.length, 3, 'az orrnal az elsodleges mellett a tartalek is latszik (egy foglalt par)');
}

// ---- 2. tarolo: foglalas, ketszeres foglalas, tartalek, versenyhelyzet -----------------------------------------------------------------------------
const elsoOrr = savok('2026-11-25').filter((s) => s.tipus === 'orr' && s.szerep === 'elsodleges');
const [orr1, orr2] = elsoOrr;
const tartOrr1 = savok('2026-11-25').find((s) => s.tipus === 'orr' && s.szerep === 'tartalek' && s.elsodlegesIdo === orr1.ido);
{
  const db = d1();
  const f1 = await T.foglal(db, { ...ADAT(1), nap: '2026-11-25', tipus: 'orr', ido: orr1.ido, most: MOST });
  ellenorzes(f1.ok && f1.foglalas.allapot === 'aktiv', 'az elso foglalas sikerul', f1);
  ellenorzes(/^[a-z0-9]{20}$/.test(f1.id), 'az azonosito 20 karakteres, kisbetus', f1.id);
  egyenlo(f1.foglalas.telefon, '+36301000001', 'a telefon +36 formara tisztul');
  const dupla = await T.foglal(db, { ...ADAT(2), nap: '2026-11-25', tipus: 'orr', ido: orr1.ido, most: MOST });
  egyenlo(dupla.hiba, 'foglalt', 'ugyanarra a savra masodik foglalas: foglalt');
  const elobb = await T.foglal(db, { ...ADAT(3), nap: '2026-11-25', tipus: 'orr', ido: tartOrr1.ido, most: MOST, korny: 'eles' });
  ellenorzes(elobb.ok, 'a tartalek foglalhato, ha az elsodleges foglalt', elobb);
  const tartElsodlegesNelkul = savok('2026-11-25').find((s) => s.tipus === 'ajak' && s.szerep === 'tartalek');
  egyenlo((await T.foglal(db, { ...ADAT(4), nap: '2026-11-25', tipus: 'ajak', ido: tartElsodlegesNelkul.ido, most: MOST })).hiba, 'nincs_elsodleges', 'tartalek elsodleges nelkul nem foglalhato');
  egyenlo((await T.foglal(db, { ...ADAT(1, { email: 'masik@example.hu' }), nap: '2026-11-25', tipus: 'orr', ido: orr2.ido, most: MOST })).hiba, 'mar_van', 'ugyanazzal a telefonnal masodik foglalas: mar_van');
  egyenlo((await T.foglal(db, { ...ADAT(9, { telefon: '123' }), nap: '2026-11-25', tipus: 'orr', ido: orr2.ido, most: MOST })).hiba, 'hibas_adat', 'hibas telefon');
  egyenlo((await T.foglal(db, { ...ADAT(9, { email: 'nem-email' }), nap: '2026-11-25', tipus: 'orr', ido: orr2.ido, most: MOST })).hiba, 'hibas_adat', 'hibas e-mail');
  egyenlo((await T.foglal(db, { ...ADAT(9), nap: '2026-11-26', tipus: 'orr', ido: '10:00', most: MOST })).hiba, 'ervenytelen_sav', 'ismeretlen nap');
  egyenlo((await T.foglal(db, { ...ADAT(9), nap: '2026-11-25', tipus: 'orr', ido: '10:01', most: MOST })).hiba, 'ervenytelen_sav', 'ismeretlen ido');
  // elonezeti sorok nem foglalnak helyet az eles savokbol
  ellenorzes((await T.foglal(db, { ...ADAT(1), korny: 'elonezet', nap: '2026-11-25', tipus: 'orr', ido: orr1.ido, most: MOST })).ok, 'az elonezet kulon kornyezet: az eles foglalas nem akadalyozza');
  const sz = await T.szabad(db, 'eles');
  egyenlo(sz.napok[0].tipusok.orr.filter((x) => !x.szabad).length, 2, 'az eles elerhetoseg: 2 foglalt orr-sav (elsodleges + tartalek)');
  // IP-limit
  const ip = 'ip-teszt-1';
  const szabadSavok = savok('2026-11-30').filter((s) => s.szerep === 'elsodleges');
  for (let i = 0; i < T.MAX_AKTIV_IP_NAPONTA; i++) ellenorzes((await T.foglal(db, { ...ADAT(100 + i), nap: '2026-11-30', tipus: szabadSavok[i].tipus, ido: szabadSavok[i].ido, ipHash: ip, most: MOST })).ok, `IP-limit: a(z) ${i + 1}. foglalas sikerul`);
  egyenlo((await T.foglal(db, { ...ADAT(200), nap: '2026-11-30', tipus: szabadSavok[5].tipus, ido: szabadSavok[5].ido, ipHash: ip, most: MOST })).hiba, 'tul_sok', 'egy IP-rol naponta legfeljebb 5 foglalas');
  ellenorzes((await T.foglal(db, { ...ADAT(201), nap: '2026-11-30', tipus: szabadSavok[5].tipus, ido: szabadSavok[5].ido, ipHash: 'masik-ip', most: MOST + 86500 })).ok, 'masik IP-rol (es 24 ora mulva) a foglalas megy');
}
{ // versenyhelyzet: 12 egyidejű foglalás ugyanarra a savra -> pontosan egy sikeres
  const db = d1();
  await T.sema(db);
  const r = await Promise.all(Array.from({ length: 12 }, (_, i) => T.foglal(db, { ...ADAT(300 + i), nap: '2026-11-25', tipus: 'rook', ido: savok('2026-11-25').find((s) => s.tipus === 'rook' && s.szerep === 'elsodleges').ido, most: MOST })));
  egyenlo(r.filter((x) => x.ok).length, 1, 'versenyhelyzet: 12 egyideju foglalasbol pontosan 1 sikeres');
  egyenlo(r.filter((x) => !x.ok && x.hiba === 'foglalt').length, 11, 'a tobbi 11: foglalt');
  const sorok = (await db.prepare('SELECT COUNT(*) AS db FROM modell_foglalas').first()).db;
  egyenlo(sorok, 1, 'az adatbazisban 1 sor van (a bukott batch visszagordult)');
  const uz = (await db.prepare('SELECT COUNT(*) AS db FROM modell_uzenet').first()).db;
  ellenorzes(uz >= 1 && uz <= 3, 'csak a nyertes foglalas leveleit tervezte be', uz);
}

// ---- 3. megerosites, lemondas, varolista, lejarat --------------------------------------------------------------------------------------------------------
{
  const db = d1();
  const fogl = (n, sv) => T.foglal(db, { ...ADAT(n), nap: '2026-11-25', tipus: 'orr', ido: sv.ido, most: MOST });
  const A = await fogl(1, orr1), B = await fogl(2, orr2), Ca = await fogl(3, tartOrr1);
  const tartOrr2 = savok('2026-11-25').find((s) => s.tipus === 'orr' && s.szerep === 'tartalek' && s.elsodlegesIdo === orr2.ido);
  const Dd = await fogl(4, tartOrr2);
  ellenorzes(A.ok && B.ok && Ca.ok && Dd.ok, 'az orr mind a 4 helye foglalt', [A, B, Ca, Dd].map((x) => x.hiba));
  const sz = await T.szabad(db, 'eles');
  ellenorzes(sz.napok[0].tipusok.orr.every((x) => !x.szabad), 'az orr betelt');
  // megerosites
  const m = await T.megerosit(db, A.id, MOST + 100);
  ellenorzes(m.ok && m.foglalas.megerositve === MOST + 100, 'megerosites rogzul');
  ellenorzes((await T.megerosit(db, A.id, MOST + 999)).foglalas.megerositve === MOST + 100, 'a masodik megerosites nem irja felul');
  egyenlo((await T.megerosit(db, 'nemletezoazonosito1234')).hiba, 'nincs', 'ismeretlen foglalas megerositese: nincs');
  // varolista: az orr tele van -> nincs azonnali ajanlat
  const W1 = await T.varolistaFelvesz(db, { ...ADAT(11), tipus: 'orr', nap: '2026-11-25', most: MOST + 10 });
  const W2 = await T.varolistaFelvesz(db, { ...ADAT(12), tipus: 'orr', nap: '2026-11-25', most: MOST + 20 });
  ellenorzes(W1.ok && W2.ok, 'varolista felvetel', [W1, W2]);
  egyenlo((await T.varolistaFelvesz(db, { ...ADAT(11), tipus: 'orr', most: MOST + 30 })).mar, true, 'ketszeri varolista-felvetel: mar');
  egyenlo((await db.prepare(`SELECT COUNT(*) AS db FROM modell_foglalas WHERE allapot = 'tartva'`).first()).db, 0, 'varolista: a 25-re jelentkezoknek nincs ajanlat, amig nincs szabad hely a 25-en');
  // aki barmelyik napra jelentkezik, azonnal ajanlatot kap, ha a masik napon van szabad orr-hely
  const Wb = await T.varolistaFelvesz(db, { ...ADAT(13), tipus: 'orr', most: MOST + 25 });
  const wbAjanlat = await db.prepare(`SELECT * FROM modell_foglalas WHERE allapot = 'tartva' AND email = ?1`).bind(E(13)).first();
  ellenorzes(Wb.ok && wbAjanlat && wbAjanlat.nap === '2026-11-30', 'a "barmelyik nap" varolistas azonnal ajanlatot kap a szabad 30-i helyre', wbAjanlat);
  await T.lemond(db, wbAjanlat.id, MOST + 26);
  // A lemond -> az elso varolistas (W1) ajanlatot kap A helyere
  const lem = await T.lemond(db, A.id, MOST + 1000);
  ellenorzes(lem.ok && lem.foglalas.allapot === 'lemondva', 'lemondas', lem);
  const ajanlat = await db.prepare(`SELECT * FROM modell_foglalas WHERE allapot = 'tartva'`).first();
  ellenorzes(ajanlat && ajanlat.email === E(11) && ajanlat.ido === orr1.ido, 'az ajanlat a leghamarabb jelentkezo varolistasnak szol, A helyere', ajanlat);
  egyenlo(ajanlat.tartva_eddig, MOST + 1000 + 30 * 60, 'az ajanlat 30 percig tart');
  egyenlo((await T.lemond(db, A.id, MOST + 1001)).mar, true, 'a masodik lemondas: mar lemondva (idempotens)');
  const uzenetek = (await db.prepare(`SELECT tipus FROM modell_uzenet WHERE foglalas_id IN (?1, ?2) ORDER BY tipus`).bind(A.id, ajanlat.id).all()).results.map((x) => x.tipus);
  ellenorzes(uzenetek.includes('lemondas') && uzenetek.includes('felajanlas'), 'lemondo level + felajanlas level tervezve', uzenetek);
  // lejarat: 31 perc mmulva az ajanlat lejar, W2 kapja
  const lejart = await T.lejartAjanlatok(db, 'eles', MOST + 1000 + 31 * 60);
  egyenlo(lejart, 1, 'egy ajanlat lejart');
  const uj = await db.prepare(`SELECT * FROM modell_foglalas WHERE allapot = 'tartva'`).first();
  ellenorzes(uj && uj.email === E(12), 'a lejart ajanlat helyett a kovetkezo varolistas kapja', uj);
  // elfogadas
  egyenlo((await T.ajanlatElfogad(db, uj.id, MOST + 1000 + 31 * 60 + 5)).foglalas.allapot, 'aktiv', 'az ajanlat elfogadasa: aktiv foglalas');
  // lejart ajanlat elfogadasa
  const wTart = await T.foglalasLekerdez(db, ajanlat.id);
  egyenlo(wTart.allapot, 'lejart', 'a lejart ajanlat allapota: lejart');
  egyenlo((await T.ajanlatElfogad(db, ajanlat.id, MOST + 5000)).hiba, 'lejart', 'lejart ajanlat elfogadasa: lejart hiba');
  // nem megerositett foglalasok felszabaditasa (kapcsolhato): a 11:00 elotti 12 oraig meg nem megerositett B
  const elottUtan = kezdesEpoch('2026-11-25', orr2.ido) - 11 * 3600;
  egyenlo(await T.megerositetlenek(db, 'eles', elottUtan, 12), 3, 'a szuras elott 12 oraval a nem megerositett foglalasok felszabadulnak (B, C, D; a megerositett nem)');
  egyenlo((await db.prepare(`SELECT COUNT(*) AS db FROM modell_foglalas WHERE allapot = 'felszabadult'`).first()).db, 3, 'allapot: felszabadult');
}

// ---- 3a. adattorles
{
  const db = d1();
  const f = await T.foglal(db, { ...ADAT(1), nap: '2026-11-25', tipus: 'orr', ido: orr1.ido, most: MOST });
  await T.varolistaFelvesz(db, { ...ADAT(2), tipus: 'rook', nap: '2026-11-30', most: MOST });
  const ELOTTE = kezdesEpoch('2026-11-30', '23:59') + T.ADAT_MEGORZES_NAP * 86400 - 60;
  egyenlo(await T.adatTorles(db, ELOTTE), 0, 'adattorles: a megorzesi ido letelte elott nem torol');
  ellenorzes(!!(await T.foglalasLekerdez(db, f.id)), 'adattorles elott a foglalas megvan');
  const tobb = await T.adatTorles(db, ELOTTE + 120);
  ellenorzes(tobb >= 3, 'adattorles: a megorzesi ido utan torol (foglalas, uzenet, varolista)', tobb);
  egyenlo(await T.foglalasLekerdez(db, f.id), null, 'adattorles utan a foglalas nincs meg');
  egyenlo((await db.prepare('SELECT COUNT(*) AS db FROM modell_varolista').first()).db, 0, 'adattorles: a varolista is ures');
}

// ---- 3b. megszolitas ----------------------------------------------------------------------------------------------------------------------------------
egyenlo([T.szolitas({ nev: 'Kovács Anna', kereszt: 'Anna' }), T.szolitas({ nev: 'Kovács Anna' })], ['Anna', 'Kovács Anna'], 'megszolitas: keresztnev, hiaya eseten a teljes nev');
{
  const l = level('t0', { id: 'abcdefghij1234567890', nap: '2026-11-25', tipus: 'orr', ido: '10:24', nev: 'Kovács Anna', kereszt: 'Anna', megerositve: null });
  ellenorzes(l.html.includes('Megvan a helyed, Anna!') && l.szoveg.startsWith('Megvan a helyed, Anna!'), 'a level a keresztnevvel szolit meg', l.szoveg.slice(0, 80));
  ellenorzes(!/Kovács/.test(l.szoveg), 'a level nem a vezeteknevvel szolit meg');
}

// ---- 4. levelek ---------------------------------------------------------------------------------------------------------------------------------------
{
  const f = { id: 'abcdefghij1234567890', nap: '2026-11-25', tipus: 'orr', ido: '10:24', nev: 'Kovács Anna', megerositve: null };
  for (const tipus of ['t0', 'm48', 'm24', 'lemondas', 'felszabadult', 'felajanlas']) {
    const l = level(tipus, tipus === 'felajanlas' ? { ...f, tartva_eddig: MOST + 1800 } : f);
    ellenorzes(l.targy && l.html && l.szoveg, `${tipus}: targy, html, szoveg`);
    ellenorzes(!/undefined|NaN|null|\[object/.test(l.html + l.szoveg + l.targy), `${tipus}: nincs undefined / NaN a levelben`);
    ellenorzes(l.html.includes(['lemondas', 'felszabadult'].includes(tipus) ? '/modellnap' : '/mf/abcdefghij1234567890'), `${tipus}: a megfelelo link benne van`);
  }
  const t0 = level('t0', f);
  ellenorzes(/workshop|gyakorl/i.test(t0.html), 't0: oktatasi gyakorlonap / workshop szerepel');
  ellenorzes(t0.html.includes('09:54') && t0.html.includes('10:24'), 't0: erkezes (09:54) es a szuras ideje (10:24)', t0.szoveg);
  ellenorzes(!/vizsga|kiserlet|k[ií]s[eé]rlet|kísérlet/i.test(t0.html + t0.szoveg), 't0: nem vizsga / kiserlet (a tulajdonos kerese)');
  ellenorzes(/Kov[aá]cs Rich[aá]rd/.test(t0.html), 't0: Kovacs Richard felugyelete');
  ellenorzes(/nyilatkozat/i.test(t0.html) && /e-mailben/.test(t0.html), 't0: a nyilatkozatot e-mailben kuldjuk');
  for (const tp of ['t0', 'm48', 'm24', 'lemondas', 'felszabadult', 'felajanlas']) for (const mg of [false, true]) { const lv = level(tp, { ...f, megerositve: mg ? 1 : null, tartva_eddig: MOST + 1800 }); ellenorzes(!/személyi|szemelyi/i.test(lv.html + lv.szoveg + lv.targy), `${tp}${mg ? ' (megerositett)' : ''}: nem kerunk szemelyi igazolvanyt`); }
  ellenorzes(!/fotó|fotoz|videó/i.test(t0.html.replace(/fotó(t|k)? (nem|sem)/gi, '')) || /nem k[eé]sz[ií]t/i.test(t0.html), 't0: ha szo van fotorol, akkor csak a tiltasrol');
}

// ---- 5. level-kuldes (kuldEsedekes) ------------------------------------------------------------------------------------------------------------------
{
  const db = d1();
  const kuldott = [];
  const kuld = async (m) => { kuldott.push(m); };
  const F = await T.foglal(db, { ...ADAT(1), nap: '2026-11-25', tipus: 'orr', ido: orr1.ido, most: MOST });
  const elso = await kuldEsedekes(db, 'eles', kuld, MOST);
  egyenlo(elso.elkuldve, 1, 'azonnal elmegy a visszaigazolo level (t0)');
  egyenlo(kuldott[0].to, E(1), 'a cimzett a vendeg');
  egyenlo((await kuldEsedekes(db, 'eles', kuld, MOST)).elkuldve, 0, 'a t0 nem megy ki ketszer');
  // 48 orara a szuras elott: megerosito kerelem; ha megerositette, kihagyva
  const m48 = kezdesEpoch('2026-11-25', orr1.ido) - 48 * 3600;
  const eredm = await kuldEsedekes(db, 'eles', kuld, m48 + 10);
  egyenlo(eredm.elkuldve, 1, 'a szuras elott 48 orara megy a megerosito kerelem');
  const F2 = await T.foglal(db, { ...ADAT(2), nap: '2026-11-25', tipus: 'orr', ido: orr2.ido, most: MOST });
  await kuldEsedekes(db, 'eles', kuld, MOST);
  await T.megerosit(db, F2.id, MOST + 5);
  const n0 = kuldott.length;
  await kuldEsedekes(db, 'eles', kuld, m48 + 20);
  ellenorzes(!kuldott.slice(n0).some((m) => m.to === E(2) && /meger/i.test(m.subject)), 'a megerositett vendeg nem kap megerosito kerelmet (m48 kihagyva)');
  // lemondas utan nincs emlekezteto, van lemondo level
  await T.lemond(db, F.id, m48 + 100);
  const n1 = kuldott.length;
  await kuldEsedekes(db, 'eles', kuld, kezdesEpoch('2026-11-25', orr1.ido) - 24 * 3600 + 10);
  ellenorzes(!kuldott.slice(n1).some((m) => m.to === E(1) && /holnap|emlekez|emlékez/i.test(m.subject)), 'lemondott foglalasra nincs 24 oras emlekezteto');
  ellenorzes(kuldott.slice(n1).some((m) => m.to === E(1)), 'a lemondasrol level megy');
  // elonezeti kornyezet: nem megy ki level
  const dbe = d1();
  await T.foglal(dbe, { ...ADAT(1), korny: 'elonezet', nap: '2026-11-25', tipus: 'orr', ido: orr1.ido, most: MOST });
  const ke = []; const r = await kuldEsedekes(dbe, 'elonezet', async (m) => ke.push(m), MOST);
  ellenorzes(ke.length === 0 && r.elkuldve === 0, 'az elonezeten SOHA nem megy ki level', r);
  // hibas kuldes: ujraprobalas
  const dbh = d1();
  await T.foglal(dbh, { ...ADAT(1), nap: '2026-11-25', tipus: 'orr', ido: orr1.ido, most: MOST });
  const h1 = await kuldEsedekes(dbh, 'eles', async () => { throw new Error('smtp-hiba'); }, MOST);
  egyenlo(h1.hiba, 1, 'smtp-hiba: hibakent szamolva');
  egyenlo((await dbh.prepare('SELECT allapot, probak FROM modell_uzenet WHERE tipus = ?1').bind('t0').first()), { allapot: 'varakozik', probak: 1 }, 'a hibas level ujra a sorba kerul');
  egyenlo((await kuldEsedekes(dbh, 'eles', async () => {}, MOST)).elkuldve, 1, 'a masodik probalkozas sikerul');
  // tick: lejart ajanlat + level
  const t = await tick(dbh, {}, 'eles', async () => {}, MOST + 60);
  ellenorzes(typeof t.lejart === 'number' && t.felszabaditva === 0, 'tick: felszabaditas alapbol ki', t);
}

// ---- 6. API -------------------------------------------------------------------------------------------------------------------------------------------
{
  const db = d1();
  const env = { MP_MERES_DB: db, MP_MERES_ADMIN_KULCS: 'titok-kulcs' };
  const kerj = (url, opt = {}) => new Request(url, opt);
  const post = (url, body) => kerj(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  const jo = { nap: '2026-11-25', tipus: 'koldok', ido: savok('2026-11-25').find((s) => s.tipus === 'koldok' && s.szerep === 'elsodleges').ido, vezeteknev: 'Próba', keresztnev: 'Péter', email: 'proba@example.hu', telefon: '06 30 123 4567', elfogad: true, elmult18: true };
  // eles domain, kapcsolo nelkul: zarva
  let v = await api(post('https://www.medicalpiercing.hu/api/modell/foglal', jo), env, { most: MOST });
  egyenlo(v.status, 403, 'eles domain, MODELL_FOGLALAS nelkul: a foglalas zarva (403)');
  let j = await (await api(kerj('https://www.medicalpiercing.hu/api/modell/szabad'), env, { most: MOST })).json();
  ellenorzes(j.ok === true && j.nyitva === false && j.kornyezet === 'eles', 'szabad: nyitva=false az elesen kapcsolo nelkul', j);
  ellenorzes(Array.isArray(j.napok) && j.napok.length === 2 && j.fo === 25, 'szabad: 2 nap, 25 hely osszesen', j.fo);
  // elonezet: mindig nyitva
  v = await api(post('https://valami.medicalpiercing.pages.dev/api/modell/foglal', jo), env, { most: MOST });
  j = await v.json();
  ellenorzes(v.status === 200 && j.ok && j.link === `/mf/${j.id}`, 'elonezeten a foglalas megy', j);
  const elonezetId = j.id;
  // az elesen a kapcsolo bekapcsolva
  const envBe = { ...env, MODELL_FOGLALAS: 'be' };
  v = await api(post('https://www.medicalpiercing.hu/api/modell/foglal', jo), envBe, { most: MOST });
  j = await v.json();
  ellenorzes(v.status === 200 && j.ok, 'MODELL_FOGLALAS=be: az elesen megy, es nem utkozik az elonezeti foglalassal', j);
  const eles = j.id;
  // hianyzo hozzajarulas
  v = await api(post('https://www.medicalpiercing.hu/api/modell/foglal', { ...jo, nap: '2026-11-30', elfogad: false }), envBe, { most: MOST });
  egyenlo(v.status, 400, 'elfogadas nelkul nincs foglalas');
  // csapda (honeypot)
  v = await api(post('https://www.medicalpiercing.hu/api/modell/foglal', { ...jo, csapda: 'bot' }), envBe, { most: MOST });
  ellenorzes((await v.json()).ok === true && (await db.prepare(`SELECT COUNT(*) AS db FROM modell_foglalas WHERE kornyezet = 'eles'`).first()).db === 1, 'a csapda-mezo: csendben elnyelve, nem keletkezik foglalas');
  // tartalek hely: csak tudomasulvetellel
  const tartSav = savok('2026-11-25').find((s) => s.tipus === 'koldok' && s.szerep === 'tartalek' && s.elsodlegesIdo === jo.ido);
  v = await api(post('https://www.medicalpiercing.hu/api/modell/foglal', { ...jo, ido: tartSav.ido, vezeteknev: 'Tartalék', keresztnev: 'Tamás', email: 'tartalek@example.hu', telefon: '06301110011' }), envBe, { most: MOST });
  j = await v.json();
  ellenorzes(v.status === 400 && j.hiba === 'hianyzo_tartalek_tudomas', 'tartalek hely tudomasulvetel nelkul nem foglalhato', j);
  v = await api(post('https://www.medicalpiercing.hu/api/modell/foglal', { ...jo, ido: tartSav.ido, vezeteknev: 'Tartalék', keresztnev: 'Tamás', email: 'tartalek@example.hu', telefon: '06301110011', tartalek: true }), envBe, { most: MOST });
  ellenorzes(v.status === 200, 'tartalek hely tudomasulvetellel foglalhato (az elsodleges mar foglalt)', await v.clone().json());
  // foglalt sav
  v = await api(post('https://www.medicalpiercing.hu/api/modell/foglal', { ...jo, email: 'masik@example.hu', telefon: '06201234567' }), envBe, { most: MOST });
  egyenlo(v.status, 409, 'foglalt sav: 409');
  // tul nagy torzs
  v = await api(post('https://www.medicalpiercing.hu/api/modell/foglal', { ...jo, vezeteknev: 'x'.repeat(6000) }), envBe, { most: MOST });
  egyenlo(v.status, 400, 'tul nagy kerestorzs: 400');
  // foglalas lekerdezes: nincs e-mail / telefon a valaszban
  v = await api(kerj(`https://www.medicalpiercing.hu/api/modell/foglalas?id=${eles}`), envBe, { most: MOST });
  j = await v.json();
  ellenorzes(j.ok && j.foglalas.keresztnev === 'Péter' && !('email' in j.foglalas) && !('telefon' in j.foglalas) && j.foglalas.erkezes, 'foglalas lekerdezes: keresztnev, erkezes; e-mail / telefon nem', j);
  // muvelet: megerosit, lemond
  j = await (await api(post('https://www.medicalpiercing.hu/api/modell/muvelet', { id: eles, akcio: 'megerosit' }), envBe, { most: MOST })).json();
  ellenorzes(j.ok && j.foglalas.megerositve === true, 'muvelet: megerosit', j);
  // varolista
  j = await (await api(post('https://www.medicalpiercing.hu/api/modell/varolista', { tipus: 'orr', nev: 'Várakozó Vera', email: 'vera@example.hu', telefon: '+36301112233', elfogad: true }), envBe, { most: MOST })).json();
  ellenorzes(j.ok, 'varolista API', j);
  // admin / tick: kulcs nelkul tiltva
  v = await api(kerj('https://www.medicalpiercing.hu/api/modell/admin'), envBe, { most: MOST });
  egyenlo(v.status, 403, 'admin kulcs nelkul: 403');
  v = await api(kerj('https://www.medicalpiercing.hu/api/modell/admin', { headers: { 'x-mp-kulcs': 'titok-kulcs' } }), envBe, { most: MOST });
  j = await v.json();
  ellenorzes(j.ok && !JSON.stringify(j).includes('example.hu'), 'admin: osszesites szemelyes adat nelkul', j);
  // level-minta: elonezeten kulcs nelkul, elesen csak kulccsal (az elesen nem adjuk ki kulcs nelkul)
  v = await api(kerj('https://valami.medicalpiercing.pages.dev/api/modell/level-minta?tipus=t0'), env, { most: MOST });
  ellenorzes(v.status === 200 && (await v.text()).includes('Megvan a helyed, Anna!'), 'level-minta az elonezeten kulcs nelkul megy');
  v = await api(kerj('https://www.medicalpiercing.hu/api/modell/level-minta?tipus=m48'), envBe, { most: MOST });
  egyenlo(v.status, 403, 'level-minta az elesen kulcs nelkul: 403');
  v = await api(kerj('https://www.medicalpiercing.hu/api/modell/nincsilyen'), envBe, { most: MOST });
  egyenlo(v.status, 404, 'ismeretlen vegpont: 404');

  // ---- 7. "A foglalasod" oldal ----
  v = await foglalasOldal(kerj(`https://www.medicalpiercing.hu/mf/${eles}`), envBe, { most: MOST });
  let html = await v.text();
  ellenorzes(v.status === 200 && html.includes('Péter') && html.includes('Érkezés') && /noindex/.test(v.headers.get('x-robots-tag')), 'foglalasi oldal: 200, keresztnev, erkezes, noindex', v.status);
  ellenorzes(!html.includes('proba@example.hu') && !html.includes('4567'), 'foglalasi oldal: e-mail / telefon nem latszik');
  ellenorzes(html.includes('data-akcio="lemond"'), 'foglalasi oldal: van lemondas gomb');
  ellenorzes(!html.includes('data-akcio="megerosit"'), 'a mar megerositett foglalasnal nincs "Ott leszek" gomb');
  v = await foglalasOldal(kerj('https://www.medicalpiercing.hu/mf/nemletezoazonosito1234'), envBe, { most: MOST });
  egyenlo(v.status, 404, 'ismeretlen foglalas: 404');
  v = await foglalasOldal(kerj('https://www.medicalpiercing.hu/mf/<script>'), envBe, { most: MOST });
  egyenlo(v.status, 404, 'hibas azonosito: 404');
  await T.lemond(db, eles, MOST + 10);
  v = await foglalasOldal(kerj(`https://www.medicalpiercing.hu/mf/${eles}`), envBe, { most: MOST });
  html = await v.text();
  ellenorzes(html.includes('már nem él') && !html.includes('data-akcio="'), 'lemondott foglalas oldala: nem el, nincs gomb');
  // XSS: a nev nem kerulhet nyersen az oldalra
  const x = await T.foglal(db, { korny: 'eles', nap: '2026-11-30', tipus: 'rook', ido: savok('2026-11-30').find((s) => s.tipus === 'rook' && s.szerep === 'elsodleges').ido, nev: '<img src=x onerror=alert(1)> Béla', kereszt: '<b>Béla</b>', email: 'xss@example.hu', telefon: '06309998877', most: MOST });
  v = await foglalasOldal(kerj(`https://www.medicalpiercing.hu/mf/${x.id}`), envBe, { most: MOST });
  html = await v.text();
  ellenorzes(!html.includes('<img src=x') && !html.includes('onerror=') && !html.includes('<b>Béla</b>'), 'foglalasi oldal: a nev HTML-je nem jut be nyersen');
  ellenorzes(!level('t0', { ...(await T.foglalasLekerdez(db, x.id)) }).html.includes('<img src=x'), 'level: a nev HTML-je nem jut be nyersen');
}

console.log(`modell-teszt: ${ok} ok, ${rossz} hiba`);
process.exit(rossz ? 1 : 0);
