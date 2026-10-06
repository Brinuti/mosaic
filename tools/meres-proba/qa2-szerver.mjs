// QA-2 SZERVERES LEPES egy tesztesethez: a Salonic visszaigazolo level adataibol (a levelet a QA-futtato olvassa a postafiokbol) a /api/foglalas-egyeztetes hivasa - EZT hivna az eles
// folyamat is (Salonic-level -> parositas -> esemenyek kuldese). A valasz tartalmazza a kuldes osszefoglalojat; utana a szerveres NAPLO (/api/meres-admin) a platformvalaszokkal.
//
//   EGYEZTETES_KULCS=... node tools/meres-proba/qa2-szerver.mjs --bazis <elonezet> --bongeszo <qa2-*-bongeszo-*.json> --level-ido <ISO> [--ar <Ft>] [--email deakfi@grantis.hu] [--telefon "+36 70 942 0090"]
//        [--uj-vendeg igen|nem|nincs] [--out szerver.json] [--fuggo 1]
//   --fuggo 1: a "nincs_hitelesites" kerelmek listaja (a kulso szallitonak: pl. a Composio-s Meta-tesztkuldes), kuldes nelkul.
// A "uj vendeg" jelzest a Salonic maga adja (a valodi folyamatban a Salonic-level / -jelzes); itt a teszt SZIMULALJA (a TESZT-vendeg a Salonicban mar nem uj), a naplo ezt jelzi.
import fs from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BAZIS = arg('bazis', ''); const KULCS = process.env.EGYEZTETES_KULCS || '';
if (!/^https:\/\/[a-z0-9-]+\.mosaic-d77\.pages\.dev$/.test(BAZIS)) throw new Error('csak PR-elonezeten fut');
if (!KULCS) throw new Error('EGYEZTETES_KULCS kell (kornyezeti valtozo)');
const H = { 'x-egyeztetes-kulcs': KULCS, 'content-type': 'application/json' };
const be = JSON.parse(fs.readFileSync(arg('bongeszo'), 'utf8'));
if (arg('fuggo', '0') === '1') { const r = await fetch(`${BAZIS}/api/meres-admin?fuggo=1`, { headers: H }); console.log(JSON.stringify(await r.json())); process.exit(0); }
// --naplo 1: csak a szerveres naplo ujraolvasasa (a kulso szallito visszaigazolasa UTAN), a --out fajlba "szerveres_naplo_vegso" kulcs ala; --kulso <json-fajl>: a kulso szallito nyers valasza (pl. Composio)
if (arg('naplo', '0') === '1') {
  const sid0 = be.booking_id || be.pi; const n = await (await fetch(`${BAZIS}/api/meres-admin?source_id=${encodeURIComponent(sid0)}`, { headers: H })).json();
  if (arg('out')) { const k = fs.existsSync(arg('out')) ? JSON.parse(fs.readFileSync(arg('out'), 'utf8')) : {}; k.szerveres_naplo_vegso = n; if (arg('kulso')) k.kulso_szallito_nyers_valasz = JSON.parse(fs.readFileSync(arg('kulso'), 'utf8')); fs.writeFileSync(arg('out'), JSON.stringify(k, null, 1)); }
  for (const k of n.kuldesek) console.log(`  ${k.esemeny_nev.padEnd(26)} ${k.platform.padEnd(7)} ${k.allapot.padEnd(18)} http=${k.http_status ?? '-'} ${k.kuldo || ''} ${k.platform_valasz ? '| ' + k.platform_valasz.slice(0, 90) : ''}`);
  process.exit(0);
}
const q = be.koszono_query || {}; const start = be.bookingUrl_elemzes && be.bookingUrl_elemzes.startUnix;
const ujVendeg = { igen: true, nem: false }[arg('uj-vendeg', 'igen')] ?? undefined;
// ar: alapbol a Salonic-atiranyitas price parametere (= a levelbeli tenyleges ar)
const kerelem = {
  uuid: be.salonic_uuid, host: be.salonic_host, felado: arg('felado', undefined), szolgaltatas: q.service, munkatarsak: [], ld: start ? { startDate: new Date(start * 1000).toISOString() } : null,
  level_datuma: arg('level-ido'), ar: arg('ar') ? Number(arg('ar')) : (/^\d+$/.test(String(q.price || '')) ? Number(q.price) : undefined), vendeg: { email: arg('email', 'deakfi@grantis.hu'), telefon: arg('telefon', '+36 70 942 0090') }, uj_vendeg: ujVendeg,
};
const t0 = new Date().toISOString();
const r = await fetch(`${BAZIS}/api/foglalas-egyeztetes`, { method: 'POST', headers: H, body: JSON.stringify(kerelem) });
const valasz = await r.json();
console.log('egyeztetes:', valasz.allapot, 'kuldheto:', valasz.kuldheto, 'booking_id:', valasz.booking_id, 'esemeny_kuldes:', valasz.esemeny_kuldes && valasz.esemeny_kuldes.allapot, valasz.esemeny_kuldes && valasz.esemeny_kuldes.elo_allapot);
const sid = valasz.booking_id || be.booking_id;
const naplo = sid ? await (await fetch(`${BAZIS}/api/meres-admin?source_id=${encodeURIComponent(sid)}`, { headers: H })).json() : null;
const kimenet = { eset: be.eset, hivas_ideje: t0, kerelem_maszkolt: { ...kerelem, vendeg: '<maszkolva: e-mail + telefon>' }, szimulalt: { uj_vendeg: ujVendeg === undefined ? 'nincs jelzes' : ujVendeg, megjegyzes: 'a Salonic "uj vendeg" jelzeset a teszt szimulalja; az ar a Salonic-level "Price / Fizetendo varhatoan" sorabol' }, egyeztetes_valasz_nyers: valasz, szerveres_naplo_nyers: naplo };
if (naplo) for (const k of naplo.kuldesek) console.log(`  ${k.esemeny_nev.padEnd(26)} ${k.platform.padEnd(7)} ${k.allapot.padEnd(18)} ${k.platform_nev || ''} ${k.indok ? '| ' + k.indok.slice(0, 80) : ''}`);
if (arg('out')) fs.writeFileSync(arg('out'), JSON.stringify(kimenet, null, 1));
