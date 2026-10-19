// DECISION #202 (maximalis hash-elt adatatadas): a hash-segedek FUGGETLEN SHA-256 / HMAC orakullal (node:crypto, nem az eles kodbol), a nev-forrasok, a platform-kerelem-epitok uj mezoi
// (Meta fn / ln / country / ct / zp / fbc-potlas, TikTok opt-in nev, Google user_identifiers + IP / UA, GA4 user_id + user_data), a forras-bekotesek es az elosztas() vegpontig menő viselkedese.
//   node --test tools/test-adatgazdagitas.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { emailGoogleNormal, hashEmailGoogle, hmacSha256Hex, iranyitoszamNormal, nevReszek, sha256hex, varosNormal } from '../netlify/lib/meres/hash.js';
import { felhasznaloHash } from '../netlify/lib/meres/felhasznalo-hash.js';
import { nevEmailbol, vendegNev } from '../netlify/lib/meres/vendeg-nev.js';
import { esemenyek } from '../netlify/lib/meres/esemeny-modell.js';
import { erkezesTisztit, metaFbc } from '../netlify/lib/meres/erkezes.js';
import { hozzajarulasTisztit, platformSzabaly } from '../netlify/lib/meres/hozzajarulas.js';
import { ga4Kerelem, googleKerelem, kuldes, metaKerelem, tiktokKerelem } from '../netlify/lib/meres/platformok.js';
import { ajandekForras } from '../netlify/lib/meres/ajandek-esemeny.js';
import { elosztas, erkezesMent, kuldesMegerosit, maszkolt, naploLeker } from '../netlify/lib/meres/elosztas.js';
import { valaszMaszk } from '../netlify/lib/meres/platformok.js';
import { motorKepek } from './meres-proba/golden-motor.mjs';

const h = (s) => crypto.createHash('sha256').update(s).digest('hex'); // FUGGETLEN orakulum
const KULCS = 'teszt-guest-hmac-kulcs-0123456789abcdef';
const BID = 'mb_0muwq2ciorsos0tznsfyliq'; const PI = 'pi_3Sabc123XYZabc456';
const NOW = Date.UTC(2026, 9, 6, 14, 0, 0); const IDO = Math.floor(NOW / 1000) - 60;
const BE = () => ({ google: { gclid: { ertek: 'Cj0KCQjw_TESZT_gclid_0123456789', ts: IDO - 100 } }, meta: { fbc: `fb.1.${(IDO - 90) * 1000}.IwAR_fbclid_TESZT_01`, fbclid: 'IwAR_fbclid_TESZT_01', ts: IDO - 90 }, tiktok: { ttclid: { ertek: 'E.C.P.ttclid_TESZT_01', ts: IDO - 80 } }, fbp: `fb.1.${(IDO - 9000) * 1000}.1234567890`, ttp: 'ttp_TESZT_0123456789abcdef', ga4: { client_id: '1234567890.1759759200', session_id: '1759759200' } });
const VENDEG = { email: 'Teszt.Claude@Example.com', telefon: '06 30 000 0001', nev: 'Kovács Anna' };
const FK = (o = {}) => ({ tipus: 'foglalas', uzletag: 'headspa', source_entity_id: BID, jelleg: 'elso', kupon: false, ertek: 26900, ido: IDO, szolgaltatas: 'HeadSpa', vendeg: { ...VENDEG }, ...o });
const ENV = { META_TESZT_KOD: 'TEST12345', TIKTOK_TESZT_KOD: 'TEST67890', GA4_TESZT_MEASUREMENT_ID: 'G-TESZT00001' };
async function ctxEpit(fkMod = {}, hozz = { ana: true, adv: true }, erk = erkezesTisztit(BE(), NOW).adat, envHash = { GUEST_HMAC_KEY_V1: KULCS }) {
  const fk = FK(fkMod); const hh = hozzajarulasTisztit(hozz);
  return { fk, erk, ua: 'Mozilla/5.0 TESZT', ip: '203.0.113.7', oldal: 'https://www.mosaicheadspa.hu/koszonjuk', hozz: { meta: platformSzabaly('meta', hh), tiktok: platformSzabaly('tiktok', hh), google: platformSzabaly('google', hh), ga4: platformSzabaly('ga4', hh) }, hash: await felhasznaloHash(envHash, fk.vendeg) };
}

// --- hash-segedek ----------------------------------------------------------------------------------------------------------------------------
test('nevReszek: magyar sorrend (vezeteknev elol) alapbol, keresztnev-elol opcio; titulus / irasjel / koztes nev; hianyzo / ures / ertelmezhetetlen = null', () => {
  assert.deepEqual(nevReszek('Kovács Anna'), { fn: 'anna', ln: 'kovács' });
  assert.deepEqual(nevReszek('Anna Kovács', 'keresztnev_elol'), { fn: 'anna', ln: 'kovács' });
  assert.deepEqual(nevReszek('Dr. Kovács-Nagy Anna'), { fn: 'anna', ln: 'kovácsnagy' }, 'titulus kimarad, a kotojel az irasjellel egyutt');
  assert.deepEqual(nevReszek('Kovács Anna Mária'), { fn: 'anna', ln: 'kovács' }, 'a koztes nevek kimaradnak');
  assert.deepEqual(nevReszek('Anna'), { fn: 'anna', ln: null }, 'egyetlen token = csak keresztnev');
  assert.deepEqual(nevReszek('TESZT – Claude'), { fn: 'claude', ln: 'teszt' }, 'az onallo gondolatjel kimarad');
  assert.deepEqual(nevReszek('  Őze   Ágnes  '), { fn: 'ágnes', ln: 'őze' }, 'ekezetes betuk UTF-8-ban maradnak');
  for (const rossz of [undefined, null, '', '   ', '–', 'dr.', 12345, {}, [], 'A B C D E F G', 'x'.repeat(41) + ' Anna']) assert.equal(nevReszek(rossz), null, JSON.stringify(rossz));
});
test('emailGoogleNormal / hashEmailGoogle: gmail pontok kimaradnak; Ads: a "+" utani resz is; mas domain csak kisbetu; ervenytelen = null', async () => {
  assert.equal(emailGoogleNormal('Jane.Doe+valami@Gmail.com'), 'janedoe@gmail.com');
  assert.equal(emailGoogleNormal('Jane.Doe+valami@Gmail.com', { plusz: false }), 'janedoe+valami@gmail.com');
  assert.equal(emailGoogleNormal('a.b+c@googlemail.com'), 'ab@googlemail.com');
  assert.equal(emailGoogleNormal('A.B+C@Example.COM'), 'a.b+c@example.com');
  assert.equal(emailGoogleNormal('nem email'), null);
  assert.equal(await hashEmailGoogle('Jane.Doe@gmail.com'), h('janedoe@gmail.com'));
  assert.equal(await hashEmailGoogle('x'), null);
});
test('varosNormal / iranyitoszamNormal (Meta ct / zp): kisbetu, irasjel / szokoz nelkul; ervenytelen = null', () => {
  assert.equal(varosNormal('Budapest'), 'budapest'); assert.equal(varosNormal('Szeged-Tápé'), 'szegedtápé'); assert.equal(varosNormal('Zalaegerszeg 2.'), 'zalaegerszeg');
  assert.equal(varosNormal(''), null); assert.equal(varosNormal(null), null); assert.equal(varosNormal('x'.repeat(61)), null);
  assert.equal(iranyitoszamNormal('1051'), '1051'); assert.equal(iranyitoszamNormal(' 10 51 '), '1051'); assert.equal(iranyitoszamNormal('SW1A 1AA'), 'sw1a1aa');
  for (const rossz of ['', null, '12', '<script>', 'x'.repeat(11)]) assert.equal(iranyitoszamNormal(rossz), null, String(rossz));
});
test('hmacSha256Hex = node:crypto HMAC; felhasznaloHash: minden mezo a FUGGETLEN orakulummal egyezik, a GA4 user_id kulcs nelkul NINCS, nev nelkul NINCS fn / ln (a tobbi megy)', async () => {
  assert.equal(await hmacSha256Hex(KULCS, 'szoveg'), crypto.createHmac('sha256', KULCS).update('szoveg').digest('hex'));
  const x = await felhasznaloHash({ GUEST_HMAC_KEY_V1: KULCS }, { ...VENDEG, g: null, varos: 'Budapest', iranyitoszam: '1051' });
  assert.deepEqual(x, {
    em: h('teszt.claude@example.com'), ph_meta: h('36300000001'), ph_e164: h('+36300000001'), ext: h('teszt.claude@example.com'),
    em_ads: h('teszt.claude@example.com'), em_ga4: h('teszt.claude@example.com'), fn: h('anna'), ln: h('kovács'), ct: h('budapest'), zp: h('1051'), country: h('hu'),
    uid: crypto.createHmac('sha256', KULCS).update('v1|ga4uid|teszt.claude@example.com').digest('hex').slice(0, 32),
  });
  assert.equal((await felhasznaloHash({}, VENDEG)).uid, null, 'GUEST_HMAC_KEY_V1 nelkul nincs user_id');
  assert.equal((await felhasznaloHash({ GUEST_HMAC_KEY_V1: 'rovid' }, VENDEG)).uid, null, 'tul rovid kulcs = nincs user_id');
  for (const nev of [undefined, null, '', '  ']) { const y = await felhasznaloHash({}, { ...VENDEG, nev }); assert.deepEqual([y.fn, y.ln], [null, null]); assert.ok(y.em && y.ph_meta && y.country, 'a tobbi mezo megy'); }
  const uidOf = (azon) => crypto.createHmac('sha256', KULCS).update(`v1|ga4uid|${azon}`).digest('hex').slice(0, 32);
  const g = await felhasznaloHash({ GUEST_HMAC_KEY_V1: KULCS }, { email: 'A@B.hu', g: '2038420' }); assert.equal(g.uid, uidOf('a@b.hu'), 'az e-mail az elsodleges: a motoros (van g) es az sd (nincs g) ag UGYANAZT a user_id-t adja ugyanarra a vendegre');
  assert.equal((await felhasznaloHash({ GUEST_HMAC_KEY_V1: KULCS }, { email: 'a@b.hu', g: null })).uid, g.uid);
  assert.equal((await felhasznaloHash({ GUEST_HMAC_KEY_V1: KULCS }, { g: '2038420' })).uid, uidOf('2038420'), 'e-mail nelkul a Salonic-vendegazonosito (g) a tartalek');
  // country (hu): csak magyar (36-os) telefonszamnal / telefon nelkul; kulfoldi szamnal nem talaljuk ki
  const orszag = async (telefon) => (await felhasznaloHash({}, { email: 'a@b.hu', telefon })).country;
  assert.equal(await orszag('06 30 000 0001'), h('hu')); assert.equal(await orszag('+36 30 000 0001'), h('hu')); assert.equal(await orszag(''), h('hu'), 'telefon nelkul (de van e-mail) = hu');
  assert.equal(await orszag('+44 20 7946 0958'), null, 'kulfoldi (+44) szam: nincs orszag'); assert.equal(await orszag('+49 30 123456'), null);
  const semmi = await felhasznaloHash({}, {}); assert.ok(Object.values(semmi).every((v) => v === null), 'adat nelkul minden null (orszag is)');
});

// --- nev-forrasok ----------------------------------------------------------------------------------------------------------------------------
test('vendegNev: forras-sorrend (bejovo.nev > vendeg.nev > a level szovege); hianyzo / null / ures / markup / e-mail / szam = nincs nev', () => {
  assert.equal(vendegNev({ nev: 'Kovács Anna', vendeg: { nev: 'Más Név' }, email_html: '<h2>Kedves Béla!</h2>' }), 'Kovács Anna');
  assert.equal(vendegNev({ vendeg: { nev: 'Más Név' }, email_html: '<h2>Kedves Béla!</h2>' }), 'Más Név');
  assert.equal(vendegNev({ nev: '  ', vendeg: { nev: null }, email_html: '<h2>Kedves Béla!</h2>' }), 'Béla', 'ures nev -> a level');
  for (const rossz of [undefined, null, {}, { nev: null }, { nev: '' }, { nev: 12 }, { nev: { x: 1 } }, { nev: '<b>x</b>' }, { nev: 'x@y.hu' }, { nev: '+36 30 000 0001' }, { nev: 'Vendég' }, { nev: 'Mobil: 06 30 000 0001' }, { nev: 'E-mail cím: a@b.hu' }, 'nem objektum', 42, [], { nev: 'x'.repeat(5000) }]) assert.equal(vendegNev(rossz), null, String(JSON.stringify(rossz)).slice(0, 60));
  assert.equal(vendegNev({ nev: 'Kovács Anna Mobiltelefonszám: 06 30 000 0001' }), 'Kovács Anna', 'a mezocimke elott veget er (egysoros)');
  // soha nem dob: furcsa tipusok / ciklikus / getter-hiba -> null
  const ciklus = { }; ciklus.nev = ciklus; assert.doesNotThrow(() => vendegNev(ciklus)); assert.equal(vendegNev(ciklus), null);
  const dobo = { get nev() { throw new Error('getter'); } }; assert.doesNotThrow(() => vendegNev(dobo)); assert.equal(vendegNev(dobo), null);
});
test('nevEmailbol: a szalonnak szolo level "Nev:" sora (tablazat / egysoros), a vendegnek szolo "Kedves X!" / "Dear X!" koszones; a "Szolgaltatas neve:" nem nev; nincs nev = null', () => {
  assert.equal(nevEmailbol('<table><tr><td>Név:</td><td>Kovács Anna</td></tr><tr><td>Mobiltelefonszám:</td><td>06 30 000 0001</td></tr><tr><td>E-mail cím:</td><td>a@b.hu</td></tr></table>'), 'Kovács Anna');
  assert.equal(nevEmailbol('<p>Név: Kovács Anna Mobiltelefonszám: 06 30 000 0001 E-mail cím: a@b.hu</p>'), 'Kovács Anna', 'egysoros level: a kovetkezo cimke elott er veget');
  assert.equal(nevEmailbol('<p>N&eacute;v: Nagy &Aacute;rp&aacute;d</p>'), 'Nagy Árpád', 'HTML-entitasok');
  assert.equal(nevEmailbol('<h2 style="x">\n   Kedves TESZT – Claude!</h2>'), 'TESZT – Claude');
  assert.equal(nevEmailbol('<h2>Dear Anna,</h2>'), 'Anna');
  assert.equal(nevEmailbol('<h2>Kedves Vendégünk!</h2>'), null, 'altalanos megszolitas nem nev');
  assert.equal(nevEmailbol('<p>Szolgáltatás neve: HeadSpa</p><p>nincs más</p>'), null);
  assert.equal(nevEmailbol(''), null); assert.equal(nevEmailbol(undefined), null);
  assert.equal(nevEmailbol('<script>Név: Rossz Adat</script><p>semmi</p>'), null, 'a script / style tartalma nem szamit');
  // ures "Nev:" cella: a kovetkezo sor cimkeje NEM nev
  assert.equal(nevEmailbol('<p>Név:</p><p>Mobiltelefonszám: 06 30 000 0001</p>'), null);
  assert.equal(nevEmailbol('<table><tr><td>Név:</td><td></td></tr><tr><td>Mobiltelefonszám:</td><td>06 30 000 0001</td></tr></table>'), null);
  // HTML-entitasok: ismeretlen / prototipus-kulcs / ervenytelen kodpont = szokoz, soha nem dob, nem szivarog "function"
  for (const ent of ['&constructor;', '&toString;', '&__proto__;', '&hasOwnProperty;', '&#0;', '&#xD800;', '&#99999999999;', '&#x110000;', '&#xZZ;', '&nosuch;']) {
    let nev; assert.doesNotThrow(() => { nev = nevEmailbol(`<p>Név: Kovács ${ent} Anna</p>`); }, ent);
    assert.ok(nev === null || (typeof nev === 'string' && !/function|\[object/.test(nev)), ent + ' -> ' + nev);
  }
  assert.equal(nevEmailbol('<p>Név: Kovács &#99999999999; Anna</p>'), 'Kovács Anna'); assert.equal(nevEmailbol('<p>Név: Kovács &#xD800; Anna</p>'), 'Kovács Anna');
  // NBSP / egyeb szokoz-jellegu karakter: egyetlen szokozze esik ossze (a motor a Zap email_html-jet latja, abban a Salonic NBSP-t is hasznalhat)
  assert.equal(nevEmailbol('<p>Kedves\u00a0Anna!</p>'), 'Anna'); assert.equal(nevEmailbol('<p>Név:\u00a0Kovács\u00a0Anna</p>'), 'Kovács Anna'); assert.equal(nevEmailbol('<p>Kedves\u2003Anna!</p>'), 'Anna');
  // hosszu / rosszindulatu bemenet: LINEARIS (nincs negyzetes visszalepes: a lezaratlan <script> / <style>, a "Kedves" + szokoz-futam minden fajtaja)
  const t0 = Date.now();
  for (const be of ['<p>' + ' '.repeat(300000) + 'Név:', 'Kedves ' + 'a'.repeat(200000), '<script>'.repeat(40000), '<style>'.repeat(40000), '<script>' + '<'.repeat(100000), '<' + 'a'.repeat(300000), 'Név:' + ' \n'.repeat(100000) + 'x', '&' + 'a'.repeat(100000) + ';', '&a'.repeat(60000),
    'Kedves' + '\u00a0'.repeat(30000), 'Kedves' + '\r'.repeat(30000), 'Kedves' + '\u2003'.repeat(30000), 'Kedves' + '\n'.repeat(30000), 'Kedves a '.repeat(14000), '<br' + ' '.repeat(100000), '<br '.repeat(30000), 'Név:' + '\u00a0'.repeat(100000)]) assert.doesNotThrow(() => nevEmailbol(be));
  assert.ok(Date.now() - t0 < 1500, 'rosszindulatu bemenetek: ' + (Date.now() - t0) + ' ms');
  for (const rossz of ['<script>'.repeat(30000), 'Kedves' + '\u00a0'.repeat(20000)]) { const t1 = Date.now(); nevEmailbol(rossz); assert.ok(Date.now() - t1 < 200, 'egy bemenet: ' + (Date.now() - t1) + ' ms'); }
  assert.equal(nevEmailbol('<script>Név: Rossz</script><p>Név: Jó Név</p><style>x{}</style>'), 'Jó Név', 'a lezart script / style kimarad, a tobbi marad');
});
test('forras-bekotesek: az sd a bejovo.nev-et, a motor a Zap nev-et (+ level-tartalek), az ajandekkartya a PI metadata nev / varos / iranyitoszam mezot adja at (csak hash-eleshez); ct / zp a motornal / sd-nel nincs', async () => {
  const sd = fs.readFileSync(fileURLToPath(new URL('../netlify/lib/meres/salonic-direct.js', import.meta.url)), 'utf8');
  const motor = fs.readFileSync(fileURLToPath(new URL('../netlify/lib/meres/foglalas-esemeny.js', import.meta.url)), 'utf8');
  assert.match(sd, /vendeg: \{ email: v\.email, telefon: v\.telefon, g: null, nev: vendegNev\(bejovo\) \}/); assert.match(motor, /nev: vendegNev\(\{ \.\.\.bejovo, vendeg: v \}\)/);
  assert.ok(!/(?:varos|iranyitoszam)/.test(motor) && !/(?:varos|iranyitoszam)/.test(sd.replace(/\/\/.*$/gm, '')), 'a motor / sd ag nem talal ki varost / iranyitoszamot');
  const pi = { id: PI, status: 'succeeded', amount: 5380000, amount_received: 5380000, created: IDO, receipt_email: 'vevo@example.com', metadata: { termek: 'x', telefon: '06 30 000 0002', nev: 'Szabó Éva', varos: 'Debrecen', iranyitoszam: '4025' }, latest_charge: null };
  const { fk } = ajandekForras(pi, 'kartya');
  assert.deepEqual(fk.vendeg, { email: 'vevo@example.com', telefon: '06 30 000 0002', g: null, nev: 'Szabó Éva', varos: 'Debrecen', iranyitoszam: '4025' });
  const hash = await felhasznaloHash({}, fk.vendeg); assert.deepEqual([hash.fn, hash.ln, hash.ct, hash.zp], [h('éva'), h('szabó'), h('debrecen'), h('4025')]);
  const nincs = ajandekForras({ ...pi, metadata: { termek: 'x' } }, 'kartya').fk.vendeg; assert.deepEqual([nincs.nev, nincs.varos, nincs.iranyitoszam], [null, null, null]);
});

// --- platform-kerelmek -----------------------------------------------------------------------------------------------------------------------
test('Meta: fn / ln / country (hash), ct / zp csak ha van forras (ajandekkartya); nev nelkul nincs fn / ln, a tobbi megy; fbc potlasa az esemeny idejevel; a tartalek-torzs a regi alak', async () => {
  const ctx = await ctxEpit(); const [alap] = esemenyek(ctx.fk);
  const k = metaKerelem(alap, ctx, ENV); const u = k.body.data[0].user_data;
  assert.deepEqual([u.fn, u.ln, u.country, u.ct, u.zp], [[h('anna')], [h('kovács')], [h('hu')], undefined, undefined]);
  assert.deepEqual([u.em, u.ph, u.external_id], [[h('teszt.claude@example.com')], [h('36300000001')], [h('teszt.claude@example.com')]]);
  assert.ok(!JSON.stringify(k).includes('Kovács') && !JSON.stringify(k).includes('Anna'), 'nyers nev nincs');
  const t = k.tartalek_body.data[0].user_data; assert.deepEqual([t.fn, t.ln, t.country], [undefined, undefined, undefined]); assert.deepEqual(t.em, u.em);
  assert.ok(!('tartalek_body' in JSON.parse(JSON.stringify(k))), 'nem szerializalodik');
  // nev nelkul
  const nevtelen = await ctxEpit({ vendeg: { ...VENDEG, nev: null } }); const un = metaKerelem(esemenyek(nevtelen.fk)[0], nevtelen, ENV).body.data[0].user_data;
  assert.deepEqual([un.fn, un.ln], [undefined, undefined]); assert.ok(un.em && un.ph && un.country && un.external_id && un.fbc && un.client_user_agent, 'a tobbi mezo megy');
  // ajandekkartya: ct / zp
  const kartya = await ctxEpit({ tipus: 'ajandekkartya', source_entity_id: PI, jelleg: undefined, vendeg: { ...VENDEG, varos: 'Debrecen', iranyitoszam: '4025' } });
  const uk = metaKerelem(esemenyek(kartya.fk)[0], kartya, ENV).body.data[0].user_data; assert.deepEqual([uk.ct, uk.zp], [[h('debrecen')], [h('4025')]]);
  // fbc: a kattintas-idobelyeg nelkuli fbclid az esemeny idejevel egeszul ki; a suti-fbc / ts erintetlen; nincs fbclid = nincs fbc
  assert.equal(metaFbc({ meta: { fbclid: 'IwAR_x' } }), null, 'tartalek nelkul (regi hivas) valtozatlan');
  assert.equal(metaFbc({ meta: { fbclid: 'IwAR_x' } }, 1791295140000), 'fb.1.1791295140000.IwAR_x');
  assert.equal(metaFbc({ meta: { fbclid: 'IwAR_x', ts: 1760000000 } }, 1791295140000), 'fb.1.1760000000000.IwAR_x', 'a kattintas ideje elsobbseget elvez');
  assert.equal(metaFbc({ meta: { fbc: 'fb.1.1.z', fbclid: 'IwAR_x' } }, 5), 'fb.1.1.z'); assert.equal(metaFbc({}, 5), null); assert.equal(metaFbc({ meta: { fbclid: 'x' } }, NaN), null);
  const fbclidCtx = await ctxEpit({}, undefined, { meta: { fbclid: 'IwAR_x' }, ga4: BE().ga4 });
  assert.equal(metaKerelem(esemenyek(fbclidCtx.fk)[0], fbclidCtx, ENV).body.data[0].user_data.fbc, `fb.1.${IDO * 1000}.IwAR_x`);
});
test('TikTok: a nev-mezok OPT-IN (TIKTOK_NEV_MEZOK=1) mogott, alapbol nem mennek; ct / zp nincs; nev nelkul opt-in mellett sincs nev-mezo', async () => {
  const ctx = await ctxEpit(); const [alap] = esemenyek(ctx.fk);
  const ki = tiktokKerelem(alap, ctx, ENV); assert.deepEqual(Object.keys(ki.body.data[0].user).sort(), ['email', 'external_id', 'ip', 'phone', 'ttclid', 'ttp', 'user_agent'], 'alapbol a hivatalos user-kulcsok'); assert.equal(ki.tartalek_body, undefined);
  const be = tiktokKerelem(alap, ctx, { ...ENV, TIKTOK_NEV_MEZOK: '1' }); const u = be.body.data[0].user;
  assert.deepEqual([u.first_name, u.last_name], [h('anna'), h('kovács')]); assert.equal(u.ct, undefined); assert.equal(u.zp, undefined);
  assert.deepEqual(Object.keys(be.tartalek_body.data[0].user).sort(), Object.keys(ki.body.data[0].user).sort(), 'a tartalek = az alap user-kulcsok');
  const nevtelen = await ctxEpit({ vendeg: { ...VENDEG, nev: '' } }); const kn = tiktokKerelem(esemenyek(nevtelen.fk)[0], nevtelen, { ...ENV, TIKTOK_NEV_MEZOK: '1' });
  assert.deepEqual(Object.keys(kn.body.data[0].user).sort(), Object.keys(ki.body.data[0].user).sort()); assert.equal(kn.tartalek_body, undefined);
  assert.equal(tiktokKerelem(alap, ctx, { ...ENV, TIKTOK_NEV_MEZOK: '0' }).body.data[0].user.first_name, undefined);
});
test('Google (Zapier-torzs): hashed_email (Ads-normalizalt) / hashed_phone_number / user_identifiers + a motor altal rogzitett IP / UA; elutasito dontes, IP / UA nelkuli (sd) ag: kimarad; a kattintasazonosito valtozatlanul egy (a legfrissebb)', async () => {
  const gmail = await ctxEpit({ vendeg: { ...VENDEG, email: 'Jane.Doe+x@Gmail.com' } }); const [alap] = esemenyek(gmail.fk);
  const c = googleKerelem(alap, gmail, {}).body;
  assert.deepEqual([c.hashed_email, c.hashed_phone_number], [h('janedoe@gmail.com'), h('+36300000001')]);
  assert.deepEqual(c.user_identifiers, [{ hashed_email: h('janedoe@gmail.com') }, { hashed_phone_number: h('+36300000001') }]);
  assert.deepEqual([c.user_ip_address, c.user_agent], ['203.0.113.7', 'Mozilla/5.0 TESZT']);
  assert.deepEqual(Object.keys(c).filter((k) => ['gclid', 'wbraid', 'gbraid'].includes(k)), ['gclid'], 'egy kattintasazonosito');
  assert.ok(!Object.keys(c).some((k) => /name|city|zip|nev/i.test(k)), 'Google fele nev / cim nem megy');
  const sd = { ...gmail, ip: null, ua: null }; const cs = googleKerelem(alap, sd, {}).body; assert.deepEqual([cs.user_ip_address, cs.user_agent], [undefined, undefined]); assert.ok(cs.hashed_email);
  const elut = await ctxEpit({}, { ana: false, adv: false }); const ce = googleKerelem(esemenyek(elut.fk)[0], elut, {}).body;
  assert.deepEqual([ce.hashed_email, ce.hashed_phone_number, ce.user_identifiers, ce.user_ip_address, ce.user_agent, ce.ad_user_data], [undefined, undefined, undefined, undefined, undefined, 'DENIED']);
  const nincsTel = await ctxEpit({ vendeg: { ...VENDEG, telefon: '' } }); assert.deepEqual(googleKerelem(esemenyek(nincsTel.fk)[0], nincsTel, {}).body.user_identifiers, [{ hashed_email: h('teszt.claude@example.com') }]);
});
test('GA4: user_id (HMAC) + user_data (SHA-256 e-mail, E.164 telefon); nev / cim nincs; elutasito dontes: nincs; a validacios hiba utan a tartalek (regi) torzs megy', async () => {
  const ctx = await ctxEpit(); const alap = esemenyek(ctx.fk)[0]; const k = ga4Kerelem(alap, ctx, ENV);
  assert.equal(k.body.user_id, crypto.createHmac('sha256', KULCS).update('v1|ga4uid|teszt.claude@example.com').digest('hex').slice(0, 32));
  assert.deepEqual(k.body.user_data, { sha256_email_address: [h('teszt.claude@example.com')], sha256_phone_number: [h('+36300000001')] });
  assert.ok(!/first_name|last_name|"address"|city|postal/i.test(JSON.stringify(k.body)));
  const elut = await ctxEpit({}, { ana: false, adv: false }); const ke = ga4Kerelem(esemenyek(elut.fk)[0], elut, ENV); assert.deepEqual([ke.body.user_id, ke.body.user_data, ke.tartalek_body], [undefined, undefined, undefined]);
  // GA4 validacios hiba (debug) a kibovitett torzsre, tiszta a tartalekra: 2 debug + 1 valodi kuldes
  const hivasok = []; const f = async (u, o) => { const body = JSON.parse(o.body); const debug = String(u).includes('/debug/'); hivasok.push({ debug, kibovitett: !!body.user_data });
    return { status: 200, text: async () => (debug ? JSON.stringify({ validationMessages: body.user_data ? [{ fieldPath: 'user_data', description: 'x', validationCode: 'VALUE_INVALID' }] : [] }) : '') }; };
  const r = await kuldes(k, { ...ENV, GA4_TESZT_API_SECRET: 's' }, f);
  assert.equal(r.allapot, 'elkuldve'); assert.deepEqual(hivasok, [{ debug: true, kibovitett: true }, { debug: true, kibovitett: false }, { debug: false, kibovitett: false }]);
  assert.equal(JSON.parse(r.valasz).tartalek_ujraprobalas, true);
});

test('MERES_GAZDAGITAS=0 (visszagorgetes deploy nelkul): nincs nev / orszag / varos / iranyitoszam / fbc-potlas (Meta), nincs TikTok-nev (opt-in mellett sem), nincs Google hash / IP / UA, nincs GA4 user_id / user_data; a regi mezok valtozatlanok', async () => {
  const KI = { ...ENV, MERES_GAZDAGITAS: '0', TIKTOK_NEV_MEZOK: '1' };
  const kartya = await ctxEpit({ tipus: 'ajandekkartya', source_entity_id: PI, jelleg: undefined, vendeg: { ...VENDEG, varos: 'Debrecen', iranyitoszam: '4025' } }, undefined, { meta: { fbclid: 'IwAR_x' }, google: BE().google, ga4: BE().ga4, tiktok: BE().tiktok });
  const [alap] = esemenyek(kartya.fk);
  const be = metaKerelem(alap, kartya, { ...ENV, TIKTOK_NEV_MEZOK: '1' }).body.data[0].user_data; assert.ok(be.fn && be.ln && be.country && be.ct && be.zp && be.fbc, 'kapcsolo nelkul megy (kontroll)');
  const mu = metaKerelem(alap, kartya, KI); const m = mu.body.data[0].user_data;
  assert.deepEqual([m.fn, m.ln, m.country, m.ct, m.zp, m.fbc], [undefined, undefined, undefined, undefined, undefined, undefined]);
  assert.deepEqual([m.em, m.ph, m.external_id], [[h('teszt.claude@example.com')], [h('36300000001')], [h('teszt.claude@example.com')]], 'a regi mezok valtoznak'); assert.equal(mu.tartalek_body, undefined, 'nincs mit tartalekolni');
  const tk = tiktokKerelem(alap, kartya, KI); assert.equal(tk.body.data[0].user.first_name, undefined); assert.equal(tk.tartalek_body, undefined);
  const gg = googleKerelem(alap, kartya, KI).body; assert.deepEqual([gg.hashed_email, gg.hashed_phone_number, gg.user_identifiers, gg.user_ip_address, gg.user_agent], [undefined, undefined, undefined, undefined, undefined]); assert.equal(gg.ad_user_data, 'GRANTED', 'a hozzajarulas-jel (PR-A) a kapcsolotol fuggetlen');
  const ga = ga4Kerelem(alap, kartya, KI); assert.deepEqual([ga.body.user_id, ga.body.user_data, ga.tartalek_body], [undefined, undefined, undefined]);
  for (const v of ['1', undefined, '', 'igen']) assert.ok(metaKerelem(alap, kartya, { ...ENV, MERES_GAZDAGITAS: v }).body.data[0].user_data.fn, 'csak a "0" kapcsol ki: ' + v);
});
test('kuldes(): a hibaszovegben (platform visszhangozza a mezoertekeket) a hash-szeru ertekek "[hash]"-ra maszkoltak; a tartalek-ujraprobalas utan is; a sikeres valasz nem valtozik', async () => {
  const ctx = await ctxEpit(); const k = metaKerelem(esemenyek(ctx.fk)[0], ctx, { ...ENV });
  const em = h('teszt.claude@example.com'); const fn = h('anna');
  let hivas = 0;
  const f = async () => { hivas++; return { status: 400, text: async () => JSON.stringify({ error: { message: `Invalid parameter fn=${fn} em=${em}`, error_user_msg: 'x' } }) }; };
  const r = await kuldes(k, { ...ENV, META_CAPI_TOKEN: 't' }, f);
  assert.equal(hivas, 2, 'kibovitett + tartalek'); assert.equal(r.allapot, 'hiba');
  assert.ok(!r.valasz.includes(fn) && !r.valasz.includes(em) && r.valasz.includes('[hash]'), r.valasz);
  assert.doesNotThrow(() => JSON.parse(r.valasz)); assert.ok(r.valasz.length <= 2000, 'a D1 / naplo hosszkorlatja alatt marad: ' + r.valasz.length);
  // 5xx / halozati hiba: nincs ujraprobalas; a hiba-szoveg itt is maszkolt
  hivas = 0; const f5 = async () => { hivas++; return { status: 503, text: async () => `unavailable ${em}` }; };
  const r5 = await kuldes(k, { ...ENV, META_CAPI_TOKEN: 't' }, f5); assert.equal(hivas, 1); assert.ok(!r5.valasz.includes(em));
  // sikeres valasz: valtozatlan (a maszk csak hibara fut)
  const fo = async () => ({ status: 200, text: async () => JSON.stringify({ events_received: 1, fbtrace_id: em }) }); const ro = await kuldes(k, { ...ENV, META_CAPI_TOKEN: 't' }, fo);
  assert.equal(ro.allapot, 'elkuldve'); assert.ok(ro.valasz.includes(em));
});

// --- elosztas vegpontig (motor-forras, minden platform) ----------------------------------------------------------------------------------------
function d1() {
  const db = new DatabaseSync(':memory:');
  const kot = (sql, args = []) => ({ run: async () => { const r = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...args) || null, all: async () => ({ results: db.prepare(sql).all(...args).map((r) => ({ ...r })) }) });
  return { db, prepare: (sql) => ({ bind: (...args) => kot(sql, args), ...kot(sql, []) }), batch: async (stmts) => { for (const s of stmts) await s.run(); } };
}
const SIKER = { meta: { events_received: 1 }, tiktok: { code: 0 }, google: {}, ga4: {} };
const hamis = () => { const hivasok = []; const f = async (url, o) => { if (String(url).includes('/debug/mp/collect')) return { status: 200, text: async () => JSON.stringify({ validationMessages: [] }) }; const kulcs = ['meta', 'tiktok', 'google', 'ga4'][['graph.facebook.com', 'business-api.tiktok.com', 'hooks.zapier.com', 'google-analytics.com'].findIndex((x) => String(url).includes(x))]; hivasok.push({ kulcs, body: JSON.parse(o.body) }); return { status: 200, text: async () => JSON.stringify(SIKER[kulcs]) }; }; return { f, hivasok }; };
const TELJES_ENV = { ...ENV, MERES_ELOSZTO: '1', META_CAPI_TOKEN: 't', TIKTOK_EVENTS_TOKEN: 't', GOOGLE_ARNYEK_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/1/teszt/', GA4_TESZT_API_SECRET: 't', GUEST_HMAC_KEY_V1: KULCS };
const erkBe = (o = {}) => ({ source_id: BID, uzletag: 'headspa', attr: BE(), hozz: { ana: true, adv: true, fun: true }, ua: 'UA TESZT', ip: '203.0.113.7', oldal: 'https://www.mosaicheadspa.hu/koszonjuk', ...o });
test('elosztas: mind a 4 platform a bovitett torzzsel megy (nev / orszag / user_identifiers / user_id / user_data), a nyers adat a kimeno hivasokban SEHOL, a naploban a hash-ertekek "[hash]"; elo ID tiltas valtozatlan; rogzitett elutasitas: Google / GA4 hash nelkul', async () => {
  const db = d1(); const { f, hivasok } = hamis(); await erkezesMent(db, erkBe(), NOW);
  const r = await elosztas(db, FK(), { env: TELJES_ENV, fetchImpl: f, now: () => NOW }); assert.equal(r.allapot, 'kesz');
  const meta = hivasok.find((x) => x.kulcs === 'meta').body.data[0].user_data; assert.deepEqual([meta.fn, meta.ln, meta.country], [[h('anna')], [h('kovács')], [h('hu')]]);
  const tik = hivasok.find((x) => x.kulcs === 'tiktok').body.data[0].user; assert.equal(tik.first_name, undefined, 'a TikTok-nev alapbol nem megy');
  const goo = hivasok.find((x) => x.kulcs === 'google').body; assert.deepEqual([goo.hashed_email, goo.hashed_phone_number, goo.user_ip_address, goo.user_agent, goo.ad_user_data], [h('teszt.claude@example.com'), h('+36300000001'), '203.0.113.7', 'UA TESZT', 'GRANTED']);
  const ga = hivasok.find((x) => x.kulcs === 'ga4').body; assert.ok(ga.user_id && ga.user_data.sha256_email_address);
  const kimenet = JSON.stringify(hivasok).toLowerCase(); for (const nyers of ['kovács', 'kovacs', 'anna', 'teszt.claude@example.com', '36300000001', '30 000 0001']) assert.ok(!kimenet.includes(nyers), 'nyers adat a kimeno hivasokban: ' + nyers);
  const naplo = JSON.stringify((await naploLeker(db, BID)).kuldesek.map((x) => x.kerelem)).toLowerCase();
  for (const hash of [h('anna'), h('kovács'), h('teszt.claude@example.com'), h('+36300000001'), h('36300000001'), h('hu')]) assert.ok(!naplo.includes(hash), 'hash-ertek a naploban: ' + hash.slice(0, 10));
  assert.ok(naplo.includes('[hash]') && naplo.includes('203.0.113.xxx') && !naplo.includes('203.0.113.7'), 'a mezo megleten latszik, az IP maszkolt (user_ip_address is)');
  // rogzitett elutasitas
  const db2 = d1(); const m2 = hamis(); await erkezesMent(db2, erkBe({ hozz: { ana: false, adv: false, fun: false } }), NOW);
  await elosztas(db2, FK(), { env: TELJES_ENV, fetchImpl: m2.f, now: () => NOW });
  const g2 = m2.hivasok.find((x) => x.kulcs === 'google').body; assert.deepEqual([g2.hashed_email, g2.user_identifiers, g2.user_ip_address, g2.ad_user_data], [undefined, undefined, undefined, 'DENIED']);
  const a2 = m2.hivasok.find((x) => x.kulcs === 'ga4').body; assert.deepEqual([a2.user_id, a2.user_data], [undefined, undefined]);
  assert.ok(m2.hivasok.find((x) => x.kulcs === 'meta').body.data[0].user_data.fn, 'Meta: valtozatlanul kap azonositot (SZ-38)');
  // elo azonosito tiltas valtozatlan
  const ctx = await ctxEpit(); const [alap] = esemenyek(ctx.fk);
  assert.match(metaKerelem(alap, ctx, { ...ENV, META_ARNYEK_DATASET: '3473839859576758' }).tiltva, /ARNYEK/); assert.match(ga4Kerelem(alap, ctx, { ...ENV, GA4_TESZT_MEASUREMENT_ID: 'G-H4206SQ0Q7' }).tiltva, /tiltott/);
  assert.match(tiktokKerelem(alap, ctx, { ...ENV, TIKTOK_ARNYEK_PIXEL: 'CTDGK5BC77U0PIODKP30' }).tiltva, /ARNYEK/);
});
test('elosztas: MERES_NAPLO_TELJES nelkul is, es a visszagorgetes (MERES_HOZZAJARULAS_VALOS=1) mellett a Google hash nelkul (a regi szabaly dontes nelkul DENIED); a user_id kulcs nelkul nem jelenik meg', async () => {
  const db = d1(); const { f, hivasok } = hamis(); await erkezesMent(db, erkBe({ hozz: {} }), NOW);
  await elosztas(db, FK(), { env: { ...TELJES_ENV, MERES_HOZZAJARULAS_VALOS: '1', GUEST_HMAC_KEY_V1: undefined }, fetchImpl: f, now: () => NOW });
  const g = hivasok.find((x) => x.kulcs === 'google').body; assert.deepEqual([g.hashed_email, g.ad_user_data], [undefined, 'DENIED']);
  const a = hivasok.find((x) => x.kulcs === 'ga4').body; assert.deepEqual([a.user_id, a.user_data], [undefined, undefined], 'VALOS=1: a GA4-nek nincs hash-e (regi szabaly)');
});
const d1Dump = (x) => x.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((t) => JSON.stringify(x.db.prepare(`SELECT * FROM "${t.name}"`).all())).join('\n').toLowerCase();
const NYERS = ['kovács', 'kovacs', 'anna', 'teszt.claude@example.com', 'teszt.claude', '+36 30 000 0001', '06 30 000 0001', '30 000 0001', '36300000001', '+36300000001', '300000001', 'szabó', 'éva', 'debrecen', '4025', 'vevo@example.com', '06 30 000 0002'];
test('elosztas: a teljes D1-ben (minden tabla) SEHOL nincs nyers nev / e-mail / telefon / varos / iranyitoszam - motor-forras, a level-tartalekbol nyert nev, es az ajandekkartya ag is', async () => {
  // 1) motor: a nev a Zap nev-mezojebol (FK.vendeg.nev)
  const db = d1(); const { f } = hamis(); await erkezesMent(db, erkBe(), NOW);
  await elosztas(db, FK(), { env: TELJES_ENV, fetchImpl: f, now: () => NOW });
  const d = d1Dump(db); for (const nyers of NYERS) assert.ok(!d.includes(nyers), 'D1 (motor): ' + nyers);
  assert.ok(d.includes('"[hash]"') || d.includes('[hash]'), 'a maszkolt mezok jelen vannak');
  // 2) motor: a nev a Salonic-level szovegebol (tartalek) - a nyers level / nev sehol
  const nevLevel = vendegNev({ email_html: '<p>Név: Kovács Anna Mobiltelefonszám: 06 30 000 0001 E-mail cím: teszt.claude@example.com</p>' }); assert.equal(nevLevel, 'Kovács Anna');
  const db2 = d1(); const m2 = hamis(); await erkezesMent(db2, erkBe(), NOW);
  await elosztas(db2, FK({ vendeg: { ...VENDEG, nev: nevLevel } }), { env: TELJES_ENV, fetchImpl: m2.f, now: () => NOW });
  const d2 = d1Dump(db2); for (const nyers of NYERS) assert.ok(!d2.includes(nyers), 'D1 (level-tartalek): ' + nyers);
  assert.equal(m2.hivasok.find((x) => x.kulcs === 'meta').body.data[0].user_data.fn[0], h('anna'));
  // 3) ajandekkartya: nev + varos + iranyitoszam a Stripe PI metadatabol
  const pi = { id: PI, status: 'succeeded', amount: 5380000, amount_received: 5380000, created: IDO, receipt_email: 'vevo@example.com', metadata: { termek: 'x', telefon: '06 30 000 0002', nev: 'Szabó Éva', varos: 'Debrecen', iranyitoszam: '4025' }, latest_charge: null };
  const { fk } = ajandekForras(pi, 'kartya'); const db3 = d1(); const m3 = hamis(); await erkezesMent(db3, erkBe({ source_id: PI, uzletag: 'ajandekkartya' }), NOW);
  await elosztas(db3, fk, { env: TELJES_ENV, fetchImpl: m3.f, now: () => NOW });
  const meta3 = m3.hivasok.find((x) => x.kulcs === 'meta'); assert.ok(meta3, 'az ajandekkartya Meta-ba megy');
  assert.deepEqual([meta3.body.data[0].user_data.fn, meta3.body.data[0].user_data.ct, meta3.body.data[0].user_data.zp], [[h('éva')], [h('debrecen')], [h('4025')]]);
  const d3 = d1Dump(db3); for (const nyers of NYERS) assert.ok(!d3.includes(nyers), 'D1 (ajandekkartya): ' + nyers);
  const kimenet3 = JSON.stringify(m3.hivasok).toLowerCase(); for (const nyers of ['szabó', 'éva', 'debrecen', 'vevo@example.com']) assert.ok(!kimenet3.includes(nyers), 'kimeno hivas (ajandekkartya): ' + nyers);
  // a hash-ertekek (a nev / varos / iranyitoszam hash is) a naploban SEHOL
  for (const hash of [h('éva'), h('szabó'), h('debrecen'), h('4025'), h('anna'), h('kovács')]) assert.ok(!d3.includes(hash) && !d.includes(hash), 'hash a D1-ben: ' + hash.slice(0, 10));
});
test('elosztas: MERES_NAPLO_TELJES=1 (csak elonezet): a nyers IP es az e-mail / telefon hash a naploban valodi, de a nev / varos / iranyitoszam hash ott sem marad', async () => {
  const db = d1(); const { f } = hamis(); await erkezesMent(db, erkBe(), NOW);
  await elosztas(db, FK({ vendeg: { ...VENDEG, varos: 'Debrecen', iranyitoszam: '4025' } }), { env: { ...TELJES_ENV, MERES_NAPLO_TELJES: '1', TIKTOK_NEV_MEZOK: '1' }, fetchImpl: f, now: () => NOW });
  const naplo = JSON.stringify((await naploLeker(db, BID)).kuldesek.map((x) => x.kerelem)).toLowerCase();
  assert.ok(naplo.includes(h('teszt.claude@example.com')), 'TELJES: az e-mail hash latszik'); assert.ok(naplo.includes('203.0.113.7'), 'TELJES: az IP latszik');
  for (const nevHash of [h('anna'), h('kovács'), h('debrecen'), h('4025')]) assert.ok(!naplo.includes(nevHash), 'TELJES: nev / varos / iranyitoszam hash a naploban: ' + nevHash.slice(0, 10));
  const nyersEllenorzes = d1Dump(db); for (const nyers of ['kovács', 'kovacs', 'teszt.claude@example.com', '+36 30 000 0001', '06 30 000 0001']) assert.ok(!nyersEllenorzes.includes(nyers), 'TELJES: nyers adat a D1-ben: ' + nyers);
  assert.ok(naplo.includes('[hash]'), 'a maszkolt nev-mezok jelen vannak');
});

// --- review-javitasok (J1-J6): maszk, hibamaszk, ujraprobalas-feltetelek, a visszagorgetes bajtra egyezese -------------------------------------------
test('maszkolt(): a HASH_KULCSOK alatt MINDEN nem ures szoveg maszkolt (melyseg-vedelem: nyers / nagybetus ertek sem juthat a naploba); a technikai azonositok es az ures ertek valtozatlan; TELJES modban csak a nev / varos / iranyitoszam mezok', () => {
  const be = { data: [{ user_data: { fn: ['Kovács'], ln: 'RAW', em: ['RAW@x.hu'], ph: ['0630'], country: 'HU', external_id: ['ABCDEF'], client_ip_address: '203.0.113.7', fbc: 'fb.1.1.x', fbp: 'fb.1.2.y', ct: ['x'], zp: [''] } }], user: { email: 'RAW', first_name: 'Anna', ttclid: 'E.C.P.x', ip: '203.0.113.7' }, hashed_phone_number: 'raw', hashed_email: h('x'), user_id: 'abc', user_ip_address: '203.0.113.7', gclid: 'Cj0K_TESZT', user_data: { sha256_email_address: ['RAW'], sha256_phone_number: [null] } };
  const ki = maszkolt(be); const u = ki.data[0].user_data;
  assert.deepEqual([u.fn, u.ln, u.em, u.ph, u.country, u.external_id, u.ct, u.zp], [['[hash]'], '[hash]', ['[hash]'], ['[hash]'], '[hash]', ['[hash]'], ['[hash]'], ['']]);
  assert.deepEqual([u.client_ip_address, u.fbc, u.fbp], ['203.0.113.xxx', 'fb.1.1.x', 'fb.1.2.y']);
  assert.deepEqual([ki.user.email, ki.user.first_name, ki.user.ttclid, ki.user.ip, ki.hashed_phone_number, ki.hashed_email, ki.user_id, ki.user_ip_address, ki.gclid], ['[hash]', '[hash]', 'E.C.P.x', '203.0.113.xxx', '[hash]', '[hash]', '[hash]', '203.0.113.xxx', 'Cj0K_TESZT']);
  assert.deepEqual(ki.user_data, { sha256_email_address: ['[hash]'], sha256_phone_number: [null] });
  assert.equal(JSON.stringify(ki).includes('RAW'), false); assert.equal(be.data[0].user_data.fn[0], 'Kovács', 'a bemenetet nem modositja');
  const t = maszkolt(be, true).data[0].user_data; assert.deepEqual([t.fn, t.ln, t.ct, t.em, t.ph, t.client_ip_address], [['[hash]'], '[hash]', ['[hash]'], ['RAW@x.hu'], ['0630'], '203.0.113.7'], 'TELJES mod: IP es e-mail / telefon valodi, a nev / varos hash maszkolt');
});
test('valaszMaszk / hibaMaszk: a hash-szeru (32+ hexa) futamok maszkoltak, kornyezettol fuggetlenul (alahuzas / betu mellett, 64 karakternel hosszabb, nagybetus is); a rovid hexa es a szoveg valtozatlan; a kulso szallito valasza (kuldesMegerosit) is maszkolt', async () => {
  const x = h('anna'); const hosszu = x + x;
  assert.equal(valaszMaszk(`fn=${x}`), 'fn=[hash]'); assert.equal(valaszMaszk(`hash_${x}`), 'hash_[hash]'); assert.equal(valaszMaszk(`x${x}y`), 'x[hash]y'); assert.equal(valaszMaszk(hosszu), '[hash]'); assert.equal(valaszMaszk(x.toUpperCase()), '[hash]');
  assert.equal(valaszMaszk(x.slice(0, 31)), x.slice(0, 31), '31 karakter nem hash'); assert.equal(valaszMaszk('Invalid parameter'), 'Invalid parameter'); assert.equal(valaszMaszk(null), null); assert.equal(valaszMaszk(12), 12);
  const db = d1(); const { f } = hamis(); await erkezesMent(db, erkBe(), NOW);
  await elosztas(db, FK(), { env: { ...TELJES_ENV, META_CAPI_TOKEN: undefined }, fetchImpl: f, now: () => NOW });
  const sor = db.db.prepare("SELECT id FROM meres_kuldes WHERE platform = 'meta' AND allapot = 'nincs_hitelesites'").get(); assert.ok(sor, 'van hitelesites nelkuli Meta-sor');
  const r = await kuldesMegerosit(db, { id: sor.id, allapot: 'hiba', http_status: 400, valasz: `bad fn=${h('anna')} em_${h('teszt.claude@example.com')}`, kuldo: 'kulso' }); assert.equal(r.ok, true);
  const mentett = db.db.prepare('SELECT platform_valasz FROM meres_kuldes WHERE id = ?').get(sor.id).platform_valasz; assert.equal(mentett, 'bad fn=[hash] em_[hash]');
});
test('kuldes(): a tartalek-ujraprobalas CSAK kifejezett elutasitasra fut (Meta error / 4xx a 408 es 429 kivetelevel, TikTok 4xxxx kod, GA4 validacio); csonkolt / nem-JSON 200, 429, 5xx, halozati hiba: NEM (az esemeny feldolgozodhatott)', async () => {
  const ctx = await ctxEpit(); const meta = metaKerelem(esemenyek(ctx.fk)[0], ctx, ENV); assert.ok(meta.tartalek_body);
  const tik = tiktokKerelem(esemenyek(ctx.fk)[0], ctx, { ...ENV, TIKTOK_NEV_MEZOK: '1' }); assert.ok(tik.tartalek_body);
  const hivasSzam = async (kerelem, env, valasz) => { let n = 0; const r = await kuldes(kerelem, env, async () => { n++; return typeof valasz === 'function' ? valasz() : valasz; }); return { n, r }; };
  const V = (status, szoveg) => ({ status, text: async () => (typeof szoveg === 'string' ? szoveg : JSON.stringify(szoveg)) });
  const ME = { ...ENV, META_CAPI_TOKEN: 't' }; const TE = { ...ENV, TIKTOK_EVENTS_TOKEN: 't' };
  // Meta
  assert.equal((await hivasSzam(meta, ME, V(400, { error: { message: 'x' } }))).n, 2, '400 + error: kifejezett');
  assert.equal((await hivasSzam(meta, ME, V(400, 'Bad Request'))).n, 2, '4xx nem-JSON torzzsel is kifejezett');
  assert.equal((await hivasSzam(meta, ME, V(200, { error: { message: 'x' } }))).n, 2, '200 + parse-olt error');
  assert.equal((await hivasSzam(meta, ME, V(200, 'nem json'))).n, 1, '200 nem-JSON: feldolgozodhatott');
  assert.equal((await hivasSzam(meta, ME, V(200, '{"events_received":0,"x":"' + 'a'.repeat(2500) + '"}'))).n, 1, '200 csonkolt (2000 char) valasz');
  assert.equal((await hivasSzam(meta, ME, V(429, { error: { message: 'rate' } }))).n, 1, '429: atmeneti'); assert.equal((await hivasSzam(meta, ME, V(408, ''))).n, 1, '408: atmeneti');
  assert.equal((await hivasSzam(meta, ME, V(503, { error: { message: 'x' } }))).n, 1, '5xx'); assert.equal((await hivasSzam(meta, ME, () => { throw new Error('halozat'); })).n, 1, 'halozati hiba');
  assert.equal((await hivasSzam(meta, ME, V(200, { events_received: 1 }))).n, 1, 'siker: nincs ujraprobalas'); assert.equal((await hivasSzam(meta, ME, V(200, { events_received: 1 }))).r.allapot, 'elkuldve');
  // TikTok
  assert.equal((await hivasSzam(tik, TE, V(200, { code: 40002, message: 'param' }))).n, 2, 'TikTok 4xxxx kod'); assert.equal((await hivasSzam(tik, TE, V(200, { code: 50000, message: 'internal' }))).n, 1, '5xxxx: belso hiba');
  assert.equal((await hivasSzam(tik, TE, V(200, { code: 40100, message: 'rate' }))).n, 1, '40100: rate limit'); assert.equal((await hivasSzam(tik, TE, V(200, { code: 0 }))).n, 1); assert.equal((await hivasSzam(tik, TE, V(200, 'nem json'))).n, 1);
  // GA4: a validacios hiba (debug) kifejezett; a debug-vegpont 5xx-e nem
  const ga = ga4Kerelem(esemenyek(ctx.fk)[0], ctx, ENV); assert.ok(ga.tartalek_body); const GE = { ...ENV, GA4_TESZT_API_SECRET: 's' };
  assert.equal((await hivasSzam(ga, GE, V(503, 'unavailable'))).n, 1, 'GA4 debug 5xx: nincs ujraprobalas');
  assert.equal((await hivasSzam(ga, GE, V(400, { validationMessages: [] }))).n, 2, 'GA4 debug 4xx: kifejezett');
  // a naplozott kerelem nem fedi fel a tartalek-ujraprobalast, ezert a valasz jelzi: ervenyes JSON, a hash maszkolt
  const { r } = await hivasSzam(meta, ME, V(400, { error: { message: `fn=${h('anna')}` } })); const j = JSON.parse(r.valasz); assert.equal(j.tartalek_ujraprobalas, true); assert.ok(!r.valasz.includes(h('anna')));
});
test('MERES_GAZDAGITAS=0: a golden kep (kerelem-epitok + elosztas HTTP-hivasai) BAJTRA azonos a PR-A (a PR-B elotti) allapottal', async () => {
  const kep = (j) => ({ kerelmek: j.kerelmek, hivasok: Object.fromEntries(Object.entries(j.elosztasok).map(([k, v]) => [k, v.hivasok])) });
  const ki = await motorKepek({ MERES_GAZDAGITAS: '0' }); const hash = crypto.createHash('sha256').update(JSON.stringify(kep(ki))).digest('hex');
  assert.equal(hash, '29238089ec2f1ce0cfdae4440935befcdf1c3af1a71f0ebc6c199bb8efd179d2', 'a PR-A golden fixture (f01a959807) kerelem- es hivas-kepe'); // a hash a claude/meres-202-granted golden-motor-kerelem.json kerelmek + hivasok szekciojabol szamolt (sorok nelkul: a naplo [hash]-maszkja PR-B-ben szandekosan ujabb)
  const be = await motorKepek({}); assert.notEqual(crypto.createHash('sha256').update(JSON.stringify(kep(be))).digest('hex'), hash, 'kapcsolo nelkul a bovitett torzs megy (kontroll)');
});
