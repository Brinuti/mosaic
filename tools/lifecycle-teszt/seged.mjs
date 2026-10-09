// Kozos segedek a lifecycle-tesztekhez (munkatars.test.mjs): D1-hamisitvany (node:sqlite), hamis kuldok, kitalalt Salonic-ertesitok.
// Vendegadat nincs: minden nev / e-mail kitalalt.
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const SEMA = fs.readFileSync(new URL('../../netlify/lib/lifecycle/sema.sql', import.meta.url), 'utf8');
export const ORA = 3600, NAP = 86400;
export const UUID1 = '0b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8';
export const UUID2 = '11111111-2222-4333-8444-555555555555';
export const SZOLG = '👱‍♀️ Tőfestés + Szárítás - Hosszú haj'; // a Salonic-pillanatkepben szereplo fodrasz-szolgaltatas
export const MOST = Date.UTC(2026, 9, 7, 8, 0) / 1000; // 2026-10-07 10:00 (nyari ido)

export function d1() {
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
export function hamisKuldok() {
  const ki = { sms: [], email: [] };
  return { ki, sms: async (a) => { ki.sms.push(a); return { id: `sms-${ki.sms.length}` }; }, email: async (a) => { ki.email.push(a); return { id: `mail-${ki.email.length}` }; }, egyenleg: async () => 12345 };
}
/** Hamis elo-ellenorzes: valasz = objektum vagy fuggveny({fiok,id}); a hivasok a .hivasok tombben. */
export function hamisElo(valasz) {
  const hivasok = [];
  const f = async (a) => { hivasok.push(a); return typeof valasz === 'function' ? valasz(a) : valasz; };
  f.hivasok = hivasok;
  return f;
}

const html = (cim, sorok, uuid, fiok = 'mosaic-hair') => `<html><head><style>.x{}</style></head><body><table><tr><td>${cim}</td></tr>${sorok.map((s) => `<tr><td>${s}</td></tr>`).join('')}
${uuid ? `<tr><td><a href="https://app.salonic.hu/backend/signin/?customer=${fiok}&amp;redirect=%2Fcalendar%2FshowBooking%2F%3FbookingId%3D${uuid}">Foglalás megtekintése</a></td></tr>` : ''}
<tr><td>Magyar fejlesztésű online naptár és időpontfoglaló rendszer</td></tr></table></body></html>`;

/** "Új online foglalás érkezett" (vendeg-oldali ertesito): a foglalas felvetele. */
export function foglaltLevel({ uzenetId = 'g1', nev = 'Teszt Elek', tel = '06301234567', email = 'teszt.elek@example.com', szolg = SZOLG, munka = 'Betti', datum = 'november 25. (szerda) 16:00', uuid = UUID1, fiok = 'mosaic-hair', kuldo = 'Mosaic Hair <app@salonic.hu>' } = {}) {
  return { uzenetId, targy: `Új online foglalás érkezett: ${szolg}`, kuldo, html: html('Új online foglalás érkezett az alábbi adatokkal, melyet a rendszer automatikusan jóváhagyott:', ['Foglaló adatai:', `Név: ${nev}`, `Mobiltelefonszám: ${tel}`, `E-mail cím: ${email}`, 'Időpont adatok:', `Szolgáltatás: ${szolg}`, `Munkatárs: ${munka}`, `Kezdő dátum: ${datum}`], uuid, fiok) };
}
/** "Foglalás lemondás" (a regi, vendeg-oldali lemondas-ertesito) */
export const lemondottLevel = ({ uzenetId = 'l1', datum = 'november 25. (szerda) 16:00', szolg = SZOLG, nev = 'Teszt Elek', tel = '06301234567', email = 'teszt.elek@example.com', ok = '' } = {}) => ({
  uzenetId, targy: `Foglalás lemondás - ${nev} - ${szolg}`, kuldo: 'Mosaic Hair <app@salonic.hu>',
  html: html('Az alábbi időpontot a vendég lemondta:', [`Lemondás oka: ${ok}${datum}`, `Szolgáltatás: ${szolg}`, 'Munkatárs: Betti', 'Foglaló adatai:', `Név: ${nev}`, `Mobiltelefonszám: ${tel}`, `E-mail cím: ${email}`], null),
});
/** A Salonic MUNKATARSI ertesitoje (torles / modositas): nev, szolgaltatas, datum (ev nelkul), helyszin, munkatars; nincs azonosito, link, ok, telefon, e-mail. */
export function munkatarsLevel({ uzenetId = 'mt1', tipus = 'torles', nev = 'Teszt Elek', szolg = SZOLG, datum = 'november 25. (szerda) 16:00', helyszin = 'Mosaic Hair', munka = 'Betti', kuldo = 'Mosaic Hair <app@salonic.hu>' } = {}) {
  const cim = tipus === 'torles' ? '❌ Időpont törölve' : '🗓️ Időpont módosítva';
  const mondat = tipus === 'torles' ? 'Az alábbi időpontot törölték a rendszerből:' : 'Az alábbi időpont módosult a rendszerben:';
  return {
    uzenetId, targy: `${cim}: ${szolg}`, kuldo,
    html: `<html><body><div>${helyszin}</div><div>${cim}</div><div>${mondat}</div><div>Neve: ${nev}</div><div>Szolgáltatás: ${szolg}</div><div>Dátum: ${datum}</div><div>Helyszín: ${helyszin}</div><div>Munkatárs: ${munka}</div><div><a href="https://www.salonic.hu">Salonic</a></div></body></html>`,
  };
}
export const szam = (db, sql, ...p) => db.sqlite.prepare(sql).get(...p);
