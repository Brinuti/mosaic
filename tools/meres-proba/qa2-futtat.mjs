// QA-2: egy teljes teszteset egyben - bongeszos proba (qa2-eset.mjs) -> szerveres lepes (qa2-szerver.mjs: parositas + esemenyek a SAJAT szallitoval) -> a foglalas azonnali lemondasa (lemond.mjs).
//   EGYEZTETES_KULCS=... node tools/meres-proba/qa2-futtat.mjs --bazis https://<ag>.mosaic-d77.pages.dev --eset headspa|fodrasz|oxigen|oxigen-elso|szor|pmu|pmu-kezeles --profil teljes|nincs|ana|dontes_nelkul --nev <fajlnev-resz> [--dir docs/booking-engine/meres-naplo]
// A szerveres lepes idejen a foglalas AKTIV (a kuldes elotti elo ellenorzes ezt varja); a lemondas utana jon. Csak elonezeten.
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
const r3 = fut('tools/meres-proba/lemond.mjs', [b.lemondo_url], 90000);
console.log(`[${NEV}] ${(r3.stdout.trim().split('\n').pop() || '').slice(0, 80)}`);
