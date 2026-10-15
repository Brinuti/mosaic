// node --test tools/test-mp-lemondas.mjs  -  lemondas / modositas level: ertelmezes es rogzites, KITALALT (szintetikus) levelekkel
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { lemondasErtelmezes, lemondasRogzites } from '../lib/meres/lemondas.js';
import { budapestUnix } from '../lib/meres/igazolas.js';

const FROM = 'Medical Piercing <app@salonic.hu>';
const ERK = Date.UTC(2026, 9, 15, 8, 0) / 1000;
const lemondasLevel = {
  from: FROM, date: new Date(ERK * 1000).toISOString(),
  subject: 'Foglalás lemondás - Teszt Elek - 2 PIERCING',
  body: '<p>Foglalás lemondás</p><p>Az alábbi időpontot a páciens lemondta: Lemondás oka: Kitalált ok, nem valódi. október 26. (hétfő) 10:00</p><p>Szolgáltatás: 2 PIERCING</p><p>Munkatárs: Kovács Gabriella</p><p>Foglaló adatai: Név: Teszt Elek Mobiltelefonszám: +36 30 000 0000</p>',
};
const modositasLevel = {
  from: FROM, date: new Date(ERK * 1000).toISOString(),
  subject: 'Foglalás módosítva páciens által',
  body: '<p>Foglaló adatai: Név: Próba Panna Mobiltelefonszám: +36 30 111 1111</p><p>RÉGI dátum: október 20. (kedd) 15:30</p><p>Új dátum: október 22. (csütörtök) 16:00</p><p>Szolgáltatás: Migrén</p><p>Tervezett kezdés: 16:00 Munkatárs: Kovács Richárd Várható időtartam: 15 perc</p><a href="https://x.salonic.hu/b?bookingId=12345678-1234-1234-1234-1234567890ab">Foglalás megtekintése</a>',
};

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec("CREATE TABLE mp_foglalas (kulcs TEXT PRIMARY KEY, kornyezet TEXT, allapot TEXT)");
  db.exec("CREATE TABLE mp_salonic_igazolas (booking_id TEXT PRIMARY KEY, kulcs TEXT)");
  const prep = (sql) => { let a = []; const o = { bind: (...x) => { a = x; return o; }, run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: r.changes } }; },
    first: async () => db.prepare(sql).get(...a) ?? null, all: async () => ({ results: db.prepare(sql).all(...a) }) }; return o; };
  return { prepare: prep, raw: db };
}

test('lemondas: munkatars + idopont, nev/telefon/ok nem kerul a kimenetbe', () => {
  const l = lemondasErtelmezes(lemondasLevel);
  assert.equal(l.ok, true); assert.equal(l.tipus, 'lemondas');
  assert.deepEqual(l.employeeIds, ['13509']);
  assert.equal(l.startUnix, budapestUnix(2026, 10, 26, 10, 0));
  assert.equal(l.bizonytalan, false);
  const s = JSON.stringify(l);
  for (const tilos of ['Teszt', 'Elek', '+36', 'Kitalált', 'PIERCING']) assert.ok(!s.includes(tilos), tilos);
});

test('modositas: bookingId + regi es uj idopont', () => {
  const l = lemondasErtelmezes(modositasLevel);
  assert.equal(l.tipus, 'modositas');
  assert.equal(l.bookingId, '12345678-1234-1234-1234-1234567890ab');
  assert.deepEqual(l.employeeIds, ['17769']);
  assert.equal(l.startUnix, budapestUnix(2026, 10, 20, 15, 30));
  assert.equal(l.ujStartUnix, budapestUnix(2026, 10, 22, 16, 0));
  assert.ok(!JSON.stringify(l).includes('Panna'));
});

test('nem lemondas / nem MP: elutasitva', () => {
  assert.equal(lemondasErtelmezes({ ...lemondasLevel, subject: 'Új online foglalás érkezett' }).hiba, 'nem_lemondas');
  assert.equal(lemondasErtelmezes({ ...lemondasLevel, from: 'Mosaic <app@salonic.hu>' }).hiba, 'nem_mp_fiok');
});

test('hianyos level: bizonytalan, foglalast nem jelol', async () => {
  const db = d1();
  const k = `6029|13509|${budapestUnix(2026, 10, 26, 10, 0)}`;
  db.raw.prepare("INSERT INTO mp_foglalas VALUES (?, 'eles', NULL)").run(k);
  const l = lemondasErtelmezes({ ...lemondasLevel, body: lemondasLevel.body.replace('Kovács Gabriella', 'Ismeretlen Valaki') });
  assert.equal(l.bizonytalan, true);
  const r = await lemondasRogzites(db, l, ERK);
  assert.equal(r.allapot, 'bizonytalan');
  assert.equal(db.raw.prepare('SELECT allapot FROM mp_foglalas').get().allapot, null);
});

test('rogzites: egyertelmu foglalas lemondva, ismetles nem duplaz, naploban nincs vendegadat', async () => {
  const db = d1();
  const k = `6029|13509|${budapestUnix(2026, 10, 26, 10, 0)}`;
  db.raw.prepare("INSERT INTO mp_foglalas VALUES (?, 'eles', NULL)").run(k);
  const l = lemondasErtelmezes(lemondasLevel);
  const r1 = await lemondasRogzites(db, l, ERK);
  const r2 = await lemondasRogzites(db, l, ERK + 5);
  assert.equal(r1.jelolve, true); assert.equal(r2.uj, false);
  assert.equal(db.raw.prepare('SELECT allapot FROM mp_foglalas').get().allapot, 'lemondva');
  const naplo = db.raw.prepare('SELECT * FROM mp_lemondas').all();
  assert.equal(naplo.length, 1);
  assert.ok(!JSON.stringify(naplo).match(/Teszt|Elek|\+36|Kitalált/));
});

test('modositas bookingId-vel: athelyezve', async () => {
  const db = d1();
  db.raw.prepare("INSERT INTO mp_foglalas VALUES ('6029|17769|1', 'eles', NULL)").run();
  db.raw.prepare("INSERT INTO mp_salonic_igazolas VALUES ('12345678-1234-1234-1234-1234567890ab', '6029|17769|1')").run();
  const r = await lemondasRogzites(db, lemondasErtelmezes(modositasLevel), ERK);
  assert.equal(r.jelolve, true);
  assert.equal(db.raw.prepare('SELECT allapot FROM mp_foglalas').get().allapot, 'athelyezve');
});
