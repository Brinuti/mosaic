// ELETUT E2E (DECISION-LOG #102): egy TESZT - Claude foglalas eletutja LEPESENKENT, a sajat elonezeten (nyelo mod: semmi nem megy ki arnyek-celpontra sem).
//   EGYEZTETES_KULCS=... node tools/meres-proba/eletut-eset.mjs --bazis https://<ag>.mosaic-d77.pages.dev --nev <fajlnev-resz> <lepes> [opciok]
// lepesek (a kimenet: docs/booking-engine/meres-naplo/eletut-<nev>-<nap>.json, minden lepes hozzafuzodik; a kulcs soha nem kerul bele):
//   letrehoz --eset headspa|fodrasz|oxigen|oxigen-elso|szor|pmu|pmu-kezeles [--profil teljes] : bongeszos foglalas (TESZT - Claude) + a level -> /api/foglalas-egyeztetes (parositas + alapesemenyek)
//   hiv --allapot lemondva|nem_jelent_meg|megjelent [--forras ..] [--cimke ..] [--ido ISO]    : POST /api/foglalas-eletut
//   ertesito --felado .. --szolgaltatas .. --munkatars .. --idopont-szoveg ..                   : a LEMONDASI level (nincs uuid) -> /api/foglalas-egyeztetes (a lemondasi horog indit eletutat)
//   lemond                                                                                       : a Salonic "Lemondom" link + a reszletek-oldal allapota
//   naplo [--cimke ..]                                                                           : GET /api/foglalas-eletut?source_id + /api/meres-admin?source_id (az eletut + a kuldesi sorok)
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const LEPES = process.argv.slice(2).find((a, i, t) => !a.startsWith('--') && !(t[i - 1] || '').startsWith('--'));
const BAZIS = arg('bazis', ''), NEV = arg('nev', ''), NAP = arg('nap', new Date().toISOString().slice(0, 10)), DIR = arg('dir', 'docs/booking-engine/meres-naplo'), KULCS = process.env.EGYEZTETES_KULCS || '';
if (!/^https:\/\/[a-z0-9-]+\.mosaic-d77\.pages\.dev$/.test(BAZIS)) throw new Error('csak PR-elonezeten fut');
if (!NEV || !KULCS) throw new Error('--nev es EGYEZTETES_KULCS kell');
const H = { 'x-egyeztetes-kulcs': KULCS, 'content-type': 'application/json' };
const bongeszo = `${DIR}/eletut-${NEV}-bongeszo-${NAP}.json`, szerver = `${DIR}/eletut-${NEV}-szerver-${NAP}.json`, ki = `${DIR}/eletut-${NEV}-${NAP}.json`;
const fut = (cmd, args, ido = 280000) => spawnSync('node', [cmd, ...args], { encoding: 'utf8', timeout: ido, env: process.env });
const chromeUt = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'; if (!process.env.CHROME_UTVONAL && fs.existsSync(chromeUt)) process.env.CHROME_UTVONAL = chromeUt;
const olvas = () => (fs.existsSync(ki) ? JSON.parse(fs.readFileSync(ki, 'utf8')) : { nev: NEV, bazis: BAZIS, megjegyzes: 'TESZT - Claude foglalas; nyelo mod: a kerelmek elkeszulnek es naplozodnak, de semerre nem mennek ki', lepesek: [] });
const ir = (lepes) => { const o = olvas(); o.lepesek.push({ ido: new Date().toISOString(), ...lepes }); fs.writeFileSync(ki, JSON.stringify(o, null, 1)); console.log(JSON.stringify(lepes).slice(0, 700)); };
const B = () => JSON.parse(fs.readFileSync(bongeszo, 'utf8'));
const sid = () => { const s = fs.existsSync(szerver) ? JSON.parse(fs.readFileSync(szerver, 'utf8')) : {}; return (s.szerveres_naplo_nyers && s.szerveres_naplo_nyers.source_id) || (s.egyeztetes_valasz_nyers && s.egyeztetes_valasz_nyers.booking_id) || B().booking_id; };
const post = async (ut, torzs) => { const r = await fetch(BAZIS + ut, { method: 'POST', headers: H, body: JSON.stringify(torzs) }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* nyers */ } return { http: r.status, json: j, nyers: j ? undefined : t.slice(0, 300) }; };
const get = async (ut) => { const r = await fetch(BAZIS + ut, { headers: H }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* nyers */ } return { http: r.status, json: j }; };

if (LEPES === 'letrehoz') {
  const eset = arg('eset'), profil = arg('profil', 'teljes');
  const r1 = fut('tools/meres-proba/qa2-eset.mjs', ['--bazis', BAZIS, '--eset', eset, '--profil', profil, '--out', bongeszo]);
  if (!fs.existsSync(bongeszo)) { console.log(r1.stdout.slice(-800), r1.stderr.slice(-400)); process.exit(1); }
  const b = B(); if (b.hiba || !b.lemondo_url) { console.log('HIBA:', b.hiba || 'nincs lemondo URL'); if (b.lemondo_url) fut('tools/meres-proba/lemond.mjs', [b.lemondo_url], 90000); process.exit(1); }
  const felado = { mosaicheadspa: 'Mosaic Headspa', 'mosaic-hair': 'Mosaic Hair', 'mosaic-oxigen': 'Mosaic Oxigén', 'mosaic-elysion': 'Mosaic Elysion', 'mosaic-pmu': 'Mosaic PMU' }[String(b.salonic_host).split('.')[0]];
  const levelIdo = new Date(Date.now() - 60000).toISOString().replace(/\.\d+Z$/, 'Z');
  const r2 = fut('tools/meres-proba/qa2-szerver.mjs', ['--bazis', BAZIS, '--bongeszo', bongeszo, '--level-ido', levelIdo, '--felado', felado, '--out', szerver], 120000);
  console.log(r2.stdout.trim().slice(0, 1500)); if (r2.status) console.log(r2.stderr.slice(-400));
  const s = fs.existsSync(szerver) ? JSON.parse(fs.readFileSync(szerver, 'utf8')) : {};
  const e = s.egyeztetes_valasz_nyers || {};
  ir({ lepes: 'foglalas letrehozva (Salonic, TESZT - Claude) + level -> /api/foglalas-egyeztetes', eset, salonic_uuid: b.salonic_uuid, salonic_host: b.salonic_host, booking_id: sid(), kezdes_unix: b.bookingUrl_elemzes && b.bookingUrl_elemzes.startUnix,
    egyeztetes: { allapot: e.allapot, kuldheto: e.kuldheto, esemeny_kuldes: e.esemeny_kuldes && { allapot: e.esemeny_kuldes.allapot, elo_allapot: e.esemeny_kuldes.elo_allapot, jelleg: e.esemeny_kuldes.jelleg } },
    lemondo_url_van: Boolean(b.lemondo_url) });
} else if (LEPES === 'hiv') {
  const b = B(); const o = { uuid: b.salonic_uuid, allapot: arg('allapot'), forras: arg('forras', 'eletut-e2e') }; if (arg('ido')) o.ido = arg('ido');
  const r = await post('/api/foglalas-eletut', o);
  ir({ lepes: `POST /api/foglalas-eletut ${o.allapot}${arg('cimke') ? ' (' + arg('cimke') + ')' : ''}`, kerelem: o, http: r.http, valasz: r.json || r.nyers });
} else if (LEPES === 'ertesito') {
  const mezok = { tipus: 'lemondas', felado: arg('felado'), szolgaltatas: arg('szolgaltatas'), munkatarsak: (arg('munkatars', '') || '').split('|').filter(Boolean), idopont_szoveg: arg('idopont-szoveg'), level_datuma: new Date().toISOString() };
  const r = await post('/api/foglalas-egyeztetes', mezok);
  ir({ lepes: 'lemondasi ertesito (nincs uuid) -> /api/foglalas-egyeztetes', kerelem: mezok, http: r.http, valasz: r.json || r.nyers });
} else if (LEPES === 'lemond') {
  const b = B(); const t = new Date().toISOString();
  const r3 = fut('tools/meres-proba/lemond.mjs', [b.lemondo_url], 90000); const sor = (r3.stdout.trim().split('\n').pop() || '').slice(0, 120);
  const r4 = fut('tools/meres-proba/foglalas-allapot.mjs', [b.lemondo_url.replace('/cancelBooking/', '/bookingDetails/')], 90000);
  ir({ lepes: 'lemondas (Salonic lemondo link)', lemondas_ideje: t, eredmeny: sor, salonic_allapot: (r4.stdout.match(/-> (\S+)/) || [])[1] || '?' });
} else if (LEPES === 'naplo') {
  const s = sid(); const e = await get(`/api/foglalas-eletut?source_id=${encodeURIComponent(s)}`); const m = await get(`/api/meres-admin?source_id=${encodeURIComponent(s)}`);
  const sorok = ((m.json && m.json.kuldesek) || []).map((k) => ({ esemeny_id: k.esemeny_id, esemeny_nev: k.esemeny_nev, esemeny_tipus: k.esemeny_tipus, platform: k.platform, platform_nev: k.platform_nev, allapot: k.allapot, http_status: k.http_status, kuldo: k.kuldo, ertek: k.ertek, indok: k.indok, kerelem: k.kerelem }));
  ir({ lepes: `naplo${arg('cimke') ? ' (' + arg('cimke') + ')' : ''}`, booking_id: s, eletut: e.json, kuldesi_sorok: sorok });
  for (const k of sorok) console.log(`  ${String(k.esemeny_tipus || '').padEnd(10)} ${String(k.esemeny_nev).padEnd(24)} ${k.platform.padEnd(7)} ${String(k.allapot).padEnd(16)} ${k.kuldo || ''} ${k.esemeny_id}`.slice(0, 200));
} else throw new Error('ismeretlen lepes: letrehoz | hiv | ertesito | lemond | naplo');
