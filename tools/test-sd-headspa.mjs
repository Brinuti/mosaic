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
import { ELO_CELOK } from '../netlify/lib/meres/platformok.js';
import { arnyekCel } from '../netlify/lib/meres/qa-nap.js';
import { emailNormal, sha256hex } from '../netlify/lib/meres/hash.js';
import { sdIdentitas, szolgIndexKulcs, szolgKanon, szolgKulcsEgyezik } from '../netlify/lib/meres/salonic-direct.js';
import { SALONIC_UZLETAG, kuponJelzes } from '../netlify/lib/meres/esemeny-modell.js';
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

test('HS-02 (F2 + DECISION #194 / N1) a Zap kuponos levelnel " (kupon)" utotagot fuz a szolgaltatasnevhez: a szolgKanon a ZARO utotagot leveszi (kupon <-> normal azonos kanon), de az index-kulcs (szolgIndexKulcs) a kupon-jelzest MEGTARTJA -> a kuponos <-> normal par NEM azonos kulcs (nem csere-jelolt), kupon <-> kupon az; a szolgKulcsEgyezik szigoru egyenloseg', () => {
  for (const s of SZOLG) {
    const zap = `${s.nev} (kupon)`;
    assert.equal(szolgKanon(zap), szolgKanon(s.nev), `${s.id}: a zaro utotag nem kerul a kanonikus kulcsba`);
    assert.equal(kuponJelzes(s.nev), s.kupon, `${s.id}: a kupon-jelzes a nevbol (KUPONKODDAL elotag)`);
    assert.equal(kuponJelzes(zap), true, `${s.id}: a Zap " (kupon)" utotagja kupon-jelzes`);
  }
  for (const csalad of new Set(SZOLG.map((x) => x.csalad))) {
    const [n, k] = [NORMAL, KUPONOS].map((l) => l.find((x) => x.csalad === csalad));
    assert.equal(szolgKanon(`${n.nev} (kupon)`), szolgKanon(`${k.nev} (kupon)`), `${csalad}: kupon <-> kupon azonos kanon`);
    assert.equal(szolgKanon(`${k.nev} (kupon)`), szolgKanon(n.nev), `${csalad}: kupon <-> normal azonos kanon`);
    const kanon = szolgKanon(n.nev);
    // az index-kulcs: a normal foglalas kulcsa a kanon, a kuponosé `<kanon> kupon` (mindegy, hogy a Zap " (kupon)" utotagot fuzott-e)
    assert.equal(szolgIndexKulcs(n.nev), kanon, `${csalad}: normal -> a kanonikus kulcs`);
    assert.equal(szolgIndexKulcs(k.nev), `${kanon} kupon`, `${csalad}: kuponos -> kanon + kupon`);
    assert.equal(szolgIndexKulcs(`${k.nev} (kupon)`), `${kanon} kupon`, `${csalad}: a Zap " (kupon)" utotagjaval is ugyanaz`);
    assert.equal(szolgIndexKulcs(`${n.nev} (kupon)`), `${kanon} kupon`, `${csalad}: a normal nev + Zap-utotag is kuponos`);
    // szigoru egyezes: kupon <-> normal soha, kupon <-> kupon es normal <-> normal igen
    assert.equal(szolgKulcsEgyezik(szolgIndexKulcs(n.nev), szolgIndexKulcs(k.nev)), false, `${csalad}: normal <-> kuponos NEM egyezik (N1: nem csere-jelolt)`);
    assert.equal(szolgKulcsEgyezik(szolgIndexKulcs(k.nev), szolgIndexKulcs(n.nev)), false, `${csalad}: kuponos <-> normal sem`);
    assert.equal(szolgKulcsEgyezik(szolgIndexKulcs(k.nev), szolgIndexKulcs(`${k.nev} (kupon)`)), true, `${csalad}: kupon <-> kupon egyezik`);
    assert.equal(szolgKulcsEgyezik(szolgIndexKulcs(n.nev), szolgIndexKulcs(n.nev)), true, `${csalad}: normal <-> normal egyezik`);
    assert.equal(szolgKulcsEgyezik(`${kanon} kupon`, kanon), false, `${csalad}: a regi "<kulcs> kupon" tarolt kulcs sem egyezik a kupon-jelzes nelkuli kulccsal (a tolerancia megszunt)`);
    assert.equal(szolgKulcsEgyezik(null, kanon), false); assert.equal(szolgKulcsEgyezik(kanon, null), false);
  }
});

test('HS-03 a 4 NORMAL HeadSpa szolgaltatas, uj vendeg: FoglalasElso + ernyo (Meta: Schedule, TikTok: CompletePayment), Google / GA4 jogos_0; ertek = lista-ar (exact)', async () => {
  for (const s of NORMAL) {
    const { v, u, b, probak } = await jelolt(s.nev);
    assert.deepEqual(probak.map((x) => x.allapot), ['fuggoben', 'fuggoben', 'fuggoben', 'parositatlan'], s.id);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.sd_allapot, r.uzletag, r.jelleg, r.ertek_minoseg, r.ertek_forras], ['kesz', 'kesz', 'headspa', 'elso', 'exact', 'szolgaltatas_lista'], s.id);
    assert.equal(r.sd_id, await sdIdentitas(v.e, u), s.id);
    assert.deepEqual(nevek(v, 'meta'), ['FoglalasElso', 'Schedule'], s.id);
    assert.deepEqual(nevek(v, 'tiktok'), ['FoglalasElso', 'Schedule'], s.id);
    assert.deepEqual(metaTestek(v).map((d) => d.event_name), ['HeadSpa_FoglalasElso', 'Schedule'], s.id);
    assert.deepEqual(tiktokTestek(v).map((d) => d.event), ['HeadSpa_FoglalasElso', 'CompletePayment'], `${s.id}: TikTokon a HeadSpa ernyoje CompletePayment (nem Schedule)`);
    assert.ok(metaTestek(v).every((d) => d.custom_data.value === s.ar && d.custom_data.currency === 'HUF'), s.id);
    assert.ok(tiktokTestek(v).every((d) => d.properties.value === s.ar), s.id);
    for (const p of ['google', 'ga4']) for (const c of cellak(v).filter((x) => x.platform === p)) assert.equal(cellaOsztaly(c).osztaly, 'jogos_0', `${s.id} ${p}: jogos 0 (nem hiany)`);
    assert.ok(cellak(v).every((c) => c.forras === 'salonic_direct'), s.id);
    assert.equal(v.sql('SELECT COUNT(*) AS n FROM meres_kuldes WHERE allapot = ?1', 'elkuldve')[0].n, 4, s.id);
  }
});

test('HS-04 (DECISION #194) a 4 KUPONOS HeadSpa szolgaltatas, uj vendeg: a kuponos (ajandekkartyas) foglalas NEM konverzio - SEMMILYEN esemeny nem megy ki (se FoglalasElso, se Schedule), 0 halozati hivas, 0 meres_kuldes sor; az alapesemeny-jelleg es a kupon-jel rogzul (meres_jelleg.kupon=1), a vendeg-index sor megvan', async () => {
  for (const s of KUPONOS) {
    const { v, b } = await jelolt(s.nev);
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.uzletag, r.jelleg, r.kupon, r.ertek_minoseg], ['kesz', 'headspa', 'elso', true, 'unknown_discount'], s.id);
    assert.deepEqual([r.esemeny_kuldes.allapot, r.esemeny_kuldes.kupon_nem_konverzio], ['nincs_esemeny', true], `${s.id}: a kuldes-eredmeny jelzi, hogy a kupon miatt nincs esemeny`);
    assert.equal(cellak(v).length, 0, `${s.id}: nincs meres_kuldes sor (egyik platformra sem)`);
    assert.equal(v.net.hivasok.length, 0, `${s.id}: 0 kimeno halozati hivas`);
    assert.deepEqual(v.sql('SELECT jelleg, kupon FROM meres_jelleg').map((x) => [x.jelleg, x.kupon]), [['elso', 1]], `${s.id}: a jelleg + kupon-jel rogzul (tartos nyom)`);
    assert.deepEqual(v.sql('SELECT uzletag, szolg_kulcs FROM foglalas_vendeg').map((x) => [x.uzletag, / kupon$/.test(x.szolg_kulcs)]), [['headspa', true]], `${s.id}: a vendeg-index sor kupon-jelzett kulccsal`);
    // ismetelt feldolgozas: tovabbra sincs esemeny, nincs dupla
    const r2 = await v.sd(b);
    assert.equal(r2.allapot, 'kesz', s.id); assert.equal(cellak(v).length, 0, `${s.id}: ismetelve sem`); assert.equal(v.net.hivasok.length, 0);
  }
});

test('HS-05 visszatero vendeg (uj_vendeg=false): a NORMAL foglalas csak Visszajaro (Meta / TikTok), nincs Schedule; Google / GA4 jogos_0 - a KUPONOS visszatero foglalas sem konverzio (DECISION #194): semmilyen esemeny', async () => {
  for (const s of [NORMAL[0], NORMAL[2]]) {
    const { v, b } = await jelolt(s.nev, { uj_vendeg: false });
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.uzletag, r.jelleg], ['kesz', 'headspa', 'visszajaro'], s.id);
    assert.deepEqual(nevek(v, 'meta'), ['Visszajaro'], s.id);
    assert.deepEqual(nevek(v, 'tiktok'), ['Visszajaro'], s.id);
    assert.deepEqual(metaTestek(v).map((d) => d.event_name), ['HeadSpa_Visszajaro'], s.id);
    assert.equal(cellak(v).filter((c) => c.esemeny_nev === 'Schedule').length, 0, s.id);
    for (const p of ['google', 'ga4']) for (const c of cellak(v).filter((x) => x.platform === p)) assert.equal(cellaOsztaly(c).osztaly, 'jogos_0', `${s.id} ${p}`);
  }
  for (const s of [KUPONOS[0], KUPONOS[2]]) {
    const { v, b } = await jelolt(s.nev, { uj_vendeg: false });
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.uzletag, r.jelleg, r.kupon], ['kesz', 'headspa', 'visszajaro', true], s.id);
    assert.equal(r.esemeny_kuldes.kupon_nem_konverzio, true, s.id);
    assert.equal(cellak(v).length, 0, `${s.id}: kuponos visszatero foglalas: nincs meres_kuldes sor`);
    assert.equal(v.net.hivasok.length, 0, `${s.id}: 0 kimeno hivas`);
  }
});

test('HS-06 (F1 javitva, DECISION #192; DECISION #194: a kuponos foglalas nem kuld esemenyt) a kuponos level "E-mail cim:" mezoje az e-mail UTAN a kuponkod-sort is tartalmazza (elvalaszto nelkul is): a normal level em / external_id hash-e a tiszta e-mail hash-e, a kuponos level vendeg-index hash-e UGYANAZ, mint a normal leveleke, a kuponkod sehova nem kerul; nincs e-mail -> nincs index-sor', async () => {
  const s = KUPONOS[0];
  const TISZTA = 'teszt.claude@example.com';
  const kulcsok = (v) => Object.keys(metaTestek(v)[0].user_data);
  const ud = (v, k) => JSON.stringify(metaTestek(v)[0].user_data[k]);
  const tel = '+36 30 000 0001';
  // kontroll: a normal levelnel (egyetlen e-mail token)
  const kontroll = await jelolt(NORMAL[0].nev, { vendeg: { email: TISZTA, telefon: tel } });
  await kontroll.v.sd(kontroll.b);
  assert.deepEqual(kulcsok(kontroll.v), ['em', 'ph', 'external_id', 'fn', 'ln', 'country']); // DECISION #202: + fn / ln (a bejovo `nev`-bol, csak hash) + country
  const emH = await sha256hex(TISZTA);
  assert.ok(ud(kontroll.v, 'em').includes(emH) && ud(kontroll.v, 'external_id').includes(emH));
  const indexH = kontroll.v.sql('SELECT email_h FROM foglalas_vendeg')[0].email_h;
  assert.ok(/^[0-9a-f]{32}$/.test(indexH));
  // a kuponos level e-mail mezojenek lehetseges alakjai (3 valos level szerkezete: az e-mail, kozvetlenul utana a kuponkod-sor, elvalaszto biztositasa nelkul)
  const alakok = [
    ['szokozzel', `${TISZTA} Kupon kód: KUPXYZ9`],
    ['ujsorral', `${TISZTA}\nKupon kód: KUPXYZ9`],
    ['elvalaszto nelkul (osszeer)', `${TISZTA}Kupon kód: KUPXYZ9`],
    ['nagybetuvel, tobb szokozzel', `  ${TISZTA.toUpperCase()}   KUPON KÓD:  KUPXYZ9 `],
    ['ekezet nelkul, kettospont utan szokoz nelkul', `${TISZTA} Kupon kod:KUPXYZ9`],
    ['angol cimke', `${TISZTA} Coupon code: KUPXYZ9`],
    ['rovid cimke, osszeerve', `${TISZTA}Kupon:KUPXYZ9`],
  ];
  for (const [nev, email] of alakok) {
    assert.equal(emailNormal(email), TISZTA, `${nev}: az emailNormal a tiszta e-mailt adja`);
    const { v, b } = await jelolt(`${s.nev} (kupon)`, { vendeg: { email, telefon: tel } });
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.uzletag, r.jelleg, r.ertek_minoseg], ['kesz', 'headspa', 'elso', 'unknown_discount'], nev);
    // DECISION #194: a kuponos foglalas nem konverzio -> nincs kimeno esemeny; az F1 hatasa a vendeg-indexben latszik (a csere-felismeres a kuponos <-> kuponos parra tovabbra is mukodik)
    assert.equal(cellak(v).length, 0, `${nev}: kuponos foglalas: nincs esemeny`);
    assert.equal(v.net.hivasok.length, 0, `${nev}: 0 kimeno hivas`);
    assert.deepEqual(v.sql('SELECT email_h FROM foglalas_vendeg').map((x) => x.email_h), [indexH], `${nev}: a vendeg-index HMAC azonos a normal levelevel (az F1 az ELSO e-mail-szeru tokent hasheli)`);
    const mind = JSON.stringify(v.net.hivasok) + JSON.stringify(v.sql('SELECT * FROM meres_kuldes')) + JSON.stringify(v.sql('SELECT * FROM foglalas_egyeztetes')) + JSON.stringify(v.sql('SELECT * FROM foglalas_vendeg'));
    assert.ok(!/kupxyz9/i.test(mind), `${nev}: a kuponkod nyersen nem kerul ki / a naploba / az indexbe`);
  }
  // nincs e-mail: nincs index-sor, a kuponkod ekkor sem kerul sehova (es a kuponos foglalas ugyis nem kuld esemenyt)
  for (const [nev, email] of [['ures', ''], ['csak kuponkod', 'Kupon kód: KUPXYZ9']]) {
    assert.equal(emailNormal(email), null, nev);
    const { v, b } = await jelolt(`${s.nev} (kupon)`, { vendeg: { email, telefon: tel } });
    const r = await v.sd(b);
    assert.deepEqual([r.allapot, r.uzletag], ['kesz', 'headspa'], nev);
    assert.equal(cellak(v).length, 0, `${nev}: nincs esemeny`);
    assert.equal(v.sql('SELECT COUNT(*) AS n FROM foglalas_vendeg')[0].n, 0, `${nev}: nincs e-mail -> nincs index-sor`);
    const mind = JSON.stringify(v.net.hivasok) + JSON.stringify(v.sql('SELECT * FROM meres_kuldes')) + JSON.stringify(v.sql('SELECT * FROM foglalas_egyeztetes'));
    assert.ok(!/kupxyz9/i.test(mind), `${nev}: a kuponkod nem kerul ki`);
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

test('HS-08 SZARAZ terv a HeadSpa-kapcsolo bekapcsolasa mellett: a D1 nem valtozik, nem kuld; ismetelve azonos terv; a terv esemenyei (id, nev, tipus, ertek) azonosak az utana lefuto eles sd celláival', async () => {
  const { v, b } = await jelolt(NORMAL[2].nev);
  const elotte = dump(v);
  const terv = await v.sd({ ...b, szaraz: true });
  assert.equal(terv.allapot, 'szaraz_terv');
  assert.equal(terv.uzletag, 'headspa');
  assert.equal(dump(v), elotte, 'a szaraz terv nem ir');
  assert.equal(v.net.hivasok.length, 0, 'a szaraz terv nem kuld');
  const masodik = await v.sd({ ...b, szaraz: true });
  assert.deepEqual(masodik.terv, terv.terv, 'ismetelve azonos terv'); assert.equal(dump(v), elotte); assert.equal(v.net.hivasok.length, 0);
  assert.deepEqual([terv.terv.jelleg, terv.terv.kupon, terv.terv.ertek_minoseg, terv.terv.ertek_forras], ['elso', false, 'exact', 'szolgaltatas_lista']);
  const el = await v.sd(b);
  assert.deepEqual([el.allapot, el.uzletag], ['kesz', 'headspa']);
  const tervE = terv.terv.terv_esemenyek.map((e) => [e.esemeny_id, e.nev, e.tipus, e.ertek]).sort();
  const eloE = [...new Map(cellak(v).map((c) => [c.esemeny_nev, c])).values()].map((c) => [c.esemeny_nev, c.esemeny_tipus, c.ertek]);
  assert.deepEqual(tervE.map(([, nev, tipus, ertek]) => [nev, tipus, ertek]).sort(), eloE.sort(), 'a terv esemenyei = az eles cellak esemenyei');
  const sdId = await sdIdentitas(v.e, b.uuid);
  assert.ok(terv.terv.terv_esemenyek.every((e) => e.esemeny_id.endsWith(`:${sdId}`)), 'a terv azonositoi az sd identitasbol kepzodnek');
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

test('HS-11 a HeadSpa sd kimenet: minden kiment kerelem ARNYEK-cel (arnyekCel), nincs elo ID; a nyers vendegadat (e-mail, telefon, nev) es a szolgaltatasnev nincs a kimeno kerelmekben, es a D1-ben sincs nyers e-mail / telefon / nev', async () => {
  const { v, b } = await jelolt(NORMAL[0].nev);
  await v.sd(b);
  const kiment = v.sql("SELECT platform, kerelem FROM meres_kuldes WHERE allapot = 'elkuldve'");
  assert.equal(kiment.length, 4, 'Meta + TikTok x (alap + ernyo)');
  for (const k of kiment) assert.ok(arnyekCel({ platform: k.platform, kerelem: k.kerelem }, { GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001' }), `${k.platform}: a cel nem ARNYEK`);
  const hivasok = JSON.stringify(v.net.hivasok);
  for (const id of [...ELO_CELOK.meta, ...ELO_CELOK.tiktok, ...ELO_CELOK.ga4, ...ELO_CELOK.google_primary]) assert.ok(!hivasok.includes(String(id)) && !JSON.stringify(kiment).includes(String(id)), `elo ID a kerelemben: ${id}`);
  assert.ok(v.net.hivasok.length === 4 && v.net.hivasok.every((h) => /^(meta|tiktok)$/.test(h.kulcs)), 'csak a Meta es a TikTok hivasa');
  for (const h of v.net.hivasok) assert.ok(!/head spa kezel|hajsz|PÁROS|EGYÉNI|Relax/i.test(JSON.stringify(h.body)), `${h.kulcs}: szolgaltatasnev nincs a kimeno payloadban`);
  const d1 = JSON.stringify(v.sql('SELECT * FROM meres_kuldes')) + JSON.stringify(v.sql('SELECT * FROM foglalas_vendeg')) + JSON.stringify(v.sql('SELECT * FROM foglalas_egyeztetes'));
  for (const tiltott of ['teszt.claude@example.com', '+36 30 000 0001', '36300000001', 'Teszt Claude', 'Teszt Terapeuta']) assert.ok(!(hivasok + d1).includes(tiltott), tiltott);
});

test('HS-12 a globalis `salonic_direct` sor (uzletag nelkul) a HeadSpat IS bekapcsolja, ha nincs `salonic_direct:headspa` sor; az uzletag-sor 0 felulirja - ezert a bekapcsolas elott a globalis sornak hianyoznia KELL (ma: nincs)', async () => {
  const { v, b } = await jelolt(NORMAL[0].nev, {}, { kapcsolo: 'mind' }); // `mind` = a globalis salonic_direct sor (NEM a meres_kapcsolo `mind` fo-kuldesi kulcsa)
  assert.deepEqual(v.sql("SELECT kulcs, be FROM meres_kapcsolo WHERE kulcs LIKE 'salonic_direct%'"), [{ kulcs: 'salonic_direct', be: 1 }]);
  const be = await v.sd(b);
  assert.deepEqual([be.allapot, be.uzletag], ['kesz', 'headspa'], 'a globalis sor 1 -> a HeadSpa is megy (uzletag-sor nelkul)');
  await v.kapcsol('headspa', false); // az uzletag-sor felulirja a globalis sort
  const u2 = ujUuid(); const b2 = hsLevel(u2, KUPONOS[0].nev); await lezar(v, b2); v.t.set(SD_ELOTT + 4000_000);
  const ki = await v.sd(b2);
  assert.deepEqual([ki.allapot, ki.miert], ['ki', 'a salonic_direct kapcsolo ki: salonic_direct:headspa']);
});
