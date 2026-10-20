// POST /api/mp-motor-stat: nevtelen foglalomotor-lepes statisztika (Feri, 2026-10-19: "hol esik ki a latogato, van-e technikai hiba").
// Napi darabszam: esemeny (nyit / lepes / bezar / hiba / nincs_idopont) + lepes + eszkoz (mobil / asztali). Suti, IP, URL, azonosito NINCS.
// A kliens: assets/js/motor/motor.js (motorStat, sendBeacon). Riport: SELECT ... FROM mp_motor_stat (D1 mp-meres).
const ESEMENYEK = ['nyit', 'lepes', 'bezar', 'hiba', 'nincs_idopont'];
const LEPESEK = ['tipus', 'urlap', 'hely', 'szolg', 'ido', 'adatlap', 'szolgaltatasok', 'idopontok', 'helyszinek', 'betoltes'];

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  let b = {};
  try { b = JSON.parse((await request.text()).slice(0, 200)) || {}; } catch (e) { return new Response(null, { status: 400 }); }
  const esemeny = ESEMENYEK.includes(b.e) ? b.e : null;
  if (!esemeny) return new Response(null, { status: 400 });
  const lepes = LEPESEK.includes(b.l) ? b.l : (b.l ? 'egyeb' : '');
  const eszkoz = b.m === 1 ? 'mobil' : 'asztali';
  const kornyezet = new URL(request.url).hostname === 'www.medicalpiercing.hu' ? 'eles' : 'elonezet';
  const nap = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  try {
    const db = env.MP_MERES_DB;
    await db.prepare(`CREATE TABLE IF NOT EXISTS mp_motor_stat (nap TEXT, kornyezet TEXT, esemeny TEXT, lepes TEXT, eszkoz TEXT, db INTEGER DEFAULT 0, PRIMARY KEY (nap, kornyezet, esemeny, lepes, eszkoz))`).run();
    await db.prepare(`INSERT INTO mp_motor_stat (nap, kornyezet, esemeny, lepes, eszkoz, db) VALUES (?,?,?,?,?,1)
      ON CONFLICT(nap, kornyezet, esemeny, lepes, eszkoz) DO UPDATE SET db = db + 1`).bind(nap, kornyezet, esemeny, lepes, eszkoz).run();
  } catch (e) {
    console.error('mp-motor-stat:', String(e && e.message || e).slice(0, 200));
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
