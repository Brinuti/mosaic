// A mérés teljes leképezése KÓDBÓL exportálva (a mérési oldal kérése: #167 6240242371 / 6240456665 (a); a Google E2E-próba leképezés-táblája).
//   node tools/meres-lekepezes-export.mjs [--md] [--json] [--ki <fájl>] [--gyoker <mappa>]
// NEM kézzel másolt tábla: az éles döntő függvényeket hívja szintetikus bemenetekkel (I/O, D1, hálózat nélkül):
//   - esemenyek() / foglalasJelleg() (netlify/lib/meres/esemeny-modell.js): melyik esemény keletkezik (alap + ernyő), milyen értékkel
//   - KEREM_EPITO.{meta,tiktok,ga4,google}() (platformok.js): mi menne ki platformonként (esemény-név, érték, Google ARNYEK-akció), vagy miért marad ki / tiltott
//   - platformSzabaly() (hozzajarulas.js): a hozzájárulás szerepe;  ajandekForras() (ajandek-esemeny.js): az ajándékkártya-ágak
// A forrásfájl:sor hivatkozásokat a futás a forrásfájlból keresi ki (horgony-szöveg alapján), ezért a kóddal együtt mozognak; ha egy horgony eltűnik, az eszköz hibával áll le.
// --gyoker: egy MÁSIK gyökér (pl. a mutációs próba másolata); alapból a repó, amelyben az eszköz van.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const ITT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MINTA_AR = 12345;                          // a "tényleges ár" jelölő érték: ha az esemény értéke ezt követi, akkor a tényleges árból jön
const MINTA_IDO = 1793000000;
const GOOGLE_ERK = { google: { gclid: { ertek: 'TESZTGCLIDmintaertek1234567', ts: 1792999000 } }, fbp: 'fb.1.1.123456789', ttp: 'TESZTTTP', ga4: { client_id: '1234567890.1792999000', session_id: '1792999000' }, meta: { fbc: 'fb.1.1792999000000.TESZTFBCLID' } };

/** Egy horgony (kódrészlet) helye a forrásfájlban: 'fájl:sor'. Hiba, ha nincs meg. */
function helyKereso(gyoker) {
  const cache = new Map();
  return (rel, horgony) => {
    if (!cache.has(rel)) cache.set(rel, fs.readFileSync(path.join(gyoker, rel), 'utf8').split('\n'));
    const i = cache.get(rel).findIndex((s) => s.includes(horgony));
    if (i < 0) throw new Error(`forrás-horgony nincs meg: ${rel}: ${JSON.stringify(horgony)}`);
    return `${rel}:${i + 1}`;
  };
}
const M = 'netlify/lib/meres/';
export const HORGONYOK = Object.freeze({
  esemenyek: [M + 'esemeny-modell.js', 'export function esemenyek('],
  foglalasJelleg: [M + 'esemeny-modell.js', 'export function foglalasJelleg'],
  ernyoJogosult: [M + 'esemeny-modell.js', 'const ernyoJogosult'],
  headspaKonzNincs: [M + 'esemeny-modell.js', 'HeadSpa: nincs konzultacio-ag'],
  konzTabla: [M + 'esemeny-modell.js', 'export const KONZULTACIO_ERTEK'],
  metaKerelem: [M + 'platformok.js', 'export function metaKerelem'],
  tiktokKerelem: [M + 'platformok.js', 'export function tiktokKerelem'],
  tiktokNev: [M + 'platformok.js', "const nev = e.tipus === 'ernyo'"],
  tiktokCompletePayment: [M + 'platformok.js', "nev === 'CompletePayment' && ctx.fk.ertek_minoseg"],
  googleKerelem: [M + 'platformok.js', 'export function googleKerelem'],
  googleAkciok: [M + 'platformok.js', 'akciok: Object.freeze'],
  googleCsakAlap: [M + 'platformok.js', "if (e.tipus !== 'alap' || e.nev === 'Visszajaro')"],
  ga4Kerelem: [M + 'platformok.js', 'export function ga4Kerelem'],
  ga4SdNincsClientId: [M + 'platformok.js', "ctx.fk.forras === 'salonic_direct' && !(ctx.erk"],
  hozzajarulas: [M + 'hozzajarulas.js', 'export function platformSzabaly'],
  elosztasD5: [M + 'elosztas.js', "fk.ertek_minoseg !== 'exact'"],
  elosztasKikapcsolva: [M + 'elosztas.js', 'export function kikapcsolva'],
  motorKuldes: [M + 'foglalas-esemeny.js', 'export async function foglalasEsemenyKuldes'],
  sdKuldes: [M + 'salonic-direct.js', 'async function kuldesFuttat'],
  sdArFeloldas: [M + 'salonic-direct.js', 'export async function arFeloldas'],
  ajandekForras: [M + 'ajandek-esemeny.js', 'export function ajandekForras'],
  ajandekArnyek: ['netlify/lib/ajandek.js', 'async function arnyekMeres('],
  ajandekEloMeres: ['netlify/lib/ajandek.js', 'async function meresKuld('],
  ajandekTesztVedelem: ['netlify/lib/ajandek.js', 'MERES_TESZT_NEV_RE = '],
  ajandekIgenyles: ['assets/js/ajandek.js', "mer('bank_transfer_request'"],
  zapTesztRegi: [M + 'qa-nap.js', 'export const PROBA_SZABALY'],
});

const FORRAS_AGAK = {
  motor: { leiras: 'foglalás-motor + Salonic-levél (foglalas-esemeny.js; böngészős érkezési adat: gclid, _ga, fbp …)', sourceId: 'mb_abcdef123456' },
  salonic_direct: { leiras: 'Salonic-direct safety net (salonic-direct.js; csak a Salonic-levél: nincs böngészős adat, nincs click ID / GA4 client_id)', sourceId: 'sd_' + 'a1'.repeat(12), forras: 'salonic_direct' },
};
const SZCENARIOK = [
  { kulcs: 'uj_elso', cim: 'új vendég, kezelés (nem konzultáció)', szolgaltatasNev: 'Mintakezelés', ujVendeg: true },
  { kulcs: 'uj_konzultacio', cim: 'új vendég, konzultáció / hajkamerás vizsgálat', szolgaltatasNev: 'Ingyenes konzultáció', ujVendeg: true },
  { kulcs: 'visszajaro', cim: 'visszatérő vendég (Salonic: nem új)', szolgaltatasNev: 'Mintakezelés', ujVendeg: false },
  { kulcs: 'ismeretlen_vendeg', cim: 'új / visszatérő nem ismert (Salonic-jelzés hiányzik)', szolgaltatasNev: 'Mintakezelés', ujVendeg: null },
  { kulcs: 'kupon_uj_elso', cim: 'KUPONOS foglalás, új vendég', szolgaltatasNev: 'KUPONKODDAL - Mintakezelés (kupon)', ujVendeg: true },
  { kulcs: 'kupon_visszajaro', cim: 'KUPONOS foglalás, visszatérő vendég', szolgaltatasNev: 'KUPONKODDAL - Mintakezelés (kupon)', ujVendeg: false },
];

const kiolvas = (platform, r) => {
  if (r.kihagyva) return { allapot: 'kihagyva', ok: r.kihagyva };
  if (r.tiltva) return { allapot: 'tiltva', ok: r.tiltva };
  const o = { allapot: 'kuldve', platform_nev: r.platform_nev };
  if (platform === 'meta') { const d = r.body.data[0]; o.ertek = d.custom_data.value ?? null; o.penznem = d.custom_data.currency ?? null; o.esemeny_nev = d.event_name; }
  else if (platform === 'tiktok') { const d = r.body.data[0]; o.ertek = d.properties.value ?? null; o.penznem = d.properties.currency ?? null; o.esemeny_nev = d.event; }
  else if (platform === 'ga4') { const d = r.body.events[0]; o.ertek = d.params.value ?? null; o.penznem = d.params.currency ?? null; o.esemeny_nev = d.name; }
  else { o.ertek = r.body.value ?? null; o.penznem = r.body.currency ?? null; o.akcio = r.body.conversion_action_id; o.click_tipus = ['gclid', 'wbraid', 'gbraid'].find((k) => r.body[k]); o.ad_user_data = r.body.ad_user_data; o.ugyfel = r.cel.customer_id; o.esemeny_nev = r.platform_nev; }
  return o;
};
const ertekLeiras = (e) => (e.nyitott ? `nyitott: nem megy ki (${e.nyitott_ok})` : e.ertek_forras === 'konzultacio_tabla' ? `konzultáció-tábla: ${e.ertek} Ft` : e.ertek === MINTA_AR ? 'tényleges ár (Salonic-levél / Stripe)' : String(e.ertek));

export async function epit({ gyoker = ITT } = {}) {
  const imp = (rel) => import(pathToFileURL(path.join(gyoker, M, rel)).href);
  const [modell, plat, hozz, ajandek] = await Promise.all([imp('esemeny-modell.js'), imp('platformok.js'), imp('hozzajarulas.js'), imp('ajandek-esemeny.js')]);
  const hely = helyKereso(gyoker);
  const helyek = Object.fromEntries(Object.entries(HORGONYOK).map(([k, [f, h]]) => [k, hely(f, h)]));
  const tabla = modell.konzultacioTabla({});
  const env = { META_TESZT_KOD: 'TEST00000', TIKTOK_TESZT_KOD: 'TEST00000', GA4_TESZT_MEASUREMENT_ID: 'G-TESZTPROP1' };
  const platformok = [...plat.PLATFORMOK];

  const ctxEpit = (fk, { erk, hozzajarulas }) => {
    const h = hozz.hozzajarulasTisztit(hozzajarulas);
    return { fk, erk, ua: 'TESZT-UA', ip: '1.2.3.xxx', oldal: 'https://www.mosaicheadspa.hu/minta', hozz: Object.fromEntries(['meta', 'tiktok', 'google', 'ga4'].map((p) => [p, hozz.platformSzabaly(p, h)])), hash: { em: 'a'.repeat(64), ph_meta: 'b'.repeat(64), ph_e164: 'c'.repeat(64), ext: 'd'.repeat(64) } };
  };
  const futtat = (platform, e, ctx) => kiolvas(platform, plat.KEREM_EPITO[platform](e, ctx, env));
  // D5 (elosztas.js): ismeretlen tényleges ár -> a tényleges árra épülő esemény ÉRTÉK NÉLKÜL megy (az elosztas() sora tükrözve; a horgony a helyek.elosztasD5)
  const d5 = (lista, fk) => lista.map((e) => (fk.ertek_minoseg && fk.ertek_minoseg !== 'exact' && e.ertek_forras === 'tenyleges_ar' ? { ...e, ertek_nelkul: true } : e));

  const sorok = [];
  for (const uzletag of modell.UZLETAGAK) {
    for (const [agNev, ag] of Object.entries(FORRAS_AGAK)) {
      for (const sz of SZCENARIOK) {
        const j = modell.foglalasJelleg({ szolgaltatasNev: sz.szolgaltatasNev, ujVendeg: sz.ujVendeg, kategoria: '' });
        const fk = { tipus: 'foglalas', uzletag, source_entity_id: ag.sourceId, jelleg: j.jelleg, kupon: j.kupon, ertek: MINTA_AR, ido: MINTA_IDO, szolgaltatas: sz.szolgaltatasNev, ...(ag.forras ? { forras: ag.forras, attr_minoseg: 'C_salonic_direct', ertek_minoseg: 'exact' } : {}) };
        const lista = d5(modell.esemenyek(fk, tabla), fk);
        const alap = { uzletag, forras_ag: agNev, szcenario: sz.kulcs, szcenario_cim: sz.cim, jelleg: j.jelleg, kupon: j.kupon };
        if (!lista.length) { sorok.push({ ...alap, esemeny: null, megjegyzes: 'a kódban ehhez a foglaláshoz NEM keletkezik esemény (esemenyek() üres lista)' }); continue; }
        for (const e of lista) {
          const erk = agNev === 'motor' ? GOOGLE_ERK : {};
          const ctx = ctxEpit(fk, { erk, hozzajarulas: agNev === 'motor' ? { ana: true, adv: true, fun: false } : null });
          const sor = { ...alap, esemeny: e.nev, esemeny_tipus: e.tipus, esemeny_id_minta: e.esemeny_id, ertek_szabaly: ertekLeiras(e), penznem: e.penznem, platformok: {}, valtozatok: {} };
          for (const p of platformok) sor.platformok[p] = futtat(p, e, ctx);
          // a platformonkénti feltétel-változatok: ugyanaz az esemény más bemenettel (hozzájárulás, click ID, GA4 client_id, ismeretlen ár) -> mi változik
          const v = sor.valtozatok;
          v.hozzajarulas_nincs = Object.fromEntries(['meta', 'tiktok', 'google', 'ga4'].map((p) => [p, futtat(p, e, ctxEpit(fk, { erk, hozzajarulas: { ana: false, adv: false, fun: false } }))]));
          v.google_click_id_nelkul = futtat('google', e, ctxEpit(fk, { erk: { ...erk, google: undefined }, hozzajarulas: agNev === 'motor' ? { ana: true, adv: true } : null }));
          v.ga4_client_id_nelkul = futtat('ga4', e, ctxEpit(fk, { erk: { ...erk, ga4: undefined }, hozzajarulas: agNev === 'motor' ? { ana: true, adv: true } : null }));
          if (agNev === 'salonic_direct' && e.ertek_forras === 'tenyleges_ar') {   // a D5 (ismeretlen ár) csak az sd-ágon létezik: a motor-ág nem állít ertek_minoseg-et
            const fk2 = { ...fk, ertek_minoseg: 'unknown_price' };
            const e2 = d5([e], fk2)[0];
            v.ismeretlen_ar = Object.fromEntries(['meta', 'tiktok', 'ga4'].map((p) => [p, futtat(p, e2, ctxEpit(fk2, { erk, hozzajarulas: agNev === 'motor' ? { ana: true, adv: true } : null }))]));
          }
          const googleAkcio = (plat.ARNYEK.google.akciok[uzletag] || {})[e.nev] || null;
          sor.konverzio = e.tipus === 'ernyo' ? { igen: true, miert: 'ernyő-esemény: Meta / TikTok optimalizáló konverzió' } : googleAkcio ? { igen: true, miert: `Google ARNYEK-akció ${googleAkcio}: akvizíciós konverzió` } : { igen: false, miert: 'információs alapesemény: nincs ernyő és nincs Google-akció (visszatérő vendég, nem szerzés)' };
          sor.google_akcio = googleAkcio;
          sorok.push(sor);
        }
      }
    }
  }

  // --- ajándékkártya-ágak (HeadSpa; ajandek-esemeny.js + ajandek.js) -----------------------------------------------------------------------
  const pi = (md) => ({ id: 'pi_TESZTMINTA1234', status: 'succeeded', metadata: { forras: 'ajandek', ...md }, amount: MINTA_AR * 100, amount_received: MINTA_AR * 100, created: MINTA_IDO, receipt_email: 'minta@example.com', latest_charge: null });
  const ajandekEsetek = [
    { kulcs: 'kartya', cim: 'Stripe-kártyás vásárlás (payment_intent.succeeded)', mod: 'kartya', pi: pi({}) },
    { kulcs: 'atutalas_igenyles_webhook', cim: 'utalásos rendelés a Stripe-webhooknál (igénylés)', mod: 'kartya', pi: pi({ fizetesi_mod: 'atutalas', atu_ref: 'ATU-ABCD1234' }) },
    { kulcs: 'atutalas_befizetve', cim: 'utalásos kártya: a szalon igazolta a befizetést (kiállítás)', mod: 'atutalas', pi: pi({ fizetesi_mod: 'atutalas', atu_ref: 'ATU-ABCD1234', atutalas_beerkezett: '1', atutalas_ekkor: '2026-10-17T12:00:00Z' }) },
    { kulcs: 'atutalas_nem_erkezett_be', cim: 'utalásos kártya, a befizetés még nem érkezett meg', mod: 'atutalas', pi: pi({ fizetesi_mod: 'atutalas', atu_ref: 'ATU-ABCD1234' }) },
  ];
  const ajandek_sorok = [];
  for (const a of ajandekEsetek) {
    const f = ajandek.ajandekForras(a.pi, a.mod);
    if (f.kihagyva) { ajandek_sorok.push({ uzletag: 'headspa', forras_ag: 'kartya', szcenario: a.kulcs, szcenario_cim: a.cim, esemeny: null, megjegyzes: 'kihagyva: ' + f.kihagyva }); continue; }
    const fk = { ...f.fk, ertek: MINTA_AR, ido: MINTA_IDO };
    for (const e of modell.esemenyek(fk, tabla)) {
      const ctx = ctxEpit(fk, { erk: GOOGLE_ERK, hozzajarulas: { ana: true, adv: true } });
      const sor = { uzletag: 'headspa', forras_ag: f.fk.forras, szcenario: a.kulcs, szcenario_cim: a.cim, jelleg: null, kupon: false, esemeny: e.nev, esemeny_tipus: e.tipus, esemeny_id_minta: e.esemeny_id, ertek_szabaly: ertekLeiras(e), penznem: e.penznem, platformok: {}, valtozatok: {} };
      for (const p of platformok) sor.platformok[p] = futtat(p, e, ctx);
      const googleAkcio = (plat.ARNYEK.google.akciok.headspa || {})[e.nev] || null;
      sor.google_akcio = googleAkcio;
      sor.konverzio = e.tipus === 'ernyo' ? { igen: true, miert: 'ernyő-esemény' } : { igen: true, miert: `ajándékkártya-vásárlás: konverzió (Google ARNYEK-akció ${googleAkcio || '-'})` };
      ajandek_sorok.push(sor);
    }
  }

  // --- a 10 Google ARNYEK-akció (E2E-próba tábla) -------------------------------------------------------------------------------------------
  const KONZ = /konzult|hajkamer/i;                                                    // ugyanaz a szabály, mint az esemeny-modell.js KONZULTACIO / a booking-engine CONSULT
  const SNAP_UZLETAG = { headspa: 'headspa', fodrasz: 'hair', oxigen: 'oxygen', szor: 'laser', pmu: 'pmu' };
  let snap = null; try { snap = JSON.parse(fs.readFileSync(path.join(gyoker, 'docs/booking-engine/SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json'), 'utf8')); } catch (e) { /* nincs pillanatkép */ }
  const szolg = (uz) => ((snap && snap.services) || []).filter((s) => s.business === SNAP_UZLETAG[uz] && s.service_name_raw);
  const akcioTabla = [];
  for (const [uzletag, akciok] of Object.entries(plat.ARNYEK.google.akciok)) {
    for (const [esemeny, akcioId] of Object.entries(akciok)) {
      const konz = esemeny === 'Konzultacio';
      const pelda = esemeny === 'Ajandekkartya' ? [] : szolg(uzletag).filter((s) => KONZ.test(s.service_name_raw) === konz && !/kupon/i.test(s.service_name_raw) && (konz || Number(s.active_price) > 0)).sort((a, b) => (Number(a.active_price) || 0) - (Number(b.active_price) || 0)).slice(0, konz ? 3 : 2);
      const fkElso = { tipus: 'foglalas', uzletag, source_entity_id: FORRAS_AGAK.motor.sourceId, jelleg: konz ? 'konzultacio' : 'elso', kupon: false, ertek: MINTA_AR, ido: MINTA_IDO };
      const ev = esemeny === 'Ajandekkartya' ? null : modell.esemenyek(fkElso, tabla).find((x) => x.nev === esemeny);
      // a Zap-webhooknak szánt SZINTETIKUS kérés-törzs: pontosan a googleKerelem() kimenete (minta-gclid, minta-ár; a dryrun a relay-Zap `dryrun` mezője: nem tölt fel, csak visszaadja a kész kérést)
      let fkSz = fkElso, evSz = ev;
      if (esemeny === 'Ajandekkartya') { fkSz = { ...ajandek.ajandekForras(pi({}), 'kartya').fk, ertek: MINTA_AR, ido: MINTA_IDO }; evSz = modell.esemenyek(fkSz, tabla).find((x) => x.nev === esemeny); }
      const gr = evSz ? plat.googleKerelem(evSz, ctxEpit(fkSz, { erk: GOOGLE_ERK, hozzajarulas: { ana: true, adv: true, fun: false } }), env) : null;
      akcioTabla.push({
        szintetikus_feltoltes: gr && gr.body ? { cel: gr.cel, body: gr.body, dryrun_body: { ...gr.body, dryrun: true } } : null,
        akcio_id: akcioId, ugyfel: plat.ARNYEK.google.customerId, uzletag, uzletag_nev: modell.UZLETAG_NEV[uzletag], esemeny,
        elo_azonosito_e: plat.ELO_CELOK.google_primary.includes(akcioId),
        kivaltas: esemeny === 'Ajandekkartya' ? 'HeadSpa ajándékkártya vásárlás (Stripe-kártyás; utalásos: a befizetés igazolásakor), hozzájárulás + Google click ID a rendelésben' : konz ? 'ÚJ vendég (Salonic: új vendég) + a szolgáltatás neve konzult / hajkamer (regex: konzult vagy hajkamer, kis- és nagybetű mindegy); KUPON nélkül; motor-ág gclid / gbraid / wbraid-del' : 'ÚJ vendég (Salonic: új vendég), NEM konzultáció típusú szolgáltatás; KUPON nélkül; motor-ág gclid / gbraid / wbraid-del',
        ertek: ev ? ertekLeiras(ev) : 'tényleges ár (Stripe)',
        belepo_pelda: pelda.map((s) => ({ service_id: s.salonic_service_id, nev: s.service_name_raw, ar: s.active_price, link: `/foglalo-motor?business=${SNAP_UZLETAG[uzletag]}&service=${s.salonic_service_id}` })),
        pillanatkep: snap ? snap.fetched_at : null,
      });
    }
  }

  let commit = null; try { commit = execSync('git rev-parse --short HEAD', { cwd: gyoker, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { /* nincs git */ }
  return {
    generalva: new Date().toISOString(), commit, helyek,
    parameterek: { minta_ar: MINTA_AR, konzultacio_tabla: tabla, arnyek: plat.ARNYEK, elo_celok_tiltva: plat.ELO_CELOK, platformok, ernyoesemenyek: modell.ERNYOESEMENYEK, alapesemenyek: modell.ALAPESEMENYEK },
    szcenariok: SZCENARIOK.map(({ kulcs, cim }) => ({ kulcs, cim })), forras_agak: Object.fromEntries(Object.entries(FORRAS_AGAK).map(([k, v]) => [k, v.leiras])),
    sorok, ajandek_sorok, google_arnyek_akciok: akcioTabla,
  };
}

/** Automatikus megállapítások: a táblából számolva (nem kézzel írt állítások). */
export function megallapitasok(t) {
  const m = [];
  const kuponos = t.sorok.filter((s) => s.kupon && s.esemeny);
  const kuponUzl = [...new Set(kuponos.map((s) => s.uzletag))];
  m.push(kuponos.length
    ? `KUPONOS foglalásra a kód MA is küld eseményt (${kuponUzl.join(', ')}; ${[...new Set(kuponos.map((s) => s.esemeny))].join(', ')}), ezek közül Google-ba: ${kuponos.filter((s) => s.platformok.google.allapot === 'kuldve' && s.forras_ag === 'motor').length ? 'igen (motor-ág, click ID-vel)' : 'nem'}; ernyő-esemény kuponosra nincs. (A #194 elvárása: kuponos foglalásra semmilyen konverziós esemény.)`
    : 'KUPONOS foglalásra a kód NEM küld eseményt (a #194 elvárása teljesül).');
  const sdGoogle = t.sorok.filter((s) => s.forras_ag === 'salonic_direct' && s.platformok && s.platformok.google && s.platformok.google.allapot === 'kuldve');
  m.push(sdGoogle.length ? `A salonic_direct-ág Google-be KÜLD (${sdGoogle.length} sor): ellenőrizendő.` : 'A salonic_direct-ág Google-be soha nem küld (nincs click ID); GA4-be sem (nincs client_id): csak Meta és TikTok.');
  const gk = t.google_arnyek_akciok;
  m.push(`Google ARNYEK-akció: ${gk.length} db (${gk.map((a) => a.akcio_id).join(', ')}); élő azonosító közöttük: ${gk.filter((a) => a.elo_azonosito_e).length}.`);
  const tt = t.sorok.filter((s) => s.platformok && s.platformok.tiktok.allapot === 'kuldve' && s.platformok.tiktok.esemeny_nev === 'CompletePayment');
  m.push(`TikTok CompletePayment csak: ${[...new Set(tt.map((s) => s.uzletag))].join(', ') || '-'} (HeadSpa ernyő).`);
  const konz = Object.entries(t.parameterek.konzultacio_tabla).map(([u, v]) => `${u} ${v} Ft`).join(', ');
  m.push(`Konzultáció-értékek (rögzített tábla): ${konz}; HeadSpa-nak nincs konzultáció-ága (nem keletkezik esemény).`);
  const nyitott = t.sorok.filter((s) => s.ertek_szabaly && /^nyitott/.test(s.ertek_szabaly));
  m.push(nyitott.length ? `NYITOTT értékű esemény (nem megy ki): ${nyitott.length} sor.` : 'Nyitott értékű (nem küldhető) esemény nincs.');
  const vissza = t.sorok.filter((s) => s.esemeny === 'Visszajaro' && s.platformok.google.allapot === 'kuldve');
  m.push(vissza.length ? 'A Visszajaro Google-ba KÜLD: ellenőrizendő.' : 'A Visszajaro (visszatérő vendég) Google-be soha nem megy, ernyő-esemény sincs hozzá.');
  return m;
}

// --- Markdown ----------------------------------------------------------------------------------------------------------------------------------
const cella = (p, v) => {
  if (!p) return '–';
  if (p.allapot === 'kuldve') {
    const x = [`**${p.esemeny_nev}**`]; if (p.ertek !== null && p.ertek !== undefined) x.push(`${p.ertek} ${p.penznem || ''}`.trim()); else x.push('érték nélkül');
    if (p.akcio) x.push(`akció ${p.akcio}${p.click_tipus ? ' (' + p.click_tipus + ')' : ''}`);
    return x.join(', ');
  }
  return `— ${p.allapot}: ${String(p.ok).replace(/\|/g, '/').slice(0, 90)}`;
};
const rovidOk = (s) => { const t = String(s).replace(/^salonic_direct: /, '').replace(/\|/g, '/'); const i = t.indexOf(': '); return (i > 8 && i < 70 ? t.slice(0, i) : t).slice(0, 80); };
const rovid = (p) => (p ? (p.allapot === 'kuldve' ? 'megy' : p.allapot + ' (' + rovidOk(p.ok) + ')') : '–');
const jel = (p) => (p ? [p.allapot, p.esemeny_nev, p.ertek, p.ad_user_data].join('~') : '-');
/** A feltétel-változatok közül CSAK azok, amelyek eltérnek az alap-kimenettől: "változat → platform: mi lesz". */
function valtozatSzoveg(s) {
  const v = s.valtozatok, ki = [];
  for (const p of ['meta', 'tiktok', 'google', 'ga4']) if (v.hozzajarulas_nincs && jel(v.hozzajarulas_nincs[p]) !== jel(s.platformok[p])) ki.push(`hozzájárulás nélkül → ${p}: ${v.hozzajarulas_nincs[p].allapot === 'kuldve' ? 'megy' + (v.hozzajarulas_nincs[p].ad_user_data ? ' (ad_user_data=' + v.hozzajarulas_nincs[p].ad_user_data + ')' : '') : rovid(v.hozzajarulas_nincs[p])}`);
  if (v.google_click_id_nelkul && jel(v.google_click_id_nelkul) !== jel(s.platformok.google)) ki.push(`click ID nélkül → google: ${rovid(v.google_click_id_nelkul)}`);
  if (v.ga4_client_id_nelkul && jel(v.ga4_client_id_nelkul) !== jel(s.platformok.ga4)) ki.push(`GA4 client_id nélkül → ga4: ${rovid(v.ga4_client_id_nelkul)}`);
  if (v.ismeretlen_ar) for (const p of ['meta', 'tiktok', 'ga4']) if (jel(v.ismeretlen_ar[p]) !== jel(s.platformok[p])) ki.push(`ismeretlen ár → ${p}: ${v.ismeretlen_ar[p].allapot === 'kuldve' ? 'érték ' + (v.ismeretlen_ar[p].ertek ?? 'nélkül') : rovid(v.ismeretlen_ar[p])}`);
  return ki.join('; ') || '–';
}
const konvRovid = (k) => (k.igen ? 'igen' : 'nem') + ' – ' + k.miert.replace(/\|/g, '/');
export function markdown(t) {
  const L = [];
  L.push('# Mérés-leképezés: esemény × üzletág × platform (KÓDBÓL exportálva)');
  L.push('');
  L.push(`Generálva: ${t.generalva} · commit: \`${t.commit || '?'}\` · eszköz: \`node tools/meres-lekepezes-export.mjs --md --ki docs/booking-engine/MERES_LEKEPEZES.md\` (újragenerálható; a tábla az éles döntő függvények kimenete, nem kézzel írt).`);
  L.push('');
  L.push('Cél: a Google E2E-próba leképezés-táblája (mérési oldal, #167 6240242371 / 6240456665). Csak az ÁRNYÉK-lánc (netlify/lib/meres/**); élő konverziót nem ír le. A szintetikus bemenetek: minta-ár ' + t.parameterek.minta_ar + ' Ft, platform-teszt kódok, minta-gclid.');
  L.push('');
  L.push('## 1. Forrás-ágak, szabályok, forrás-helyek');
  L.push('');
  for (const [k, v] of Object.entries(t.forras_agak)) L.push(`- **${k}**: ${v}`);
  L.push('- **kártya**: ajándékkártya (HeadSpa) – `ajandek-esemeny.js` + `ajandek.js` (Stripe-webhook / kiállítás); lásd a 4. szakaszt.');
  L.push('');
  L.push('| Szabály | Hely |');
  L.push('|---|---|');
  const leir = { esemenyek: 'melyik esemény keletkezik (alap + ernyő)', foglalasJelleg: 'a foglalás jellege: elso / konzultacio / visszajaro + kupon', ernyoJogosult: 'ernyő-esemény jogosultság (kupon és visszatérő: soha)', headspaKonzNincs: 'HeadSpa: nincs konzultáció-ág (#101)', konzTabla: 'konzultáció-érték tábla', metaKerelem: 'Meta CAPI kérés (csak ARNYEK dataset + test_event_code)', tiktokKerelem: 'TikTok Events API kérés (csak ARNYEK pixel + test_event_code)', tiktokNev: 'TikTok esemény-név (HeadSpa ernyő: CompletePayment, többi üzletág: Schedule)', tiktokCompletePayment: 'TikTok CompletePayment: csak ismert tényleges árral', googleKerelem: 'Google ARNYEK feltöltés (Zapier-webhookon át)', googleAkciok: 'Google ARNYEK-akció azonosítók üzletág × esemény', googleCsakAlap: 'Google-be csak alapesemény megy (visszatérő és ernyő nem)', ga4Kerelem: 'GA4 Measurement Protocol (csak teszt-property)', ga4SdNincsClientId: 'sd-ág: nincs GA4 client_id → GA4 kihagyva', hozzajarulas: 'hozzájárulás-szabály platformonként (SZ-38)', elosztasD5: 'ismeretlen tényleges ár → érték nélkül (D5)', elosztasKikapcsolva: 'vészkapcsoló (mind / üzletág / platform / cella)', motorKuldes: 'motor-ág belépési pont', sdKuldes: 'salonic_direct küldési lépés', sdArFeloldas: 'sd ár-feloldás (zap_ar / szolgáltatás-lista / ismeretlen)', ajandekForras: 'ajándékkártya forrás-entitás (kártya / utalás)', ajandekArnyek: 'ajándékkártya árnyék-elosztás hívása', ajandekEloMeres: 'ÉLŐ (nem árnyék) szerveroldali ajándékkártya-mérés (Zapier-webhook)', ajandekTesztVedelem: 'teszt-védelem (név / e-mail szabály) az ajándékkártya élő mérésében', ajandekIgenyles: 'utalásos igénylés: böngészős dataLayer-esemény (bank_transfer_request, nem konverzió)', zapTesztRegi: 'a "proba" definíciója a napi QA-ban (a tesztFoglalas-szabály a Zapben dől el)' };
  for (const [k, h] of Object.entries(t.helyek)) L.push(`| ${leir[k] || k} | \`${h}\` |`);
  L.push('');
  L.push('Google ARNYEK-ügyfél: `' + t.parameterek.arnyek.google.customerId + '`. Konzultáció-érték tábla: ' + Object.entries(t.parameterek.konzultacio_tabla).map(([u, v]) => `${u} ${v}`).join(', ') + ' Ft.');
  L.push('');
  L.push('## 1b. Automatikus megállapítások (a kódból számolva)');
  L.push('');
  for (const x of megallapitasok(t)) L.push('- ' + x);
  L.push('');
  L.push('## 2. A 10 Google ARNYEK-akció (E2E-próba tábla)');
  L.push('');
  L.push('Élő azonosító egyik sincs közöttük (a `ELO_CELOK.google_primary` tiltólista ellenőrizve). A konverzió csak MOTOR-ágon, Google click ID-vel (gclid / gbraid / wbraid) megy; a salonic_direct-ág Google-be soha nem küld (nincs böngészős adat).');
  L.push('');
  L.push('| ARNYEK-akció | Üzletág | Esemény | Kiváltás | Érték | Belépő-példa (Salonic-pillanatkép' + (t.google_arnyek_akciok[0] && t.google_arnyek_akciok[0].pillanatkep ? ' ' + String(t.google_arnyek_akciok[0].pillanatkep).slice(0, 10) : '') + ', élőben ellenőrizendő) |');
  L.push('|---|---|---|---|---|---|');
  for (const a of t.google_arnyek_akciok) L.push(`| \`${a.akcio_id}\`${a.elo_azonosito_e ? ' ⚠ ÉLŐ' : ''} | ${a.uzletag_nev} | ${a.esemeny} | ${a.kivaltas} | ${a.ertek} | ${a.belepo_pelda.length ? a.belepo_pelda.map((b) => `\`${b.link}\` (${String(b.nev).replace(/\|/g, '/').slice(0, 45)}${b.ar ? ', ' + b.ar + ' Ft' : ''})`).join('<br>') : '–'} |`);
  L.push('');
  L.push('### 2b. Szintetikus Google-feltöltési törzsek (a relay-Zapnak szánt kérés, MINTAADATTAL)');
  L.push('');
  L.push('Ezt küldi a szerver a `GOOGLE_ARNYEK_WEBHOOK_URL` relay-Zapnak (a `googleKerelem()` kimenete; minta-gclid `TESZTGCLID…`, minta-ár ' + t.parameterek.minta_ar + ' Ft, `ad_user_data` = a hozzájárulás). A relay-Zap `dryrun: true` mezővel NEM tölt fel, csak visszaadja a kész Google Ads kérést (`keres`): ez a #193 szintetikus feltöltési napló alapja. Valódi „Elfogadva” csak a 6088874770 fiókhoz tartozó valódi gclid-del lehet (a minta-gclid érvénytelen).');
  L.push('');
  L.push('| ARNYEK-akció | Üzletág / esemény | Webhook-törzs (dryrun: a törzs + `"dryrun": true`) |');
  L.push('|---|---|---|');
  for (const a of t.google_arnyek_akciok) L.push(`| \`${a.akcio_id}\` | ${a.uzletag_nev} / ${a.esemeny} | ${a.szintetikus_feltoltes ? '`' + JSON.stringify(a.szintetikus_feltoltes.body) + '`' : '–'} |`);
  L.push('');
  L.push('## 3. Foglalás-események: üzletág × forrás-ág × szcenárió × platform');
  L.push('');
  L.push('Cellák: **küldendő esemény-név**, érték, (Google: ARNYEK-akció + click ID típus) vagy `— kihagyva / tiltva: ok` (az ok a kód szövege). A „Változatok” oszlop csak azt mutatja, mi VÁLTOZIK az alap-kimenethez képest hozzájárulás nélkül, click ID nélkül, GA4 client_id nélkül, ismeretlen tényleges árral (`–` = nem változik).');
  L.push('');
  for (const uz of [...new Set(t.sorok.map((s) => s.uzletag))]) {
    L.push(`### ${uz}`);
    L.push('');
    for (const ag of Object.keys(t.forras_agak)) {
      L.push(`**${uz} / ${ag}**`);
      L.push('');
      L.push('| Szcenárió | Esemény (típus) | Érték | Konverzió? | Meta | TikTok | GA4 | Google | Változatok |');
      L.push('|---|---|---|---|---|---|---|---|---|');
      for (const s of t.sorok.filter((x) => x.uzletag === uz && x.forras_ag === ag)) {
        if (!s.esemeny) { L.push(`| ${s.szcenario_cim} | — | — | — | ${s.megjegyzes} | | | | |`); continue; }
        L.push(`| ${s.szcenario_cim} | ${s.esemeny} (${s.esemeny_tipus}) | ${s.ertek_szabaly} | ${konvRovid(s.konverzio)} | ${cella(s.platformok.meta)} | ${cella(s.platformok.tiktok)} | ${cella(s.platformok.ga4)} | ${cella(s.platformok.google)} | ${valtozatSzoveg(s)} |`);
      }
      L.push('');
    }
  }
  L.push('## 4. Ajándékkártya-ágak (HeadSpa)');
  L.push('');
  L.push('Az **árnyék**-lánc: `ajandek-esemeny.js` (a HeadSpa-példányban `arnyek: true`). Az **élő** (nem árnyék) szerveroldali vásárlásmérés külön út: `' + t.helyek.ajandekEloMeres + '` (Zapier-webhook, hozzájárulás-függő, teszt-védelem: `' + t.helyek.ajandekTesztVedelem + '`). Az utalásos **igénylés** böngészős esemény: `' + t.helyek.ajandekIgenyles + '` (nem konverzió, az árnyék-lánc nem küldi).');
  L.push('');
  L.push('| Szcenárió | Esemény (típus) | Érték | Meta | TikTok | GA4 | Google |');
  L.push('|---|---|---|---|---|---|---|');
  for (const s of t.ajandek_sorok) {
    if (!s.esemeny) { L.push(`| ${s.szcenario_cim} | — | — | ${s.megjegyzes} | | | |`); continue; }
    L.push(`| ${s.szcenario_cim} | ${s.esemeny} (${s.esemeny_tipus}) | ${s.ertek_szabaly} | ${cella(s.platformok.meta)} | ${cella(s.platformok.tiktok)} | ${cella(s.platformok.ga4)} | ${cella(s.platformok.google)} |`);
  }
  L.push('');
  return L.join('\n') + '\n';
}

// --- CLI ----------------------------------------------------------------------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : null; };
  const has = (n) => process.argv.includes('--' + n);
  const t = await epit({ gyoker: arg('gyoker') ? path.resolve(arg('gyoker')) : ITT });
  const ki = arg('ki');
  const szoveg = has('json') ? JSON.stringify(t, null, 2) + '\n' : markdown(t);
  if (ki) { fs.writeFileSync(ki, szoveg); console.log('kesz: ' + ki + ' (' + szoveg.length + ' karakter, ' + t.sorok.length + ' foglalas-sor + ' + t.ajandek_sorok.length + ' ajandek-sor)'); } else process.stdout.write(szoveg);
}
