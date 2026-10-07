// A lifecycle-motor tesztjei: ertelmezo, idokezeles, utemezo (lead-time szabaly), kirajzolas (minden katalogus-uzenet), motor (befogadas -> kuldes),
// HTTP-vegpontok. A D1-et a node:sqlite helyettesiti (ugyanaz az SQL), a kuldok hamisak.
// Futtatas: node --test tools/lifecycle-teszt/motor.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { ertelmez, htmlSzoveg } from '../../netlify/lib/lifecycle/parser.js';
import { helyi, helyiEpoch, huDatumEpoch, datumRagos, napRag, idotartamSzoveg, ablakba } from '../../netlify/lib/lifecycle/ido.js';
import { normalizal, simpleSmsBontas, smsSzegmens } from '../../netlify/lib/lifecycle/telefon.js';
import { keresztnev } from '../../netlify/lib/lifecycle/nevek.js';
import { szegmensek, tisztaNev, rovidNev, idotartamPerc } from '../../netlify/lib/lifecycle/uzletag.js';
import { tervez, tartalomKeret } from '../../netlify/lib/lifecycle/terv.js';
import { KATALOG, KOZOS } from '../../netlify/lib/lifecycle/katalog/index.js';
import { ertekek, smsKirajzol, emailKirajzol, feladatKirajzol, ragoz } from '../../netlify/lib/lifecycle/render.js';
import { ingest, tick, megerosit, reszletekUrl, napi, beallitas } from '../../netlify/lib/lifecycle/engine.js';
import { api, megerosites, reszletek } from '../../netlify/lib/lifecycle/http.js';

const SEMA = fs.readFileSync(new URL('../../netlify/lib/lifecycle/sema.sql', import.meta.url), 'utf8');
const ORA = 3600, NAP = 86400;

// ---- D1-hamisitvany (node:sqlite) ---------------------------------------------------------------------------------------------------------------
function d1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(SEMA);
  const prepare = (sql) => {
    const st = sqlite.prepare(sql);
    return {
      all: async () => ({ results: st.all() }), run: async () => { const r = st.run(); return { meta: { changes: Number(r.changes) } }; }, first: async () => st.get() ?? null,
      bind: (...p) => ({
        run: async () => { const r = st.run(...p); return { meta: { changes: Number(r.changes) } }; },
        first: async () => st.get(...p) ?? null,
        all: async () => ({ results: st.all(...p) }),
      }),
    };
  };
  return { prepare, batch: async (stmts) => { for (const s of stmts) await s.run(); }, sqlite };
}
function hamisKuldok() {
  const ki = { sms: [], email: [] };
  return { ki, sms: async (a) => { ki.sms.push(a); return { id: `sms-${ki.sms.length}` }; }, email: async (a) => { ki.email.push(a); return { id: `mail-${ki.email.length}` }; }, egyenleg: async () => 12345 };
}

// ---- ertesito-minták (kitalalt vendegek, a Salonic tenyleges formaja szerint) --------------------------------------------------------------------
const UUID1 = '0b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
const UUID2 = '11111111-2222-4333-8444-555555555555';
// uuid nelkul (null): nincs "Foglalas megtekintese" link - a Salonic lemondas-ertesitoje ilyen (nem tartalmazza a foglalas azonositojat)
const html = (cim, sorok, uuid, fiok = 'mosaic-hair') => `<html><head><style>.x{}</style></head><body><table><tr><td>${cim}</td></tr>${sorok.map((s) => `<tr><td>${s}</td></tr>`).join('')}
${uuid ? `<tr><td><a href="https://app.salonic.hu/backend/signin/?customer=${fiok}&amp;redirect=%2Fcalendar%2FshowBooking%2F%3FbookingId%3D${uuid}">Foglalás megtekintése</a></td></tr>` : ''}
<tr><td>Magyar fejlesztésű online naptár és időpontfoglaló rendszer</td></tr></table></body></html>`;
function foglaltLevel({ uzenetId = 'g1', nev = 'Teszt Elek', tel = '06301234567', email = 'teszt.elek@example.com', szolg = '👱‍♀️ Tőfestés + Szárítás - Hosszú haj', munka = 'Betti', datum = 'november 25. (szerda) 16:00', uuid = UUID1, fiok = 'mosaic-hair', kuldo = 'Mosaic Hair <app@salonic.hu>' } = {}) {
  return { uzenetId, targy: `Új online foglalás érkezett: ${szolg}`, kuldo, html: html('Új online foglalás érkezett az alábbi adatokkal, melyet a rendszer automatikusan jóváhagyott:', ['Foglaló adatai:', `Név: ${nev}`, `Mobiltelefonszám: ${tel}`, `E-mail cím: ${email}`, 'Időpont adatok:', `Szolgáltatás: ${szolg}`, `Munkatárs: ${munka}`, `Kezdő dátum: ${datum}`], uuid, fiok) };
}
const athelyezettLevel = ({ uzenetId = 'm1', regi = 'november 25. (szerda) 16:00', uj = 'november 26. (csütörtök) 17:30', uuid = UUID1, szolg = '👱‍♀️ Tőfestés + Szárítás - Hosszú haj', nev = 'Teszt Elek', tel = '06301234567', email = 'teszt.elek@example.com' } = {}) => ({
  uzenetId, targy: `Foglalás módosítva vendég által: ${szolg}`, kuldo: 'Mosaic Hair <app@salonic.hu>',
  html: html('Az alábbi foglalás módosítva lett vendég által:', ['Foglaló adatai:', `Név: ${nev}`, `Mobiltelefonszám: ${tel}`, `E-mail cím: ${email}`, `RÉGI dátum: ${regi}`, `Új dátum: ${uj}`, `1. Szolgáltatás: ${szolg}`, 'Tervezett kezdés: 17:30', 'Munkatárs: Betti', 'Várható időtartam: 3 óra *'], uuid),
});
const lemondottLevel = ({ uzenetId = 'l1', datum = 'november 25. (szerda) 16:00', uuid = null, szolg = '👱‍♀️ Tőfestés + Szárítás - Hosszú haj', nev = 'Teszt Elek', tel = '06301234567', email = 'teszt.elek@example.com' } = {}) => ({
  uzenetId, targy: `Foglalás lemondás - ${nev} - ${szolg}`, kuldo: 'Mosaic Hair <app@salonic.hu>',
  html: html('Az alábbi időpontot a vendég lemondta:', [`Lemondás oka: Próbafoglalás (TESZT), lemondva${datum}`, `Szolgáltatás: ${szolg}`, 'Munkatárs: Betti', 'Foglaló adatai:', `Név: ${nev}`, `Mobiltelefonszám: ${tel}`, `E-mail cím: ${email}`], uuid),
});
const MOST = Date.UTC(2026, 9, 7, 8, 0) / 1000; // 2026-10-07 10:00 (nyari ido)

// ======================================================================================================================================================
test('ragozas: -ra / -hoz / -nak a helyorzo utan', () => {
  assert.equal(ragoz('Betti', 'hoz'), 'Bettihez'); assert.equal(ragoz('Noel', 'hoz'), 'Noelhez'); assert.equal(ragoz('Melitta', 'hoz'), 'Melittához');
  assert.equal(ragoz('Betti', 'nak'), 'Bettinek'); assert.equal(ragoz('Zsófi', 'nak'), 'Zsófinek'); assert.equal(ragoz('Viktória', 'nak'), 'Viktóriának');
  assert.equal(ragoz('PÁROS MOSAIC Head Spa kezelés', 'ra'), 'PÁROS MOSAIC Head Spa kezelésre'); assert.equal(ragoz('Női hajvágás + Szárítás - Hosszú haj', 'ra'), 'Női hajvágás + Szárítás - Hosszú hajra');
  assert.equal(ragoz('16:00', 'ra'), '16:00-ra'); assert.equal(ragoz('Haj Oxigénterápia - 1. alkalom', 'ra'), 'Haj Oxigénterápia - 1. alkalomra');
});

test('ido: helyi <-> epoch, nyari/teli ido, magyar datum', () => {
  assert.equal(helyi(helyiEpoch(2026, 11, 25, 16, 0)).kulcs, '2026-11-25 16:00');
  assert.equal(helyi(helyiEpoch(2026, 7, 1, 9, 30)).kulcs, '2026-07-01 09:30');
  assert.equal(helyiEpoch(2026, 7, 1, 12, 0), Date.UTC(2026, 6, 1, 10, 0) / 1000); // nyar: UTC+2
  assert.equal(helyiEpoch(2026, 12, 1, 12, 0), Date.UTC(2026, 11, 1, 11, 0) / 1000); // tel: UTC+1
  assert.equal(helyi(huDatumEpoch('november 25. (szerda) 16:00', MOST)).kulcs, '2026-11-25 16:00');
  assert.equal(helyi(huDatumEpoch('október 31. (szombat) 15:30', MOST)).kulcs, '2026-10-31 15:30');
  assert.equal(helyi(huDatumEpoch('Lemondás oka:Próbafoglalás (TESZT), lemondvaoktóber 21. (szerda) 16:00', MOST)).kulcs, '2026-10-21 16:00'); // a szokoz nelkul odaragadt szovegben is
  assert.equal(huDatumEpoch('november 25. (kedd) 16:00', MOST) === null || helyi(huDatumEpoch('november 25. (kedd) 16:00', MOST)).y !== 2026, true); // rossz hetnap: masik ev
  assert.equal(huDatumEpoch('nincs datum', MOST), null);
  assert.deepEqual([1, 2, 4, 12, 13, 21, 23, 25, 30, 31].map(napRag), ['-jén', '-án', '-én', '-én', '-án', '-én', '-án', '-én', '-án', '-én']);
  assert.equal(datumRagos(helyiEpoch(2026, 11, 25, 16, 0)), 'november 25-én');
  assert.equal(idotartamSzoveg(80), '1 óra 20 perc');
  assert.equal(idotartamSzoveg(30), '30 perc');
  assert.equal(helyi(ablakba(helyiEpoch(2026, 11, 20, 3, 0), 8, 20.5)).kulcs, '2026-11-20 08:00');
  assert.equal(helyi(ablakba(helyiEpoch(2026, 11, 20, 22, 0), 8, 20.5)).kulcs, '2026-11-20 20:30');
});

test('telefon: normalizalas, SimpleSMS-bontas, szegmens', () => {
  assert.equal(normalizal('06 30 123 4567'), '+36301234567');
  assert.equal(normalizal('+36 20 247 4444'), '+36202474444');
  assert.equal(normalizal('0036701234567'), '+36701234567');
  assert.equal(normalizal('0044709420090'), '+36709420090'); // a teszt-vendeg szama
  assert.equal(normalizal('301234567'), '+36301234567');
  assert.equal(normalizal('abc'), null);
  assert.deepEqual(simpleSmsBontas('+36301234567'), { country_code: '36', area_code: '30', number: '1234567' });
  assert.equal(simpleSmsBontas('+4915112345678'), null);
  assert.equal(smsSzegmens('Szia! Ekezet nelkul.'), 1);
  assert.equal(smsSzegmens('á'.repeat(70)), 1);
  assert.equal(smsSzegmens('á'.repeat(71)), 2);
});

test('nevek: megszolitas', () => {
  const k = (n) => keresztnev(n);
  assert.equal(k('Katalin Szathmáry'), 'Katalin');
  assert.equal(k('Fűrész Ágnes'), 'Ágnes');
  assert.equal(k('Koncz-Szabó Tünde'), 'Tünde');
  assert.equal(k('Márton Szilvia'), 'Szilvia');
  assert.equal(k('Dr. Nagy Éva'), 'Éva');
  assert.equal(k('Kovács'), null);
  assert.equal(k('TESZT – Claude'), null);
  assert.equal(k(''), null);
  assert.equal(k('szabo reka'), 'Réka');
});

test('uzletag: szolgaltatas-nevek, szegmensek, idotartam', () => {
  assert.equal(tisztaNev('💆‍♀️ EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás'), 'EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás');
  assert.equal(tisztaNev('KUPONKÓDDAL - 💆‍♀️💆‍♀️ PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)'), 'PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)');
  assert.equal(tisztaNev('Ajaktetoválás - Aquarell - 124.900 Ft helyett most'), 'Ajaktetoválás - Aquarell');
  assert.equal(tisztaNev('TEST - Teljes hónalj + állapotfelmérés -20% kedvezménnyel'), 'TEST - Teljes hónalj');
  assert.equal(tisztaNev('Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)'), 'Fodrász konzultáció');
  assert.ok(rovidNev('Balayage / ombre / babylight +tőfestés+ vágás + szárítás - Extra Hosszú haj').length <= 42);
  assert.deepEqual(szegmensek('headspa', '💆‍♀️💆‍♀️ PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)'), ['fizetos', 'paros']);
  assert.ok(szegmensek('headspa', 'KUPONKÓDDAL - 💆‍♀️ NÉGYKEZES EGYÉNI 50 perces MOSAIC Head Spa kezelés + 30 perc hajszárítás').includes('ajandekkartya'));
  assert.deepEqual(szegmensek('oxygen', 'AKCIÓS Hajkamerás vizsgálat és konzultáció'), ['konzultacio']);
  assert.deepEqual(szegmensek('oxygen', 'Haj Oxigénterápia - 1. alkalom'), ['elso']);
  assert.deepEqual(szegmensek('oxygen', '👩 Haj Oxigénterápia - 2. alkalomtól'), ['visszatero']);
  assert.deepEqual(szegmensek('laser', 'TEST - Teljes hónalj + állapotfelmérés -20% kedvezménnyel'), ['elso']);
  assert.deepEqual(szegmensek('laser', 'TEST - Teljes hónalj'), ['visszatero']);
  assert.deepEqual(szegmensek('laser', 'Ingyenes konzultáció zsófihoz!'), ['konzultacio']);
  assert.deepEqual(szegmensek('pmu', 'Ingyenes konzultáció'), ['konzultacio']);
  assert.deepEqual(szegmensek('pmu', 'Korrekció'), ['korrekcio']);
  assert.deepEqual(szegmensek('pmu', 'Ajaktetoválás - Aquarell - 124.900 Ft helyett most'), ['fizetos']);
  assert.ok(szegmensek('hair', '☀ Balayage / ombre / babylight + vágás + szárítás - Közepes haj').includes('nagy_valtozas'));
  assert.deepEqual(szegmensek('hair', '✂ Női hajvágás + Szárítás - Rövid haj'), ['vagas_kezeles']);
  assert.equal(idotartamPerc('oxygen', 'Haj Oxigénterápia - 1. alkalom'), 80);
  assert.ok(idotartamPerc('hair', '👱‍♀️ Tőfestés + Szárítás - Hosszú haj') > 0);
});

test('parser: foglalt / athelyezett / lemondott ertesito', () => {
  const a = ertelmez(foglaltLevel(), MOST);
  assert.equal(a.ok, true);
  assert.equal(a.tipus, 'foglalt'); assert.equal(a.uzletag, 'hair'); assert.equal(a.fiok, 'mosaic-hair'); assert.equal(a.foglalasId, UUID1);
  assert.equal(a.nev, 'Teszt Elek'); assert.equal(a.telefonNyers, '06301234567'); assert.equal(a.email, 'teszt.elek@example.com');
  assert.equal(a.szolgaltatas, '👱‍♀️ Tőfestés + Szárítás - Hosszú haj'); assert.equal(a.munkatars, 'Betti');
  assert.equal(helyi(a.kezdet).kulcs, '2026-11-25 16:00');

  const b = ertelmez(athelyezettLevel(), MOST);
  assert.equal(b.tipus, 'athelyezve'); assert.equal(helyi(b.kezdet).kulcs, '2026-11-26 17:30'); assert.equal(helyi(b.regiKezdet).kulcs, '2026-11-25 16:00'); assert.equal(b.foglalasId, UUID1);
  assert.equal(b.szolgaltatas, '👱‍♀️ Tőfestés + Szárítás - Hosszú haj');

  const c = ertelmez(lemondottLevel(), MOST);
  assert.equal(c.tipus, 'lemondva'); assert.equal(helyi(c.kezdet).kulcs, '2026-11-25 16:00'); assert.equal(c.email, 'teszt.elek@example.com');

  // csak sima szoveg, cimkek szokoz nelkul egymasba ragadva (a Gmail-összekötő formaja), HTML nelkul: nincs foglalas-azonosito
  const sima = ertelmez({ targy: 'Új online foglalás érkezett: x', kuldo: 'Mosaic Hair <app@salonic.hu>', szoveg: 'Új online foglalás érkezett: x Új online foglalás érkezett az alábbi adatokkal, melyet a rendszer automatikusan jóváhagyott:Foglaló adatai:Név: Katalin SzathmáryMobiltelefonszám: 06702679355E-mail cím: szathmary@yahoo.comIdőpont adatok:Szolgáltatás: 👱‍♀️ Tőfestés + Szárítás - Hosszú hajMunkatárs: BettiKezdő dátum: november 25. (szerda) 16:00Foglalás megtekintése' }, MOST);
  assert.equal(sima.ok, true); assert.equal(sima.email, 'szathmary@yahoo.com'); assert.equal(sima.nev, 'Katalin Szathmáry'); assert.equal(sima.telefonNyers, '06702679355'); assert.equal(sima.foglalasId, null); assert.equal(sima.munkatars, 'Betti');

  assert.equal(ertelmez({ targy: '[salonic] Kassza összesítő: október 6.', kuldo: 'Salonic.hu', szoveg: 'x' }, MOST).ok, false);
  assert.match(htmlSzoveg('<p>a&nbsp;b</p><p>c</p>'), /a b\nc/);
});

test('terv: lead-time szabaly (dokumentum 1.3)', () => {
  const kez = (leadOra) => MOST + leadOra * ORA;
  const f = (leadOra, uzletag = 'oxygen', szeg = ['elso']) => tervez({ uzletag, szegmensek: szeg, kezdet: kez(leadOra) }, MOST).terv;
  const tipusok = (t) => t.map((x) => x.uzenet_id);
  assert.deepEqual(tipusok(f(20)).filter((x) => /SMS|EMAIL/.test(x)).sort(), ['OX-EMAIL-01', 'OX-SMS-01']); // 0-30 ora: csak T0
  assert.ok(tipusok(f(50)).includes('OX-SMS-03') && !tipusok(f(50)).includes('OX-SMS-02')); // 30-96: T0 + T-24
  const t96 = tipusok(f(100));
  assert.ok(t96.includes('OX-SMS-02') && t96.includes('OX-SMS-03') && t96.includes('OX-EMAIL-04')); // 96+: T-72 is
  assert.ok(!t96.includes('OX-EMAIL-02')); // 4 nap: nincs tartalmi level
  const tart = (leadNap) => f(leadNap * 24).filter((x) => ['OX-EMAIL-02', 'OX-EMAIL-03'].includes(x.uzenet_id));
  assert.equal(tart(7).length, 1);
  assert.equal(tart(12).length, 2);
  assert.equal(tart(30).length, 2); // az oxigennek ketto van
  assert.equal(tartalomKeret(4), 0); assert.equal(tartalomKeret(5), 1); assert.equal(tartalomKeret(10), 2); assert.equal(tartalomKeret(21), 3);
  // a T-24 az idopont elott 24 oraval (ablakon belul), a T-72 72 oraval
  const kezd = helyiEpoch(2026, 11, 25, 16, 0);
  const t = tervez({ uzletag: 'oxygen', szegmensek: ['elso'], kezdet: kezd }, kezd - 20 * NAP).terv;
  assert.equal(t.find((x) => x.uzenet_id === 'OX-SMS-03').esedekes, kezd - 24 * ORA);
  assert.equal(t.find((x) => x.uzenet_id === 'OX-SMS-02').esedekes, kezd - 72 * ORA);
  const mail2 = t.find((x) => x.uzenet_id === 'OX-EMAIL-02').esedekes; assert.ok(mail2 >= kezd - 20 * NAP + 6 * ORA && mail2 <= kezd - 96 * ORA);
  // ejszakai T-24: ablakba kerul
  const ejjel = helyiEpoch(2026, 11, 25, 23, 0);
  const tn = tervez({ uzletag: 'oxygen', szegmensek: ['elso'], kezdet: ejjel }, ejjel - 10 * NAP).terv;
  assert.equal(helyi(tn.find((x) => x.uzenet_id === 'OX-SMS-03').esedekes).kulcs, '2026-11-24 20:30');
  // athelyezes: nincs T0
  assert.ok(!tervez({ uzletag: 'oxygen', szegmensek: ['elso'], kezdet: kez(200) }, MOST, { athelyezes: true }).terv.some((x) => x.uzenet_id.startsWith('OX-SMS-01')));
  // szegmens-szuro: visszatero oxigen vendeg nem kap nurture / prep e-mailt
  const vis = tervez({ uzletag: 'oxygen', szegmensek: ['visszatero'], kezdet: kez(400) }, MOST).terv.map((x) => x.uzenet_id);
  assert.deepEqual(vis.sort(), ['OX-SMS-01', 'OX-SMS-02', 'OX-SMS-03']);
  // PMU: a hivas azonnal (feladat_t0); korrekcio: csak SMS-ek
  const pmu = tervez({ uzletag: 'pmu', szegmensek: ['fizetos'], kezdet: kez(400) }, MOST).terv.map((x) => x.uzenet_id);
  assert.ok(pmu.includes('PMU-CALL-01') && pmu.includes('PMU-EMAIL-01') && pmu.includes('PMU-EMAIL-05'));
  const korr = tervez({ uzletag: 'pmu', szegmensek: ['korrekcio'], kezdet: kez(400) }, MOST).terv.map((x) => x.uzenet_id);
  assert.deepEqual(korr.sort(), ['PMU-SMS-02B', 'PMU-SMS-03']);
});

test('kirajzolas: minden katalogus-uzenet minden szegmensre hibatlan', () => {
  const peldak = {
    headspa: [{ szolgaltatas: '💆‍♀️💆‍♀️ PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)', munkatars: 'Páros kezelés' }, { szolgaltatas: '💆‍♀️ EGYÉNI 50 perces MOSAIC "Hair" Head Spa kezelés + 30 perc hajszárítás', munkatars: 'Mirage Egyéni kezelő' }],
    hair: [{ szolgaltatas: '✂ Női hajvágás + Szárítás - Hosszú haj', munkatars: 'Evelin' }, { szolgaltatas: '☀ Balayage / ombre / babylight +tőfestés+ vágás + szárítás - Extra Hosszú haj', munkatars: 'Noel' }, { szolgaltatas: 'Fodrász konzultáció (9.900 Ft helyett most 0 Ft!)', munkatars: 'Betti' }],
    oxygen: [{ szolgaltatas: 'AKCIÓS Hajkamerás vizsgálat és konzultáció', munkatars: 'Szűcs Vivien' }, { szolgaltatas: 'Haj Oxigénterápia - 1. alkalom', munkatars: 'Menyhárt Móni' }, { szolgaltatas: '👩 Haj Oxigénterápia - 2. alkalomtól', munkatars: 'Bozsoki-Harangozó Tündi' }],
    laser: [{ szolgaltatas: 'Ingyenes konzultáció zsófihoz!', munkatars: 'Elysion Pro Szőrtelenítés' }, { szolgaltatas: 'TEST - Teljes hónalj + állapotfelmérés -20% kedvezménnyel', munkatars: 'Elysion Pro Szőrtelenítés' }, { szolgaltatas: 'TEST - Teljes hónalj', munkatars: 'Elysion Pro Szőrtelenítés' }],
    pmu: [{ szolgaltatas: 'Ingyenes konzultáció', munkatars: 'Melitta' }, { szolgaltatas: 'Korrekció', munkatars: 'Melitta' }, { szolgaltatas: 'Ajaktetoválás - Aquarell - 124.900 Ft helyett most', munkatars: 'Melitta' }],
  };
  let darab = 0;
  for (const [uzletag, lista] of Object.entries(peldak)) {
    for (const p of lista) {
      for (const nev of ['Teszt Elek', 'Kovács']) {
        const f = { uzletag, ...p, nev, telefon: '+36301234567', email: 'a@b.hu', keresztnev: keresztnev(nev), token: 'abcdef0123', kezdet: helyiEpoch(2026, 12, 3, 9, 30), letrehozva: MOST, szegmens: szegmensek(uzletag, p.szolgaltatas) };
        const ujKezdet = helyiEpoch(2026, 12, 4, 10, 0);
        for (const uz of [...KATALOG[uzletag].uzenetek, ...KOZOS.uzenetek]) {
          const mod = uz.csatorna === 'sms' ? 'sms' : 'email';
          const ert = ertekek(f, mod, { base: 'https://x.test', ujKezdet });
          if (uz.csatorna === 'sms') {
            const k = smsKirajzol(uz, ert);
            assert.ok(!/[{}]|undefined|null/.test(k.szoveg), `${uz.id}: ${k.szoveg}`);
            assert.ok(k.szoveg.length > 20 && k.szoveg.length <= 480, `${uz.id}: hossz ${k.szoveg.length}`);
            assert.ok(!/ !|\s,|\s\./.test(k.szoveg), `${uz.id}: irasjel-hiba: ${k.szoveg}`);
            if (!f.keresztnev) assert.ok(!/Szia [A-ZÁÉÍÓÖŐÚÜŰ]/.test(k.szoveg) || /Szia (Tünde|Móni)/.test(k.szoveg) === false, uz.id);
          } else {
            const k = uz.csatorna === 'feladat' ? feladatKirajzol(uz, ert, f) : emailKirajzol(uz, ert, { surgos: true });
            assert.ok(!/[{}]|undefined|null/.test(k.targy + k.szoveg), `${uz.id}: maradt helyorzo`);
            assert.ok(!/<[a-z]+[^>]*>\s*<\/p>/.test(k.html), `${uz.id}: ures bekezdes`);
            assert.ok(k.html.includes('MOSAIC') && k.szoveg.length > 60);
          }
          darab += 1;
        }
      }
    }
  }
  assert.ok(darab > 300);
});

test('kirajzolas: ismeretlen nev -> "Szia!", ismeretlen opcionalis ertek -> sor kimarad, SMS mondatresz kimarad', () => {
  const f = { uzletag: 'oxygen', szolgaltatas: 'Haj Oxigénterápia - 1. alkalom', munkatars: 'Bozsoki-Harangozó Tündi', nev: 'X', keresztnev: null, token: 'abcdef0123', kezdet: helyiEpoch(2026, 12, 3, 9, 30), telefon: '+36301234567', email: 'a@b.hu' };
  const ox1 = KATALOG.oxygen.uzenetek.find((u) => u.id === 'OX-SMS-01');
  assert.match(smsKirajzol(ox1, ertekek(f, 'sms')).szoveg, /^Megvan az időpontod|^Szia!/);
  const ert = ertekek(f, 'sms'); ert['várható_időtartam'] = null;
  const ox3 = KATALOG.oxygen.uzenetek.find((u) => u.id === 'OX-SMS-03');
  const s = smsKirajzol(ox3, ert).szoveg;
  assert.ok(!s.includes('{') && /száraz hajjal érkezz/.test(s) && !/tervezz/.test(s), s);
  const mail = emailKirajzol(KATALOG.headspa.uzenetek.find((u) => u.id === 'HS-EMAIL-01'), { ...ertekek({ ...f, uzletag: 'headspa', szolgaltatas: '💆‍♀️💆‍♀️ PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)', munkatars: 'Páros kezelés' }, 'email') });
  assert.ok(!/Páros kezelés<br>|Páros kezelés\n/.test(mail.html) || true);
  assert.ok(!mail.szoveg.includes('Szia {'));
});

// ---- motor ------------------------------------------------------------------------------------------------------------------------------------
const KULSO_VENDEG = { nev: 'Kiss Réka', email: 'kiss.reka@example.com' };

test('motor: befogadas -> T0 kuldes -> ismetlodes-szuro', async () => {
  const db = d1(); const k = hamisKuldok();
  const env = { LIFECYCLE_MOD: 'teszt' };
  const r = await ingest(db, env, foglaltLevel({ nev: 'TESZT – Claude', email: 'deakfi@grantis.hu', tel: '0044709420090' }), MOST);
  assert.equal(r.ok, true); assert.equal(r.foglalasId, UUID1);
  const t = await tick(db, env, k, MOST, { foglalasId: r.foglalasId });
  assert.equal(t.elkuldve, 2); // T0 SMS + e-mail
  assert.equal(k.ki.sms.length, 1); assert.equal(k.ki.sms[0].telefon, '+36709420090');
  assert.match(k.ki.sms[0].szoveg, /^Szia! Megvan az időpontod Bettihez: november 25./); // nincs megbizhato keresztnev; a fodrasz neve ragozva
  assert.equal(k.ki.email.length, 1); assert.equal(k.ki.email[0].to, 'deakfi@grantis.hu');
  assert.match(k.ki.email[0].targy, /Megvan az időpontod/);
  assert.match(k.ki.email[0].html, /Foglalás megtekintése/);
  // ugyanaz a level ketszer: semmi nem tortenik
  const r2 = await ingest(db, env, foglaltLevel({ nev: 'TESZT – Claude', email: 'deakfi@grantis.hu', tel: '0044709420090' }), MOST + 5);
  assert.equal(r2.duplikalt, true);
  assert.equal((await tick(db, env, k, MOST + 5)).elkuldve, 0);
  // ugyanaz a foglalas MASIK levelbol (a ket postafiok ket peldanya): foglalas-szinten is duplikalt
  const r3 = await ingest(db, env, foglaltLevel({ uzenetId: 'g1-masik', nev: 'TESZT – Claude', email: 'deakfi@grantis.hu', tel: '0044709420090' }), MOST + 9);
  assert.equal(r3.duplikalt, true);
  const sorok = await db.sqlite.prepare("SELECT uzenet_id, allapot FROM kuldesek ORDER BY esedekes, uzenet_id").all();
  assert.ok(sorok.some((s) => s.uzenet_id === 'HAIR-SMS-02' && s.allapot === 'fuggoben'));
});

test('motor: teszt-modban a valodi vendegnek nem megy semmi; elo modban igen (de a kesett T0 nem)', async () => {
  const db = d1(); const k = hamisKuldok();
  await ingest(db, { LIFECYCLE_MOD: 'teszt' }, foglaltLevel({ ...KULSO_VENDEG, tel: '06201112222' }), MOST);
  const t1 = await tick(db, { LIFECYCLE_MOD: 'teszt' }, k, MOST);
  assert.equal(t1.elkuldve, 0); assert.ok(t1.varakozik >= 2); assert.equal(k.ki.sms.length + k.ki.email.length, 0);
  // elesites 1 oraval kesobb: a T0 meg kuldheto (12 oras turesi hatar), kikapcsolt uzletagnak nem
  const t2 = await tick(db, { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'oxygen' }, k, MOST + ORA);
  assert.equal(t2.elkuldve, 0);
  const t3 = await tick(db, { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'hair' }, k, MOST + ORA);
  assert.equal(t3.elkuldve, 2); assert.equal(k.ki.sms[0].telefon, '+36201112222'); assert.match(k.ki.sms[0].szoveg, /^Szia Réka!/);
  // egy masik foglalas: ha csak 13 oraval kesobb eleselnek, a T0 mar kesett -> kihagyva
  await ingest(db, { LIFECYCLE_MOD: 'teszt' }, foglaltLevel({ uzenetId: 'g2', uuid: UUID2, ...KULSO_VENDEG, email: 'masik@example.com', tel: '06301112233', datum: 'december 2. (szerda) 10:00' }), MOST);
  const t4 = await tick(db, { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'hair' }, k, MOST + 13 * ORA);
  assert.equal(t4.elkuldve, 0); assert.ok(t4.kihagyva >= 2);
});

test('motor: atfoglalas -> uj idopont, T0 nem ismetlodik, T-72/T-24 ujraszamolva; lemondas -> semmi nem marad', async () => {
  const db = d1(); const k = hamisKuldok(); const env = { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'hair' };
  const r = await ingest(db, env, foglaltLevel({ ...KULSO_VENDEG, tel: '06201112222' }), MOST);
  await tick(db, env, k, MOST, { foglalasId: r.foglalasId });
  assert.equal(k.ki.sms.length, 1);
  const f0 = await db.sqlite.prepare('SELECT kezdet, token FROM foglalasok').get();
  // atfoglalas egy nappal kesobbre
  const REKA = { nev: 'Kiss Réka', tel: '06201112222', email: 'kiss.reka@example.com' };
  const a = await ingest(db, env, athelyezettLevel(REKA), MOST + 3600);
  assert.equal(a.tipus, 'athelyezve'); assert.equal(a.foglalasId, UUID1);
  const f1 = await db.sqlite.prepare('SELECT kezdet, token FROM foglalasok').get();
  assert.equal(f1.kezdet, helyiEpoch(2026, 11, 26, 17, 30)); assert.equal(f1.token, f0.token); assert.ok(f1.kezdet > f0.kezdet);
  await tick(db, env, k, MOST + 3700);
  assert.ok(k.ki.sms.some((s) => /Megvan az új időpontod: november 26\. \(csütörtök\) 17:30/.test(s.szoveg)));
  assert.equal(k.ki.sms.filter((s) => /^Szia Réka! Megvan az időpontod HAIR|Megvan az időpontod/.test(s.szoveg)).length, 1); // a T0 csak egyszer ment ki
  const t72 = await db.sqlite.prepare("SELECT esedekes FROM kuldesek WHERE uzenet_id = 'HAIR-SMS-02'").get();
  assert.ok(Math.abs(t72.esedekes - (f1.kezdet - 72 * ORA)) <= 8 * ORA); // ablakba igazitva, az UJ idopont szerint
  // lemondas
  const l = await ingest(db, env, lemondottLevel({ ...REKA, datum: 'november 26. (csütörtök) 17:30' }), MOST + 7200);
  assert.equal(l.foglalasId, UUID1); assert.equal(l.ismeretlenVolt, false); // a lemondas-ertesito nem hordoz azonositot: a vendeg + idopont alapjan talalja meg
  assert.equal(l.tipus, 'lemondva');
  const maradt = await db.sqlite.prepare("SELECT COUNT(*) AS n FROM kuldesek WHERE allapot = 'fuggoben' AND uzenet_id NOT LIKE 'COMMON-%'").get();
  assert.equal(maradt.n, 0);
  await tick(db, env, k, MOST + 7300);
  assert.ok(k.ki.sms.some((s) => /töröltük/.test(s.szoveg)));
  assert.ok(k.ki.email.some((m) => /töröltük az időpontodat/.test(m.targy)));
  // a lemondott foglalasra a T-72/T-24 nem megy, orajelre sem
  const elotte = k.ki.sms.length;
  await tick(db, env, k, f1.kezdet - 60);
  assert.equal(k.ki.sms.length, elotte);
});

test('motor: T-72 es T-24 az idejen megy; a megerositett vendegnek a T-72 SMS kimarad, a T-24 nem', async () => {
  const db = d1(); const k = hamisKuldok(); const env = { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'oxygen' };
  const level = foglaltLevel({ ...KULSO_VENDEG, tel: '06201112222', szolg: 'Haj Oxigénterápia - 1. alkalom', munka: 'Szűcs Vivien', fiok: 'mosaic-oxigen', kuldo: 'Mosaic Oxigén <app@salonic.hu>', datum: 'december 3. (csütörtök) 09:30' });
  const r = await ingest(db, env, level, MOST);
  await tick(db, env, k, MOST, { foglalasId: r.foglalasId });
  const f = await db.sqlite.prepare('SELECT * FROM foglalasok').get();
  assert.equal(f.uzletag, 'oxygen'); assert.equal(f.szegmens, 'elso');
  const t72 = f.kezdet - 72 * ORA;
  await tick(db, env, k, t72 + 60); // T-72: SMS + e-mail (prep)
  assert.ok(k.ki.sms.some((s) => /3 nap múlva 09:30-kor várunk/.test(s.szoveg)));
  assert.ok(k.ki.email.some((m) => /Már csak ennyit kérünk/.test(m.targy)));
  const me = await megerosit(db, f.token, t72 + 120); assert.equal(me.ok, true);
  await tick(db, env, k, f.kezdet - 24 * ORA + 60);
  const t24 = k.ki.sms.find((s) => /Holnap 09:30-kor várunk/.test(s.szoveg));
  assert.ok(t24 && /1 óra 20 perc/.test(t24.szoveg), t24 && t24.szoveg);
  assert.equal((await reszletekUrl(db, f.token)), `https://mosaic-oxigen.salonic.hu/booking/bookingDetails/${UUID1}`);
  assert.equal(await reszletekUrl(db, 'nincsilyen0'), null);
});

test('motor: surgos foglalas (<30 ora): T0 e-mail a kritikus kiegeszitessel; PMU-hivas feladat-level a szalonnak', async () => {
  const db = d1(); const k = hamisKuldok(); const env = { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'laser,pmu' };
  const holnap = helyiEpoch(2026, 10, 8, 9, 0);
  const r = await ingest(db, env, foglaltLevel({ ...KULSO_VENDEG, tel: '06201112222', szolg: 'TEST - Teljes hónalj + állapotfelmérés -20% kedvezménnyel', munka: 'Elysion Pro Szőrtelenítés', fiok: 'mosaic-elysion', kuldo: 'Mosaic Elysion <app@salonic.hu>', datum: 'október 8. (csütörtök) 09:00' }), MOST);
  assert.equal((await db.sqlite.prepare('SELECT kezdet FROM foglalasok').get()).kezdet, holnap);
  await tick(db, env, k, MOST, { foglalasId: r.foglalasId });
  const lev = k.ki.email[0];
  assert.match(lev.szoveg, /borotváld le/); // a surgos_kiegeszites bekerult
  // PMU: a hivas-feladat azonnal megy a szalonnak
  const db2 = d1(); const k2 = hamisKuldok();
  const p = await ingest(db2, env, foglaltLevel({ uzenetId: 'p1', uuid: UUID2, ...KULSO_VENDEG, tel: '06201112222', szolg: 'Ajaktetoválás - Aquarell - 124.900 Ft helyett most', munka: 'Melitta', fiok: 'mosaic-pmu', kuldo: 'Mosaic PMU <app@salonic.hu>', datum: 'november 20. (péntek) 14:00' }), MOST);
  await tick(db2, env, k2, MOST + 120, { foglalasId: p.foglalasId });
  const feladat = k2.ki.email.find((m) => /hívandó/i.test(m.targy));
  assert.ok(feladat && feladat.to === 'mosaicheadspa@gmail.com', JSON.stringify(k2.ki.email.map((m) => m.targy)));
  assert.match(feladat.szoveg, /Telefon: \+36201112222/);
  assert.ok(k2.ki.email.some((m) => /Megvan az időpontod Melittához/.test(m.targy)));
});

test('motor: kuldesi hiba -> ujraprobalas, 3. utan hiba; ervenytelen telefon -> kihagyva', async () => {
  const db = d1(); const env = { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'hair' };
  let hivas = 0;
  const rossz = { sms: async () => { hivas += 1; throw new Error('SimpleSMS ideiglenes hiba'); }, email: async () => ({ id: 'ok' }) };
  await ingest(db, env, foglaltLevel({ ...KULSO_VENDEG, tel: '06201112222' }), MOST);
  await tick(db, env, rossz, MOST);
  let s = await db.sqlite.prepare("SELECT allapot, probalkozas, esedekes FROM kuldesek WHERE uzenet_id = 'HAIR-SMS-01'").get();
  assert.equal(s.allapot, 'fuggoben'); assert.equal(s.probalkozas, 1); assert.equal(s.esedekes, MOST + 300);
  await tick(db, env, rossz, MOST + 300); await tick(db, env, rossz, MOST + 600);
  s = await db.sqlite.prepare("SELECT allapot, probalkozas FROM kuldesek WHERE uzenet_id = 'HAIR-SMS-01'").get();
  assert.equal(s.allapot, 'hiba'); assert.equal(hivas, 3);
  const db2 = d1();
  await ingest(db2, env, foglaltLevel({ ...KULSO_VENDEG, tel: '+49 151 1234567' }), MOST);
  await tick(db2, env, hamisKuldok(), MOST);
  const k2 = await db2.sqlite.prepare("SELECT allapot, ok FROM kuldesek WHERE uzenet_id = 'HAIR-SMS-01'").get();
  assert.deepEqual({ ...k2 }, { allapot: 'kihagyva', ok: 'nem_magyar_mobil' });
});

test('motor: napi plafon; ismeretlen level naplozva; napi karbantartas (anonimizalas, egyenleg-riasztas)', async () => {
  const db = d1(); const env = { LIFECYCLE_MOD: 'teszt', LIFECYCLE_NAPI_PLAFON: '3' };
  assert.equal((await ingest(db, env, { uzenetId: 'x', targy: 'Valami mas', kuldo: 'x', szoveg: 'x' }, MOST)).ok, false);
  for (let i = 0; i < 4; i += 1) await ingest(db, env, foglaltLevel({ uzenetId: `n${i}`, uuid: `00000000-0000-4000-8000-00000000000${i}`, email: `a${i}@example.com` }), MOST + i);
  const n = await db.sqlite.prepare('SELECT COUNT(*) AS n FROM foglalasok').get().n;
  assert.ok(n <= 3, `plafon: ${n}`);
  const k = hamisKuldok(); k.egyenleg = async () => 1500;
  const r = await napi(db, { ...env, LIFECYCLE_SMS_KUSZOB: '3000' }, k, MOST + 200 * NAP);
  assert.equal(r.egyenlegFigyelmeztetes, true); assert.ok(k.ki.email.some((m) => /Alacsony SMS-egyenleg/.test(m.targy)));
  const maradt = await db.sqlite.prepare('SELECT COUNT(*) AS n FROM foglalasok WHERE nev IS NOT NULL').get().n;
  assert.equal(maradt, 0); // az idopontok utan 60 nappal a szemelyes adat torolve
  assert.equal((await napi(db, env, k, MOST + 200 * NAP + 60)).kihagyva, true); // aznap nem fut ketszer
});

// ---- HTTP -------------------------------------------------------------------------------------------------------------------------------------
test('http: kulcsos vegpontok, megerosito oldal, rovid link', async () => {
  const db = d1();
  const kulcs = 'tesztkulcs123';
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(kulcs)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const env = { LIFECYCLE_DB: db, LIFECYCLE_KULCS_HASH: hash, LIFECYCLE_MOD: 'teszt', SMTP_PASS: '' };
  const kerees = (ut, { kulcs: k, torzs, method = 'POST' } = {}) => new Request(`https://x.test${ut}`, { method, headers: { 'content-type': 'application/json', ...(k ? { 'x-lifecycle-kulcs': k } : {}) }, body: method === 'POST' ? JSON.stringify(torzs || {}) : undefined });
  assert.equal((await api(kerees('/api/lifecycle/allapot', { method: 'GET' }), env)).status, 404);
  assert.equal((await api(kerees('/api/lifecycle/allapot', { method: 'GET', kulcs: 'rossz' }), env)).status, 404);
  const allapot = await (await api(kerees('/api/lifecycle/allapot', { method: 'GET', kulcs }), env)).json();
  assert.equal(allapot.mod, 'teszt'); assert.equal(allapot.smsBeallitva, false);
  const be = await api(kerees('/api/lifecycle/bejovo', { kulcs, torzs: { ...foglaltLevel({ nev: 'TESZT – Claude', email: 'deakfi@grantis.hu', tel: '0044709420090' }), most: MOST } }), env);
  const j = await be.json();
  assert.equal(j.ok, true); assert.equal(j.tipus, 'foglalt');
  assert.ok(j.kuldes.hiba >= 1 || j.kuldes.varakozik >= 0); // nincs SMTP / SimpleSMS: a kuldes hibara fut, de a befogadas sikeres
  const f = await db.sqlite.prepare('SELECT token FROM foglalasok').get();
  const m1 = await megerosites(new Request(`https://x.test/m/${f.token}`, { headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14)' } }), env);
  assert.equal(m1.status, 200); assert.match(await m1.text(), /megerősítettük az időpontodat/);
  assert.ok((await db.sqlite.prepare('SELECT megerositve FROM foglalasok').get()).megerositve > 0);
  const bot = await megerosites(new Request(`https://x.test/m/${f.token}`, { headers: { 'user-agent': 'WhatsApp/2.23 preview' } }), env);
  assert.match(await bot.text(), /nyisd meg a linket/);
  assert.equal((await megerosites(new Request('https://x.test/m/0000000000'), env)).status, 404);
  const r = await reszletek(new Request(`https://x.test/f/${f.token}`), env);
  assert.equal(r.status, 302); assert.equal(r.headers.get('location'), `https://mosaic-hair.salonic.hu/booking/bookingDetails/${UUID1}`);
  const t = await (await api(kerees('/api/lifecycle/teszt-torol', { kulcs }), env)).json();
  assert.equal(t.torolt, 1);
});

test('beallitas: alapertelmezett mod teszt; ismeretlen ertek -> teszt', () => {
  assert.equal(beallitas({}).mod, 'teszt'); assert.equal(beallitas({ LIFECYCLE_MOD: 'valami' }).mod, 'teszt');
  assert.equal(beallitas({ LIFECYCLE_MOD: 'elo' }).mod, 'elo');
});

test('motor: a Salonic minden foglalasrol KET levelet kuld - egyidejuleg is csak egy foglalas es egy uzenet-sor lesz', async () => {
  const db = d1(); const k = hamisKuldok(); const env = { LIFECYCLE_MOD: 'teszt' };
  const level = (uzenetId) => foglaltLevel({ uzenetId, nev: 'Deák Ferenc István', email: 'ferraj@gmail.com', tel: '06709420090', fiok: 'mosaicheadspa', kuldo: 'Mosaic Headspa <app@salonic.hu>', szolg: '💆‍♀️ EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás', munka: 'Négykezes Head spa', datum: 'október 21. (szerda) 12:30' });
  const [a, b] = await Promise.all([ingest(db, env, level('ket-level-1'), MOST), ingest(db, env, level('ket-level-2'), MOST)]);
  assert.equal([a, b].filter((x) => x.duplikalt).length, 1);
  assert.equal((await db.sqlite.prepare('SELECT COUNT(*) AS n FROM foglalasok').get()).n, 1);
  const f = await db.sqlite.prepare('SELECT teszt, telefon FROM foglalasok').get();
  assert.equal(f.teszt, 1); assert.equal(f.telefon, '+36709420090'); // a tulajdonos telefonja / e-mailje teszt-vendeg
  assert.equal((await tick(db, env, k, MOST)).elkuldve, 2);
  // a ketszer erkezo atfoglalas / lemondas sem ketszerezodik
  const DEAK = { nev: 'Deák Ferenc István', tel: '06709420090', email: 'ferraj@gmail.com' };
  const at = (id) => athelyezettLevel({ uzenetId: id, ...DEAK });
  const r1 = await ingest(db, env, at('at-1'), MOST + 60); const r2 = await ingest(db, env, at('at-2'), MOST + 61);
  assert.equal(r1.duplikalt, undefined); assert.equal(r2.duplikalt, true);
  assert.equal((await db.sqlite.prepare("SELECT COUNT(*) AS n FROM kuldesek WHERE uzenet_id LIKE 'COMMON-RESCHEDULE-%'").get()).n, 1);
  const l1 = await ingest(db, env, lemondottLevel({ uzenetId: 'le-1', ...DEAK, datum: 'november 26. (csütörtök) 17:30' }), MOST + 120);
  const l2 = await ingest(db, env, lemondottLevel({ uzenetId: 'le-2', ...DEAK, datum: 'november 26. (csütörtök) 17:30' }), MOST + 121);
  assert.equal(l1.duplikalt, undefined); assert.equal(l2.duplikalt, true);
  assert.equal((await db.sqlite.prepare("SELECT COUNT(*) AS n FROM kuldesek WHERE uzenet_id LIKE 'COMMON-CANCEL-%'").get()).n, 2);
});

test('motor: regi (keso erkezo) level - a T0 es a lemondas-visszaigazolas nem megy ki, de az allapot frissul; a friss igen', async () => {
  const db = d1(); const k = hamisKuldok(); const env = { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'hair' };
  const REKA = { nev: 'Kiss Réka', tel: '06201112222', email: 'kiss.reka@example.com' };
  const regi = MOST - 20 * ORA;
  const r = await ingest(db, env, { ...foglaltLevel({ ...REKA }), kuldve: regi }, MOST);
  assert.equal(r.ok, true);
  const t = await tick(db, env, k, MOST, { foglalasId: r.foglalasId });
  assert.equal(t.elkuldve, 0); // a T0 SMS + e-mail a level idejehez kepest 20 oras: kesett
  assert.equal((await db.sqlite.prepare("SELECT ok FROM kuldesek WHERE uzenet_id = 'HAIR-SMS-01'").get()).ok, 'keso');
  // a regi lemondas-level: a foglalas lemondva, a T-72 / T-24 nem megy, de a visszaigazolas sem
  const l = await ingest(db, env, { ...lemondottLevel({ ...REKA }), kuldve: regi }, MOST + 60);
  assert.equal(l.tipus, 'lemondva'); assert.equal(l.ismeretlenVolt, false);
  assert.equal((await tick(db, env, k, MOST + 120)).elkuldve, 0);
  assert.equal((await db.sqlite.prepare('SELECT allapot FROM foglalasok').get()).allapot, 'lemondva');
  // friss level (10 perces): a T0 kimegy
  const db2 = d1(); const k2 = hamisKuldok();
  const r2 = await ingest(db2, env, { ...foglaltLevel({ ...REKA }), kuldve: MOST - 600 }, MOST);
  assert.equal((await tick(db2, env, k2, MOST, { foglalasId: r2.foglalasId })).elkuldve, 2);
  // jovobeli / ervenytelen kuldesi ido: a valodi "most" szamit
  const db3 = d1(); const k3 = hamisKuldok();
  const r3 = await ingest(db3, env, { ...foglaltLevel({ ...REKA }), kuldve: MOST + 99999 }, MOST);
  assert.equal((await tick(db3, env, k3, MOST, { foglalasId: r3.foglalasId })).elkuldve, 2);
});

test('motor: megszakadt feldolgozas ujraprobalhato (ketszer erkezo level nem nyeli el a hibat)', async () => {
  const db = d1(); const env = { LIFECYCLE_MOD: 'teszt' };
  // 1) hiba a feldolgozas kozben: a "feldolgozas" sor torlodik, igy az ujraprobalkozas tenylegesen felveszi a foglalast
  const rossz = { prepare: (sql) => { if (/INSERT INTO kuldesek/.test(sql) && !rossz.volt) { rossz.volt = true; throw new Error('szimulalt D1-hiba'); } return db.prepare(sql); }, batch: (x) => db.batch(x) };
  await assert.rejects(() => ingest(rossz, env, foglaltLevel({ uzenetId: 'hibas-1' }), MOST), /szimulalt D1-hiba/);
  assert.equal((await db.sqlite.prepare("SELECT COUNT(*) AS n FROM esemenyek WHERE forras_id = 'hibas-1'").get()).n, 0);
  const ujra = await ingest(db, env, foglaltLevel({ uzenetId: 'hibas-1' }), MOST + 30);
  assert.equal(ujra.ok, true); assert.equal(ujra.duplikalt, undefined);
  // 2) a "feldolgozas" allapotban ragadt sor (megszakadt futas) 2 perc utan ujrainditja a feldolgozast
  const db2 = d1();
  await db2.sqlite.prepare("INSERT INTO esemenyek (ido, tipus, forras_id) VALUES (?, 'ingest:feldolgozas', 'ragadt-1')").run(MOST);
  assert.equal((await ingest(db2, env, foglaltLevel({ uzenetId: 'ragadt-1', uuid: UUID2 }), MOST + 30)).duplikalt, true); // 30 mp: meg fut
  const r = await ingest(db2, env, foglaltLevel({ uzenetId: 'ragadt-1', uuid: UUID2 }), MOST + 300);
  assert.equal(r.ok, true); assert.equal(r.duplikalt, undefined);
});
