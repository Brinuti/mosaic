// POST /api/gy-suti-stat: nevtelen sutisav-statisztika - naponta osszesitett darabszamok (megjelenes / elfogadas / elutasitas / reszleges / beallitasok), nezet es eszkoz szerint.
// Suti, IP, URL, azonosito NINCS tarolva: csak a szamlalo no. (Az adatkezelest Feri kulon ellenorzi; docs/SUTISAV.md.) A kliens a suti.js-bol sendBeacon-nel kuldi.
const ESEMENYEK = ['megjelent', 'elfogad', 'elutasit', 'reszleges', 'beall'];
const NEZETEK = ['nagy', 'fo', 'beall'];
const VERZIO = /^v[0-9]{1,2}$/;

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  let b = {};
  try { b = JSON.parse((await request.text()).slice(0, 300)) || {}; } catch (e) { return new Response(null, { status: 400 }); }
  if (!ESEMENYEK.includes(b.e)) return new Response(null, { status: 400 });
  const nezet = NEZETEK.includes(b.n) ? b.n : 'egyeb';
  const eszkoz = b.m === 1 ? 'mobil' : 'asztali';
  const verzio = VERZIO.test(String(b.v || '')) ? b.v : 'v0';
  const host = new URL(request.url).hostname;
  const kornyezet = host === 'www.gyogytornaszom.hu' ? 'eles' : 'elonezet';
  const nap = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
  try {
    const db = env.GY_DB;
    await db.prepare(`CREATE TABLE IF NOT EXISTS gy_suti_stat (nap TEXT, kornyezet TEXT, verzio TEXT, nezet TEXT, eszkoz TEXT, esemeny TEXT, db INTEGER DEFAULT 0, PRIMARY KEY (nap, kornyezet, verzio, nezet, eszkoz, esemeny))`).run();
    if (Math.random() < 0.02) await db.prepare("DELETE FROM gy_suti_stat WHERE nap < date('now', '-13 months')").run(); // megorzes: 13 honap
    await db.prepare(`INSERT INTO gy_suti_stat (nap, kornyezet, verzio, nezet, eszkoz, esemeny, db) VALUES (?,?,?,?,?,?,1)
      ON CONFLICT(nap, kornyezet, verzio, nezet, eszkoz, esemeny) DO UPDATE SET db = db + 1`).bind(nap, kornyezet, verzio, nezet, eszkoz, b.e).run();
  } catch (e) {
    console.error('gy-suti-stat:', String((e && e.message) || e).slice(0, 120));
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
