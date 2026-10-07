// QA-3 KONTROLLALT TESZTEK (2026-10-07, DECISION #102 utan): egy eset = valodi, "TESZT - Claude" nevu probafoglalas(ok) a MEGADOTT elonezeten, KOD- ES BRANCH-MODOSITAS NELKUL; csak arnyek-celok
// (Meta TEST83939, TikTok TEST83543, GA4 teszt-property, Google ARNYEK akciok). Minden eset: booking_id, platformonkenti kiment esemeny_id-k, ELVART es TENYLEGES eredmeny, PASS / FAIL.
//   EGYEZTETES_KULCS=... node tools/meres-proba/qa3-futtat.mjs --bazis https://<elonezet>.mosaic-d77.pages.dev --eset <nev> [--nap 2026-10-07] [--refund-bazis https://<masik-elonezet>.mosaic-d77.pages.dev] [--szaraz 1]
// X1-javitas utani ujrateszt (R1-R6; R1 = a KET sorrend, csak akkor PASS, ha mindketto PASS): dupla-level-eltero-jelzes + dupla-level-eltero-jelzes-forditva | paros-headspa | elso-foglalas | valodi-visszajaro | dupla-level | darabszam-ellenorzes (utoljara futtatando)
// esetek: (extra: dupla-level-eltero-jelzes, dupla-level-eltero-jelzes-forditva) ujratoltes | dupla-level | lemondas-elotte | lemondas-utana | visszajaro | kupon | konz-szor | konz-fodrasz | konz-pmu | konz-oxigen | suti-elutasitas | kattintas-tiktok-meta | kattintas-meta-google | ajandek-visszaterites
// Kimenet: docs/booking-engine/meres-naplo/qa3-<eset>-<nap>.json (nyers valaszok + ellenorzesek); osszefoglalo: tools/meres-proba/qa3-osszefoglalo.mjs. A kulcs soha nem kerul a kimenetbe.
// Az "elvart" oszlop a DOKUMENTALT szabalybol jon (QA2_ARNYEK.md, esemeny-modell.js szabalyai), nem a kodbol szamolt ertekbol; eltereskor a FAIL a lelet, nem a teszt javitando.
// Versenyhelyzet: az elo Salonic-level-Zap ugyanazokat a leveleket maga is tovabbitja az elonezet vegpontjara; ha o er oda elobb, az 1. sajat hivas "mar_kuldve" (a cellak vegesek) - ezt a teszt elfogadja, es jelzi.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BAZIS = arg('bazis', ''), ESET = arg('eset', ''), NAP = arg('nap', new Date().toISOString().slice(0, 10)), DIR = arg('dir', 'docs/booking-engine/meres-naplo'), KULCS = process.env.EGYEZTETES_KULCS || '';
const REFUND_BAZIS = arg('refund-bazis', ''), SZARAZ = arg('szaraz', '0') === '1';
if (!/^https:\/\/[a-z0-9-]+\.mosaic-d77\.pages\.dev$/.test(BAZIS)) throw new Error('csak PR-elonezeten fut (--bazis https://<ag>.mosaic-d77.pages.dev)');
if (!KULCS && !SZARAZ) throw new Error('EGYEZTETES_KULCS kell (kornyezeti valtozo)');
const H = { 'x-egyeztetes-kulcs': KULCS, 'content-type': 'application/json' };
const chromeUt = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'; if (!process.env.CHROME_UTVONAL && fs.existsSync(chromeUt)) process.env.CHROME_UTVONAL = chromeUt;
const FELADO = { mosaicheadspa: 'Mosaic Headspa', 'mosaic-hair': 'Mosaic Hair', 'mosaic-oxigen': 'Mosaic Oxigén', 'mosaic-elysion': 'Mosaic Elysion', 'mosaic-pmu': 'Mosaic PMU' };
const KONZ_ERTEK = { szor: 27000, fodrasz: 13000, pmu: 13800, oxigen: 8900 }; // #100 / #101
const META_NEVEK = { szor: ['Schedule', 'Szor_Konzultacio'], fodrasz: ['Fodrasz_AkviziciosFoglalas', 'Fodrasz_Konzultacio'], pmu: ['PMU_Konzultacio', 'Schedule'], oxigen: ['Oxigen_AkviziciosFoglalas', 'Oxigen_Konzultacio'] };
const fut = (cmd, args, ms = 280000) => spawnSync('node', [cmd, ...args], { encoding: 'utf8', timeout: ms, env: process.env });
const olvas = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const fajl = (resz) => `${DIR}/qa3-${ESET}-${resz}-${NAP}.json`;
const jsonValasz = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return { http: r.status, nyers: t.slice(0, 300) }; } };
const get = async (ut, b = BAZIS) => jsonValasz(await fetch(b + ut, { headers: H }));
const post = async (ut, torzs, b = BAZIS) => jsonValasz(await fetch(b + ut, { method: 'POST', headers: H, body: JSON.stringify(torzs) }));
const naplo = (sid) => get(`/api/meres-admin?source_id=${encodeURIComponent(sid)}`);
const ido = () => new Date().toISOString();
const levelIdo = () => new Date(Date.now() - 60000).toISOString().replace(/\.\d+Z$/, 'Z');
const varj = (ms) => new Promise((r) => setTimeout(r, ms));
let nyitott = null; // a mar letrehozott, de meg nem lemondott probafoglalas lemondo URL-je (hibaval megszakadt esetnel a vegen lemondjuk)

const kimenet = { eset: ESET, bazis: BAZIS, nap: NAP, megjegyzes: 'TESZT - Claude foglalasok; csak arnyek-celok; a szimulalt elemeket (uj vendeg jelzes, levelbeli szolgaltatas-nev) a "szimulalt" mezo jelzi', lepesek: [], ellenorzesek: [], szimulalt: [] };
const lep = (lepes, x = {}) => { kimenet.lepesek.push({ ido: ido(), lepes, ...x }); console.log(`[${ido().slice(11, 19)}] ${lepes}`, Object.keys(x).length ? JSON.stringify(x).slice(0, 300) : ''); };
const ell = (leiras, elvart, tenyleges, ok = JSON.stringify(elvart) === JSON.stringify(tenyleges)) => { kimenet.ellenorzesek.push({ leiras, elvart, tenyleges, ok: Boolean(ok) }); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${leiras}  | elvart: ${JSON.stringify(elvart)} | tenyleges: ${JSON.stringify(tenyleges)}`.slice(0, 420)); };

// --- epitokockak --------------------------------------------------------------------------------------------------------------------------
/** valodi bongeszos foglalas (TESZT - Claude); extra: a qa2-eset.mjs tovabbi kapcsoloi. -> bongeszo-naplo (JSON), a fajl neve a _fajl mezoben */
function foglal(eset, profil, extra = []) {
  const f = fajl('bongeszo');
  fut('tools/meres-proba/qa2-eset.mjs', ['--bazis', BAZIS, '--eset', eset, '--profil', profil, '--out', f, ...extra]);
  if (!fs.existsSync(f)) throw new Error('nincs bongeszos naplo');
  const b = olvas(f); if (b.hiba || !b.lemondo_url) { if (b.lemondo_url) fut('tools/meres-proba/lemond.mjs', [b.lemondo_url], 90000); throw new Error('foglalas hiba: ' + (b.hiba || 'nincs lemondo URL')); }
  b._fajl = f; nyitott = b.lemondo_url; return b;
}
/** a Salonic-level szimulalasa a SAJAT szallitoval (mint a QA-2) -> { valasz: az /api/foglalas-egyeztetes nyers valasza } */
function level(b, szam, { ujVendeg = 'igen', szolgaltatas, ar } = {}) {
  const f = fajl('szerver' + szam);
  const args = ['--bazis', BAZIS, '--bongeszo', b._fajl, '--level-ido', levelIdo(), '--felado', FELADO[String(b.salonic_host).split('.')[0]], '--uj-vendeg', ujVendeg, '--out', f];
  if (szolgaltatas) args.push('--szolgaltatas', szolgaltatas); if (ar !== undefined) args.push('--ar', String(ar));
  fut('tools/meres-proba/qa2-szerver.mjs', args, 150000);
  return fs.existsSync(f) ? (olvas(f).egyeztetes_valasz_nyers || {}) : {};
}
const lemond = (b) => { nyitott = null; const r = fut('tools/meres-proba/lemond.mjs', [b.lemondo_url], 90000); const a = fut('tools/meres-proba/foglalas-allapot.mjs', [b.lemondo_url.replace('/cancelBooking/', '/bookingDetails/')], 90000); return { eredmeny: (r.stdout.trim().split('\n').pop() || '').slice(0, 120), salonic_allapot: (a.stdout.match(/-> (\S+)/) || [])[1] || '?' }; };
const idopontSzoveg = (unix) => { const p = Object.fromEntries(new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(unix * 1000)).map((x) => [x.type, x.value])); const v = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date((unix + 1800) * 1000)); return `${p.month[0].toUpperCase()}${p.month.slice(1)} ${p.day}. (${p.weekday}) ${p.hour}:${p.minute} - ${v}`; };
const kerelem = (k) => { try { return typeof (k || {}).kerelem === 'string' ? JSON.parse(k.kerelem) : (k || {}).kerelem || {}; } catch { return {}; } };
/** platformonkenti kiment esemeny_id-k + a nem kiment sorok indoka */
function osszegez(n) {
  const o = { sorok: n.kuldesek.length, elkuldve: { meta: [], tiktok: [], google: [], ga4: [] }, nem_ment_ki: [] };
  for (const k of n.kuldesek) { if (k.allapot === 'elkuldve') o.elkuldve[k.platform].push({ esemeny_id: k.esemeny_id, nev: k.platform_nev || k.esemeny_nev, ertek: k.ertek }); else o.nem_ment_ki.push({ esemeny_id: k.esemeny_id, platform: k.platform, allapot: k.allapot, indok: k.indok }); }
  return o;
}
const rogzites = (e) => (e && e.esemeny_kuldes && e.esemeny_kuldes.jelleg_rogzites) || null; // X1-javitas: az elso level jellege rogzul; a valasz jelzi, ha egy kesobbi level jelzese elter
const egyedi = (n) => new Set(n.kuldesek.map((k) => k.esemeny_id + '|' + k.platform)).size === n.kuldesek.length;
const sor = (n, tipus, platform) => n.kuldesek.find((k) => k.esemeny_tipus === tipus && k.platform === platform);
const nevek = (o, p) => o.elkuldve[p].map((x) => x.nev).sort();
const elsoHivas = (e) => { const a = e.esemeny_kuldes && e.esemeny_kuldes.allapot; ell('1. hivas: parositas + esemenyek (vagy az elo Zap mar elintezte: mar_kuldve)', 'parositott + kesz | mar_kuldve', `${e.allapot} + ${a}`, e.allapot === 'parositott' && ['kesz', 'mar_kuldve'].includes(a)); if (a === 'mar_kuldve') kimenet.megjegyzes += ' | az 1. sajat level mar_kuldve-t kapott: az elo Zap elobb elintezte'; };

// --- esetek ---------------------------------------------------------------------------------------------------------------------------------
async function futtat() {
  lep(`eset: ${ESET}`, { bazis: BAZIS });
  if (SZARAZ) { console.log('szaraz futas: nem foglal, nem kuld'); return; }
  switch (ESET) {
    case 'ujratoltes': { // 1. A koszonooldal ujratoltese (F5) es a VISSZA gomb: az erkezesi adat egyszer tarolodik, az esemenyek egyszer mennek ki; a level UTANI ujratoltes sem modosit semmit
      const jel = fajl('jelzes'); for (const e of ['', '.kesz1', '.level-kesz']) try { fs.unlinkSync(jel + e); } catch { /* nincs */ }
      const bf = fajl('bongeszo');
      const p = spawn('node', ['tools/meres-proba/qa2-eset.mjs', '--bazis', BAZIS, '--eset', 'headspa', '--profil', 'teljes', '--out', bf, '--koszono-ujratoltes', '1', '--varj-level', jel], { env: process.env, stdio: 'ignore' });
      const vege = new Promise((res) => p.on('exit', res));
      const t0 = Date.now(); while (Date.now() - t0 < 420000 && !fs.existsSync(jel + '.kesz1') && p.exitCode === null) await varj(1500);
      if (!fs.existsSync(jel + '.kesz1')) { await vege; throw new Error('a bongeszos lepes nem jutott el az ujratoltesekig (lasd a bongeszo-naplot)'); }
      lep('F5 x2 + vissza / elore gomb a koszonooldalon kesz; a bongeszo megvarja a level feldolgozasat');
      const b = olvas(bf); b._fajl = bf;
      const n0 = await naplo(b.booking_id); kimenet.erkezes_a_level_elott = n0.erkezes || null;
      const e1 = level(b, ''); elsoHivas(e1); const n1 = await naplo(b.booking_id);
      fs.writeFileSync(jel + '.level-kesz', '1'); await vege;
      const bv = olvas(bf); bv._fajl = bf; const n2 = await naplo(b.booking_id); // a level UTANI F5 + vissza gomb utan
      const e2 = level(bv, '2'); const n3 = await naplo(b.booking_id);
      Object.assign(kimenet, { booking_id: b.booking_id, salonic_uuid: b.salonic_uuid, koszono_ujratoltes: bv.koszono_ujratoltes, esemeny_idk: osszegez(n3), lemondas: lemond(bv) });
      for (const e of ['', '.kesz1', '.level-kesz']) try { fs.unlinkSync(jel + e); } catch { /* nincs */ } // a jelzo-fajlok nem kerulnek a naplok koze
      ell('az erkezesi adat mar a level elott tarolva van (a koszonooldal irta)', true, Boolean(n0.erkezes));
      ell('esemeny-sorok a level utan (4 alap + 4 ernyo)', 8, n1.kuldesek.length);
      ell('esemeny-sorok a level UTANI F5 / vissza gomb utan (valtozatlan)', 8, n2.kuldesek.length);
      ell('az erkezesi adat a level utani F5 utan valtozatlan (kiment esemeny utan nem modosul)', JSON.stringify(n1.erkezes && n1.erkezes.attr), JSON.stringify(n2.erkezes && n2.erkezes.attr), JSON.stringify(n1.erkezes && n1.erkezes.attr) === JSON.stringify(n2.erkezes && n2.erkezes.attr));
      ell('2. level (ismetles): nincs uj kuldes', 'mar_kuldve', e2.esemeny_kuldes && e2.esemeny_kuldes.allapot);
      ell('esemeny-sorok az ismetelt level utan', 8, n3.kuldesek.length);
      ell('nincs dupla (esemeny_id, platform)', true, egyedi(n3));
      const u = bv.koszono_ujratoltes || [];
      ell('a bongeszoben mind a 7 lepes lefutott (betoltes, F5 x2, vissza, elore, F5 + vissza a level utan)', true, u.length >= 7 && u.every((x) => x.url));
      ell('a vissza gomb a foglalo-oldalra visz, az elore gomb vissza a koszonooldalra', [true, true], [/booking-test|foglalo|idopont/.test((u.find((x) => /VISSZA/.test(x.lepes)) || {}).url || ''), /success|koszon|-ok/.test((u.find((x) => /ELORE/.test(x.lepes)) || {}).url || '')]);
      ell('(informacio) az erkezesi / kulcs-iras POST-ja ujratolteskor nem ismetlodik a bongeszobol', u.length ? u[0].post_keresek_osszesen : null, u.length ? u[u.length - 1].post_keresek_osszesen : null, true);
      break;
    }
    case 'dupla-level': { // 2. UGYANAZ a Salonic-level ketszer a /api/foglalas-egyeztetes vegpontra: a masodik valasz mar_kuldve
      const b = foglal('headspa', 'teljes'); const e1 = level(b, ''); const e2 = level(b, '2'); const n = await naplo(b.booking_id);
      Object.assign(kimenet, { booking_id: b.booking_id, salonic_uuid: b.salonic_uuid, esemeny_idk: osszegez(n), lemondas: lemond(b) });
      elsoHivas(e1);
      ell('2. hivas (ugyanaz a level): mar_kuldve', 'mar_kuldve', e2.esemeny_kuldes && e2.esemeny_kuldes.allapot);
      ell('2. hivas: duplikalt jelzes', true, e2.duplikalt);
      ell('esemeny-sorok szama', 8, n.kuldesek.length); ell('nincs dupla (esemeny_id, platform)', true, egyedi(n));
      break;
    }
    case 'dupla-level-eltero-jelzes': { // EXTRA (nem a 9 eset): ket level ugyanarra a foglalasra ELTERO "uj vendeg" jelzessel (a Zap sajat levele a TESZT-vendegre uj_vendeg=false-t ad): egy foglalasbol egy alapesemeny?
      const b = foglal('headspa', 'teljes'); const e1 = level(b, '', { ujVendeg: 'igen' }); const n1 = await naplo(b.booking_id); const o1 = osszegez(n1);
      const e2 = level(b, '2', { ujVendeg: 'nem' }); const n2 = await naplo(b.booking_id); const o2 = osszegez(n2);
      kimenet.szimulalt.push('az 1. level "uj vendeg: igen", a 2. level "uj vendeg: nem" (a Zap sajat levele a TESZT-vendegre ezt adja); a 2. level az 1. utan masodpercekkel megy, a Zap levele ekkor meg nem erkezett meg');
      Object.assign(kimenet, { booking_id: b.booking_id, salonic_uuid: b.salonic_uuid, esemeny_idk: o2, lemondas: lemond(b), elso_level_utan: { sorok: n1.kuldesek.length, elkuldve: [o1.elkuldve.meta.length, o1.elkuldve.tiktok.length, o1.elkuldve.google.length, o1.elkuldve.ga4.length] } });
      elsoHivas(e1);
      ell('1. level utan kiment (Meta, TikTok, Google, GA4): alap + ernyo', [2, 2, 1, 1], [o1.elkuldve.meta.length, o1.elkuldve.tiktok.length, o1.elkuldve.google.length, o1.elkuldve.ga4.length]);
      ell('2. level (eltero jelzes): a valasz szerint nincs uj kuldes', 'mar_kuldve', e2.esemeny_kuldes && e2.esemeny_kuldes.allapot);
      ell('javitott kod: a 2. level eltero jelzese latszik (jelleg_rogzites.eltero), de a rogzitett jelleg az 1. levele marad', ['elso', true, 'visszajaro'], [e2.esemeny_kuldes && e2.esemeny_kuldes.jelleg, (rogzites(e2) || {}).eltero, (rogzites(e2) || {}).kapott_jelleg]);
      ell('egy foglalasbol EGY alapesemeny: a naploban csak FoglalasElso alap-esemeny van (nincs Visszajaro)', ['FoglalasElso'], [...new Set(n2.kuldesek.filter((k) => k.esemeny_tipus === 'alap').map((k) => k.esemeny_id.split(':')[0]))]);
      ell('a 2. level utan a kiment esemenyek szama valtozatlan', o1.elkuldve.meta.length + o1.elkuldve.tiktok.length + o1.elkuldve.google.length + o1.elkuldve.ga4.length, o2.elkuldve.meta.length + o2.elkuldve.tiktok.length + o2.elkuldve.google.length + o2.elkuldve.ga4.length);
      break;
    }
    case 'dupla-level-eltero-jelzes-forditva': { // EXTRA (X1, a javitas utan): ugyanaz FORDITOTT sorrendben - az 1. level "nem uj vendeg", a 2. "uj vendeg": a Visszajaro marad, a 2. level nem kuld FoglalasElso / ernyo esemenyt
      const b = foglal('headspa', 'teljes'); const e1 = level(b, '', { ujVendeg: 'nem' }); const n1 = await naplo(b.booking_id); const o1 = osszegez(n1);
      const e2 = level(b, '2', { ujVendeg: 'igen' }); const n2 = await naplo(b.booking_id); const o2 = osszegez(n2);
      kimenet.szimulalt.push('az 1. level "uj vendeg: nem", a 2. level "uj vendeg: igen"; mindket level a SAJAT szallitobol (a Zap sajat levele ettol fuggetlenul erkezhet)');
      Object.assign(kimenet, { booking_id: b.booking_id, salonic_uuid: b.salonic_uuid, esemeny_idk: o2, lemondas: lemond(b), elso_level_utan: { sorok: n1.kuldesek.length, elkuldve: [o1.elkuldve.meta.length, o1.elkuldve.tiktok.length, o1.elkuldve.google.length, o1.elkuldve.ga4.length] } });
      elsoHivas(e1);
      ell('1. level utan kiment (Meta, TikTok, Google, GA4): csak a Visszajaro alapesemeny (Google-akcio nincs, ernyo nincs)', [1, 1, 0, 1], [o1.elkuldve.meta.length, o1.elkuldve.tiktok.length, o1.elkuldve.google.length, o1.elkuldve.ga4.length]);
      ell('2. level (eltero jelzes): a valasz szerint nincs uj kuldes', 'mar_kuldve', e2.esemeny_kuldes && e2.esemeny_kuldes.allapot);
      ell('javitott kod: a 2. level eltero jelzese latszik (jelleg_rogzites.eltero), de a rogzitett jelleg az 1. levele marad', ['visszajaro', true, 'elso'], [e2.esemeny_kuldes && e2.esemeny_kuldes.jelleg, (rogzites(e2) || {}).eltero, (rogzites(e2) || {}).kapott_jelleg]);
      ell('egy foglalasbol EGY alapesemeny: a naploban csak Visszajaro alap-esemeny van (nincs FoglalasElso, nincs ernyo)', [['Visszajaro'], 0], [[...new Set(n2.kuldesek.filter((k) => k.esemeny_tipus === 'alap').map((k) => k.esemeny_id.split(':')[0]))], n2.kuldesek.filter((k) => k.esemeny_tipus === 'ernyo').length]);
      ell('a 2. level utan a kiment esemenyek szama valtozatlan', o1.elkuldve.meta.length + o1.elkuldve.tiktok.length + o1.elkuldve.google.length + o1.elkuldve.ga4.length, o2.elkuldve.meta.length + o2.elkuldve.tiktok.length + o2.elkuldve.google.length + o2.elkuldve.ga4.length);
      break;
    }
    case 'paros-headspa': { // R2 (X1-javitas utani ujrateszt): a VALODI paros HeadSpa minta (a mai 10 levelpar alapjan): ket level, AZONOS foglalasi azonosito es AZONOS "uj vendeg" jelzes; a 2. level csak a mosaicheadspa@ cimre megy -> a 2. level semmit ne kuldjon
      const b = foglal('headspa', 'teljes'); const e = level(b, ''); elsoHivas(e); const n1 = await naplo(b.booking_id); const o1 = osszegez(n1);
      const e2 = level(b, '2'); const n = await naplo(b.booking_id); const o = osszegez(n); // ugyanaz az uuid / booking_id, ugyanaz az "uj vendeg: igen" jelzes
      kimenet.szimulalt.push('a 2. level a valodi mintaban csak a mosaicheadspa@ cimre megy; a /api/foglalas-egyeztetes bemenetben NINCS cimzett-mezo, ezert a futtato ezt nem tudja kifejezni: a szerver szamara a 2. level azonos uuid-ju (booking_id) es azonos jelzesu level (a mai 10 levelpar alapjan; TENY, ket par megnezve: a ket valodi level torzse karakterre azonos - 19 493 es 19 634 karakter, 0 elteres - csak a cimzett mas, hianyzo mezo nincs, ezert a szimulacio pontos)');
      Object.assign(kimenet, { booking_id: b.booking_id, salonic_uuid: b.salonic_uuid, esemeny_idk: o, lemondas: lemond(b) });
      ell('javitott kod fut: a valasz tartalmazza a jelleg_rogzites mezot, az 1. level nem elter', [true, false], [Boolean(rogzites(e)), rogzites(e) ? rogzites(e).eltero : null], !e.esemeny_kuldes || e.esemeny_kuldes.allapot === 'mar_kuldve' || (Boolean(rogzites(e)) && !rogzites(e).eltero));
      ell('az 1. level utan Meta + TikTok: alap + ernyo; Google + GA4: csak az alap', [2, 2, 1, 1], [o1.elkuldve.meta.length, o1.elkuldve.tiktok.length, o1.elkuldve.google.length, o1.elkuldve.ga4.length]);
      ell('esemeny-nevek (Meta)', ['HeadSpa_FoglalasElso', 'Schedule'], nevek(o, 'meta')); ell('esemeny-nevek (TikTok)', ['CompletePayment', 'HeadSpa_FoglalasElso'], nevek(o, 'tiktok'));
      ell('2. level (azonos booking_id, azonos jelzes): a valasz mar_kuldve, az eltero-jelzes NEM aktiv', ['mar_kuldve', false], [e2.esemeny_kuldes && e2.esemeny_kuldes.allapot, rogzites(e2) ? rogzites(e2).eltero : null]);
      ell('a 2. level semmit nem kuldott: a kiment esemenyek es a sorok szama valtozatlan', [n1.kuldesek.length, o1.elkuldve.meta.length + o1.elkuldve.tiktok.length + o1.elkuldve.google.length + o1.elkuldve.ga4.length], [n.kuldesek.length, o.elkuldve.meta.length + o.elkuldve.tiktok.length + o.elkuldve.google.length + o.elkuldve.ga4.length]);
      ell('egy alapesemeny-tipus (FoglalasElso)', ['FoglalasElso'], [...new Set(n.kuldesek.filter((k) => k.esemeny_tipus === 'alap').map((k) => k.esemeny_id.split(':')[0]))]);
      ell('kuldott ertek = a tenyleges ar (> 0), Meta alap = TikTok alap', true, ((sor(n, 'alap', 'meta') || {}).ertek > 0) && (sor(n, 'alap', 'meta') || {}).ertek === (sor(n, 'alap', 'tiktok') || {}).ertek);
      ell('nincs dupla (esemeny_id, platform)', true, egyedi(n));
      break;
    }
    case 'elso-foglalas': { // R3: NORMAL (fizetos) elso foglalas, nem konzultacio es nem HeadSpa: az oxigenterapias elso kezeles
      const b = foglal('oxigen-elso', 'teljes'); const e = level(b, ''); elsoHivas(e); const n = await naplo(b.booking_id); const o = osszegez(n);
      Object.assign(kimenet, { booking_id: b.booking_id, salonic_uuid: b.salonic_uuid, esemeny_idk: o, lemondas: lemond(b) });
      ell('javitott kod fut: a valasz tartalmazza a jelleg_rogzites mezot, az 1. level nem elter', [true, false], [Boolean(rogzites(e)), rogzites(e) ? rogzites(e).eltero : null], !e.esemeny_kuldes || e.esemeny_kuldes.allapot === 'mar_kuldve' || (Boolean(rogzites(e)) && !rogzites(e).eltero));
      ell('Meta + TikTok: alap + ernyo; Google + GA4: csak az alap', [2, 2, 1, 1], [o.elkuldve.meta.length, o.elkuldve.tiktok.length, o.elkuldve.google.length, o.elkuldve.ga4.length]);
      ell('esemeny-nevek (Meta)', ['Oxigen_AkviziciosFoglalas', 'Oxigen_FoglalasElso'], nevek(o, 'meta')); ell('esemeny-nevek (TikTok)', ['Oxigen_FoglalasElso', 'Schedule'], nevek(o, 'tiktok'));
      ell('egy alapesemeny-tipus (FoglalasElso), NEM konzultacio', ['FoglalasElso'], [...new Set(n.kuldesek.filter((k) => k.esemeny_tipus === 'alap').map((k) => k.esemeny_id.split(':')[0]))]);
      ell('kuldott ertek = a tenyleges ar (> 0, nem a konzultacio-ertek)', true, ((sor(n, 'alap', 'meta') || {}).ertek > 0) && (sor(n, 'alap', 'meta') || {}).ertek !== KONZ_ERTEK.oxigen);
      ell('nincs dupla (esemeny_id, platform)', true, egyedi(n));
      break;
    }
    case 'valodi-visszajaro': { // R4: VALODI visszajaro: NINCS szimulalt level - az elo Zap a valodi Salonic-levelet tovabbitja, a Salonic-vendegrekord szerint a TESZT-vendeg nem uj
      const b = foglal('headspa', 'teljes'); lep('nincs szimulalt level: az elo Zap sajat (valodi Salonic) levelet varjuk (legfeljebb 12 perc)');
      let n = { kuldesek: [] }; const t0 = Date.now();
      while (Date.now() - t0 < 720000) { n = await naplo(b.booking_id); if ((n.kuldesek || []).some((k) => k.esemeny_tipus === 'alap' && ['elkuldve', 'kihagyva', 'halasztva', 'tiltva'].includes(k.allapot))) break; await varj(10000); }
      const elso = Math.round((Date.now() - t0) / 1000); await varj(60000); n = await naplo(b.booking_id); const o = osszegez(n); // meg 60 mp: egy esetleges 2. level se hozzon masik alapesemenyt
      Object.assign(kimenet, { booking_id: b.booking_id, salonic_uuid: b.salonic_uuid, esemeny_idk: o, zap_level_varakozas_mp: elso, lemondas: lemond(b) });
      ell('a Zap levele megerkezett es feldolgozodott (van alapesemeny sor)', true, n.kuldesek.some((k) => k.esemeny_tipus === 'alap'));
      ell('alapesemeny: csak Visszajaro (a valodi Salonic-jelzes szerint nem uj vendeg), ernyo nincs', [['Visszajaro'], 0], [[...new Set(n.kuldesek.filter((k) => k.esemeny_tipus === 'alap').map((k) => k.esemeny_id.split(':')[0]))], n.kuldesek.filter((k) => k.esemeny_tipus === 'ernyo').length]);
      ell('Meta / TikTok / GA4: kiment; Google: nem', [1, 1, 1, 0], [o.elkuldve.meta.length, o.elkuldve.tiktok.length, o.elkuldve.ga4.length, o.elkuldve.google.length]);
      ell('Meta-nev', ['HeadSpa_Visszajaro'], nevek(o, 'meta'));
      ell('nincs dupla (esemeny_id, platform)', true, egyedi(n));
      break;
    }
    case 'darabszam-ellenorzes': { // R6: az R1-R5 esetek egyutt: platformonkenti darabszam + esemeny_id duplazas-ellenorzes (a keso Zap-levelek utan is)
      const KOR = [['dupla-level-eltero-jelzes', [2, 2, 1, 1]], ['dupla-level-eltero-jelzes-forditva', [1, 1, 1, 0]], ['paros-headspa', [2, 2, 1, 1]], ['elso-foglalas', [2, 2, 1, 1]], ['valodi-visszajaro', [1, 1, 1, 0]], ['dupla-level', [2, 2, 1, 1]]]; // [Meta, TikTok, GA4, Google]
      const vara = Number(arg('varakozas-mp', '240')); lep(`keso Zap-levelekre varunk ${vara} mp-et, utana a naplok ujraolvasasa`); await varj(vara * 1000);
      const osszes = { meta: 0, tiktok: 0, ga4: 0, google: 0 }, vart = { meta: 0, tiktok: 0, ga4: 0, google: 0 }, mind = []; const reszek = [];
      for (const [k, v] of KOR) {
        let o; try { o = olvas(`${DIR}/qa3-${k}-${NAP}.json`); } catch { ell(`${k}: a futas naploja megvan`, true, false); continue; }
        const n = await naplo(o.booking_id); mind.push(...n.kuldesek); const e = osszegez(n);
        const db = { meta: e.elkuldve.meta.length, tiktok: e.elkuldve.tiktok.length, ga4: e.elkuldve.ga4.length, google: e.elkuldve.google.length };
        for (const [i, p] of ['meta', 'tiktok', 'ga4', 'google'].entries()) { osszes[p] += db[p]; vart[p] += v[i]; }
        reszek.push({ eset: k, booking_id: o.booking_id, kiment: db, elvart: Object.fromEntries(['meta', 'tiktok', 'ga4', 'google'].map((p, i) => [p, v[i]])), sorok: n.kuldesek.length });
        ell(`${k} (${o.booking_id}): kiment darabszam (Meta, TikTok, GA4, Google)`, v, [db.meta, db.tiktok, db.ga4, db.google]);
        ell(`${k}: egy alapesemeny-tipus; minden esemeny_id a sajat booking_id-jat hordozza`, [1, true], [new Set(n.kuldesek.filter((x) => x.esemeny_tipus === 'alap').map((x) => x.esemeny_id.split(':')[0])).size, n.kuldesek.every((x) => x.esemeny_id.endsWith(':' + o.booking_id))]);
      }
      kimenet.esetenkent = reszek;
      ell('platformonkenti OSSZES kiment darabszam (Meta, TikTok, GA4, Google)', [vart.meta, vart.tiktok, vart.ga4, vart.google], [osszes.meta, osszes.tiktok, osszes.ga4, osszes.google]);
      ell('esemeny_id duplazas: egyetlen (esemeny_id, platform) sem fordul elo ketszer az osszes kor-foglalas soraban', true, new Set(mind.map((x) => x.esemeny_id + '|' + x.platform)).size === mind.length);
      break;
    }
    case 'lemondas-elotte': { // 3a. a foglalas LEMONDVA, MIELOTT a level feldolgozasra kerul: nem mehet ki konverzio
      const b = foglal('fodrasz', 'teljes'); const lem = lemond(b); const e = level(b, ''); const n = await naplo(b.booking_id); const o = osszegez(n);
      Object.assign(kimenet, { booking_id: b.booking_id, salonic_uuid: b.salonic_uuid, esemeny_idk: o, lemondas: lem });
      ell('Salonic-allapot a lemondas utan', 'LEMONDVA', lem.salonic_allapot);
      ell('kiment esemenyek (Meta / TikTok / GA4 / Google)', [0, 0, 0, 0], [o.elkuldve.meta.length, o.elkuldve.tiktok.length, o.elkuldve.ga4.length, o.elkuldve.google.length]);
      ell('minden cella "kihagyva" a lemondas miatt', true, n.kuldesek.length > 0 && n.kuldesek.every((k) => k.allapot === 'kihagyva' && /lemond/i.test(k.indok || '')));
      lep('a level valasza', { allapot: e.allapot, esemeny_kuldes: e.esemeny_kuldes && { allapot: e.esemeny_kuldes.allapot, elo_allapot: e.esemeny_kuldes.elo_allapot } });
      break;
    }
    case 'lemondas-utana': { // 3b. a konverzio mar kiment, a foglalast KESOBB mondjak le + lemondasi ertesito: #128-on nincs visszavonas (az eletut az #138-ban), de nem keletkezhet hamis esemeny
      const b = foglal('pmu-kezeles', 'teljes'); const e = level(b, ''); elsoHivas(e); const n1 = await naplo(b.booking_id), o1 = osszegez(n1);
      const lem = lemond(b); const q = b.koszono_query || {}; const start = b.bookingUrl_elemzes && b.bookingUrl_elemzes.startUnix;
      const ert = await post('/api/foglalas-egyeztetes', { tipus: 'lemondas', felado: FELADO[String(b.salonic_host).split('.')[0]], szolgaltatas: q.service, munkatarsak: [q.employee].filter(Boolean), idopont_szoveg: idopontSzoveg(start), level_datuma: ido() });
      lep('lemondasi ertesito', { allapot: ert.allapot, eredmenyek: (ert.eredmenyek || []).map((x) => ({ eredmeny: x.eredmeny, elo_allapot: x.elo_allapot })) });
      const e2 = level(b, '2'); const n2 = await naplo(b.booking_id);
      Object.assign(kimenet, { booking_id: b.booking_id, salonic_uuid: b.salonic_uuid, lemondasi_ertesito_valasz: { allapot: ert.allapot, eredmenyek: ert.eredmenyek, miert: ert.miert }, esemeny_idk: osszegez(n2), lemondas: lem });
      ell('a lemondas ELOTT kimentek az esemenyek (PMU: Meta 2 + TikTok 2 + Google 1 + GA4 1)', [2, 2, 1, 1], [o1.elkuldve.meta.length, o1.elkuldve.tiktok.length, o1.elkuldve.google.length, o1.elkuldve.ga4.length]);
      ell('Salonic-allapot a lemondas utan', 'LEMONDVA', lem.salonic_allapot);
      ell('a lemondasi ertesito felismerte a lemondast', 'lemondas', ert.allapot);
      ell('a level ismetlese a lemondas utan: nincs uj kuldes', 'mar_kuldve', e2.esemeny_kuldes && e2.esemeny_kuldes.allapot);
      ell('esemeny-sorok a lemondas es az ertesito utan valtozatlanok (nincs hamis / uj esemeny)', n1.kuldesek.length, n2.kuldesek.length);
      ell('#128-on nincs Google-visszavonas (az eletut-esemenyek az #138-ban): nincs "Visszavonas" / "eletut" sor', false, n2.kuldesek.some((k) => /Visszavonas/.test(k.esemeny_id) || k.esemeny_tipus === 'eletut'));
      break;
    }
    case 'visszajaro': { // 4. visszajaro vendeg (a Salonic "nem uj vendeg" jelzese): nem konverzio, nincs ernyo, Google-be nem megy
      const b = foglal('headspa', 'teljes'); const e = level(b, '', { ujVendeg: 'nem' }); const n = await naplo(b.booking_id); const o = osszegez(n);
      kimenet.szimulalt.push('"uj vendeg: nem" jelzes a levelben (a TESZT-vendeg a Salonicban valoban nem uj; a jelzest a hivo adja)');
      Object.assign(kimenet, { booking_id: b.booking_id, salonic_uuid: b.salonic_uuid, esemeny_idk: o, lemondas: lemond(b) });
      ell('jelleg', 'visszajaro', e.esemeny_kuldes && e.esemeny_kuldes.jelleg, !e.esemeny_kuldes || e.esemeny_kuldes.jelleg === 'visszajaro' || e.esemeny_kuldes.allapot === 'mar_kuldve');
      ell('csak alapesemeny (Visszajaro), ernyo nincs', ['Visszajaro'], [...new Set(n.kuldesek.map((k) => k.esemeny_nev))]);
      ell('Meta / TikTok / GA4: kiment; Google: nem', [1, 1, 1, 0], [o.elkuldve.meta.length, o.elkuldve.tiktok.length, o.elkuldve.ga4.length, o.elkuldve.google.length]);
      ell('Meta-nev', ['HeadSpa_Visszajaro'], nevek(o, 'meta'));
      break;
    }
    case 'kupon': { // 5. kuponos foglalas: ernyo NINCS (a kupon sosem ernyo)
      const szolg = 'KUPONKÓDDAL - PÁROS MOSAIC Head Spa kezelés';
      const b = foglal('headspa', 'teljes'); level(b, '', { szolgaltatas: szolg, ar: 0 }); const n = await naplo(b.booking_id); const o = osszegez(n);
      kimenet.szimulalt.push(`a level szolgaltatas-neve szimulalva: "${szolg}" es ar: 0 Ft (valodi kuponkodos foglalashoz ervenyes Salonic-kuponkod kell; a foglalas maga normal HeadSpa foglalas)`);
      Object.assign(kimenet, { booking_id: b.booking_id, salonic_uuid: b.salonic_uuid, esemeny_idk: o, lemondas: lemond(b) });
      ell('ernyoesemeny nincs (egyetlen "ernyo" sor sem)', 0, n.kuldesek.filter((k) => k.esemeny_tipus === 'ernyo').length);
      ell('alapesemeny kiment (FoglalasElso)', true, o.elkuldve.meta.some((x) => /FoglalasElso/.test(x.esemeny_id)));
      ell('kuldott ertek = a levelbeli ar (0 Ft)', 0, (sor(n, 'alap', 'meta') || {}).ertek);
      break;
    }
    case 'konz-szor': case 'konz-fodrasz': case 'konz-pmu': case 'konz-oxigen': { // 6. konzultacio: rogzitett ertek (#100 / #101), ernyo ugyanazzal, Google / GA4 az alap
      const uz = ESET.slice(5);
      const b = foglal(uz, 'teljes'); const e = level(b, ''); elsoHivas(e); const n = await naplo(b.booking_id); const o = osszegez(n);
      Object.assign(kimenet, { booking_id: b.booking_id, salonic_uuid: b.salonic_uuid, esemeny_idk: o, lemondas: lemond(b) });
      ell(`kuldott ertek (a ${uz} konzultacio-ertek, HUF)`, KONZ_ERTEK[uz], (sor(n, 'alap', 'meta') || {}).ertek);
      ell('az ernyo ugyanazzal az ertekkel', KONZ_ERTEK[uz], (sor(n, 'ernyo', 'meta') || {}).ertek);
      ell('Meta + TikTok: alap + ernyo; Google + GA4: csak az alap', [2, 2, 1, 1], [o.elkuldve.meta.length, o.elkuldve.tiktok.length, o.elkuldve.google.length, o.elkuldve.ga4.length]);
      ell('esemeny-nevek (Meta)', META_NEVEK[uz], nevek(o, 'meta'));
      break;
    }
    case 'suti-elutasitas': { // 7. minden suti elutasitva: Meta es TikTok kuldenek (SZ-38), a Google es a GA4 ELUTASITOTT jelzest kap (nem marad el, nem "granted")
      const b = foglal('headspa', 'nincs'); const e = level(b, ''); elsoHivas(e); const n = await naplo(b.booking_id); const o = osszegez(n);
      Object.assign(kimenet, { booking_id: b.booking_id, salonic_uuid: b.salonic_uuid, esemeny_idk: o, lemondas: lemond(b) });
      const m = kerelem(sor(n, 'alap', 'meta')), t = kerelem(sor(n, 'alap', 'tiktok')), g = kerelem(sor(n, 'alap', 'google')), a = kerelem(sor(n, 'alap', 'ga4'));
      const md = ((m.body || {}).data || [{}])[0].user_data || {}, td = ((t.body || {}).data || [{}])[0].user || {};
      ell('hozzajarulas a naploban: statisztika nem, marketing nem', [false, false], [(b.hozzajarulas || {}).ana, (b.hozzajarulas || {}).adv]);
      ell('Meta kuldott (hash-elt e-mail + telefon)', [true, true, 'elkuldve'], [Boolean(md.em), Boolean(md.ph), (sor(n, 'alap', 'meta') || {}).allapot]);
      ell('TikTok kuldott (hash-elt e-mail + telefon)', [true, true, 'elkuldve'], [Boolean(td.email), Boolean(td.phone), (sor(n, 'alap', 'tiktok') || {}).allapot]);
      ell('Google: kuldes ELUTASITOTT jelzessel', ['elkuldve', 'DENIED'], [(sor(n, 'alap', 'google') || {}).allapot, (g.body || {}).ad_user_data]);
      ell('GA4: kuldes ELUTASITOTT jelzessel', ['elkuldve', 'DENIED', 'DENIED'], [(sor(n, 'alap', 'ga4') || {}).allapot, ((a.body || {}).consent || {}).ad_user_data, ((a.body || {}).consent || {}).ad_personalization]);
      ell('Google / GA4: hash-elt azonosito nem megy', false, /"(em|ph|email|phone|user_data|sha256_[a-z_]+)"/.test(JSON.stringify([g.body, a.body])));
      break;
    }
    case 'kattintas-tiktok-meta': case 'kattintas-meta-google': { // 8. az 1. latogatas egyik platformrol, a 2. (a foglalas) masikrol: platformonkent CSAK a sajat kattintasazonosito megy
      const [elso, utolso] = ESET === 'kattintas-tiktok-meta' ? ['tiktok', 'meta'] : ['meta', 'google'];
      const b = foglal('headspa', 'teljes', ['--elso', elso, '--utolso', utolso]); const e = level(b, ''); elsoHivas(e); const n = await naplo(b.booking_id); const o = osszegez(n);
      Object.assign(kimenet, { booking_id: b.booking_id, salonic_uuid: b.salonic_uuid, kattintas: { elso, utolso }, esemeny_idk: o, lemondas: lemond(b) });
      const m = kerelem(sor(n, 'alap', 'meta')), t = kerelem(sor(n, 'alap', 'tiktok')), gs = sor(n, 'alap', 'google') || {};
      const md = ((m.body || {}).data || [{}])[0].user_data || {}, td = ((t.body || {}).data || [{}])[0].user || {};
      const volt = elso === 'google' || utolso === 'google';
      ell('Meta fbc (fbclid): csak ha volt Meta-kattintas', elso === 'meta' || utolso === 'meta', Boolean(md.fbc));
      ell('TikTok ttclid: csak ha volt TikTok-kattintas', elso === 'tiktok' || utolso === 'tiktok', Boolean(td.ttclid));
      ell('Google: elkuldve, ha volt Google-kattintas (gclid); egyebkent kihagyva (nincs kattintasazonosito)', volt ? 'elkuldve' : 'kihagyva', gs.allapot);
      if (!volt) ell('Google "kihagyva" indoka: nincs Google-kattintasazonosito', true, /nincs Google-kattintasazonosito/.test(gs.indok || ''));
      ell('a Meta-kerelem nem tartalmaz masik platform kattintasazonositot (gclid / wbraid / ttclid)', false, /gclid|wbraid|gbraid|ttclid/i.test(JSON.stringify(m.body || {})));
      ell('a TikTok-kerelem nem tartalmaz masik platform kattintasazonositot (gclid / wbraid / fbclid / fbc)', false, /gclid|wbraid|gbraid|fbclid|"fbc"/i.test(JSON.stringify(t.body || {})));
      ell('GA4 elkuldve (client_id az _ga sutibol)', 'elkuldve', (sor(n, 'alap', 'ga4') || {}).allapot);
      kimenet.erkezes = n.erkezes && n.erkezes.attr && { utm_elso: n.erkezes.attr.utm_elso, utm_utolso: n.erkezes.attr.utm_utolso };
      break;
    }
    case 'ajandek-visszaterites': { // 9. az ajandekkartya Stripe-visszaterítese: SEMMILYEN hamis esemeny nem mehet ki (a #128-on nincs refund-korrekcio: se uj purchase, se visszavonas)
      if (!/^https:\/\/[a-z0-9-]+\.mosaic-d77\.pages\.dev$/.test(REFUND_BAZIS)) throw new Error('--refund-bazis kell: az az elonezet, amelyik a Stripe TESZT-visszateritest letre tudja hozni (ajandek_teszt_visszateritese); a vizsgalt elonezet kodjat / agat ez nem modositja');
      if (REFUND_BAZIS === BAZIS) throw new Error('a --refund-bazis nem lehet a vizsgalt elonezet (ott nincs ajandek_teszt_visszateritese)');
      const bf = fajl('bongeszo'); fut('tools/meres-proba/qa2-ajandek.mjs', ['--bazis', BAZIS, '--profil', 'teljes', '--out', bf]);
      const b = fs.existsSync(bf) ? olvas(bf) : {}; if (!b.pi) throw new Error('nincs PI: ' + (b.hiba || '?'));
      const r0 = await post('/api/meres-admin', { muvelet: 'ajandek_ujra', pi: b.pi }); const n0 = await naplo(b.pi); const o0 = osszegez(n0);
      const osszeg = (sor(n0, 'alap', 'meta') || {}).ertek; if (!(osszeg > 3000)) throw new Error('a kartya ara nem olvashato a naplobol: ' + osszeg);
      lep('vasarlas + esemenyek', { pi: b.pi, ujra: r0.allapot, sorok: n0.kuldesek.length, osszeg });
      const r1 = await post('/api/meres-admin', { muvelet: 'ajandek_teszt_visszateritese', pi: b.pi, osszeg: 3000 }, REFUND_BAZIS); lep('reszleges (3 000 Ft) Stripe teszt-visszaterites', { ok: r1.ok, refund_id: r1.refund_id });
      const u1 = await post('/api/meres-admin', { muvelet: 'ajandek_ujra', pi: b.pi }); const n1 = await naplo(b.pi);
      const r2 = await post('/api/meres-admin', { muvelet: 'ajandek_teszt_visszateritese', pi: b.pi, osszeg: osszeg - 3000 }, REFUND_BAZIS); lep(`maradek (${osszeg - 3000} Ft) Stripe teszt-visszaterites = teljes`, { ok: r2.ok, refund_id: r2.refund_id });
      const u2 = await post('/api/meres-admin', { muvelet: 'ajandek_ujra', pi: b.pi }); const n2 = await naplo(b.pi);
      const u3 = await post('/api/meres-admin', { muvelet: 'ajandek_ujra', pi: b.pi });
      Object.assign(kimenet, { pi: b.pi, visszateritesek: [{ osszeg_huf: 3000, valasz: r1 }, { osszeg_huf: osszeg - 3000, valasz: r2 }], ajandek_ujra_valaszok: [r0, u1, u2, u3], esemeny_idk: osszegez(n2) });
      ell('a vasarlas esemenyei kimentek (Meta / TikTok alap, Google, GA4)', [1, 1, 1, 1], [o0.elkuldve.meta.filter((x) => /^Ajandekkartya:/.test(x.esemeny_id)).length, o0.elkuldve.tiktok.filter((x) => /^Ajandekkartya:/.test(x.esemeny_id)).length, o0.elkuldve.google.length, o0.elkuldve.ga4.length]);
      ell('mindket Stripe teszt-visszaterites letrejott', [true, true], [r1.ok, r2.ok]);
      ell('esemeny-sorok a reszleges visszaterites utan (valtozatlan)', n0.kuldesek.length, n1.kuldesek.length);
      ell('esemeny-sorok a teljes visszaterites utan (valtozatlan)', n0.kuldesek.length, n2.kuldesek.length);
      ell('nincs Visszavonas / Korrekcio / Visszaterites / eletut sor: SEMMILYEN hamis esemeny nem ment ki', false, n2.kuldesek.some((k) => /Visszavonas|Korrekcio|Visszaterites/.test(k.esemeny_id) || ['eletut', 'korrekcio'].includes(k.esemeny_tipus)));
      ell('az ujrajatszas a visszaterites utan: nincs uj kuldes', 'mar_kuldve', u3.allapot);
      ell('nincs dupla (esemeny_id, platform)', true, egyedi(n2));
      break;
    }
    default: throw new Error('ismeretlen eset: ' + ESET);
  }
  const fail = kimenet.ellenorzesek.filter((x) => !x.ok).length;
  kimenet.eredmeny = fail === 0 ? 'PASS' : `FAIL (${fail} / ${kimenet.ellenorzesek.length})`;
  console.log(`\nEREDMENY: ${kimenet.eredmeny}`);
}
try { await futtat(); } catch (e) { kimenet.hiba = String(e && e.message || e).slice(0, 400); kimenet.eredmeny = 'HIBA'; console.log('HIBA:', kimenet.hiba); }
if (nyitott) { const r = fut('tools/meres-proba/lemond.mjs', [nyitott], 90000); kimenet.takaritas = 'a hibaval megszakadt eset foglalasa lemondva: ' + (r.stdout.trim().split('\n').pop() || '').slice(0, 100); console.log(kimenet.takaritas); }
if (!SZARAZ) fs.writeFileSync(`${DIR}/qa3-${ESET}-${NAP}.json`, JSON.stringify(kimenet, null, 1));
