// QA-2: egy teljes teszteset egyben - bongeszos proba (qa2-eset.mjs) -> szerveres lepes (qa2-szerver.mjs: parositas + esemenyek a SAJAT szallitoval) -> a foglalas azonnali lemondasa (lemond.mjs).
//   EGYEZTETES_KULCS=... node tools/meres-proba/qa2-futtat.mjs --bazis https://<ag>.mosaic-d77.pages.dev --eset headspa|fodrasz|oxigen|oxigen-elso|szor|pmu|pmu-kezeles --profil teljes|nincs|ana|dontes_nelkul --nev <fajlnev-resz> [--dir docs/booking-engine/meres-naplo]
// A szerveres lepes idejen a foglalas AKTIV (a kuldes elotti elo ellenorzes ezt varja); a lemondas utana jon. Csak elonezeten.
// ELETUT-naplo (qa2-<nev>-eletut-<nap>.json): letrehozva -> esemenyek elkuldve (elo allapot: aktiv) -> lemondas (ido + visszaigazolas) -> a Salonic-oldal allapota (LEMONDVA) -> a level ISMETLESE lemondas utan (nincs uj kuldes: mar_kuldve).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BAZIS = arg('bazis'), ESET = arg('eset'), PROFIL = arg('profil', 'teljes'), NEV = arg('nev', ESET), DIR = arg('dir', 'docs/booking-engine/meres-naplo'), NAP = arg('nap', '2026-10-06');
const bongeszo = `${DIR}/qa2-${NEV}-bongeszo-${NAP}.json`, szerver = `${DIR}/qa2-${NEV}-szerver-${NAP}.json`;
const fut = (cmd, args, ido = 280000) => spawnSync('node', [cmd, ...args], { encoding: 'utf8', timeout: ido, env: process.env });
const r1 = fut('tools/meres-proba/qa2-eset.mjs', ['--bazis', BAZIS, '--eset', ESET, '--profil', PROFIL, '--out', bongeszo]);
console.log(`[${NEV}] bongeszos proba kesz`, (r1.stdout.match(/LEMONDO URL: (\S+)/) || [])[1] || '(nincs lemondo URL)');
if (!fs.existsSync(bongeszo)) { console.log(r1.stdout.slice(-800), r1.stderr.slice(-400)); process.exit(1); }
const b = JSON.parse(fs.readFileSync(bongeszo, 'utf8'));
if (b.hiba || !b.lemondo_url) { console.log(`[${NEV}] HIBA:`, b.hiba || 'nincs lemondo URL'); if (b.lemondo_url) fut('tools/meres-proba/lemond.mjs', [b.lemondo_url], 90000); process.exit(1); }
const felado = { mosaicheadspa: 'Mosaic Headspa', 'mosaic-hair': 'Mosaic Hair', 'mosaic-oxigen': 'Mosaic Oxigén', 'mosaic-elysion': 'Mosaic Elysion', 'mosaic-pmu': 'Mosaic PMU' }[String(b.salonic_host).split('.')[0]];
const levelIdo = new Date(Date.now() - 60000).toISOString().replace(/\.\d+Z$/, 'Z');
const r2 = fut('tools/meres-proba/qa2-szerver.mjs', ['--bazis', BAZIS, '--bongeszo', bongeszo, '--level-ido', levelIdo, '--felado', felado, '--out', szerver], 120000);
console.log(r2.stdout.trim()); if (r2.status) console.log(r2.stderr.slice(-400));
const tLemondas = new Date().toISOString();
const r3 = fut('tools/meres-proba/lemond.mjs', [b.lemondo_url], 90000);
const lemondasSor = (r3.stdout.trim().split('\n').pop() || '').slice(0, 120);
console.log(`[${NEV}] ${lemondasSor.slice(0, 80)}`);
// a Salonic-oldal allapota a lemondas utan + a level ISMETLESE (a foglalas mar lemondva: nem mehet ki uj esemeny, a cellak vegleges allapotuak)
const chromeUt = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'; if (!process.env.CHROME_UTVONAL && fs.existsSync(chromeUt)) process.env.CHROME_UTVONAL = chromeUt;
const r4 = fut('tools/meres-proba/foglalas-allapot.mjs', [b.lemondo_url.replace('/cancelBooking/', '/bookingDetails/')], 90000);
const salonicAllapot = (r4.stdout.match(/-> (\S+)/) || [])[1] || '?';
const ismetles = `${DIR}/qa2-${NEV}-ismetles-${NAP}.json`;
const r5 = fut('tools/meres-proba/qa2-szerver.mjs', ['--bazis', BAZIS, '--bongeszo', bongeszo, '--level-ido', levelIdo, '--felado', felado, '--out', ismetles], 120000);
const sz = JSON.parse(fs.readFileSync(szerver, 'utf8')), is = fs.existsSync(ismetles) ? JSON.parse(fs.readFileSync(ismetles, 'utf8')) : {};
const sorok = (sz.szerveres_naplo_nyers && sz.szerveres_naplo_nyers.kuldesek) || [], sorokUtana = (is.szerveres_naplo_nyers && is.szerveres_naplo_nyers.kuldesek) || [];
const eletut = {
  eset: NEV, booking_id: sz.szerveres_naplo_nyers && sz.szerveres_naplo_nyers.source_id, salonic_uuid: b.salonic_uuid, salonic_host: b.salonic_host,
  lepesek: [
    { lepes: 'foglalas letrehozva (Salonic, TESZT - Claude)', salonic_uuid: b.salonic_uuid },
    { lepes: 'level -> /api/foglalas-egyeztetes: parositas + elo allapot ellenorzes + esemenyek', hivas_ideje: sz.hivas_ideje, allapot: sz.egyeztetes_valasz_nyers && sz.egyeztetes_valasz_nyers.allapot, elo_allapot: sz.egyeztetes_valasz_nyers && sz.egyeztetes_valasz_nyers.esemeny_kuldes && sz.egyeztetes_valasz_nyers.esemeny_kuldes.elo_allapot, kikuldott_cellak: sorok.filter((k) => k.allapot === 'elkuldve').length },
    { lepes: 'lemondas (lemondo link)', ido: tLemondas, eredmeny: lemondasSor },
    { lepes: 'a Salonic reszletek-oldal a lemondas utan', allapot: salonicAllapot },
    { lepes: 'a level ISMETLESE a lemondas utan', hivas_ideje: is.hivas_ideje, allapot: is.egyeztetes_valasz_nyers && is.egyeztetes_valasz_nyers.allapot, duplikalt: is.egyeztetes_valasz_nyers && is.egyeztetes_valasz_nyers.duplikalt, kuldheto: is.egyeztetes_valasz_nyers && is.egyeztetes_valasz_nyers.kuldheto, esemeny_kuldes: is.egyeztetes_valasz_nyers && is.egyeztetes_valasz_nyers.esemeny_kuldes && is.egyeztetes_valasz_nyers.esemeny_kuldes.allapot, uj_esemeny: ((is.egyeztetes_valasz_nyers && is.egyeztetes_valasz_nyers.esemeny_kuldes && is.egyeztetes_valasz_nyers.esemeny_kuldes.esemenyek) || []).length, sorok_szama_elotte_utana: [sorok.length, sorokUtana.length] },
  ],
};
fs.writeFileSync(`${DIR}/qa2-${NEV}-eletut-${NAP}.json`, JSON.stringify(eletut, null, 1));
console.log(`[${NEV}] eletut: salonic=${salonicAllapot}, ismetles=${eletut.lepesek[4].esemeny_kuldes}, uj_esemeny=${eletut.lepesek[4].uj_esemeny}`);
