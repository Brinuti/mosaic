// SALONIC-DIRECT - HEADSPA ELOKESZITES (DECISION #191, #167 6235475561) - OFFLINE TESZTEK
//   node --test tools/test-sd-headspa.mjs
// A HeadSpa salonic_direct (sd) agat a VALOS HeadSpa szolgaltatasnevekkel probalja (8 db, a Salonic-fiok nevtablajabol: salonic_nevtabla, place_id 10427, 2026-10-17),
// a meglevo sd-teszt-keretben (tools/lib-sd-teszt.mjs: valodi SQLite, hamis halozat, hamis ora). SEMMI nem megy ki a halozatra, nincs titok, nincs kodvaltoztatas:
// ez a "szaraz-proba": a `salonic_direct:headspa` kapcsolo BEKAPCSOLASA ELOTT bizonyitja, mit tenne a kod HeadSpara. A kapcsolot ez a fajl NEM allitja az eloben.
// A tesztek a mai (main) viselkedest rogzitik, ezert olyan allitasok is vannak, amelyek ISMERT KORLATOT irnak le (pl. a Zap " (kupon)" utotagja), lasd docs/booking-engine/SALONIC_DIRECT_HEADSPA.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HOSTOK, kulcsIras, nevtablaMent } from '../netlify/lib/foglalas-kulcs.js';
import { cellaOsztaly } from '../netlify/lib/meres/egyeztetes-sor.js';
import { emailNormal } from '../netlify/lib/meres/hash.js';
import { sdIdentitas, szolgKanon } from '../netlify/lib/meres/salonic-direct.js';
import { SALONIC_UZLETAG } from '../netlify/lib/meres/esemeny-modell.js';
import { T0, level, lezar, ujUuid, vilag } from './lib-sd-teszt.mjs';

const HOST = 'mosaicheadspa.salonic.hu';
const PLACE = 10427;
const SD_ELOTT = T0 + 1300_000; // a letrehozo level utan ~21,7 perccel (a Zap 5. lepese)
// A valos HeadSpa-fiok szolgaltatasai (id, nev, lista-ar Ft, kupon?, csalad). A nevek betuhiven: emoji, idezojel, KUPONKODDAL elotag.
const SZOLG = Object.freeze([
  { id: '302342', nev: '💆‍♀️ EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás', ar: 26900, kupon: false, csalad: 'egyeni-relax' },
  { id: '302499', nev: '💆‍♀️ EGYÉNI 50 perces MOSAIC "Hair" Head Spa kezelés + 30 perc hajszárítás', ar: 26900, kupon: false, csalad: 'egyeni-hair' },
  { id: '302999', nev: '💆‍♀️💆‍♀️ PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)', ar: 53800, kupon: false, csalad: 'paros' },
  { id: '431713', nev: '💆‍♀️ NÉGYKEZES EGYÉNI 50 perces MOSAIC Head Spa kezelés + 30 perc hajszárítás', ar: 39900, kupon: false, csalad: 'negykezes' },
  { id: '303705', nev: 'KUPONKÓDDAL - 💆‍♀️ EGYÉNI 50 perces MOSAIC "Relax" Head Spa kezelés + 30 perc hajszárítás', ar: 26900, kupon: true, csalad: 'egyeni-relax' },
  { id: '303785', nev: 'KUPONKÓDDAL - 💆‍♀️ EGYÉNI 50 perces MOSAIC "Hair" Head Spa kezelés + 30 perc hajszárítás', ar: 26900, kupon: true, csalad: 'egyeni-hair' },
  { id: '303891', nev: 'KUPONKÓDDAL - 💆‍♀️💆‍♀️ PÁROS MOSAIC Head Spa kezelés (50 perc + Szárítás)', ar: 53800, kupon: true, csalad: 'paros' },
  { id: '431710', nev: 'KUPONKÓDDAL - 💆‍♀️ NÉGYKEZES EGYÉNI 50 perces MOSAIC Head Spa kezelés + 30 perc hajszárítás', ar: 39900, kupon: true, csalad: 'negykezes' },
]);
const NORMAL = SZOLG.filter((s) => !s.kupon);
const KUPONOS = SZOLG.filter((s) => s.kupon);
const TERAPEUTA = { employeeId: 24989, nev: 'Teszt Terapeuta' };

const nevtabla = (v) => nevtablaMent(v.db, {
  helyek: [{ placeId: PLACE, nev: 'Mosaic Headspa' }],
  munkatarsak: [{ placeId: PLACE, employeeId: TERAPEUTA.employeeId, nev: TERAPEUTA.nev }],
  szolgaltatasok: SZOLG.map((s) => ({ placeId: PLACE, serviceId: s.id, nev: s.nev })),
  arak: SZOLG.map((s) => ({ placeId: PLACE, serviceId: s.id, ar: s.ar })),
}, T0);
const hsLevel = (uuid, szolgaltatas, mod = {}) => level(uuid, { host: HOST, felado: 'Mosaic Headspa', szolgaltatas, munkatarsak: [TERAPEUTA.nev], uj_vendeg: true, ...mod });
/** HeadSpa sd-jelolt: nevtabla + a letrehozo level + a motor 4 proba (parositatlan, nincs kulcs-iras); az ora a Zap 5. lepesenel. kapcsolo: 'headspa' (alap) | 'pmu' | 'mind' | null. */
async function jelolt(szolgaltatas, mod = {}, { kapcsolo = 'headspa' } = {}) {
  const v = vilag({ kapcsolo }); await v.kesz; await nevtabla(v);
  const u = ujUuid(); const b = hsLevel(u, szolgaltatas, mod);
  const probak = await lezar(v, b); v.t.set(SD_ELOTT);
  return { v, u, b, probak };
}
const cellak = (v) => v.sql('SELECT esemeny_nev, esemeny_tipus, platform, allapot, indok, ertek, ertek_minoseg, forras FROM meres_kuldes ORDER BY id');
const nevek = (v, platform) => cellak(v).filter((c) => c.platform === platform && c.allapot === 'elkuldve').map((c) => c.esemeny_nev);
const metaTestek = (v) => v.net.hivasok.filter((h) => h.kulcs === 'meta').map((h) => h.body.data[0]);
const tiktokTestek = (v) => v.net.hivasok.filter((h) => h.kulcs === 'tiktok').map((h) => h.body.data[0]);
const TABLAK = ['foglalas_egyeztetes', 'foglalas_vendeg', 'foglalas_kulcs', 'meres_kuldes', 'meres_jelleg', 'meres_kapcsolo', 'foglalas_alias', 'foglalas_reschedule'];
const tablaVan = (v, t) => v.sql("SELECT name FROM sqlite_master WHERE type='table' AND name = ?1", t).length > 0;
const dump = (v) => JSON.stringify(TABLAK.map((t) => { const r = tablaVan(v, t) ? v.sql(`SELECT * FROM ${t}`) : []; return r.length ? r : null; }));

test('HS-01 a HeadSpa uzletag es host az sd szamara ismert (SALONIC_UZLETAG / HOSTOK / placeId), es a 8 valos szolgaltatasnev 4 kanonikus kulcsra esik', () => {
  assert.equal(SALONIC_UZLETAG[HOST], 'headspa');
  assert.equal(HOSTOK[HOST].placeId, PLACE);
  const csoportok = new Map();
  for (const s of SZOLG) { const k = szolgKanon(s.nev); assert.ok(k, s.id); (csoportok.get(k) || csoportok.set(k, []).get(k)).push(s); }
  assert.equal(csoportok.size, 4, 'Relax, Hair, Paros, Negykezes - a kuponos valtozat UGYANARRA a kulcsra esik, mint a normal');
  for (const lista of csoportok.values()) {
    assert.deepEqual(lista.map((s) => s.kupon).sort(), [false, true], 'minden kanonikus kulcshoz pontosan egy normal es egy kuponos szolgaltatas tartozik');
    assert.equal(new Set(lista.map((s) => s.csalad)).size, 1);
  }
  assert.notEqual(szolgKanon(SZOLG[0].nev), szolgKanon(SZOLG[1].nev), 'Relax != Hair');
  // a valos D1-ben (foglalas_vendeg.szolg_kulcs, 10-15) latott ket HeadSpa-kulcs a nevtablabol is eloall
  for (const k of ['egyeni 50 perces mosaic relax head spa kezeles 30 perc hajszaritas', 'paros mosaic head spa kezeles 50 perc szaritas']) assert.ok(csoportok.has(k), k);
});

test('HS-02 ISMERT KORLAT: a Zap kuponos levelnel " (kupon)" utotagot fuz a szolgaltatasnevhez (subject: KUPONKOD) - ez mas kanonikus kulcsot ad, mint a normal szolgaltatas; a kupon-felismeres es az ertek ettol fuggetlen', () => {
  for (const s of SZOLG) {
    const zap = `${s.nev} (kupon)`;
    assert.equal(szolgKanon(zap), szolgKanon(zap), 'stabil');
    assert.ok(szolgKanon(zap).endsWith(' kupon') && szolgKanon(zap).startsWith(szolgKanon(s.nev)), 'az utotag a kulcs veget bovitI (nem vagja le)');
  }
  // a reschedule-egyeztetes (azonos vendeg + azonos kanonikus kulcs) kupon <-> normal kozott igy NEM talal; kupon <-> kupon kozott igen
  assert.notEqual(szolgKanon(NORMAL[0].nev), szolgKanon(`${KUPONOS[0].nev} (kupon)`));
  assert.equal(szolgKanon(`${KUPONOS[0].nev} (kupon)`), szolgKanon(`${KUPONOS[0].nev} (kupon)`));
});

test('HS-03 a 4 NORMAL HeadSpa szolgaltatas, uj vendeg: FoglalasElso + Schedule (Meta, TikTok), Google / GA4 jogos_0; ertek = lista-ar (exact)', async () => {
  for (const s of NORMAL) {
    const { v, u, b, probak } = await jelolt(s.nev);
    assert.deepEqual(probak.map((x) => x.allapot), ['fuggoben', 'fuggoben', 'fuggoben', 'parositatlan'], s.id);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.sd_allapot, r.uzletag, r.jelleg, r.ertek_minoseg, r.ertek_forras], ['kesz', 'kesz', 'headspa', 'elso', 'exact', 'szolgaltatas_lista'], s.id);
    assert.equal(r.sd_id, await sdIdentitas(v.e, u), s.id);
    assert.deepEqual(nevek(v, 'meta'), ['FoglalasElso', 'Schedule'], s.id);
    assert.deepEqual(nevek(v, 'tiktok'), ['FoglalasElso', 'Schedule'], s.id);
    assert.deepEqual(metaTestek(v).map((d) => d.event_name), ['HeadSpa_FoglalasElso', 'Schedule'], s.id);
    assert.ok(metaTestek(v).every((d) => d.custom_data.value === s.ar && d.custom_data.currency === 'HUF'), s.id);
    assert.ok(tiktokTestek(v).every((d) => d.properties.value === s.ar), s.id);
    for (const p of ['google', 'ga4']) for (const c of cellak(v).filter((x) => x.platform === p)) assert.equal(cellaOsztaly(c).osztaly, 'jogos_0', `${s.id} ${p}: jogos 0 (nem hiany)`);
    assert.ok(cellak(v).every((c) => c.forras === 'salonic_direct'), s.id);
    assert.equal(v.sql('SELECT COUNT(*) AS n FROM meres_kuldes WHERE allapot = ?1', 'elkuldve')[0].n, 4, s.id);
  }
});

test('HS-04 a 4 KUPONOS HeadSpa szolgaltatas, uj vendeg: csak FoglalasElso (nincs Schedule), ERTEK NELKUL (unknown_discount); a lista-ar nem megy ki', async () => {
  for (const s of KUPONOS) {
    const { v, b } = await jelolt(s.nev);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.uzletag, r.jelleg, r.ertek_minoseg], ['kesz', 'headspa', 'elso', 'unknown_discount'], s.id);
    assert.match(r.ertek_forras, /^kedvezmeny_gyanu/, s.id);
    assert.deepEqual(nevek(v, 'meta'), ['FoglalasElso'], `${s.id}: kupon -> nincs ernyoesemeny`);
    assert.deepEqual(nevek(v, 'tiktok'), ['FoglalasElso'], s.id);
    assert.equal(cellak(v).filter((c) => c.esemeny_nev === 'Schedule').length, 0, s.id);
    assert.deepEqual(metaTestek(v).map((d) => d.event_name), ['HeadSpa_FoglalasElso'], s.id);
    assert.ok(metaTestek(v).every((d) => !('value' in d.custom_data) && !('currency' in d.custom_data)), `${s.id}: ertek nelkul`);
    assert.ok(tiktokTestek(v).every((d) => !('value' in d.properties)), s.id);
  }
});

test('HS-05 visszatero vendeg (uj_vendeg=false), normal es kuponos: csak Visszajaro (Meta / TikTok), nincs Schedule; Google / GA4 jogos_0', async () => {
  for (const s of [NORMAL[0], KUPONOS[0], NORMAL[2], KUPONOS[2]]) {
    const { v, b } = await jelolt(s.nev, { uj_vendeg: false });
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.uzletag, r.jelleg], ['kesz', 'headspa', 'visszajaro'], s.id);
    assert.deepEqual(nevek(v, 'meta'), ['Visszajaro'], s.id);
    assert.deepEqual(nevek(v, 'tiktok'), ['Visszajaro'], s.id);
    assert.deepEqual(metaTestek(v).map((d) => d.event_name), ['HeadSpa_Visszajaro'], s.id);
    assert.equal(cellak(v).filter((c) => c.esemeny_nev === 'Schedule').length, 0, s.id);
    for (const p of ['google', 'ga4']) for (const c of cellak(v).filter((x) => x.platform === p)) assert.equal(cellaOsztaly(c).osztaly, 'jogos_0', `${s.id} ${p}`);
  }
});

test('HS-06 a Zap kuponos levelenek VALOS alakja (" (kupon)" utotag + az "E-mail cim:" mezo nem egyetlen e-mail token): az sd lefut, de az esemeny em NELKUL megy ki, nincs vendeg-index sor, az external_id pedig a TELJES szovegbol kepzett hash (mas, mint a vendeg tiszta e-mailjebol) - ez a mai eles kuponos HeadSpa esemenyek tuneteit reprodukalja', async () => {
  const s = KUPONOS[0];
  const TISZTA = 'teszt.claude@example.com';
  const kulcsok = (v) => Object.keys(metaTestek(v)[0].user_data);
  const extId = (v) => JSON.stringify(metaTestek(v)[0].user_data.external_id);
  const kimenet = {};
  const esetek = [
    ['ures', { vendeg: { email: '', telefon: '+36 30 000 0001' } }, ['ph']], // nincs e-mail: csak a telefon-hash
    ['kuponkoddal', { vendeg: { email: `${TISZTA} Kuponkód: ABC123`, telefon: '+36 30 000 0001' } }, ['ph', 'external_id']], // egy mezoben az e-mail es a kuponkod szovege (a nem-mohon "E-mail cim:" regex ezt fogna)
  ];
  for (const [nev, mod, varhato] of esetek) {
    assert.equal(emailNormal(mod.vendeg.email), null, `${nev}: az emailNormal elutasitja (nem egyetlen e-mail token)`);
    const { v, b } = await jelolt(`${s.nev} (kupon)`, mod);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.uzletag, r.jelleg, r.ertek_minoseg], ['kesz', 'headspa', 'elso', 'unknown_discount'], nev);
    assert.deepEqual(nevek(v, 'meta'), ['FoglalasElso'], nev);
    assert.ok(!kulcsok(v).includes('em'), `${nev}: nincs e-mail-hash`);
    assert.deepEqual(kulcsok(v), varhato, `${nev}: user_data kulcsok`);
    assert.equal(v.sql('SELECT COUNT(*) AS n FROM foglalas_vendeg')[0].n, 0, `${nev}: nincs ervenyes e-mail -> nincs index-sor`);
    assert.ok(!JSON.stringify(v.net.hivasok).includes('ABC123') && !JSON.stringify(v.sql('SELECT * FROM meres_kuldes')).includes('ABC123'), `${nev}: a kuponkod nyersen nem kerul ki / a naploba`);
    kimenet[nev] = v.net.hivasok.length ? extId(v) : null;
  }
  { // kontroll: a tiszta e-mail (a normal levelnel is) em + external_id; az external_id MAS, mint a kuponkodos szovegbol kepzett
    const { v, b } = await jelolt(NORMAL[0].nev, { vendeg: { email: TISZTA, telefon: '+36 30 000 0001' } });
    await v.sd(b);
    assert.deepEqual(kulcsok(v), ['em', 'ph', 'external_id']);
    assert.equal(v.sql('SELECT COUNT(*) AS n FROM foglalas_vendeg')[0].n, 1);
    assert.notEqual(extId(v), kimenet.kuponkoddal, 'ugyanaz a vendeg a kuponos levelben MAS external_id-t kap (a vendeg nem azonosithato a ket foglalas kozott)');
  }
});

test('HS-07 kapcsolo-elkulonites es visszagorgetes: salonic_direct:pmu=1 NEM kapcsolja be a HeadSpat; salonic_direct:headspa=1 be, =0 ki; a PMU-t nem erinti', async () => {
  const { v, b } = await jelolt(NORMAL[0].nev, {}, { kapcsolo: 'pmu' }); // csak a PMU-sor van (az eles mostani allapota: mind=1, oxigen=1, pmu=1, headspa NINCS)
  const ki = await v.sd(b);
  assert.deepEqual([ki.allapot, ki.miert], ['ki', 'a salonic_direct kapcsolo nincs bekapcsolva (alap: ki)']);
  assert.equal(v.net.hivasok.length, 0); assert.equal(cellak(v).length, 0);
  assert.equal(v.sql('SELECT COUNT(*) AS n FROM foglalas_egyeztetes WHERE sd_id IS NOT NULL')[0].n, 0, 'nincs atvetel');
  await v.kapcsol('headspa', true);
  const be = await v.sd(b);
  assert.deepEqual([be.allapot, be.uzletag], ['kesz', 'headspa']);
  const n = v.net.hivasok.length; assert.ok(n >= 4);
  // visszagorgetes: az uzletag-sor 0 -> a kovetkezo HeadSpa-level nem kuld, a mar kesz sor nem valtozik
  await v.kapcsol('headspa', false);
  const u2 = ujUuid(); const b2 = hsLevel(u2, KUPONOS[1].nev, { uj_vendeg: true });
  await lezar(v, b2); v.t.set(SD_ELOTT + 4000_000);
  const ki2 = await v.sd(b2);
  assert.deepEqual([ki2.allapot, ki2.miert], ['ki', 'a salonic_direct kapcsolo ki: salonic_direct:headspa']);
  assert.equal(v.net.hivasok.length, n, 'a visszagorgetes utan 0 uj kuldes');
  assert.equal(v.sql("SELECT sd_allapot FROM foglalas_egyeztetes WHERE uuid = ?1", b.uuid)[0].sd_allapot, 'kesz', 'a korabbi sor valtozatlan');
  // a PMU (a vilag `pmu` kapcsolojaval indult: salonic_direct:pmu=1) a HeadSpa-kapcsolo kikapcsolasatol fuggetlenul tovabb megy
  const pu = ujUuid(); const pb = level(pu, { uj_vendeg: false });
  await lezar(v, pb); v.t.set(SD_ELOTT + 8000_000);
  const pr = await v.sd(pb);
  assert.deepEqual([pr.allapot, pr.uzletag], ['kesz', 'pmu'], 'a kapcsolok uzletagonkent fuggetlenek');
});

test('HS-08 SZARAZ terv a HeadSpa-kapcsolo bekapcsolasa mellett: a D1 nem valtozik, nem kuld; a terv azonos az ujrafuttatassal; az eles sd ezutan ugyanazt csinalja', async () => {
  const { v, b } = await jelolt(NORMAL[2].nev);
  const elotte = dump(v);
  const terv = await v.sd({ ...b, szaraz: true });
  assert.equal(terv.allapot, 'szaraz_terv');
  assert.equal(terv.uzletag, 'headspa');
  assert.equal(dump(v), elotte, 'a szaraz terv nem ir');
  assert.equal(v.net.hivasok.length, 0, 'a szaraz terv nem kuld');
  const el = await v.sd(b);
  assert.deepEqual([el.allapot, el.uzletag], ['kesz', 'headspa']);
  assert.equal(nevek(v, 'meta').length, 2);
});

test('HS-09 a motor mar kuldott a HeadSpa-foglalasra (kulcs-iras + parositas): az sd_atvetel motor_kuldte, 0 uj kuldes, nincs atvetel (a mai HeadSpa-foglalasok tobbsege ez)', async () => {
  const v = vilag({ kapcsolo: 'headspa' }); await v.kesz; await nevtabla(v);
  const s = NORMAL[0]; const u = ujUuid(); const bid = 'mb_0muwq2ciorsos0tznsfyli1';
  const start = Math.round(Date.parse('2026-10-20T16:00:00+02:00') / 1000); // = level().ld.startDate
  await kulcsIras(v.db, { bookingId: bid, bookingUrl: `https://${HOST}/guestData/?anyone=true&employeeId=${TERAPEUTA.employeeId}&placeId=${PLACE}&serviceId=${s.id}&startDate=${start}&back=${bid}` }, v.t());
  const b = hsLevel(u, s.nev);
  const p = await v.post(b);
  assert.deepEqual([p.allapot, p.kuldheto, p.booking_id], ['parositott', true, bid], 'a motoros parositas a HeadSpa-levelre mukodik');
  const n = v.net.hivasok.length; assert.ok(n >= 4, 'a motor kuldte az esemenyeket');
  v.t.set(SD_ELOTT);
  const r = await v.sd(b);
  assert.deepEqual([r.allapot, r.kuldes, r.booking_id], ['motor_kuldte', 0, bid]);
  assert.equal(v.net.hivasok.length, n, 'az sd nem kuldott ujra');
  assert.equal(v.sql('SELECT sd_id FROM foglalas_egyeztetes WHERE uuid = ?1', u)[0].sd_id, null, 'nincs sd atvetel');
  assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE forras = 'salonic_direct'")[0].n, 0);
});

test('HS-10 ugyanarra a Salonic-UUID-ra erkezo masodik level (paros: eltero "uj vendeg" jelzes): idempotens, egy alapesemeny-tipus, nincs dupla', async () => {
  const { v, b } = await jelolt(NORMAL[2].nev, { uj_vendeg: true });
  const elso = await v.sd(b);
  assert.deepEqual([elso.allapot, elso.jelleg], ['kesz', 'elso']);
  const n = v.net.hivasok.length; const sorok = cellak(v).length;
  const masodik = await v.sd({ ...b, uj_vendeg: false });
  assert.equal(masodik.allapot, 'kesz');
  assert.equal(v.net.hivasok.length, n, '0 uj kuldes');
  assert.equal(cellak(v).length, sorok, '0 uj cella');
  assert.deepEqual([...new Set(cellak(v).filter((c) => c.esemeny_tipus === 'alap').map((c) => c.esemeny_nev))], ['FoglalasElso']);
  assert.equal(v.sql("SELECT COUNT(*) AS n FROM meres_kuldes WHERE esemeny_nev = 'Visszajaro'")[0].n, 0);
  const dupla = v.sql("SELECT COUNT(*) AS n FROM (SELECT 1 FROM meres_kuldes WHERE allapot = 'elkuldve' GROUP BY salonic_uuid, esemeny_nev, platform HAVING COUNT(*) > 1)")[0].n;
  assert.equal(dupla, 0);
});

test('HS-11 a HeadSpa sd kimenet csak ARNYEK-celra megy, nyers vendegadat / kuponkod / szolgaltatasnev nincs a kerelmekben es a D1-ben', async () => {
  const { v, b } = await jelolt(NORMAL[0].nev);
  await v.sd(b);
  const mind = JSON.stringify(v.net.hivasok) + JSON.stringify(v.sql('SELECT * FROM meres_kuldes')) + JSON.stringify(v.sql('SELECT * FROM foglalas_vendeg')) + JSON.stringify(v.sql('SELECT * FROM foglalas_egyeztetes'));
  for (const tiltott of ['teszt.claude@example.com', '+36 30 000 0001', '36300000001', 'Teszt Claude', 'Teszt Terapeuta']) assert.ok(!mind.includes(tiltott), tiltott);
  for (const h of v.net.hivasok) assert.ok(!/head spa kezel|hajsz|PÁROS|EGYÉNI|Relax/i.test(JSON.stringify(h.body)), `${h.kulcs}: szolgaltatasnev nincs a payloadban`);
  for (const h of v.net.hivasok.filter((x) => x.kulcs === 'meta')) assert.ok(h.url.includes('graph.facebook.com'), h.url);
  assert.ok(v.net.hivasok.every((h) => /^(meta|tiktok|google|ga4)$/.test(h.kulcs)));
});
