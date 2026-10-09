// Kis segedek a CRM modulokhoz: D1-felulet (prepare/bind/run/all/first/batch), azonositok, hash, ido (budapesti naptar), normalizalas.
// Platformfuggetlen: csak a Web Crypto-t (crypto.subtle, crypto.randomUUID) hasznalja.
// TRANZAKCIO: D1-en nincs BEGIN/COMMIT; a db.batch([...]) atomikus. Ezert az iras mindig batch: felteteles utasitasok (WHERE EXISTS / valtozas-ellenorzes)
// es UNIQUE kulcsok vedik a versenyhelyzetet; ha egy utasitas megsertia a korlatot, az egesz batch visszagordul.
import { helyi, helyiEpoch } from '../../netlify/lib/lifecycle/ido.js';
import { normalizal as telefonNormalizal } from '../../netlify/lib/lifecycle/telefon.js';

export class CrmHiba extends Error {
  /** kod: gepi azonosito (pl. 'TILTOTT'), status: javasolt HTTP-kod, reszlet: tetszoleges extra adat */
  constructor(kod, uzenet, status = 400, reszlet = null) { super(uzenet || kod); this.name = 'CrmHiba'; this.kod = kod; this.status = status; this.reszlet = reszlet; }
}

export const most = () => Math.floor(Date.now() / 1000);
export const uuid = () => crypto.randomUUID();

// ---- D1 segedek ---------------------------------------------------------------------------------------------------------------------------
export const elso = (db, sql, ...p) => db.prepare(sql).bind(...p).first();
export const mind = async (db, sql, ...p) => (await db.prepare(sql).bind(...p).all()).results || [];
export const futtat = (db, sql, ...p) => db.prepare(sql).bind(...p).run();
export const keszit = (db, sql, ...p) => db.prepare(sql).bind(...p);
/** atomikus iras: az utasitasok egy batch-ben futnak (D1: tranzakcio). Visszaadja az eredmenyek listajat. */
export const tranzakcio = (db, utasitasok) => db.batch(utasitasok);
/**
 * Felteteles beszuras: INSERT [OR IGNORE] INTO tabla (oszlopok) SELECT ?1.. WHERE EXISTS (ha.sql). A ha.sql-ben nevtelen '?' jeleket kell
 * hasznalni (az SQLite az utolso szamozott parameter utan szamozza), a ha.params ezeket tolti ki. Igy egy batch utasitasa csak akkor ir,
 * ha az elozo utasitasok eredmenye megvan (pl. a kezeles-sor beszurodott).
 */
export function beszurHa(db, { tabla, adat, ha = null, ignore = false }) {
  const oszlopok = Object.keys(adat), ertekek = Object.values(adat).map((v) => (v === undefined ? null : v));
  const jelek = oszlopok.map((_, i) => `?${i + 1}`).join(', ');
  const sql = `INSERT ${ignore ? 'OR IGNORE ' : ''}INTO ${tabla} (${oszlopok.join(', ')}) SELECT ${jelek}${ha ? ` WHERE EXISTS (${ha.sql})` : ''}`;
  return db.prepare(sql).bind(...ertekek, ...(ha ? ha.params : []));
}
export const valtozas = (r) => Number(r?.meta?.changes ?? 0);
/** UNIQUE / trigger / CHECK hiba felismerese */
export const korlatHiba = (e) => /UNIQUE|constraint|CONSTRAINT|_immutable|_terminal|credit_not_eligible|append_only/i.test(String(e?.message || e));

// ---- JSON mezok -------------------------------------------------------------------------------------------------------------------------
export const jsonIr = (o) => (o === undefined || o === null ? null : JSON.stringify(o));
export function jsonOlvas(s, alap = null) { if (s === null || s === undefined || s === '') return alap; try { return JSON.parse(s); } catch { return alap; } }

// ---- hash, token --------------------------------------------------------------------------------------------------------------------------
export async function sha256(szoveg) {
  const b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(szoveg))));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
/** kriptografiailag veletlen, URL-biztos token (base64url); csak a SHA-256 hash-et szabad tarolni */
export function ujToken(bajt = 32) {
  const b = new Uint8Array(bajt);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** IP -> hash (az auditban nem tarolunk nyers IP-t) */
export const ipHash = (ip, so = 'crm') => (ip ? sha256(`${so}|${ip}`) : Promise.resolve(null));

// ---- normalizalas -------------------------------------------------------------------------------------------------------------------------
export function normEmail(e) {
  const s = String(e ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}
export const normTelefon = (t) => telefonNormalizal(t);

// ---- ido (Europe/Budapest naptar; minden epoch masodperc) --------------------------------------------------------------------------------
export { helyi, helyiEpoch };
/** 'YYYY-MM-DD' budapesti nap */
export function helyiNap(epoch) { const l = helyi(epoch); return `${l.y}-${String(l.m).padStart(2, '0')}-${String(l.d).padStart(2, '0')}`; }
/** n naptari nappal kesobb ugyanaz a helyi oraperc */
export function naptariNapHozzaad(epoch, n) {
  const l = helyi(epoch);
  const d = new Date(Date.UTC(l.y, l.m - 1, l.d + n));
  return helyiEpoch(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), l.h, l.mi) + (epoch % 60);
}
/** a (kezdet + n naptari nap) budapesti nap utolso masodperce */
export function naptariNapVege(epoch, n) {
  const l = helyi(epoch);
  const d = new Date(Date.UTC(l.y, l.m - 1, l.d + n + 1));
  return helyiEpoch(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 0, 0) - 1;
}
/** n naptari honappal kesobb (a nap a honap vegere igazodik, ha nincs olyan nap), ugyanaz a helyi oraperc */
export function honapHozzaad(epoch, n) {
  const l = helyi(epoch);
  const celHonap = l.m - 1 + n;
  const ev = l.y + Math.floor(celHonap / 12);
  const ho = ((celHonap % 12) + 12) % 12;
  const napokHo = new Date(Date.UTC(ev, ho + 1, 0)).getUTCDate();
  return helyiEpoch(ev, ho + 1, Math.min(l.d, napokHo), l.h, l.mi) + (epoch % 60);
}
