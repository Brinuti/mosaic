// A mérés-leképezés export (tools/meres-lekepezes-export.mjs) tesztje: a tábla a KÓDBÓL jön, és követi a kódot (mutációs ellenpróbák másolaton).
//   node --test tools/test-meres-lekepezes.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { epit, markdown, megallapitasok, HORGONYOK } from './meres-lekepezes-export.mjs';
import { esemenyek, foglalasJelleg, konzultacioTabla, UZLETAGAK } from '../netlify/lib/meres/esemeny-modell.js';
import { ARNYEK, ELO_CELOK } from '../netlify/lib/meres/platformok.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const t = await epit();

test('minden forrás-horgony megvan, a hely a megadott kódrészletre mutat', () => {
  for (const [kulcs, [rel, horgony]] of Object.entries(HORGONYOK)) {
    const hely = t.helyek[kulcs];
    const m = /^(.+):(\d+)$/.exec(hely);
    assert.ok(m, kulcs + ': fájl:sor alak');
    assert.equal(m[1], rel);
    const sor = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n')[Number(m[2]) - 1];
    assert.ok(sor.includes(horgony), `${kulcs}: a ${hely} sor tartalmazza a horgonyt`);
  }
});

test('MINDEN üzletág × alapesemény szerepel (vagy kifejezetten „nincs esemény”), és egyezik az esemenyek() közvetlen hívásával', () => {
  const tabla = konzultacioTabla({});
  const SZ = { uj_elso: { nev: 'Mintakezelés', uj: true }, uj_konzultacio: { nev: 'Ingyenes konzultáció', uj: true }, visszajaro: { nev: 'Mintakezelés', uj: false }, ismeretlen_vendeg: { nev: 'Mintakezelés', uj: null }, kupon_uj_elso: { nev: 'KUPONKODDAL - Mintakezelés (kupon)', uj: true }, kupon_visszajaro: { nev: 'KUPONKODDAL - Mintakezelés (kupon)', uj: false } };
  assert.equal(t.sorok.length > 0, true);
  for (const uzletag of UZLETAGAK) for (const ag of ['motor', 'salonic_direct']) for (const [kulcs, sz] of Object.entries(SZ)) {
    const j = foglalasJelleg({ szolgaltatasNev: sz.nev, ujVendeg: sz.uj, kategoria: '' });
    const fk = { tipus: 'foglalas', uzletag, source_entity_id: ag === 'motor' ? 'mb_abcdef123456' : 'sd_' + 'a1'.repeat(12), jelleg: j.jelleg, kupon: j.kupon, ertek: 12345, ido: 1793000000 };
    const vart = esemenyek(fk, tabla).map((e) => `${e.nev}/${e.tipus}`).sort();
    const sorok = t.sorok.filter((s) => s.uzletag === uzletag && s.forras_ag === ag && s.szcenario === kulcs);
    const van = sorok.filter((s) => s.esemeny).map((s) => `${s.esemeny}/${s.esemeny_tipus}`).sort();
    assert.deepEqual(van, vart, `${uzletag}/${ag}/${kulcs}`);
    if (!vart.length) assert.equal(sorok.length, 1, `${uzletag}/${ag}/${kulcs}: egy explicit „nincs esemény” sor`), assert.equal(sorok[0].esemeny, null);
  }
  // a három alapesemény minden üzletágnál megjelenik (a HeadSpa Konzultacio-ja kivételével, ott explicit „nincs esemény”)
  for (const uzletag of UZLETAGAK) for (const nev of ['FoglalasElso', 'Konzultacio', 'Visszajaro']) {
    const sorok = t.sorok.filter((s) => s.uzletag === uzletag && s.forras_ag === 'motor' && s.esemeny === nev && !s.kupon);
    if (uzletag === 'headspa' && nev === 'Konzultacio') assert.equal(sorok.length, 0, 'HeadSpa: nincs konzultáció-ág (#101)');
    else assert.ok(sorok.length >= 1, `${uzletag} / ${nev}`);
  }
});

test('Google ARNYEK-akció tábla: pontosan a platformok.js akciói, élő azonosító nincs; a Google-ba küldött kérések ezekre mennek', () => {
  const vart = Object.entries(ARNYEK.google.akciok).flatMap(([u, a]) => Object.entries(a).map(([e, id]) => `${u}/${e}/${id}`)).sort();
  assert.equal(t.google_arnyek_akciok.length, 10);
  assert.deepEqual(t.google_arnyek_akciok.map((a) => `${a.uzletag}/${a.esemeny}/${a.akcio_id}`).sort(), vart);
  for (const a of t.google_arnyek_akciok) { assert.equal(a.elo_azonosito_e, false); assert.ok(!ELO_CELOK.google_primary.includes(a.akcio_id)); assert.equal(a.ugyfel, '6088874770'); }
  const kuldve = t.sorok.filter((s) => s.platformok && s.platformok.google && s.platformok.google.allapot === 'kuldve');
  assert.ok(kuldve.length > 0);
  for (const s of kuldve) { assert.equal(s.forras_ag, 'motor'); assert.equal(s.platformok.google.akcio, ARNYEK.google.akciok[s.uzletag][s.esemeny]); assert.equal(s.platformok.google.click_tipus, 'gclid'); assert.equal(s.esemeny_tipus, 'alap'); assert.notEqual(s.esemeny, 'Visszajaro'); }
  // a próbához a 4 üzletág (FOD / SZŐR / OXI / PMU) × Elso + Konz = 8 akció külön azonosítható
  const nyolc = t.google_arnyek_akciok.filter((a) => a.uzletag !== 'headspa' && ['FoglalasElso', 'Konzultacio'].includes(a.esemeny));
  assert.equal(nyolc.length, 8);
  for (const a of nyolc) assert.ok(a.belepo_pelda.length >= 1, `${a.uzletag}/${a.esemeny}: van belépő-példa a Salonic-pillanatképből`);
});

test('szintetikus Google-feltöltési törzsek: mind a 10 akcióhoz, a relay-Zap mezőivel; gclid csak mintaérték; a táblázat sorával azonos', () => {
  const ZAP_MEZOK = ['conversion_action_id', 'conversion_date_time', 'value', 'currency', 'order_id', 'ad_user_data', 'gclid'].sort();
  for (const a of t.google_arnyek_akciok) {
    const f = a.szintetikus_feltoltes;
    assert.ok(f && f.body, `${a.akcio_id}: van szintetikus törzs`);
    assert.deepEqual(Object.keys(f.body).sort(), ZAP_MEZOK, `${a.akcio_id}: pontosan a relay-Zap mezői`);
    assert.equal(f.body.conversion_action_id, a.akcio_id);
    assert.equal(f.body.currency, 'HUF');
    assert.equal(f.body.ad_user_data, 'GRANTED');
    assert.match(f.body.gclid, /^TESZTGCLID/, 'csak mintaérték, valódi click ID nem');
    assert.match(f.body.order_id, /^[A-Za-z]+:/, 'order_id = esemény-azonosító');
    assert.deepEqual(f.dryrun_body, { ...f.body, dryrun: true });
    assert.equal(f.cel.customer_id, '6088874770');
  }
  // az érték a leképezés szerint: konzultáció = rögzített tábla, kezdő akció = a minta tényleges ár, ajándékkártya = a minta tényleges ár
  const ertek = (akcio) => t.google_arnyek_akciok.find((a) => a.akcio_id === akcio).szintetikus_feltoltes.body.value;
  assert.equal(ertek('7825200904'), 8900, 'oxigén konzultáció');
  assert.equal(ertek('7825200898'), 13000, 'fodrász konzultáció');
  assert.equal(ertek('7825200910'), 27000, 'szőrtelenítés konzultáció');
  assert.equal(ertek('7825200916'), 13800, 'PMU konzultáció');
  assert.equal(ertek('7825199992'), t.parameterek.minta_ar, 'ajándékkártya = tényleges ár');
  // minden törzs egyezik a motor-ág foglalás-soraiban a Google-nak szánt kérés akció / érték mezőivel
  for (const s of t.sorok.filter((x) => x.forras_ag === 'motor' && x.platformok && x.platformok.google && x.platformok.google.allapot === 'kuldve' && !x.kupon)) {
    const a = t.google_arnyek_akciok.find((x) => x.akcio_id === s.platformok.google.akcio);
    assert.ok(a, 'a sor akciója szerepel a táblában');
    assert.equal(s.platformok.google.ertek, a.szintetikus_feltoltes.body.value, `${s.uzletag}/${s.esemeny}: azonos érték`);
  }
  assert.ok(markdown(t).includes('### 2b. Szintetikus Google-feltöltési törzsek'));
});

test('salonic_direct-ág: Google-ba és GA4-be soha nem küld; az ismeretlen ár változat az sd-ágon érték nélkül', () => {
  const sd = t.sorok.filter((s) => s.forras_ag === 'salonic_direct' && s.esemeny);
  assert.ok(sd.length > 0);
  for (const s of sd) { assert.notEqual(s.platformok.google.allapot, 'kuldve'); assert.notEqual(s.platformok.ga4.allapot, 'kuldve'); }
  const x = sd.find((s) => s.esemeny === 'FoglalasElso' && s.valtozatok.ismeretlen_ar);
  assert.ok(x); assert.equal(x.valtozatok.ismeretlen_ar.meta.ertek, null);
  assert.ok(!t.sorok.some((s) => s.forras_ag === 'motor' && s.valtozatok && s.valtozatok.ismeretlen_ar), 'a motor-ágon nincs ismeretlen-ár változat (a D5 az sd-ágon létezik)');
});

test('ajándékkártya-ágak: kártya = Ajandekkartya + ernyő; utalás-igénylés kihagyva; utalás-befizetés eseményt ad', () => {
  const g = (k) => t.ajandek_sorok.filter((s) => s.szcenario === k);
  assert.deepEqual(g('kartya').map((s) => s.esemeny).sort(), ['Ajandekkartya', 'Schedule']);
  assert.equal(g('atutalas_igenyles_webhook')[0].esemeny, null);
  assert.deepEqual(g('atutalas_befizetve').map((s) => s.esemeny).sort(), ['Ajandekkartya', 'Schedule']);
  assert.equal(g('atutalas_nem_erkezett_be')[0].esemeny, null);
  assert.equal(g('kartya').find((s) => s.esemeny === 'Ajandekkartya').platformok.google.akcio, ARNYEK.google.akciok.headspa.Ajandekkartya);
});

test('Markdown és JSON kimenet: fejlécek, minden üzletág, parse-olható JSON, megállapítások', () => {
  const md = markdown(t);
  for (const x of ['# Mérés-leképezés', '## 1. Forrás-ágak', '## 1b. Automatikus megállapítások', '## 2. A 10 Google ARNYEK-akció', '## 3. Foglalás-események', '## 4. Ajándékkártya-ágak', 'commit:']) assert.ok(md.includes(x), x);
  for (const u of UZLETAGAK) assert.ok(md.includes(`### ${u}`), u);
  assert.ok(megallapitasok(t).length >= 6);
  const cli = (...a) => execFileSync(process.execPath, [path.join(ROOT, 'tools/meres-lekepezes-export.mjs'), ...a], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const j = JSON.parse(cli('--json'));
  assert.equal(j.google_arnyek_akciok.length, 10);
  assert.ok(cli('--md').startsWith('# Mérés-leképezés'));
});

// --- mutációs ellenpróba: a tábla követi a KÓDOT (egy másolaton módosított szabály megjelenik a kimenetben) -------------------------------------------------
function masolat(mutacio) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lek-mut-'));
  const rels = new Set(Object.values(HORGONYOK).map(([f]) => f).concat(['docs/booking-engine/SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json']));
  for (const f of fs.readdirSync(path.join(ROOT, 'netlify/lib/meres'))) rels.add('netlify/lib/meres/' + f);
  for (const rel of rels) { fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true }); fs.copyFileSync(path.join(ROOT, rel), path.join(tmp, rel)); }
  if (mutacio) { const [rel, ki, be] = mutacio; const p = path.join(tmp, rel); const s = fs.readFileSync(p, 'utf8'); assert.ok(s.includes(ki), 'a mutáció célszövege megvan: ' + ki); fs.writeFileSync(p, s.replace(ki, be)); }
  return tmp;
}
const probaMasolat = async (mutacio) => { const tmp = masolat(mutacio); try { return await epit({ gyoker: tmp }); } finally { fs.rmSync(tmp, { recursive: true, force: true }); } };

test('mutáció 1: a kupon-kizárás kivétele az ernyő-jogosultságból → a kuponos sorokban megjelenik az ernyő-esemény', async () => {
  const alap = t.sorok.filter((s) => s.kupon && s.esemeny_tipus === 'ernyo').length;
  const m = await probaMasolat(['netlify/lib/meres/esemeny-modell.js', 'const ernyoJogosult = !fk.kupon && ', 'const ernyoJogosult = ']);
  assert.equal(alap, 0);
  assert.ok(m.sorok.filter((s) => s.kupon && s.esemeny_tipus === 'ernyo').length > 0);
});
test('mutáció 2: a Google ARNYEK-akció azonosító módosítása → a táblában és a kimenő kérésben is az új azonosító látszik', async () => {
  const m = await probaMasolat(['netlify/lib/meres/platformok.js', "oxigen: { FoglalasElso: '7825200901'", "oxigen: { FoglalasElso: '7825200999'"]);
  assert.ok(m.google_arnyek_akciok.some((a) => a.uzletag === 'oxigen' && a.akcio_id === '7825200999'));
  assert.ok(m.sorok.some((s) => s.uzletag === 'oxigen' && s.platformok && s.platformok.google && s.platformok.google.akcio === '7825200999'));
  assert.ok(!t.sorok.some((s) => s.platformok && s.platformok.google && s.platformok.google.akcio === '7825200999'));
});
test('mutáció 3: az oxigén konzultáció-érték módosítása (8900 → 4990) → az érték-szabály és a kimenő érték követi', async () => {
  const m = await probaMasolat(['netlify/lib/meres/esemeny-modell.js', 'oxigen: 8900', 'oxigen: 4990']);
  const x = m.sorok.find((s) => s.uzletag === 'oxigen' && s.forras_ag === 'motor' && s.esemeny === 'Konzultacio');
  assert.equal(x.ertek_szabaly, 'konzultáció-tábla: 4990 Ft');
  assert.equal(x.platformok.meta.ertek, 4990);
  const alap = t.sorok.find((s) => s.uzletag === 'oxigen' && s.forras_ag === 'motor' && s.esemeny === 'Konzultacio');
  assert.equal(alap.platformok.meta.ertek, 8900);
});
test('mutáció 4: a TikTok HeadSpa-ernyő neve (CompletePayment → Schedule) → a tábla a másik nevet mutatja', async () => {
  const m = await probaMasolat(['netlify/lib/meres/platformok.js', "(ctx.fk.uzletag === 'headspa' ? 'CompletePayment' : 'Schedule')", "'Schedule'"]);
  const x = m.sorok.find((s) => s.uzletag === 'headspa' && s.forras_ag === 'motor' && s.esemeny_tipus === 'ernyo');
  const alap = t.sorok.find((s) => s.uzletag === 'headspa' && s.forras_ag === 'motor' && s.esemeny_tipus === 'ernyo');
  assert.equal(alap.platformok.tiktok.esemeny_nev, 'CompletePayment');
  assert.equal(x.platformok.tiktok.esemeny_nev, 'Schedule');
});
test('mutáció 5: a forrás-horgony eltűnése (kód átírása) → az eszköz hibával áll le, nem ír elavult hivatkozást', async () => {
  await assert.rejects(probaMasolat(['netlify/lib/meres/platformok.js', 'export function googleKerelem', 'function googleKerelem']), /forrás-horgony nincs meg/);
});
