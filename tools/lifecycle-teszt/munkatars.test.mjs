// A Salonic MUNKATARSI ertesitoinek feldolgozasa + az elo oldal-ellenorzes kuldes elott (DECISION #117, APPROVE_WITH_GUARDRAILS, issue #167).
// Elfogadasi kapu - egy-egy eset mindegyikbol, mindegyiknel 0 teves SMS, 0 teves allapotvaltas, 0 dupla feldolgozas:
//   (1) munkatarsi torles idopont elott   (2) torles idopont utan   (3) bizonyitott modositas   (4) belso blokk   (5) tobbertelmu parositas   (6) nev-elteres
// Futtatas: node --test tools/lifecycle-teszt/munkatars.test.mjs
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ingest, tick, napi, allapot, beallitas } from '../../netlify/lib/lifecycle/engine.js';
import { munkatarsTipus, ertelmezMunkatars, belsoBlokk, nevNorm, munkatarsKulcs, beesoNev } from '../../netlify/lib/lifecycle/munkatars.js';
import { eloElemzes, eloAllapot, eloEllenorzoKeszit } from '../../netlify/lib/lifecycle/elo.js';
import { helyiEpoch } from '../../netlify/lib/lifecycle/ido.js';
import { api } from '../../netlify/lib/lifecycle/http.js';
import { d1, hamisKuldok, hamisElo, foglaltLevel, lemondottLevel, munkatarsLevel, szam, UUID1, UUID2, SZOLG, MOST, ORA, NAP } from './seged.mjs';

const ENV = { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'hair', LIFECYCLE_MUNKATARS_MOD: 'be' };
const KEZDET_NOV25 = helyiEpoch(2026, 11, 25, 16, 0);
const TOROLT = { allapot: 'torolve' };
const aktiv = (startUnix) => ({ allapot: 'aktiv', startUnix });
const sorok = (db, sql, ...p) => db.sqlite.prepare(sql).all(...p);
const esemeny = (db, id) => szam(db, 'SELECT tipus, reszlet FROM esemenyek WHERE forras_id = ?1', id);
const alapAllapot = (db, id = UUID1) => szam(db, 'SELECT allapot, kezdet FROM foglalasok WHERE id = ?1', id);

/** Felvesz egy foglalast (T0 SMS/e-mail kimegy), visszaadja az adatbazist, a kuldot es a T0 utani SMS-darabszamot. */
async function felvesz(opc = {}, env = ENV, most = MOST) {
  const db = d1(); const k = hamisKuldok();
  const r = await ingest(db, env, foglaltLevel(opc), most);
  assert.equal(r.ok, true);
  await tick(db, env, k, most, { foglalasId: r.foglalasId });
  return { db, k, id: r.foglalasId, smsT0: k.ki.sms.length, emailT0: k.ki.email.length };
}

// ======================================================================================================================================================
test('munkatars-parser: tárgy (emoji-előtaggal), mezők, év nélküli dátum, promóciós munkatárs-név, létrehozás kihagyva', () => {
  assert.equal(munkatarsTipus('❌ Időpont törölve: Valami'), 'szalon_torolte');
  assert.equal(munkatarsTipus('🗓️ Időpont módosítva: Valami'), 'szalon_athelyezte');
  assert.equal(munkatarsTipus('🗓️ Új időpont létrehozva: Valami'), 'szalon_letrehozva');
  assert.equal(munkatarsTipus('Foglalás lemondás - Teszt Elek - Valami'), null); // a vendeg-oldali ertesitok nem ide tartoznak
  assert.equal(munkatarsTipus('Foglalás módosítva vendég által: Valami'), null);
  assert.equal(munkatarsTipus('Új online foglalás érkezett: Valami'), null);
  const e = ertelmezMunkatars(munkatarsLevel({ nev: 'Kiss Réka', datum: 'október 8. (csütörtök) 15:30', munka: 'Noel - 20% kedvezmény!' }), MOST);
  assert.equal(e.ok, true); assert.equal(e.tipus, 'szalon_torolte'); assert.equal(e.uzletag, 'hair'); assert.equal(e.nev, 'Kiss Réka');
  assert.equal(e.kezdet, helyiEpoch(2026, 10, 8, 15, 30)); assert.equal(e.munkatars, 'Noel - 20% kedvezmény!'); assert.equal(e.szolgaltatas, SZOLG);
  assert.equal(munkatarsKulcs('Noel - 20% kedvezmény!'), munkatarsKulcs('Noel')); // a promocios toldalek nem szamit
  assert.equal(nevNorm('dr. Hetthessy  Judit Réka'), nevNorm('DR HETTHESSY JUDIT REKA')); // ekezet / kisbetu / jel nem szamit - de nincs kozelito egyeztetes
  assert.notEqual(nevNorm('Kiss Réka'), nevNorm('Kiss Reka Anna'));
  // szeles forma: a cimke es az ertek kulon sorban (tablazatos kiosztas)
  const t = ertelmezMunkatars({ targy: '🗓️ Időpont módosítva: X', kuldo: 'Mosaic Oxigén <app@salonic.hu>', html: '<table><tr><td>Neve:</td><td>Kiss Réka</td></tr><tr><td>Szolgáltatás:</td><td>Haj Oxigénterápia - 1. alkalom</td></tr><tr><td>Dátum:</td><td>november 3. (kedd) 09:00</td></tr><tr><td>Helyszín:</td><td>Mosaic Oxigén</td></tr><tr><td>Munkatárs:</td><td>Anna</td></tr></table>' }, MOST);
  assert.equal(t.ok, true); assert.equal(t.uzletag, 'oxygen'); assert.equal(t.nev, 'Kiss Réka'); assert.equal(t.kezdet, helyiEpoch(2026, 11, 3, 9, 0));
  // hiba esetek
  assert.equal(ertelmezMunkatars(munkatarsLevel({ datum: 'nincs datum' }), MOST).ok, false);
  assert.equal(ertelmezMunkatars({ ...munkatarsLevel(), kuldo: 'Valami Mas <x@y.hu>', html: munkatarsLevel({ helyszin: 'Ismeretlen Hely' }).html }, MOST).ok, false);
  assert.match(ertelmezMunkatars({ ...munkatarsLevel(), kuldo: 'Mosaic Hair <app@salonic.hu>', html: munkatarsLevel({ helyszin: 'Mosaic Oxigén' }).html }, MOST).miert, /ellentmond/);
  // minden uzletag felismerese a helyszinbol
  for (const [hely, uz] of [['Mosaic Headspa', 'headspa'], ['Mosaic Hair', 'hair'], ['Mosaic Oxigén', 'oxygen'], ['Mosaic Elysion', 'laser'], ['Mosaic PMU', 'pmu']]) {
    assert.equal(ertelmezMunkatars(munkatarsLevel({ helyszin: hely, kuldo: `${hely} <app@salonic.hu>` }), MOST).uzletag, uz);
  }
});

test('belső blokk: csak egyértelmű szabály (ebédszünet, szünet, a munkatárs saját nevére szóló blokk)', () => {
  assert.equal(belsoBlokk({ szolgaltatas: 'Ebédszünet', munkatars: 'Noel' }), 'ebedszunet');
  assert.equal(belsoBlokk({ szolgaltatas: '🍽️ ebéd szünet', munkatars: 'Betti' }), 'ebedszunet');
  assert.equal(belsoBlokk({ szolgaltatas: 'Szünet', munkatars: 'Betti' }), 'szunet');
  assert.equal(belsoBlokk({ szolgaltatas: 'Noel', munkatars: 'Noel - 20% kedvezmény!' }), 'munkatars_blokk');
  assert.equal(belsoBlokk({ szolgaltatas: SZOLG, munkatars: 'Betti' }), null);
  assert.equal(belsoBlokk({ szolgaltatas: 'Valami ismeretlen blokk', munkatars: 'Betti' }), null); // bizonytalan -> nem dobhato el
  assert.equal(belsoBlokk({ szolgaltatas: 'Anna', munkatars: 'Betti' }), null); // mas munkatars neve: nem egyertelmu
});

// ---- (1) munkatarsi torles idopont ELOTT ---------------------------------------------------------------------------------------------------------
test('D2/D5 (1): munkatársi törlés időpont előtt - fuggő üzenetek törlődnek, állapot lemondva, 0 vendégüzenet, 0 dupla feldolgozás', async () => {
  const { db, k, id, smsT0 } = await felvesz();
  const elo = hamisElo(TOROLT);
  const fuggoElotte = szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE foglalas_id = ?1 AND allapot = 'fuggoben'", id).n;
  assert.ok(fuggoElotte > 0);
  const r = await ingest(db, ENV, munkatarsLevel({ uzenetId: 'mt-1', nev: 'Teszt Elek' }), MOST + 2 * ORA, { eloEllenorzes: elo });
  assert.equal(r.tipus, 'szalon_torolte'); assert.equal(r.valtozas, true); assert.equal(r.foglalasId, UUID1);
  assert.equal(alapAllapot(db).allapot, 'lemondva');
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE foglalas_id = ?1 AND allapot IN ('fuggoben','kuldes')", id).n, 0);
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE foglalas_id = ?1 AND ok = 'szalon_torolte'", id).n, fuggoElotte);
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE uzenet_id LIKE 'COMMON-%'").n, 0); // sem lemondas-, sem no-show-, sem atfoglalas-uzenet nem keletkezett
  assert.equal(elo.hivasok.length, 1);
  // minden esedekes ido utan sem megy semmi
  assert.equal((await tick(db, ENV, k, MOST + 200 * ORA, { eloEllenorzes: elo })).elkuldve, 0);
  assert.equal(k.ki.sms.length, smsT0);
  // ugyanaz a Gmail-level ujra (Zapier ujrafuttatas): duplikalt; masik level-azonosito ugyanarra a torlesre: mar feldolgozva - nincs uj valtozas
  assert.equal((await ingest(db, ENV, munkatarsLevel({ uzenetId: 'mt-1' }), MOST + 3 * ORA, { eloEllenorzes: elo })).duplikalt, true);
  const masodik = await ingest(db, ENV, munkatarsLevel({ uzenetId: 'mt-2' }), MOST + 3 * ORA, { eloEllenorzes: elo });
  assert.equal(masodik.tipus, 'mar_feldolgozva'); assert.equal(masodik.valtozas, false);
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM esemenyek WHERE tipus = 'ingest:szalon_torolte'").n, 1);
});

test('D2: a munkatársi törlés nem lesz vendég-lemondás: az "ok" nélküli régi lemondás-levél és a törlés nem ütközik', async () => {
  const { db, k, id, smsT0 } = await felvesz();
  await ingest(db, ENV, munkatarsLevel({ uzenetId: 'mt-1' }), MOST + ORA, { eloEllenorzes: hamisElo(TOROLT) });
  assert.equal(alapAllapot(db).allapot, 'lemondva');
  assert.equal(k.ki.sms.length, smsT0);
  assert.equal(szam(db, 'SELECT COUNT(*) AS n FROM foglalasok').n, 1); // nincs masodik (szintetikus) sor
  void id;
});

// ---- (2) torles idopont UTAN ---------------------------------------------------------------------------------------------------------------------
test('D3/D5 (2): törlés időpont után - nincs automatikus no-show, csak napló és riasztás; 0 SMS, nincs állapotváltás', async () => {
  const hamis = hamisElo(TOROLT);
  for (const env of [ENV, { ...ENV, LIFECYCLE_NOSHOW_AUTO: '1' }]) { // a no-show kapcsolo sem teszi automatikussa a munkatarsi torlest
    const { db, k, smsT0 } = await felvesz({ datum: 'október 8. (csütörtök) 15:30' }, env);
    const utana = helyiEpoch(2026, 10, 8, 18, 0);
    const r = await ingest(db, env, munkatarsLevel({ uzenetId: 'mt-1', datum: 'október 8. (csütörtök) 15:30' }), utana, { eloEllenorzes: hamis });
    assert.equal(r.tipus, 'riasztas:utolagos_torles'); assert.equal(r.valtozas, false);
    assert.equal(alapAllapot(db).allapot, 'aktiv');
    assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE uzenet_id LIKE 'COMMON-%'").n, 0);
    assert.equal((await tick(db, env, k, utana + 3 * NAP)).elkuldve, 0);
    assert.equal(k.ki.sms.length, smsT0);
    assert.equal(szam(db, "SELECT COUNT(*) AS n FROM esemenyek WHERE tipus = 'ingest:riasztas:utolagos_torles'").n, 1);
  }
  assert.equal(hamis.hivasok.length, 0); // az utolagos torlesnel nem is kerdezunk ra: nincs mit bizonyitani, nincs valtoztatas
});

test('D3: a régi vendég-oldali "Foglalás lemondás" levél időpont után is csak riasztás (alapból nincs no-show); 3 napnál régebbi csendes', async () => {
  const REKA = { nev: 'Kiss Réka', tel: '06201112222', email: 'kiss.reka@example.com' };
  const { db, k, smsT0 } = await felvesz({ ...REKA });
  const jelzes = helyiEpoch(2026, 11, 25, 17, 30);
  const n = await ingest(db, ENV, lemondottLevel({ ...REKA, uzenetId: 'ns-1', ok: '' }), jelzes);
  assert.equal(n.tipus, 'riasztas:utolagos_torles'); assert.equal(n.valtozas, false);
  assert.equal(alapAllapot(db).allapot, 'aktiv');
  assert.equal((await tick(db, ENV, k, helyiEpoch(2026, 11, 26, 10, 5))).elkuldve, 0);
  assert.equal(k.ki.sms.length, smsT0);
  // a "nem jelent meg" ok az idopont elott: ugyanigy csak riasztas
  const m = await felvesz({ ...REKA });
  const e2 = await ingest(m.db, ENV, lemondottLevel({ ...REKA, ok: 'Nem jelent meg' }), MOST + 2 * ORA);
  assert.equal(e2.tipus, 'riasztas:nem_jelent_meg_jelzes'); assert.equal(alapAllapot(m.db).allapot, 'aktiv');
  // 3 napnal regebbi, mar elmult idopont torlese: csendben lemondva (mint eddig), semmi nem megy ki
  const r = await felvesz({ ...REKA });
  const regi = await ingest(r.db, ENV, lemondottLevel({ ...REKA }), helyiEpoch(2026, 11, 30, 12, 0));
  assert.equal(regi.tipus, 'lemondva');
  assert.equal((await tick(r.db, ENV, r.k, helyiEpoch(2026, 11, 30, 12, 30))).elkuldve, 0);
});

// ---- (3) bizonyitott modositas -------------------------------------------------------------------------------------------------------------------
test('D4 (3a): bizonyított módosítás, az új időpont 72 órán belül - "új időpontod" SMS pontosan egyszer, a terv újraszámolva', async () => {
  const { db, k, id, smsT0 } = await felvesz({ datum: 'október 12. (hétfő) 10:00' }); // MOST: okt. 7 10:00 -> 5 nap lead
  const regiKezdet = helyiEpoch(2026, 10, 12, 10, 0), ujKezdet = helyiEpoch(2026, 10, 9, 14, 0);
  const most = helyiEpoch(2026, 10, 8, 9, 0); // az uj idopont 29 oran belul
  const elo = hamisElo(aktiv(ujKezdet));
  const r = await ingest(db, ENV, munkatarsLevel({ tipus: 'modositas', uzenetId: 'mm-1', datum: 'október 9. (péntek) 14:00', nev: 'Teszt Elek' }), most, { eloEllenorzes: elo });
  assert.equal(r.tipus, 'szalon_athelyezte'); assert.equal(r.valtozas, true); assert.equal(r.sms, true); assert.equal(r.foglalasId, id);
  assert.equal(alapAllapot(db).kezdet, ujKezdet); assert.notEqual(regiKezdet, ujKezdet);
  const t = await tick(db, ENV, k, most, { foglalasId: id });
  assert.equal(t.elkuldve, 1); assert.equal(k.ki.sms.length, smsT0 + 1);
  assert.match(k.ki.sms[k.ki.sms.length - 1].szoveg, /Teszt|Szia/);
  // ismetles (masik level ugyanarra): mar alkalmazva, nincs masodik SMS
  const m2 = await ingest(db, ENV, munkatarsLevel({ tipus: 'modositas', uzenetId: 'mm-2', datum: 'október 9. (péntek) 14:00' }), most + 60, { eloEllenorzes: elo });
  assert.equal(m2.tipus, 'mar_alkalmazva'); assert.equal(m2.valtozas, false);
  assert.equal((await tick(db, ENV, k, most + 120, { foglalasId: id })).elkuldve, 0);
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE uzenet_id LIKE 'COMMON-RESCHEDULE-SMS%'").n, 1);
});

test('D4 (3b): bizonyított módosítás 72 órán túl - csendes újraszámolás, SMS nélkül', async () => {
  const { db, k, id, smsT0 } = await felvesz({ datum: 'október 12. (hétfő) 10:00' });
  const ujKezdet = helyiEpoch(2026, 10, 20, 11, 0);
  const most = helyiEpoch(2026, 10, 8, 9, 0);
  const r = await ingest(db, ENV, munkatarsLevel({ tipus: 'modositas', datum: 'október 20. (kedd) 11:00' }), most, { eloEllenorzes: hamisElo(aktiv(ujKezdet)) });
  assert.equal(r.tipus, 'szalon_athelyezte'); assert.equal(r.sms, false); assert.equal(alapAllapot(db).kezdet, ujKezdet);
  assert.equal((await tick(db, ENV, k, most + 60, { foglalasId: id })).elkuldve, 0);
  assert.equal(k.ki.sms.length, smsT0);
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE uzenet_id LIKE 'COMMON-RESCHEDULE-%'").n, 0);
  // a T-24 az UJ idopont elott ~24 oraval esedekes
  const t24 = szam(db, "SELECT esedekes FROM kuldesek WHERE foglalas_id = ?1 AND uzenet_id LIKE '%-SMS-%' AND esedekes > ?2 ORDER BY esedekes DESC LIMIT 1", id, 0);
  assert.ok(t24 && Math.abs(t24.esedekes - (ujKezdet - 24 * ORA)) <= 24 * ORA);
});

test('D4/D6 (3c): nem bizonyított módosítás - az oldal ellentmond / nem ellenőrizhető / nem mutat kezdést / múltbeli: 0 állapotváltás, 0 SMS, riasztás', async () => {
  const regi = helyiEpoch(2026, 10, 12, 10, 0), uj = helyiEpoch(2026, 10, 9, 14, 0), most = helyiEpoch(2026, 10, 8, 9, 0);
  const esetek = [
    ['oldal_ellentmond', aktiv(regi)], // az oldal a REGI kezdest mutatja: nem modosult
    ['oldal_ellentmond', TOROLT],
    ['nem_ellenorizheto', { allapot: 'ismeretlen', miert: 'http_500' }],
    ['nem_bizonyithato', { allapot: 'aktiv' }], // a Salonic egyszeri modositasi korlatja: az oldalon nincs kezdes
  ];
  for (const [kod, valasz] of esetek) {
    const { db, k, id, smsT0 } = await felvesz({ datum: 'október 12. (hétfő) 10:00' });
    const r = await ingest(db, ENV, munkatarsLevel({ tipus: 'modositas', datum: 'október 9. (péntek) 14:00' }), most, { eloEllenorzes: hamisElo(valasz) });
    assert.equal(r.tipus, `riasztas:${kod}`, kod); assert.equal(r.valtozas, false);
    assert.equal(alapAllapot(db).kezdet, regi); assert.equal((await tick(db, ENV, k, most, { foglalasId: id })).elkuldve, 0); assert.equal(k.ki.sms.length, smsT0);
  }
  // elo-ellenorzes hianyaban sem valtozik semmi
  const { db } = await felvesz({ datum: 'október 12. (hétfő) 10:00' });
  assert.equal((await ingest(db, ENV, munkatarsLevel({ tipus: 'modositas', datum: 'október 9. (péntek) 14:00' }), most)).tipus, 'riasztas:nem_ellenorizheto');
  assert.equal(alapAllapot(db).kezdet, regi);
  // a modositas mult idopontra: riasztas
  const m = await felvesz({ datum: 'október 12. (hétfő) 10:00' });
  assert.equal((await ingest(m.db, ENV, munkatarsLevel({ tipus: 'modositas', datum: 'október 5. (hétfő) 10:00' }), most, { eloEllenorzes: hamisElo(aktiv(helyiEpoch(2026, 10, 5, 10, 0))) })).tipus, 'riasztas:multbeli_modositas');
  void uj;
});

test('D4: a módosítás névvel is szűkít - más nevű vendég foglalását nem mozgatja', async () => {
  const { db, k, smsT0 } = await felvesz({ datum: 'október 12. (hétfő) 10:00', nev: 'Kiss Réka' });
  const most = helyiEpoch(2026, 10, 8, 9, 0);
  const r = await ingest(db, ENV, munkatarsLevel({ tipus: 'modositas', nev: 'Nagy Anna', datum: 'október 9. (péntek) 14:00' }), most, { eloEllenorzes: hamisElo(aktiv(helyiEpoch(2026, 10, 9, 14, 0))) });
  assert.equal(r.tipus, 'nincs_online_foglalas'); // ismert szolgaltatas, nincs ilyen nevu online foglalas: nem hiba, nem valtoztat
  assert.equal(alapAllapot(db).kezdet, helyiEpoch(2026, 10, 12, 10, 0)); assert.equal(k.ki.sms.length, smsT0);
});

// ---- (4) belso blokk -----------------------------------------------------------------------------------------------------------------------------
test('(4) belső blokk: ebédszünet, szünet, a munkatárs saját nevére szóló blokk - ignored_internal, nincs riasztás; bizonytalan: ignored_uncertain + riasztás', async () => {
  const { db, k, smsT0 } = await felvesz();
  const elo = hamisElo(TOROLT);
  const kozel = await ingest(db, ENV, munkatarsLevel({ uzenetId: 'b1', tipus: 'modositas', nev: '', szolg: 'Ebédszünet', datum: 'november 25. (szerda) 16:00' }), MOST + ORA, { eloEllenorzes: elo });
  assert.equal(kozel.tipus, 'ignored_internal'); assert.equal(kozel.szabaly, 'ebedszunet');
  const sz = await ingest(db, ENV, munkatarsLevel({ uzenetId: 'b2', nev: 'Beeső', szolg: 'Szünet', datum: 'november 25. (szerda) 16:00' }), MOST + ORA, { eloEllenorzes: elo });
  assert.equal(sz.tipus, 'ignored_internal');
  const mk = await ingest(db, ENV, munkatarsLevel({ uzenetId: 'b3', nev: 'Beeső', szolg: 'Noel', munka: 'Noel - 20% kedvezmény!', datum: 'november 25. (szerda) 16:00' }), MOST + ORA, { eloEllenorzes: elo });
  assert.equal(mk.tipus, 'ignored_internal'); assert.equal(mk.szabaly, 'munkatars_blokk');
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM esemenyek WHERE tipus LIKE 'ingest:riasztas:%'").n, 0);
  // a Salonic "Beeső" helykitöltő vendége: nincs jelölt -> belső blokk (nincs riasztás), ismeretlen szolgáltatás-névvel is
  const beeso = await ingest(db, ENV, munkatarsLevel({ uzenetId: 'b5', nev: 'Beeső', szolg: 'Megbeszélés', datum: 'november 27. (péntek) 10:00' }), MOST + ORA, { eloEllenorzes: elo });
  assert.equal(beeso.tipus, 'ignored_internal'); assert.equal(beeso.szabaly, 'beeso_nev'); assert.equal(beeso.valtozas, false);
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM esemenyek WHERE tipus LIKE 'ingest:riasztas:%'").n, 0);
  // DECISION #119: PONTOSAN "Beeső" - az ekezet nelkuli vagy kiegeszitett nev nem az: ignored_uncertain + riasztas, nincs allapotvaltas
  for (const [i, nev] of ['Beeso', 'Beeső Anna', 'Beesőné'].entries()) {
    const nem = await ingest(db, ENV, munkatarsLevel({ uzenetId: `bn${i}`, nev, szolg: 'Megbeszélés', datum: 'november 27. (péntek) 11:00' }), MOST + ORA, { eloEllenorzes: elo });
    assert.equal(nem.tipus, 'riasztas:ignored_uncertain', nev); assert.equal(nem.valtozas, false);
  }
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM esemenyek WHERE tipus = 'ingest:riasztas:ignored_uncertain'").n, 3);
  await db.sqlite.prepare("DELETE FROM esemenyek WHERE tipus = 'ingest:riasztas:ignored_uncertain'").run();
  assert.equal(beesoNev(' BEESŐ  '), true); assert.equal(beesoNev('Beeso'), false); assert.equal(beesoNev(''), false); assert.equal(beesoNev(null), false);
  // bizonytalan: nem egyertelmuen belso (nem Beeső, nem ebedszunet / szunet / munkatars-blokk), es nem ismert vendeg-szolgaltatas
  const bizonytalan = await ingest(db, ENV, munkatarsLevel({ uzenetId: 'b4', nev: 'Valódi Vendég', szolg: 'Valami ismeretlen blokk', datum: 'november 26. (csütörtök) 10:00' }), MOST + ORA, { eloEllenorzes: elo });
  assert.equal(bizonytalan.tipus, 'riasztas:ignored_uncertain'); assert.equal(bizonytalan.valtozas, false);
  assert.equal(elo.hivasok.length, 0); // belso blokknal / bizonytalannal nem kerdezunk ra a Salonicra
  assert.equal(alapAllapot(db).allapot, 'aktiv'); assert.equal(k.ki.sms.length, smsT0);
});

// ---- (5) tobbertelmu parositas, (6) nev-elteres --------------------------------------------------------------------------------------------------
test('(5) többértelmű párosítás: két foglalás is illik - 0 állapotváltás, 0 SMS, riasztás', async () => {
  const { db, k, smsT0 } = await felvesz({ nev: 'Kiss Réka', uuid: UUID1, uzenetId: 'g1' });
  await ingest(db, ENV, foglaltLevel({ nev: 'Nagy Anna', tel: '06201234567', email: 'nagy.anna@example.com', uuid: UUID2, uzenetId: 'g2' }), MOST);
  await tick(db, ENV, k, MOST);
  const smsKetto = k.ki.sms.length;
  const elo = hamisElo(TOROLT);
  const r = await ingest(db, ENV, munkatarsLevel({ nev: 'Kiss Réka' }), MOST + ORA, { eloEllenorzes: elo });
  assert.equal(r.tipus, 'riasztas:tobbertelmu'); assert.equal(r.valtozas, false);
  assert.deepEqual(sorok(db, 'SELECT allapot FROM foglalasok').map((x) => x.allapot), ['aktiv', 'aktiv']);
  assert.equal(elo.hivasok.length, 0); assert.equal(k.ki.sms.length, smsKetto);
  assert.ok(smsKetto >= smsT0);
});

test('újrafoglalt slot: a korábban lemondott foglalás nem teszi többértelművé a másik (élő) foglalás törlését; csak az élő foglalás törlődik', async () => {
  const { db, k } = await felvesz({ nev: 'Kiss Réka', uuid: UUID1, uzenetId: 'g1' });
  await ingest(db, ENV, lemondottLevel({ nev: 'Kiss Réka', tel: '06301234567', email: 'teszt.elek@example.com', uzenetId: 'l1' }), MOST + ORA); // A vendeg lemondta
  assert.equal(alapAllapot(db).allapot, 'lemondva');
  const b = await ingest(db, ENV, foglaltLevel({ nev: 'Nagy Anna', tel: '06201234567', email: 'nagy.anna@example.com', uuid: UUID2, uzenetId: 'g2' }), MOST + 2 * ORA); // ugyanaz a slot, masik vendeg
  await tick(db, ENV, k, MOST + 2 * ORA, { foglalasId: b.foglalasId });
  const r = await ingest(db, ENV, munkatarsLevel({ uzenetId: 'mt-b', nev: 'Nagy Anna' }), MOST + 3 * ORA, { eloEllenorzes: hamisElo(TOROLT) });
  assert.equal(r.tipus, 'szalon_torolte'); assert.equal(r.foglalasId, UUID2);
  assert.equal(alapAllapot(db, UUID2).allapot, 'lemondva');
  // az A vendeg lemondott foglalasara szolo ujabb munkatarsi torles-level: mar feldolgozva, nincs valtozas
  assert.equal((await ingest(db, ENV, munkatarsLevel({ uzenetId: 'mt-a', nev: 'Kiss Réka' }), MOST + 4 * ORA, { eloEllenorzes: hamisElo(TOROLT) })).tipus, 'mar_feldolgozva');
});

test('(6) név-eltérés: a négy kulcs egyezik, de a név nem - 0 állapotváltás, 0 SMS, riasztás; közelítő egyeztetés nincs', async () => {
  const { db, k, smsT0 } = await felvesz({ nev: 'Kiss Réka' });
  const elo = hamisElo(TOROLT);
  for (const [i, nev] of ['Nagy Anna', 'Kiss Reka Anna', 'Kiss Rékáné', ''].entries()) {
    const r = await ingest(db, ENV, munkatarsLevel({ uzenetId: `n${i}`, nev }), MOST + ORA, { eloEllenorzes: elo });
    assert.equal(r.tipus, 'riasztas:nev_elteres', nev); assert.equal(r.valtozas, false);
  }
  assert.equal(alapAllapot(db).allapot, 'aktiv'); assert.equal(elo.hivasok.length, 0); assert.equal((await tick(db, ENV, k, MOST + 2 * ORA)).elkuldve, 0); assert.equal(k.ki.sms.length, smsT0);
});

test('a név normalizált egyezése (kisbetű, ékezet nélkül) elég a megerősítéshez, de csak a négy kulccsal együtt', async () => {
  const { db } = await felvesz({ nev: 'Kiss Réka' });
  const r = await ingest(db, ENV, munkatarsLevel({ nev: 'KISS REKA' }), MOST + ORA, { eloEllenorzes: hamisElo(TOROLT) });
  assert.equal(r.tipus, 'szalon_torolte');
});

test('nincs online foglalás (telefonon felvett vendég): ismert szolgáltatás, nincs ilyen foglalás - nem hiba, nem riasztás, nincs változás', async () => {
  const { db, k, smsT0 } = await felvesz();
  const r = await ingest(db, ENV, munkatarsLevel({ nev: 'Telefonos Vendég', datum: 'november 26. (csütörtök) 10:00' }), MOST + ORA, { eloEllenorzes: hamisElo(TOROLT) });
  assert.equal(r.tipus, 'nincs_online_foglalas');
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM esemenyek WHERE tipus LIKE 'ingest:riasztas:%'").n, 0);
  assert.equal(alapAllapot(db).allapot, 'aktiv'); assert.equal(k.ki.sms.length, smsT0);
});

test('törlés időpont előtt, de az élő oldal ELLENTMOND / nem ellenőrizhető / nem UUID-s foglalás: 0 állapotváltás, 0 SMS, riasztás', async () => {
  for (const [kod, valasz] of [['oldal_ellentmond', aktiv(KEZDET_NOV25)], ['nem_ellenorizheto', { allapot: 'ismeretlen', miert: 'idotullepes' }]]) {
    const { db, k, smsT0 } = await felvesz();
    const r = await ingest(db, ENV, munkatarsLevel(), MOST + ORA, { eloEllenorzes: hamisElo(valasz) });
    assert.equal(r.tipus, `riasztas:${kod}`); assert.equal(alapAllapot(db).allapot, 'aktiv'); assert.equal(k.ki.sms.length, smsT0);
  }
  const { db } = await felvesz({ uuid: null }); // uuid nelkul: szintetikus azonosito, az oldal nem kerdezheto le
  const elo = hamisElo(TOROLT);
  assert.equal((await ingest(db, ENV, munkatarsLevel(), MOST + ORA, { eloEllenorzes: elo })).tipus, 'riasztas:nem_ellenorizheto');
  assert.equal(elo.hivasok.length, 0);
  assert.equal((await ingest(db, ENV, munkatarsLevel({ uzenetId: 'x2' }), MOST + ORA)).tipus, 'riasztas:nem_ellenorizheto'); // elo-ellenorzes nelkul is
});

// ---- uzemmodok -----------------------------------------------------------------------------------------------------------------------------------
test('LIFECYCLE_MUNKATARS_MOD: alapértelmezett "figyel" (naplóz, nem változtat); "ki" nem regisztrál (később újraküldhető); a létrehozás-levél kimarad', async () => {
  assert.equal(beallitas({}).munkatarsMod, 'figyel'); assert.equal(beallitas({ LIFECYCLE_MUNKATARS_MOD: 'be' }).munkatarsMod, 'be'); assert.equal(beallitas({ LIFECYCLE_MUNKATARS_MOD: 'x' }).munkatarsMod, 'figyel');
  assert.equal(beallitas({}).noShowAuto, false); assert.equal(beallitas({ LIFECYCLE_NOSHOW_AUTO: '1' }).noShowAuto, true);
  const figyelEnv = { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'hair' }; // nincs munkatars mod: figyel
  const { db, k, smsT0 } = await felvesz({}, figyelEnv);
  const f = await ingest(db, figyelEnv, munkatarsLevel({ uzenetId: 'f1' }), MOST + ORA, { eloEllenorzes: hamisElo(TOROLT) });
  assert.equal(f.tipus, 'figyel'); assert.equal(f.volna, 'szalon_torolte'); assert.equal(f.valtozas, false);
  assert.equal(alapAllapot(db).allapot, 'aktiv'); assert.ok(szam(db, "SELECT COUNT(*) AS n FROM esemenyek WHERE tipus = 'ingest:figyel:szalon_torolte'").n === 1);
  assert.equal(k.ki.sms.length, smsT0);
  // ki: nem regisztralodik
  const kiEnv = { ...ENV, LIFECYCLE_MUNKATARS_MOD: 'ki' };
  const x = await felvesz({}, kiEnv);
  assert.equal((await ingest(x.db, kiEnv, munkatarsLevel({ uzenetId: 'k1' }), MOST + ORA, { eloEllenorzes: hamisElo(TOROLT) })).ok, false);
  assert.equal(szam(x.db, "SELECT COUNT(*) AS n FROM esemenyek WHERE forras_id = 'k1'").n, 0);
  assert.equal((await ingest(x.db, ENV, munkatarsLevel({ uzenetId: 'k1' }), MOST + ORA, { eloEllenorzes: hamisElo(TOROLT) })).tipus, 'szalon_torolte'); // mod bekapcsolva: ugyanaz a level mar feldolgozhato
  // letrehozas-level: sosem feldolgozott
  const l = await ingest(x.db, ENV, { ...munkatarsLevel({ uzenetId: 'lh' }), targy: '🗓️ Új időpont létrehozva: x' }, MOST + ORA);
  assert.equal(l.ok, false);
});

test('ertelmezhetetlen munkatarsi level (megvaltozott sablon): riasztas, semmi nem valtozik', async () => {
  const { db, k, smsT0 } = await felvesz();
  const r = await ingest(db, ENV, { uzenetId: 'ro', targy: '❌ Időpont törölve: x', kuldo: 'Mosaic Hair <app@salonic.hu>', html: '<p>teljesen mas felepitesu level</p>' }, MOST + ORA, { eloEllenorzes: hamisElo(TOROLT) });
  assert.equal(r.ok, false); assert.equal(r.tipus, 'riasztas:ertelmezhetetlen');
  assert.equal(alapAllapot(db).allapot, 'aktiv'); assert.equal(k.ki.sms.length, smsT0);
});

test('napi összesítő: a riasztások egyetlen e-mailben, személyes adat (vendégnév) nélkül; a következő napon nincs új levél', async () => {
  const { db, k } = await felvesz({ nev: 'Titkos Vendég' });
  await ingest(db, ENV, munkatarsLevel({ uzenetId: 'r1', nev: 'Titkos Masvalaki' }), MOST + ORA, { eloEllenorzes: hamisElo(TOROLT) }); // nev_elteres
  await ingest(db, ENV, munkatarsLevel({ uzenetId: 'r2', nev: 'Valódi Vendég', szolg: 'Valami ismeretlen blokk', datum: 'november 26. (csütörtök) 10:00' }), MOST + ORA);
  const emailElotte = k.ki.email.length;
  const n = await napi(db, ENV, k, MOST + NAP);
  assert.equal(n.riasztasOsszesito, 2); assert.equal(k.ki.email.length, emailElotte + 1);
  const level = k.ki.email[k.ki.email.length - 1];
  assert.match(level.targy, /2 kézi ellenőrzést/); assert.doesNotMatch(level.szoveg, /Titkos|Valódi Vendég|Masvalaki/);
  assert.match(level.szoveg, /nev_elteres/); assert.match(level.szoveg, /ignored_uncertain/);
  const n2 = await napi(db, ENV, k, MOST + 2 * NAP);
  assert.equal(n2.riasztasOsszesito, undefined); assert.equal(k.ki.email.length, emailElotte + 1);
  // az /allapot szamlalokat ad, szemelyes adat nelkul
  const a = await allapot(db, ENV, MOST);
  assert.equal(a.munkatarsMod, 'be'); assert.equal(a.munkatarsEsemenyek['ingest:riasztas:nev_elteres'], 1); assert.doesNotMatch(JSON.stringify(a), /Titkos|Masvalaki/);
});

// ---- D6: elo ellenorzes kuldes elott -------------------------------------------------------------------------------------------------------------
test('D6: a tick kiküldés előtt megnézi a Salonic-oldalt: törölt foglalásra nem megy semmi, a fuggő üzenetek törlődnek', async () => {
  const { db, k, id, smsT0 } = await felvesz({ datum: 'október 14. (szerda) 10:00' }); // 7 nap lead: T-72 es T-24 is lesz
  const elo = hamisElo(TOROLT);
  const t72 = szam(db, "SELECT esedekes FROM kuldesek WHERE foglalas_id = ?1 AND uzenet_id LIKE '%SMS%' AND esedekes > ?2 ORDER BY esedekes LIMIT 1", id, MOST + 3600);
  assert.ok(t72);
  const t = await tick(db, ENV, k, t72.esedekes + 60, { eloEllenorzes: elo });
  assert.equal(t.elkuldve, 0); assert.ok(t.eloTorolt >= 1); assert.equal(k.ki.sms.length, smsT0);
  assert.equal(alapAllapot(db).allapot, 'lemondva');
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE foglalas_id = ?1 AND allapot IN ('fuggoben','kuldes')", id).n, 0);
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE uzenet_id LIKE 'COMMON-%'").n, 0); // nincs vendeguzenet a torlesrol
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM esemenyek WHERE tipus = 'elo:torolve'").n, 1);
  // egy booking egyszer kerul lekerdezesre tickenkent
  assert.equal(elo.hivasok.length, 1);
  assert.equal((await tick(db, ENV, k, t72.esedekes + 3 * NAP, { eloEllenorzes: elo })).elkuldve, 0);
});

test('D6: eltérő kezdés csak naplózódik (nem döntési feltétel), a küldés megy; ismeretlen / hiba / nincs ellenőrző: a mostani működés', async () => {
  for (const [nev, eloFn, vart] of [
    ['egyezo kezdes', () => hamisElo(aktiv(helyiEpoch(2026, 10, 14, 10, 0))), 0],
    ['eltero kezdes', () => hamisElo(aktiv(helyiEpoch(2026, 10, 15, 10, 0))), 1],
    ['ismeretlen', () => hamisElo({ allapot: 'ismeretlen' }), 0],
    ['hiba', () => hamisElo(() => { throw new Error('halozat'); }), 0],
    ['nincs ellenorzo', () => undefined, 0],
  ]) {
    const { db, k, id, smsT0 } = await felvesz({ datum: 'október 14. (szerda) 10:00' });
    const t72 = szam(db, "SELECT esedekes FROM kuldesek WHERE foglalas_id = ?1 AND uzenet_id LIKE '%SMS%' AND esedekes > ?2 ORDER BY esedekes LIMIT 1", id, MOST + 3600).esedekes;
    const t = await tick(db, ENV, k, t72 + 60, { eloEllenorzes: eloFn() });
    assert.equal(t.elkuldve >= 1, true, nev); assert.equal(k.ki.sms.length > smsT0, true, nev);
    assert.equal(alapAllapot(db).allapot, 'aktiv', nev);
    assert.equal(szam(db, "SELECT COUNT(*) AS n FROM esemenyek WHERE tipus = 'elo:kezdes_eltero'").n, vart, nev);
  }
});

test('D6: a T0 / lemondás / áthelyezés üzenet előtt nincs oldal-lekérdezés (azonnali üzenetek); szintetikus (nem UUID) foglalásnál sincs', async () => {
  const db = d1(); const k = hamisKuldok(); const elo = hamisElo(aktiv(KEZDET_NOV25));
  const r = await ingest(db, ENV, foglaltLevel(), MOST);
  await tick(db, ENV, k, MOST, { foglalasId: r.foglalasId, eloEllenorzes: elo });
  assert.equal(elo.hivasok.length, 0); assert.ok(k.ki.sms.length >= 1);
  const db2 = d1(); const k2 = hamisKuldok(); const elo2 = hamisElo(TOROLT);
  const r2 = await ingest(db2, ENV, foglaltLevel({ uuid: null, datum: 'október 14. (szerda) 10:00' }), MOST);
  await tick(db2, ENV, k2, helyiEpoch(2026, 10, 11, 10, 0), { eloEllenorzes: elo2 });
  assert.equal(elo2.hivasok.length, 0); void r2;
});

test('elo-elemzes: deleteSuccess átirányítás / felirat / élő foglalás kezdéssel / ismeretlen oldal', () => {
  const id = UUID1;
  assert.deepEqual(eloElemzes({ status: 200, url: `https://mosaic-hair.salonic.hu/booking/deleteSuccess/${id}`, html: '', id }), { allapot: 'torolve', forras: 'atiranyitas' });
  // a felirat ONMAGABAN nem dont (a Salonic a forditasi szovegeket elo foglalas oldalan is hordozhatja): csak az atiranyitas
  assert.deepEqual(eloElemzes({ status: 200, url: `https://x/booking/bookingDetails/${id}`, html: '<h2>Időpont törölve!</h2>', id }), { allapot: 'ismeretlen', miert: 'torolve_felirat_atiranyitas_nelkul' });
  assert.equal(eloElemzes({ status: 200, url: `https://x/booking/bookingDetails/${id}`, html: '<script>var t={"deleted":"Appointment deleted!"}</script><b>Visszaigazolt</b>', id }).allapot, 'aktiv');
  assert.deepEqual(eloElemzes({ status: 200, url: `https://x/booking/deleteSuccess/${UUID2}`, html: '', id }), { allapot: 'ismeretlen', miert: 'masik_foglalas' });
  assert.deepEqual(eloElemzes({ status: 200, url: 'x', html: `<a href="/selectDate/?startDate=1795000000&amp;bookingId=${id}">Foglalás módosítása</a><b>Visszaigazolt</b>`, id }), { allapot: 'aktiv', startUnix: 1795000000 });
  assert.deepEqual(eloElemzes({ status: 200, url: 'x', html: '<b>Visszaigazolt</b>', id }), { allapot: 'aktiv' });
  assert.equal(eloElemzes({ status: 200, url: 'x', html: `<a href="/selectDate/?startDate=1795000000&amp;bookingId=${UUID2}">x</a>`, id }).allapot, 'ismeretlen'); // masik foglalas UUID-ja
  assert.equal(eloElemzes({ status: 500, url: 'x', html: '', id }).allapot, 'ismeretlen');
  assert.equal(eloElemzes({ status: 200, url: 'x', html: '<p>az időpont törölhető</p>', id }).allapot, 'ismeretlen'); // "toroLHETO" nem "torolve"
});

test('elo-allapot: hálózati hiba / időtúllépés / érvénytelen azonosító sosem dob hibát; az URL a fiókból és az UUID-ból áll', async () => {
  const hivott = [];
  const fetchOk = async (url) => { hivott.push(url); const r = new Response('<b>Visszaigazolt</b>', { status: 200 }); Object.defineProperty(r, 'url', { value: url }); return r; };
  assert.equal((await eloAllapot({ fiok: 'mosaic-hair', id: UUID1, fetchFn: fetchOk })).allapot, 'aktiv');
  assert.deepEqual(hivott, [`https://mosaic-hair.salonic.hu/booking/bookingDetails/${UUID1}`]);
  assert.equal((await eloAllapot({ fiok: 'mosaic-hair', id: UUID1, fetchFn: async () => { throw new Error('halozat'); } })).allapot, 'ismeretlen');
  assert.equal((await eloAllapot({ fiok: 'mosaic-hair', id: UUID1, ms: 20, fetchFn: (u, o) => new Promise((_, nem) => o.signal.addEventListener('abort', () => nem(new Error('abort')))) })).allapot, 'ismeretlen');
  assert.equal((await eloAllapot({ fiok: 'evil.com/x', id: UUID1, fetchFn: fetchOk })).allapot, 'ismeretlen'); // SSRF-vedelem: a host csak a fiok-nevbol
  assert.equal((await eloAllapot({ fiok: 'mosaic-hair', id: 'szint-1234', fetchFn: fetchOk })).allapot, 'ismeretlen');
  assert.equal(hivott.length, 1);
  assert.equal(eloEllenorzoKeszit({ LIFECYCLE_ELO_ELLENORZES: 'ki' }), null); assert.equal(typeof eloEllenorzoKeszit({}), 'function');
});

test('http: a munkatársi level a /bejovo végponton át, az elo-ellenorzes a Salonic oldalan (deleteSuccess átirányítás) - törlés időpont előtt', async () => {
  const db = d1(); const eredeti = globalThis.fetch;
  const kulcs = 'proba-kulcs';
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(kulcs)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const env = { ...ENV, LIFECYCLE_DB: db, LIFECYCLE_KULCS_HASH: hash };
  const hiv = (torzs) => api(new Request('https://x.test/api/lifecycle/bejovo', { method: 'POST', headers: { 'x-lifecycle-kulcs': kulcs }, body: JSON.stringify(torzs) }), env, {});
  try {
    await ingest(db, env, foglaltLevel(), MOST);
    globalThis.fetch = async (url) => { const r = new Response('', { status: 200 }); Object.defineProperty(r, 'url', { value: String(url).replace('bookingDetails', 'deleteSuccess') }); return r; };
    const lev = munkatarsLevel({ uzenetId: 'http-1' });
    const valasz = await (await hiv({ uzenetId: lev.uzenetId, targy: lev.targy, kuldo: lev.kuldo, html: lev.html, kuldve: MOST - 1 })).json();
    assert.equal(valasz.tipus, 'szalon_torolte'); assert.equal(valasz.valtozas, true);
    assert.equal(alapAllapot(db).allapot, 'lemondva');
    const ism = await (await hiv({ uzenetId: lev.uzenetId, targy: lev.targy, kuldo: lev.kuldo, html: lev.html })).json();
    assert.equal(ism.duplikalt, true);
  } finally { globalThis.fetch = eredeti; }
});

test('http (DECISION #119 holdout): figyel módban a munkatársi level SOHA nem indít küldést - a /bejovo nem hívja a tick-et, a függő üzenetek érintetlenek', async () => {
  const db = d1(); const eredeti = globalThis.fetch;
  const kulcs = 'proba-kulcs-2';
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(kulcs)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const env = { ...ENV, LIFECYCLE_MOD: 'teszt', LIFECYCLE_MUNKATARS_MOD: 'figyel', LIFECYCLE_DB: db, LIFECYCLE_KULCS_HASH: hash }; // teszt mod: a "most" felulirhato
  const hiv = (torzs) => api(new Request('https://x.test/api/lifecycle/bejovo', { method: 'POST', headers: { 'x-lifecycle-kulcs': kulcs }, body: JSON.stringify({ ...torzs, most: MOST + ORA }) }), env, {});
  try {
    const f = await ingest(db, env, foglaltLevel(), MOST); // NINCS tick: a T0 uzenetek fuggoben allnak, esedekesek
    assert.equal(f.ok, true);
    const elotte = sorok(db, 'SELECT uzenet_id, allapot, probalkozas FROM kuldesek ORDER BY id');
    assert.ok(elotte.length > 0 && elotte.every((x) => x.allapot === 'fuggoben'));
    globalThis.fetch = async (url) => { const r = new Response('', { status: 200 }); Object.defineProperty(r, 'url', { value: String(url).replace('bookingDetails', 'deleteSuccess') }); return r; };
    const lev = munkatarsLevel({ uzenetId: 'holdout-1' });
    const valasz = await (await hiv({ uzenetId: lev.uzenetId, targy: lev.targy, kuldo: lev.kuldo, html: lev.html, kuldve: MOST })).json();
    assert.equal(valasz.tipus, 'figyel'); assert.equal(valasz.volna, 'szalon_torolte'); assert.equal(valasz.valtozas, false);
    assert.equal(valasz.kuldes, null); // a tick nem futott
    assert.deepEqual(sorok(db, 'SELECT uzenet_id, allapot, probalkozas FROM kuldesek ORDER BY id'), elotte); // egyetlen kuldes sem probalkozott
    assert.equal(alapAllapot(db).allapot, 'aktiv');
    // riasztas (nev-eltérés) és belső blokk sem indít küldést
    const nevElter = munkatarsLevel({ uzenetId: 'holdout-2', nev: 'Masvalaki' });
    const r2 = await (await hiv({ uzenetId: nevElter.uzenetId, targy: nevElter.targy, kuldo: nevElter.kuldo, html: nevElter.html, kuldve: MOST })).json();
    assert.equal(r2.tipus, 'riasztas:nev_elteres'); assert.equal(r2.kuldes, null);
    assert.deepEqual(sorok(db, 'SELECT uzenet_id, allapot, probalkozas FROM kuldesek ORDER BY id'), elotte);
  } finally { globalThis.fetch = eredeti; }
});

// ---- VALODI (kitakart) munkatarsi levelek: a 2026-10-09-i visszajatszasi csomagbol (fixtures/munkatarsi-levelek.json) -----------------------------------
const ENV_MIND = { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'headspa,hair,oxygen,laser,pmu', LIFECYCLE_MUNKATARS_MOD: 'be' };
const VALODI = JSON.parse(fs.readFileSync(new URL('./fixtures/munkatarsi-levelek.json', import.meta.url), 'utf8')).esetek;
/** egy valodi minta; a (semleges) vendeg-hash helyere `nev` kerul, hogy a tesztben felvett foglalas neve ezzel egyezzen */
function valodi(cimke, nev) {
  const e = VALODI.find((x) => x.cimke === cimke);
  assert.ok(e, `hianyzo minta: ${cimke}`);
  const epoch = Math.floor(Date.parse(e.kuldve_utc) / 1000);
  const BEESO_HASH = 'e48ff85456a2c076'; // sha256("beeső")[:16] - a Salonic helykitoltő vendege (nem szemely): a hash helyere visszakerul a nev
  const nevCsere = nev ?? (e.nev_hash === BEESO_HASH ? 'Beeső' : null);
  const html = nevCsere ? e.html.replaceAll(`[NEV-HASH:${e.nev_hash}]`, nevCsere) : e.html;
  const level = (kuldve = epoch) => ({ uzenetId: `${e.gmail_id}-${kuldve}`, targy: e.targy, kuldo: e.felado, html, kuldve });
  return { ...e, epoch, level, p: ertelmezMunkatars({ targy: e.targy, kuldo: e.felado, html }, epoch) };
}

test('VALÓDI levelek: a parser a Salonic tényleges HTML-jét értelmezi (törlés, módosítás, belső blokk), a hetnap és az időpont egyezik', () => {
  const t = valodi('torles_vendeg').p;
  assert.equal(t.ok, true); assert.equal(t.tipus, 'szalon_torolte'); assert.equal(t.uzletag, 'headspa'); assert.equal(t.munkatars, 'Négykezes Head spa');
  assert.equal(t.kezdet, helyiEpoch(2026, 10, 9, 10, 30)); assert.equal(t.helyszin, 'Mosaic Headspa'); assert.match(t.szolgaltatas, /EGYÉNI 50 perces MOSAIC "Relax" Head Spa/);
  const m = valodi('modositas_vendeg').p;
  assert.equal(m.ok, true); assert.equal(m.tipus, 'szalon_athelyezte'); assert.equal(m.kezdet, helyiEpoch(2026, 10, 10, 15, 30)); assert.match(m.szolgaltatas, /^KUPONKÓDDAL - /);
  assert.equal(belsoBlokk(valodi('beeso_belso_szabaly').p), 'ebedszunet');
  assert.equal(belsoBlokk(valodi('beeso_blokk').p), null); // a munkatars-szabaly nem fogja meg ("Tundi" blokk az "Elysion Pro" eroforrason) - a Beeső-szabaly igen (lasd lent)
});

test('VALÓDI levelek: "Beeső" helykitöltő / belső blokk - ignored_internal, nincs riasztás, nincs foglalás-változás; ismeretlen vendég-szolgáltatás - riasztás', async () => {
  const db = d1();
  const futtat = async (cimke) => { const e = valodi(cimke); return ingest(db, ENV_MIND, e.level(), e.epoch + 5); };
  const ebed = await futtat('beeso_belso_szabaly');
  assert.equal(ebed.tipus, 'ignored_internal'); assert.equal(ebed.szabaly, 'ebedszunet');
  const beeso = await futtat('beeso_blokk');
  assert.equal(beeso.tipus, 'ignored_internal'); assert.equal(beeso.szabaly, 'beeso_nev'); assert.equal(beeso.valtozas, false);
  const ismeretlen = await futtat('ismeretlen_szolgaltatas_vendeg'); // valodi vendeg, de az "Arc+Haj Oxigenterapia" nincs a Salonic-pillanatkepben: ember dont
  assert.equal(ismeretlen.tipus, 'riasztas:ignored_uncertain');
  assert.equal(szam(db, 'SELECT COUNT(*) AS n FROM foglalasok').n, 0); assert.equal(szam(db, 'SELECT COUNT(*) AS n FROM kuldesek').n, 0);
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM esemenyek WHERE tipus LIKE 'ingest:riasztas:%'").n, 1); // csak az ismeretlen vendeg-szolgaltatas riaszt
});

test('"Beeső" nevű valódi online foglalás a rendes úton megy (a helykitöltő-szabály csak jelölt hiányában él)', async () => {
  const e = valodi('torles_vendeg', 'Beeső');
  const kezdet = e.p.kezdet;
  const { db, id } = await felvesz({ nev: 'Beeső', szolg: e.p.szolgaltatas, munka: e.p.munkatars, datum: 'október 9. (péntek) 10:30', fiok: 'mosaicheadspa', kuldo: 'Mosaic Headspa <app@salonic.hu>' }, ENV_MIND, kezdet - 4 * NAP);
  const r = await ingest(db, ENV_MIND, e.level(kezdet - 5 * ORA), kezdet - 5 * ORA, { eloEllenorzes: hamisElo(TOROLT) });
  assert.equal(r.tipus, 'szalon_torolte'); assert.equal(alapAllapot(db, id).allapot, 'lemondva');
});

test('VALÓDI törlés (a 2026-10-09 10:30-as eset): időpont UTÁN - csak riasztás, 0 állapotváltás, 0 SMS; időpont ELŐTT - lemondva, függő üzenetek törölve, 0 vendégüzenet', async () => {
  const e = valodi('torles_vendeg', 'Teszt Elek');
  const kezdet = e.p.kezdet;
  const foglalas = { nev: 'Teszt Elek', szolg: e.p.szolgaltatas, munka: e.p.munkatars, datum: 'október 9. (péntek) 10:30', fiok: 'mosaicheadspa', kuldo: 'Mosaic Headspa <app@salonic.hu>' };
  // (a) a valodi level 10 perccel az idopont UTAN erkezett
  const a = await felvesz(foglalas, ENV_MIND, kezdet - 4 * NAP);
  const ra = await ingest(a.db, ENV_MIND, e.level(e.epoch), e.epoch + 5, { eloEllenorzes: hamisElo(TOROLT) });
  assert.equal(ra.tipus, 'riasztas:utolagos_torles'); assert.equal(ra.valtozas, false); assert.equal(alapAllapot(a.db, a.id).allapot, 'aktiv');
  assert.equal((await tick(a.db, ENV_MIND, a.k, kezdet + ORA)).elkuldve, 0); assert.equal(a.k.ki.sms.length, a.smsT0);
  // (b) ugyanez a level az idopont ELOTT
  const b = await felvesz(foglalas, ENV_MIND, kezdet - 4 * NAP);
  const elott = kezdet - 5 * ORA;
  const rb = await ingest(b.db, ENV_MIND, e.level(elott), elott, { eloEllenorzes: hamisElo(TOROLT) });
  assert.equal(rb.tipus, 'szalon_torolte'); assert.equal(rb.valtozas, true); assert.equal(alapAllapot(b.db, b.id).allapot, 'lemondva');
  assert.equal(szam(b.db, "SELECT COUNT(*) AS n FROM kuldesek WHERE allapot IN ('fuggoben', 'kuldes')").n, 0);
  assert.equal((await tick(b.db, ENV_MIND, b.k, kezdet - 3 * ORA)).elkuldve, 0); assert.equal(b.k.ki.sms.length, b.smsT0); assert.equal(b.k.ki.email.length, b.emailT0);
  assert.equal((await ingest(b.db, ENV_MIND, e.level(elott), elott + 60, { eloEllenorzes: hamisElo(TOROLT) })).duplikalt, true); // ugyanaz a level: 0 dupla feldolgozas
});

test('VALÓDI módosítás: bizonyított (az élő oldal az új kezdést mutatja), 72 órán belül - "új időpontod" SMS pontosan egyszer; ugyanaz a level újra: nincs dupla', async () => {
  const e = valodi('modositas_vendeg', 'Teszt Elek');
  const uj = e.p.kezdet; // 2026-10-10 15:30
  const { db, id } = await felvesz({ nev: 'Teszt Elek', szolg: e.p.szolgaltatas, munka: e.p.munkatars, datum: 'október 11. (vasárnap) 15:30', fiok: 'mosaicheadspa', kuldo: 'Mosaic Headspa <app@salonic.hu>' }, ENV_MIND, uj - 5 * NAP);
  const most = uj - 20 * ORA;
  const r = await ingest(db, ENV_MIND, e.level(most), most, { eloEllenorzes: hamisElo(aktiv(uj)) });
  assert.equal(r.tipus, 'szalon_athelyezte'); assert.equal(r.sms, true); assert.equal(alapAllapot(db, id).kezdet, uj);
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE foglalas_id = ?1 AND uzenet_id LIKE 'COMMON-RESCHEDULE-%'", id).n, 1);
  const ujra = await ingest(db, ENV_MIND, { ...e.level(most), uzenetId: 'masik-gmail-id' }, most + 60, { eloEllenorzes: hamisElo(aktiv(uj)) });
  assert.equal(ujra.tipus, 'mar_alkalmazva'); assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE uzenet_id LIKE 'COMMON-RESCHEDULE-%'").n, 1);
});
