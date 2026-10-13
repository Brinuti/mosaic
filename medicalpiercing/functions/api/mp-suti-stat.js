// POST /api/mp-suti-stat: nevtelen sutisav-statisztika (Feri, 2026-10-13): naponta osszesitett darabszamok
// (megjelenes / elfogadas / elutasitas / reszleges / beallitasok), nezet (nagy / fo) es eszkoz (mobil / asztali) szerint.
// Suti, IP, URL, azonosito NINCS: csak a szamlalo no. A kliens a suti.js-bol sendBeacon-nel kuldi.
const ESEMENYEK = ['megjelent', 'elfogad', 'elutasit', 'reszleges', 'beall'];
const NEZETEK = ['nagy', 'fo', 'beall'];
const VERZIO = /^v[0-9]{1,2}$/;

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  let b = {};
  try { b = JSON.parse((await request.text()).slice(0, 300)) || {}; } catch (e) { return new Response(null, { status: 400 }); }
  const esemeny = ESEMENYEK.includes(b.e) ? b.e : null;
  if (!esemeny) return new Response(null, { status: 400 });
  const nezet = NEZETEK.includes(b.n) ? b.n : 'egyeb';
  const eszkoz = b.m === 1 ? 'mobil' : 'asztali';
  const verzio = VERZIO.test(String(b.v || '')) ? b.v : 'v0';
  const host = new URL(request.url).hostname;
  const kornyezet = host === 'www.medicalpiercing.hu' ? 'eles' : 'elonezet';
  const nap = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10); // kb. helyi nap (CEST)
  try {
    const db = env.MP_MERES_DB;
    await db.prepare(`CREATE TABLE IF NOT EXISTS mp_suti_stat (nap TEXT, kornyezet TEXT, verzio TEXT, nezet TEXT, eszkoz TEXT, esemeny TEXT, db INTEGER DEFAULT 0, PRIMARY KEY (nap, kornyezet, verzio, nezet, eszkoz, esemeny))`).run();
    await db.prepare(`INSERT INTO mp_suti_stat (nap, kornyezet, verzio, nezet, eszkoz, esemeny, db) VALUES (?,?,?,?,?,?,1)
      ON CONFLICT(nap, kornyezet, verzio, nezet, eszkoz, esemeny) DO UPDATE SET db = db + 1`).bind(nap, kornyezet, verzio, nezet, eszkoz, esemeny).run();
  } catch (e) {
    console.error('mp-suti-stat:', String(e && e.message || e).slice(0, 200));
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
