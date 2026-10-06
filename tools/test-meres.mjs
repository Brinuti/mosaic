// QA-2 arnyek-meres egysegtesztjei: netlify/lib/meres/*.js  (esemenymodell, hash, erkezesi adat, hozzajarulas, platform-kerelmek + vedelmek, szallito, elosztas)
//   node --test tools/test-meres.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { esemenyek, esemenyId, foglalasJelleg, metaNev, SOURCE_ID_MINTA, ERNYOESEMENYEK } from '../netlify/lib/meres/esemeny-modell.js';
import { hashEmail, hashTelefon, sha256hex, telefonSzamjegy } from '../netlify/lib/meres/hash.js';
import { erkezesTisztit, googleKattintas, metaFbc } from '../netlify/lib/meres/erkezes.js';
import { hozzajarulasTisztit, platformSzabaly } from '../netlify/lib/meres/hozzajarulas.js';
import { ARNYEK, ELO_CELOK, googleIdo, KEREM_EPITO, kuldes, ga4Kerelem, googleKerelem, metaKerelem, tiktokKerelem } from '../netlify/lib/meres/platformok.js';
import { elosztas, erkezesMent, fuggoKuldesek, kapcsoloBeallit, kikapcsolva, kuldesMegerosit, maszkIp, naploLeker } from '../netlify/lib/meres/elosztas.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const kot = (sql, args = []) => ({
    run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    first: async () => db.prepare(sql).get(...args) || null,
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }),
  });
  return { db, prepare: (sql) => ({ bind: (...args) => kot(sql, args), ...kot(sql, []) }), batch: async (stmts) => { for (const s of stmts) await s.run(); } };
}
const BID = 'mb_0muwq2ciorsos0tznsfyliq';
const PI = 'pi_3Sabc123XYZabc456';
const NOW = Date.UTC(2026, 9, 6, 14, 0, 0);
const IDO = Math.floor(NOW / 1000) - 60;
const GCLID = 'Cj0KCQjw_TESZT_gclid_0123456789';
const BE = () => ({
  google: { gclid: { ertek: GCLID, ts: IDO - 100 }, wbraid: { ertek: 'CoMKCQ_wbraid_TESZT_0123', ts: IDO - 50 } },
  meta: { fbc: `fb.1.${(IDO - 90) * 1000}.IwAR_fbclid_TESZT_01`, fbclid: 'IwAR_fbclid_TESZT_01', ts: IDO - 90 },
  tiktok: { ttclid: { ertek: 'E.C.P.ttclid_TESZT_01', ts: IDO - 80 } },
  utm_elso: { source: 'google', medium: 'cpc', campaign: 'elso', ts: IDO - 5000 }, utm_utolso: { source: 'facebook', medium: 'paid', campaign: 'utolso', ts: IDO - 90 },
  fbp: `fb.1.${(IDO - 9000) * 1000}.1234567890`, ttp: 'ttp_TESZT_0123456789abcdef',
  ga4: { client_id: '1234567890.1759759200', session_id: '1759759200', measurement_id: 'G-H4206SQ0Q7' },
});

// --- eseménymodell -------------------------------------------------------------------------------------------------------------------------
const FK = (o = {}) => ({ tipus: 'foglalas', uzletag: 'headspa', source_entity_id: BID, jelleg: 'elso', kupon: false, ertek: 26900, ido: IDO, szolgaltatas: 'HeadSpa', vendeg: { email: 'Teszt.Claude@Example.com', telefon: '06 70 942 0090' }, ...o });
const nevek = (fk) => esemenyek(fk).map((e) => `${e.tipus}:${e.nev}`);

test('esemenymodell: HeadSpa uj vendeg = FoglalasElso + Schedule ernyo; az id <esemeny>:<booking_id>', () => {
  const l = esemenyek(FK());
  assert.deepEqual(l.map((e) => [e.nev, e.tipus, e.esemeny_id, e.ertek, e.penznem]), [['FoglalasElso', 'alap', `FoglalasElso:${BID}`, 26900, 'HUF'], ['Schedule', 'ernyo', `Schedule:${BID}`, 26900, 'HUF']]);
});
test('esemenymodell: az ernyo uzletagankent (szor/PMU: Schedule, fodrasz / oxigen: sajat nev), konzultacio az ernyobe megy a nem-HeadSpa agaknal', () => {
  assert.deepEqual(nevek(FK({ uzletag: 'szor', jelleg: 'konzultacio', ertek: 0 })), ['alap:Konzultacio', 'ernyo:Schedule']);
  assert.deepEqual(nevek(FK({ uzletag: 'pmu', jelleg: 'elso' })), ['alap:FoglalasElso', 'ernyo:Schedule']);
  assert.deepEqual(nevek(FK({ uzletag: 'fodrasz', jelleg: 'konzultacio' })), ['alap:Konzultacio', 'ernyo:Fodrasz_AkviziciosFoglalas']);
  assert.deepEqual(nevek(FK({ uzletag: 'oxigen', jelleg: 'elso' })), ['alap:FoglalasElso', 'ernyo:Oxigen_AkviziciosFoglalas']);
  assert.deepEqual(ERNYOESEMENYEK, { headspa: 'Schedule', szor: 'Schedule', pmu: 'Schedule', fodrasz: 'Fodrasz_AkviziciosFoglalas', oxigen: 'Oxigen_AkviziciosFoglalas' });
});
test('esemenymodell: visszajaro es kupon SOHA nem kerul az ernyobe; a HeadSpa konzultacioja nem ernyo', () => {
  for (const uzletag of ['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu']) assert.deepEqual(nevek(FK({ uzletag, jelleg: 'visszajaro' })), ['alap:Visszajaro'], uzletag);
  for (const uzletag of ['headspa', 'fodrasz', 'oxigen', 'szor', 'pmu']) assert.ok(!nevek(FK({ uzletag, kupon: true })).some((n) => n.startsWith('ernyo')), 'kupon: ' + uzletag);
  assert.deepEqual(nevek(FK({ uzletag: 'headspa', jelleg: 'konzultacio' })), ['alap:Konzultacio']);
});
test('esemenymodell: ajandekkartya = Ajandekkartya + ernyo (HeadSpa); id: Stripe pi_ / sajat ATU- order_id; ervenytelen azonosito = nincs esemeny', () => {
  assert.deepEqual(esemenyek(FK({ tipus: 'ajandekkartya', jelleg: undefined, source_entity_id: PI, ertek: 53800 })).map((e) => e.esemeny_id), [`Ajandekkartya:${PI}`, `Schedule:${PI}`]);
  assert.equal(esemenyek(FK({ tipus: 'ajandekkartya', jelleg: undefined, source_entity_id: 'ATU-AB12CD' }))[0].esemeny_id, 'Ajandekkartya:ATU-AB12CD');
  for (const rossz of ['', 'g:2038420', 'mb_x', 'ATU-', 'pi_', undefined]) assert.deepEqual(esemenyek(FK({ source_entity_id: rossz })), [], String(rossz));
  assert.deepEqual(esemenyek(FK({ uzletag: 'ismeretlen' })), []);
  assert.ok(SOURCE_ID_MINTA.test(BID) && SOURCE_ID_MINTA.test(PI));
});
test('esemenymodell: az ertek a tenyleges ar (kerekitve, nem negativ), a penznem HUF; metaNev: uzletag-elotag az alapesemenynel, az ernyo valtozatlan', () => {
  assert.equal(esemenyek(FK({ ertek: 26900.4 }))[0].ertek, 26900);
  assert.equal(esemenyek(FK({ ertek: -5 }))[0].ertek, 0);
  assert.equal(esemenyek(FK({ ertek: 'x' }))[0].ertek, 0);
  const [alap, ernyo] = esemenyek(FK({ uzletag: 'oxigen' }));
  assert.equal(metaNev(alap, 'oxigen'), 'Oxigen_FoglalasElso'); assert.equal(metaNev(ernyo, 'oxigen'), 'Oxigen_AkviziciosFoglalas');
  assert.equal(esemenyId('Konzultacio', BID), `Konzultacio:${BID}`);
});
test('foglalasJelleg: a Salonic "uj vendeg" jelzes az igazsag; konzultacio csak uj vendegnel; kupon a nevbol; ismeretlen nem uj vendeg', () => {
  assert.deepEqual(foglalasJelleg({ szolgaltatasNev: 'Fodrász konzultáció', ujVendeg: true }), { jelleg: 'konzultacio', kupon: false });
  assert.deepEqual(foglalasJelleg({ szolgaltatasNev: 'Fodrász konzultáció', ujVendeg: false }), { jelleg: 'visszajaro', kupon: false });
  assert.deepEqual(foglalasJelleg({ szolgaltatasNev: 'KUPONKODDAL - HeadSpa kezelés', ujVendeg: true }), { jelleg: 'elso', kupon: true });
  assert.deepEqual(foglalasJelleg({ szolgaltatasNev: 'Hajkamera vizsgálat', ujVendeg: true }).jelleg, 'konzultacio');
  assert.equal(foglalasJelleg({ szolgaltatasNev: 'HeadSpa', ujVendeg: null }).jelleg, 'visszajaro');
});

// --- hash ----------------------------------------------------------------------------------------------------------------------------------------
test('hash: SHA-256 normalizalas (e-mail kisbetu + trim; telefon orszagkoddal; TikTok / Google "+" jellel); ervenytelen = null; a hash nem egyezik a nyers ertekkel', async () => {
  assert.equal(await sha256hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(await hashEmail('  Teszt.Claude@Example.com '), await sha256hex('teszt.claude@example.com'));
  assert.equal(await hashEmail('nem email'), null);
  for (const v of ['06 70 942 0090', '+36 70 942 0090', '0036709420090', '709420090', '36-70-942-0090']) assert.equal(telefonSzamjegy(v), '36709420090', v);
  assert.equal(await hashTelefon('06 70 942 0090'), await sha256hex('36709420090'));
  assert.equal(await hashTelefon('06 70 942 0090', { plusz: true }), await sha256hex('+36709420090'));
  assert.equal(telefonSzamjegy('123'), null); assert.equal(await hashTelefon(''), null);
});

// --- erkezesi adat -------------------------------------------------------------------------------------------------------------------------
test('erkezesTisztit: platformonkent kulon utolso kattintas + idobelyeg, elso / utolso UTM, fbp, ttp, GA4 client_id + session_id', () => {
  const { adat, hibak } = erkezesTisztit(BE(), NOW);
  assert.deepEqual(hibak, []);
  assert.equal(adat.google.gclid.ertek, GCLID); assert.equal(adat.google.gclid.ts, IDO - 100); assert.equal(adat.google.wbraid.ts, IDO - 50);
  assert.equal(adat.meta.fbc, BE().meta.fbc); assert.equal(adat.meta.ts, IDO - 90); assert.equal(adat.tiktok.ttclid.ertek, 'E.C.P.ttclid_TESZT_01');
  assert.equal(adat.utm_elso.campaign, 'elso'); assert.equal(adat.utm_utolso.campaign, 'utolso');
  assert.equal(adat.fbp, BE().fbp); assert.equal(adat.ttp, BE().ttp);
  assert.deepEqual(adat.ga4, { client_id: '1234567890.1759759200', session_id: '1759759200', measurement_id: 'G-H4206SQ0Q7' });
});
test('erkezesTisztit: ervenytelen / injektalt / jovobeli / regi ertek eldobva; nincs adat = ures', () => {
  const rossz = { google: { gclid: { ertek: '<script>', ts: IDO }, gbraid: { ertek: GCLID, ts: IDO + 999999 } }, meta: { fbc: 'nem fbc' }, tiktok: { ttclid: { ertek: 'x' } }, fbp: 'x', ttp: '!', ga4: { client_id: 'x' }, utm_utolso: { source: 'a\nb', ts: 5 } };
  const { adat, hibak } = erkezesTisztit(rossz, NOW);
  assert.deepEqual(adat.google, { gbraid: { ertek: GCLID, ts: null } }, 'a jovobeli idobelyeg null, az ertek (formailag jo) marad');
  assert.ok(!adat.meta && !adat.tiktok && !adat.fbp && !adat.ttp && !adat.ga4);
  assert.equal(adat.utm_utolso.source, 'ab'); assert.equal(adat.utm_utolso.ts, null);
  assert.ok(hibak.includes('ervenytelen gclid') && hibak.includes('ervenytelen fbc') && hibak.includes('ervenytelen ttclid') && hibak.includes('ervenytelen fbp'));
  assert.deepEqual(erkezesTisztit(null).adat, {});
});
test('googleKattintas: a legfrissebb a gclid / wbraid / gbraid kozul; metaFbc: suti, tartalekban az fbclid-bol', () => {
  const { adat } = erkezesTisztit(BE(), NOW);
  assert.deepEqual(googleKattintas(adat), { tipus: 'wbraid', ertek: 'CoMKCQ_wbraid_TESZT_0123', ts: IDO - 50 });
  assert.equal(googleKattintas({}), null);
  assert.equal(metaFbc(adat), BE().meta.fbc);
  assert.equal(metaFbc({ meta: { fbclid: 'IwAR_fbclid_TESZT_01', ts: 1760000000 } }), 'fb.1.1760000000000.IwAR_fbclid_TESZT_01');
  assert.equal(metaFbc({}), null);
});

// --- hozzajarulas (SZ-38) ------------------------------------------------------------------------------------------------------------------
test('hozzajarulas SZ-38: Meta / TikTok hozzajarulas nelkul is kuld (azonositokkal), Google hozzajarulas nelkul hash nelkul + valos DENIED jel, GA4 sosem kap hash-t', () => {
  const nincs = hozzajarulasTisztit({ ana: false, adv: false });
  assert.deepEqual([platformSzabaly('meta', nincs).kuldheto, platformSzabaly('meta', nincs).felhasznaloi_adat, platformSzabaly('tiktok', nincs).felhasznaloi_adat], [true, true, true]);
  assert.deepEqual([platformSzabaly('google', nincs).felhasznaloi_adat, platformSzabaly('google', nincs).jel.ad_user_data], [false, 'DENIED']);
  assert.equal(platformSzabaly('ga4', hozzajarulasTisztit({ ana: true, adv: true })).felhasznaloi_adat, false);
  const igen = hozzajarulasTisztit({ ana: true, adv: true, fun: true });
  assert.deepEqual([platformSzabaly('google', igen).felhasznaloi_adat, platformSzabaly('google', igen).jel.ad_personalization], [true, 'GRANTED']);
  const dontesNelkul = hozzajarulasTisztit(null);
  assert.equal(platformSzabaly('google', dontesNelkul).jel.ad_user_data, 'UNSPECIFIED'); assert.equal(dontesNelkul.dontes, false);
  assert.equal(platformSzabaly('x', igen).kuldheto, false);
});

// --- platform-kerelmek ---------------------------------------------------------------------------------------------------------------------
async function ctxEpit(fkMod = {}, hozz = { ana: true, adv: true }, erk = erkezesTisztit(BE(), NOW).adat) {
  const fk = FK(fkMod); const v = fk.vendeg;
  const h = hozzajarulasTisztit(hozz);
  return { fk, erk, ua: 'Mozilla/5.0 TESZT', ip: '203.0.113.7', oldal: 'https://www.mosaicheadspa.hu/koszonjuk', hozz: { meta: platformSzabaly('meta', h), tiktok: platformSzabaly('tiktok', h), google: platformSzabaly('google', h), ga4: platformSzabaly('ga4', h) },
    hash: { em: await hashEmail(v.email), ph_meta: await hashTelefon(v.telefon), ph_e164: await hashTelefon(v.telefon, { plusz: true }), ext: await sha256hex(v.email.toLowerCase()) } };
}
const ENV = { META_TESZT_KOD: 'TEST12345', TIKTOK_TESZT_KOD: 'TEST67890', GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001' };

test('Meta CAPI kerelem: ARNYEK dataset + test_event_code, event_id, ertek HUF, hash-elt em / ph, fbc, fbp, order_id; tesztkod nelkul TILTVA; elo dataset TILTVA', async () => {
  const ctx = await ctxEpit(); const [alap, ernyo] = esemenyek(ctx.fk);
  const k = metaKerelem(alap, ctx, ENV);
  assert.equal(k.url, 'https://graph.facebook.com/v21.0/28616665324611098/events'); assert.equal(k.body.test_event_code, 'TEST12345');
  const d = k.body.data[0];
  assert.deepEqual([d.event_name, d.event_id, d.event_time, d.action_source], ['HeadSpa_FoglalasElso', `FoglalasElso:${BID}`, IDO, 'website']);
  assert.deepEqual([d.custom_data.value, d.custom_data.currency, d.custom_data.order_id], [26900, 'HUF', BID]);
  assert.deepEqual(d.user_data.em, [await sha256hex('teszt.claude@example.com')]); assert.deepEqual(d.user_data.ph, [await sha256hex('36709420090')]);
  assert.equal(d.user_data.fbc, BE().meta.fbc); assert.equal(d.user_data.fbp, BE().fbp);
  assert.ok(!JSON.stringify(k).includes('teszt.claude@example.com'), 'a nyers e-mail nincs a kerelemben');
  assert.equal(metaKerelem(ernyo, ctx, ENV).body.data[0].event_name, 'Schedule');
  assert.match(metaKerelem(alap, ctx, {}).tiltva, /META_TESZT_KOD/);
  for (const eloId of ELO_CELOK.meta) assert.match(metaKerelem(alap, ctx, { ...ENV, META_ARNYEK_DATASET: eloId }).tiltva, /ARNYEK/);
  assert.match(metaKerelem(alap, ctx, { ...ENV, META_ARNYEK_DATASET: '1' }).tiltva, /ARNYEK/, 'barmilyen mas dataset is tilos');
});
test('TikTok kerelem: ARNYEK pixel + test_event_code, ttclid + ttp, E.164 hash; HeadSpa ernyo = CompletePayment; tesztkod / elo pixel TILTVA', async () => {
  const ctx = await ctxEpit(); const [alap, ernyo] = esemenyek(ctx.fk);
  const k = tiktokKerelem(alap, ctx, ENV);
  assert.deepEqual([k.body.event_source_id, k.body.test_event_code, k.body.event_source], ['DB2GTTJC77UE4D1NE4MG', 'TEST67890', 'web']);
  const d = k.body.data[0];
  assert.deepEqual([d.event, d.event_id, d.properties.value, d.properties.currency], ['HeadSpa_FoglalasElso', `FoglalasElso:${BID}`, 26900, 'HUF']);
  assert.equal(d.user.ttclid, 'E.C.P.ttclid_TESZT_01'); assert.equal(d.user.ttp, BE().ttp);
  assert.equal(d.user.phone, await sha256hex('+36709420090')); assert.equal(d.user.email, await sha256hex('teszt.claude@example.com'));
  assert.equal(tiktokKerelem(ernyo, ctx, ENV).body.data[0].event, 'CompletePayment');
  assert.match(tiktokKerelem(alap, ctx, {}).tiltva, /TIKTOK_TESZT_KOD/);
  assert.match(tiktokKerelem(alap, ctx, { ...ENV, TIKTOK_ARNYEK_PIXEL: ELO_CELOK.tiktok[0] }).tiltva, /ARNYEK/);
  assert.equal(ARNYEK.tiktok.pixelCode, 'DB2GTTJC77UE4D1NE4MG');
});
test('Google kerelem: csak alapesemeny, csak az "ARNYEK" masodlagos akcioba, a legfrissebb kattintasazonosito, valos hozzajarulasi jel; alapbol validateOnly', async () => {
  const ctx = await ctxEpit(); const [alap, ernyo] = esemenyek(ctx.fk);
  const k = googleKerelem(alap, ctx, {}); const c = k.body.conversions[0];
  assert.equal(c.conversionAction, 'customers/6088874770/conversionActions/7825199989');
  assert.deepEqual([c.wbraid, c.gclid, c.conversionValue, c.currencyCode, c.orderId], ['CoMKCQ_wbraid_TESZT_0123', undefined, 26900, 'HUF', BID]);
  assert.deepEqual(c.consent, { adUserData: 'GRANTED', adPersonalization: 'GRANTED' });
  assert.deepEqual(c.userIdentifiers, [{ hashedEmail: await sha256hex('teszt.claude@example.com') }, { hashedPhoneNumber: await sha256hex('+36709420090') }]);
  assert.equal(k.body.validateOnly, true); assert.equal(googleKerelem(alap, ctx, { GOOGLE_ADS_ELES_KULDES: '1' }).body.validateOnly, false);
  assert.match(googleKerelem(ernyo, ctx, {}).kihagyva, /alapesemeny/);
  assert.match(googleKerelem(esemenyek(await ctxEpit({ jelleg: 'visszajaro' }).then((x) => x.fk))[0], ctx, {}).kihagyva, /alapesemeny/);
  const nincsHozz = await ctxEpit({}, { ana: false, adv: false });
  const k2 = googleKerelem(alap, nincsHozz, {}).body.conversions[0];
  assert.deepEqual([k2.userIdentifiers, k2.consent.adUserData], [undefined, 'DENIED']);
  // minden uzletag / alapesemeny az ARNYEK akciora mutat, soha az elo (elsodleges) akciora
  for (const [uzletag, akciok] of Object.entries(ARNYEK.google.akciok)) for (const nev of Object.keys(akciok)) {
    const ex = esemenyek(await ctxEpit({ uzletag, jelleg: nev === 'Konzultacio' ? 'konzultacio' : 'elso', tipus: nev === 'Ajandekkartya' ? 'ajandekkartya' : 'foglalas' }).then((x) => x.fk)).find((e) => e.nev === nev);
    const cx = await ctxEpit({ uzletag }); const kk = googleKerelem(ex, cx, {});
    assert.match(kk.body.conversions[0].conversionAction, /conversionActions\/78(2519998\d|2519999\d|252008\d\d|252009\d\d|2520\d{4})$/, uzletag + nev);
    assert.ok(!ELO_CELOK.google_primary.some((id) => kk.body.conversions[0].conversionAction.endsWith('/' + id)));
  }
  assert.match(googleKerelem({ nev: 'Ajandekkartya', tipus: 'alap', ertek: 1 }, await ctxEpit({ uzletag: 'szor' }), {}).kihagyva, /nincs "ARNYEK"/);
});
test('GA4 kerelem: csak teszt-property, client_id + session_id, hash NINCS, vegig valos hozzajarulasi jel; az elo property / hianyzo client_id TILTVA', async () => {
  const ctx = await ctxEpit(); const alap = esemenyek(ctx.fk)[0];
  const k = ga4Kerelem(alap, ctx, ENV);
  assert.equal(k.url, 'https://www.google-analytics.com/mp/collect?measurement_id=G-TESZT00001');
  assert.equal(k.body.client_id, '1234567890.1759759200'); assert.equal(k.body.events[0].params.session_id, '1759759200');
  assert.deepEqual([k.body.events[0].name, k.body.events[0].params.value, k.body.events[0].params.currency], ['foglalas_elso', 26900, 'HUF']);
  const ga4Szoveg = JSON.stringify(k.body);
  assert.ok(!ga4Szoveg.includes(ctx.hash.em) && !ga4Szoveg.includes(ctx.hash.ph_meta) && !ga4Szoveg.includes(ctx.hash.ph_e164) && !/"user_data"|"user_properties"|hashed|"em"|"ph"|"email"|"phone"/i.test(ga4Szoveg), 'GA4 felé nincs hash / azonosító');
  assert.deepEqual(k.body.consent, { ad_user_data: 'GRANTED', ad_personalization: 'GRANTED' });
  assert.match(ga4Kerelem(alap, ctx, { ...ENV, GA4_TESZT_MEASUREMENT_ID: 'G-H4206SQ0Q7' }).tiltva, /tiltott/);
  assert.match(ga4Kerelem(alap, ctx, {}).tiltva, /teszt-property/);
  assert.match(ga4Kerelem(alap, await ctxEpit({}, undefined, {}), ENV).tiltva, /client_id/);
  const kartya = esemenyek(await ctxEpit({ tipus: 'ajandekkartya', source_entity_id: PI, jelleg: undefined }).then((x) => x.fk))[0];
  const kk = ga4Kerelem(kartya, await ctxEpit({ tipus: 'ajandekkartya', source_entity_id: PI, jelleg: undefined }), ENV);
  assert.equal(kk.body.events[0].name, 'purchase'); assert.equal(kk.body.events[0].params.transaction_id, PI);
});
test('googleIdo: Europe/Budapest eltolassal (nyar +02:00, tel +01:00)', () => {
  assert.equal(googleIdo(Date.UTC(2026, 9, 6, 12, 0, 0) / 1000), '2026-10-06 14:00:00+02:00');
  assert.equal(googleIdo(Date.UTC(2026, 11, 15, 17, 0, 0) / 1000), '2026-12-15 18:00:00+01:00');
});

// --- szallito ------------------------------------------------------------------------------------------------------------------------------------
const valasz = (status, body) => async () => ({ status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) });
test('kuldes: titok nelkul "nincs_hitelesites" (a kerelem kesz marad); a titok CSAK a szallitoban kerul a kereshez; a sikeres valasz felismerese platformonkent', async () => {
  const ctx = await ctxEpit(); const [alap] = esemenyek(ctx.fk);
  const meta = metaKerelem(alap, ctx, ENV);
  assert.equal((await kuldes(meta, ENV, valasz(200, {}))).allapot, 'nincs_hitelesites');
  let latott; const f = async (u, o) => { latott = { u, o }; return { status: 200, text: async () => JSON.stringify({ events_received: 1, fbtrace_id: 'AbC' }) }; };
  const r = await kuldes(meta, { ...ENV, META_CAPI_TOKEN: 'TITOK' }, f);
  assert.deepEqual([r.allapot, r.http_status], ['elkuldve', 200]); assert.match(latott.u, /access_token=TITOK$/); assert.ok(!JSON.stringify(meta).includes('TITOK'));
  assert.equal((await kuldes(meta, { ...ENV, META_CAPI_TOKEN: 'T' }, valasz(400, { error: { message: 'x' } }))).allapot, 'hiba');
  const tt = tiktokKerelem(alap, ctx, ENV);
  assert.equal((await kuldes(tt, { ...ENV, TIKTOK_EVENTS_TOKEN: 'T' }, valasz(200, { code: 0, message: 'OK' }))).allapot, 'elkuldve');
  assert.equal((await kuldes(tt, { ...ENV, TIKTOK_EVENTS_TOKEN: 'T' }, valasz(200, { code: 40001, message: 'bad' }))).allapot, 'hiba');
  const hal = await kuldes(tt, { ...ENV, TIKTOK_EVENTS_TOKEN: 'T' }, async () => { throw new Error('ECONNRESET'); });
  assert.deepEqual([hal.allapot, hal.http_status], ['hiba', null]); assert.match(hal.valasz, /ECONNRESET/);
});

// --- elosztas ------------------------------------------------------------------------------------------------------------------------------------
const SIKER = { meta: { events_received: 1, fbtrace_id: 'x' }, tiktok: { code: 0, message: 'OK' }, google: { results: [{}] }, ga4: {} };
const TELJES_ENV = { ...ENV, MERES_ELOSZTO: '1', META_CAPI_TOKEN: 't', TIKTOK_EVENTS_TOKEN: 't', GOOGLE_ADS_ACCESS_TOKEN: 't', GOOGLE_ADS_DEVELOPER_TOKEN: 't', GA4_TESZT_API_SECRET: 't' };
const hamis = () => { const hivasok = []; const f = async (url, o) => { const p = ['graph.facebook.com', 'business-api.tiktok.com', 'googleads.googleapis.com', 'google-analytics.com'].findIndex((h) => String(url).includes(h)); const kulcs = ['meta', 'tiktok', 'google', 'ga4'][p]; hivasok.push({ kulcs, url: String(url), body: JSON.parse(o.body) }); return { status: 200, text: async () => JSON.stringify(SIKER[kulcs]) }; }; return { f, hivasok }; };
const erkBe = (o = {}) => ({ source_id: BID, uzletag: 'headspa', attr: BE(), hozz: { ana: true, adv: true, fun: true }, ua: 'UA TESZT', ip: '203.0.113.7', oldal: 'https://www.mosaicheadspa.hu/koszonjuk', ...o });

test('elosztas: MERES_ELOSZTO nelkul nem fut le (nincs kuldes, nincs naplo)', async () => {
  const db = d1(); const { f, hivasok } = hamis();
  const r = await elosztas(db, FK(), { env: { ...TELJES_ENV, MERES_ELOSZTO: '0' }, fetchImpl: f, now: () => NOW });
  assert.equal(r.allapot, 'ki'); assert.equal(hivasok.length, 0);
});
test('elosztas: HeadSpa uj vendeg - minden platformra elmegy (Meta 2, TikTok 2, Google 1, GA4 1), minden kuldes naplozva a platform valaszaval, a naplo kerelmeben nincs nyers IP / titok', async () => {
  const db = d1(); const { f, hivasok } = hamis();
  await erkezesMent(db, erkBe(), NOW);
  const r = await elosztas(db, FK(), { env: TELJES_ENV, fetchImpl: f, now: () => NOW });
  assert.equal(r.allapot, 'kesz');
  const szam = (k) => hivasok.filter((h) => h.kulcs === k).length;
  assert.deepEqual([szam('meta'), szam('tiktok'), szam('google'), szam('ga4')], [2, 2, 1, 1]);
  const naplo = await naploLeker(db, BID);
  assert.equal(naplo.kuldesek.length, 8); // 2 esemeny x 4 platform
  const elk = naplo.kuldesek.filter((k) => k.allapot === 'elkuldve');
  assert.equal(elk.length, 6); assert.ok(elk.every((k) => k.http_status === 200 && k.platform_valasz));
  assert.deepEqual(naplo.kuldesek.filter((k) => k.allapot === 'kihagyva').map((k) => `${k.esemeny_tipus}:${k.platform}`), ['ernyo:google', 'ernyo:ga4']);
  const szoveg = JSON.stringify(naplo);
  assert.ok(!szoveg.includes('203.0.113.7'), 'nyers IP nem a naploban'); assert.ok(!szoveg.includes('"t"') && !/access_token|api_secret/.test(szoveg));
  assert.ok(!szoveg.includes('teszt.claude@example.com'));
  assert.equal(naplo.erkezes.ip, '203.0.113.xxx');
});
test('elosztas: DUPLIKACIOSZURES - ugyanaz az esemeny ujrahivva sem megy ki ketszer; hibas kuldes ujraprobalhato, a sikeres nem', async () => {
  const db = d1(); const { f, hivasok } = hamis();
  await erkezesMent(db, erkBe(), NOW);
  await elosztas(db, FK(), { env: TELJES_ENV, fetchImpl: f, now: () => NOW });
  const elso = hivasok.length;
  const r2 = await elosztas(db, FK(), { env: TELJES_ENV, fetchImpl: f, now: () => NOW + 1000 });
  assert.equal(hivasok.length, elso, 'a masodik hivas nem kuld'); assert.ok(r2.esemenyek.flatMap((e) => Object.values(e.platformok)).some((p) => p.duplikalt));
  // hiba -> ujraprobalhato
  const db2 = d1(); let n = 0; const hibas = async () => { n++; return { status: n === 1 ? 500 : 200, text: async () => JSON.stringify(n === 1 ? { error: 'x' } : { events_received: 1 }) }; };
  const env = { ...TELJES_ENV, MERES_ELOSZTO: '1', TIKTOK_EVENTS_TOKEN: '', GOOGLE_ADS_ACCESS_TOKEN: '', GA4_TESZT_API_SECRET: '' };
  await elosztas(db2, FK({ uzletag: 'szor', jelleg: 'konzultacio' }), { env, fetchImpl: hibas, now: () => NOW });
  assert.equal((await naploLeker(db2, BID)).kuldesek.find((k) => k.platform === 'meta' && k.esemeny_tipus === 'alap').allapot, 'hiba');
  await elosztas(db2, FK({ uzletag: 'szor', jelleg: 'konzultacio' }), { env, fetchImpl: hibas, now: () => NOW + 5000 });
  const meta = (await naploLeker(db2, BID)).kuldesek.filter((k) => k.platform === 'meta');
  assert.ok(meta.every((k) => k.allapot === 'elkuldve' || k.allapot === 'hiba'));
  assert.equal(meta.find((k) => k.esemeny_tipus === 'alap').allapot, 'elkuldve'); assert.equal(meta.find((k) => k.esemeny_tipus === 'alap').probalkozas, 2);
});
test('elosztas: VESZKAPCSOLO uzletagankent es platformonkent (es cellankent, es mind) - a kikapcsolt cella nem kuld, a naploban "kihagyva" + a kapcsolo', async () => {
  const mind = async (be) => { const db = d1(); const { f, hivasok } = hamis(); await erkezesMent(db, erkBe(), NOW); await kapcsoloBeallit(db, be, NOW); await elosztas(db, FK(), { env: TELJES_ENV, fetchImpl: f, now: () => NOW }); return { db, hivasok }; };
  let x = await mind({ platform: 'meta', be: false }); assert.ok(!x.hivasok.some((h) => h.kulcs === 'meta')); assert.ok(x.hivasok.some((h) => h.kulcs === 'tiktok'));
  assert.match((await naploLeker(x.db, BID)).kuldesek.find((k) => k.platform === 'meta').indok, /platform:meta/);
  x = await mind({ uzletag: 'headspa', be: false }); assert.equal(x.hivasok.length, 0);
  x = await mind({ uzletag: 'headspa', platform: 'google', be: false }); assert.ok(!x.hivasok.some((h) => h.kulcs === 'google') && x.hivasok.some((h) => h.kulcs === 'meta'));
  x = await mind({ be: false }); assert.equal(x.hivasok.length, 0);
  // masik uzletag nem erintett
  const db = d1(); const { f, hivasok } = hamis(); await kapcsoloBeallit(db, { uzletag: 'fodrasz', be: false }, NOW);
  await elosztas(db, FK({ uzletag: 'szor', jelleg: 'konzultacio' }), { env: TELJES_ENV, fetchImpl: f, now: () => NOW }); assert.ok(hivasok.some((h) => h.kulcs === 'meta'));
  assert.deepEqual(await kapcsoloBeallit(db, { uzletag: 'nincs', be: false }, NOW), { ok: false, miert: 'ismeretlen uzletag' });
  assert.equal(kikapcsolva([{ kulcs: 'cella:headspa:meta', be: 0 }], 'headspa', 'meta'), 'cella:headspa:meta'); assert.equal(kikapcsolva([{ kulcs: 'cella:headspa:meta', be: 1 }], 'headspa', 'meta'), null);
});
test('elosztas: ELO ALLAPOT-ELLENORZES az esemeny elkuldese elott - torolt foglalas: nincs kuldes; ismeretlen: halasztva (nem kuld), kesobb ujraprobalhato; aktiv: kuld', async () => {
  const db = d1(); const { f, hivasok } = hamis(); await erkezesMent(db, erkBe(), NOW);
  const torolve = await elosztas(db, FK(), { env: TELJES_ENV, fetchImpl: f, now: () => NOW, eloEllenorzes: async () => 'torolve' });
  assert.equal(hivasok.length, 0); assert.equal(torolve.elo_allapot, 'torolve');
  assert.ok((await naploLeker(db, BID)).kuldesek.every((k) => k.allapot === 'kihagyva' && /lemondva/.test(k.indok)));
  const db2 = d1(); await erkezesMent(db2, erkBe(), NOW);
  const nem = await elosztas(db2, FK(), { env: TELJES_ENV, fetchImpl: f, now: () => NOW, eloEllenorzes: async () => { throw new Error('halozat'); } });
  assert.equal(nem.allapot, 'halasztva'); assert.equal(hivasok.length, 0);
  const jo = await elosztas(db2, FK(), { env: TELJES_ENV, fetchImpl: f, now: () => NOW + 60000, eloEllenorzes: async () => 'aktiv' });
  assert.equal(jo.allapot, 'kesz'); assert.ok(hivasok.length > 0); assert.equal(jo.elo_allapot, 'aktiv');
});
test('elosztas: Visszajaro csak alapesemeny (nincs ernyo, a Google-ba a visszajaro nem megy), kupon nem ernyo; konzultacio erteke a valos ertek', async () => {
  const db = d1(); const { f, hivasok } = hamis(); await erkezesMent(db, erkBe(), NOW);
  await elosztas(db, FK({ jelleg: 'visszajaro' }), { env: TELJES_ENV, fetchImpl: f, now: () => NOW });
  assert.ok(!hivasok.some((h) => h.kulcs === 'google'));
  assert.ok(!hivasok.some((h) => h.body.data && JSON.stringify(h.body).includes('"Schedule"')));
  const n = await naploLeker(db, BID); assert.equal(new Set(n.kuldesek.map((k) => k.esemeny_nev)).size, 1); assert.equal(n.kuldesek[0].esemeny_nev, 'Visszajaro');
  const db2 = d1(); const g = hamis();
  await elosztas(db2, FK({ uzletag: 'szor', jelleg: 'konzultacio', ertek: 4900 }), { env: TELJES_ENV, fetchImpl: g.f, now: () => NOW });
  assert.equal(g.hivasok.find((h) => h.kulcs === 'meta').body.data[0].custom_data.value, 4900);
});
test('elosztas: hitelesites nelkuli platform = "nincs_hitelesites" + kesz kerelem; kulso szallito megerositheti a platform valaszaval; a megerositett nem megy ujra', async () => {
  const db = d1(); const { f, hivasok } = hamis(); await erkezesMent(db, erkBe(), NOW);
  const env = { ...ENV, MERES_ELOSZTO: '1' };
  await elosztas(db, FK(), { env, fetchImpl: f, now: () => NOW });
  assert.equal(hivasok.length, 0);
  const fuggo = await fuggoKuldesek(db); assert.deepEqual(fuggo.map((x) => x.platform), ['meta', 'tiktok', 'google', 'ga4', 'meta', 'tiktok'], 'alap: 4 platform, ernyo: Meta + TikTok');
  assert.equal(fuggo[0].kerelem.body.test_event_code, 'TEST12345');
  const m = await kuldesMegerosit(db, { id: fuggo[0].id, allapot: 'elkuldve', http_status: 200, valasz: '{"events_received":1,"fbtrace_id":"abc"}', kuldo: 'composio' }, NOW);
  assert.equal(m.ok, true);
  assert.equal((await kuldesMegerosit(db, { id: fuggo[0].id, allapot: 'hiba' }, NOW)).ok, false, 'a megerositett sor mar nem irhato felul');
  await elosztas(db, FK(), { env, fetchImpl: f, now: () => NOW + 1000 });
  const sor = (await naploLeker(db, BID)).kuldesek.find((k) => k.id === fuggo[0].id); assert.deepEqual([sor.allapot, sor.kuldo, sor.http_status], ['elkuldve', 'composio', 200]);
  assert.equal((await fuggoKuldesek(db)).length, 5);
});
test('erkezesMent: ervenytelen source_id / uzletag elutasitva; a bongeszo ujrakuldese frissit, kiment esemeny utan mar nem; az IP maszkolt', async () => {
  const db = d1();
  assert.equal((await erkezesMent(db, erkBe({ source_id: 'g:1' }), NOW)).ok, false); assert.equal((await erkezesMent(db, erkBe({ uzletag: 'x' }), NOW)).ok, false);
  const a = await erkezesMent(db, erkBe(), NOW); assert.deepEqual([a.ok, a.frissitve], [true, true]);
  await erkezesMent(db, erkBe({ attr: { ...BE(), fbp: `fb.1.${(IDO - 1) * 1000}.99999999` } }), NOW + 1000);
  const { f } = hamis(); await elosztas(db, FK(), { env: TELJES_ENV, fetchImpl: f, now: () => NOW + 2000 });
  const b = await erkezesMent(db, erkBe({ attr: { ...BE(), fbp: `fb.1.${(IDO - 2) * 1000}.11111111` } }), NOW + 3000);
  assert.deepEqual([b.ok, b.frissitve], [true, false]);
  assert.equal(maszkIp('203.0.113.7'), '203.0.113.xxx'); assert.equal(maszkIp('2001:db8:1:2::1'), '2001:db8:1:xxxx'); assert.equal(maszkIp(''), null);
});
test('elosztas: hozzajarulas nelkul - Meta / TikTok megy (azonositokkal), Google hash nelkul DENIED jellel, a naploban a hozzajarulasi allapot latszik', async () => {
  const db = d1(); const { f, hivasok } = hamis();
  await erkezesMent(db, erkBe({ hozz: { ana: false, adv: false, fun: false } }), NOW);
  await elosztas(db, FK(), { env: TELJES_ENV, fetchImpl: f, now: () => NOW });
  const m = hivasok.find((h) => h.kulcs === 'meta').body.data[0].user_data; assert.ok(m.em && m.ph);
  const g = hivasok.find((h) => h.kulcs === 'google').body.conversions[0]; assert.deepEqual([g.userIdentifiers, g.consent.adUserData], [undefined, 'DENIED']);
  const h = (await naploLeker(db, BID)).kuldesek.find((k) => k.platform === 'google').hozzajarulas; assert.equal(h.allapot.adv, false); assert.equal(h.szabaly.jel.ad_user_data, 'DENIED');
});
