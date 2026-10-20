// Leiratkozas az automatikus e-mailekrol (Feri kerese, 2026-10-20): lablec-link minden vendeg-levelben, /u/<kod> (GET megerosit, POST leiratkoztat),
// a motor leiratkozott cimre nem kuld e-mailt (SMS igen), a hash-ben nincs e-mail. Vendegadat nincs: minden nev / e-mail kitalalt.
// Futtatas: node --test tools/lifecycle-teszt/leiratkozas.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { ingest, tick } from '../../netlify/lib/lifecycle/engine.js';
import { leiratkozas } from '../../netlify/lib/lifecycle/http.js';
import { emailHash, leiratkozott, leiratkoztat, leiratkozasUrl } from '../../netlify/lib/lifecycle/leiratkozas.js';
import { levelKirajzol, emailKirajzol, ertekek } from '../../netlify/lib/lifecycle/render.js';
import { KATALOG, KOZOS } from '../../netlify/lib/lifecycle/katalog/index.js';
import { d1, hamisKuldok, foglaltLevel, MOST, ORA, UUID1, UUID2, szam } from './seged.mjs';

const ENV = { LIFECYCLE_MOD: 'elo', LIFECYCLE_UZLETAGOK: 'hair,laser,oxygen,headspa,pmu' };
const VENDEG = { nev: 'Kiss Réka', email: 'Kiss.Reka@Example.com', tel: '06201112222' };
const kerelem = (db, ut, metodus = 'GET') => leiratkozas(new Request(`https://www.mosaicheadspa.hu${ut}`, { method: metodus }), { LIFECYCLE_DB: db });

async function foglalasToken(db, id = null) {
  const f = await db.sqlite.prepare(id ? 'SELECT token, email FROM foglalasok WHERE id = ?' : 'SELECT token, email FROM foglalasok').get(...(id ? [id] : []));
  return f.token;
}

test('leiratkozas: a cim hash-e kisbetus / szokoz nelkuli, az e-mail nincs a tablaban', async () => {
  assert.equal(await emailHash(' Kiss.Reka@Example.com '), await emailHash('kiss.reka@example.com'));
  const db = d1();
  await ingest(db, ENV, foglaltLevel({ ...VENDEG }), MOST);
  const token = await foglalasToken(db);
  const r = await leiratkoztat(db, token, MOST + 5);
  assert.equal(r.ok, true);
  const sor = db.sqlite.prepare('SELECT * FROM leiratkozasok').all();
  assert.equal(sor.length, 1);
  assert.equal(sor[0].email_h, await emailHash('kiss.reka@example.com'));
  assert.ok(!JSON.stringify(sor).toLowerCase().includes('example.com'));
  assert.equal(await leiratkozott(db, 'KISS.REKA@example.com'), true);
  assert.equal(await leiratkozott(db, 'masik@example.com'), false);
  // ismetelt leiratkozas nem hiba, nincs dupla sor
  assert.equal((await leiratkoztat(db, token, MOST + 9)).ok, true);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM leiratkozasok').get().n, 1);
  assert.equal((await leiratkoztat(db, 'nincsilyen0', MOST)).ok, false);
});

test('motor: minden vendeg-e-mail lablecen van leiratkozas-link (HTML + szoveg + List-Unsubscribe adat), a link a foglalas tokenje', async () => {
  const db = d1(); const k = hamisKuldok();
  const r = await ingest(db, ENV, foglaltLevel({ ...VENDEG }), MOST);
  await tick(db, ENV, k, MOST, { foglalasId: r.foglalasId });
  const token = await foglalasToken(db);
  assert.ok(k.ki.email.length >= 1);
  for (const m of k.ki.email) {
    const url = leiratkozasUrl('https://www.mosaicheadspa.hu', token);
    assert.equal(m.leiratkozas, url, 'a kuldonek atadott leiratkozas-URL (List-Unsubscribe fejlec)');
    assert.ok(m.html.includes(`href="${url}"`) && /Leiratkozás/.test(m.html), 'HTML-lablec');
    assert.ok(m.szoveg.includes(url), 'szoveges valtozat');
  }
});

test('katalogus: a vendeg e-mail-sablon (minden uzletag, minden uzenet) kirajzolva tartalmazza a lablec-linket, a belso feladat-level nem', async () => {
  let db = 0;
  for (const uzletag of Object.keys(KATALOG)) {
    if (uzletag === 'mp') continue; // kesz HTML-sablonok: a leiratkozas-oldal az MP-oldalon kulon feladat
    for (const uz of [...KATALOG[uzletag].uzenetek, ...KOZOS.uzenetek].filter((u) => u.csatorna === 'email')) {
      const ert = ertekek({ uzletag, nev: 'Kiss Réka', keresztnev: 'Réka', kezdet: MOST + 5 * 86400, szolgaltatas: 'x', szegmens: [], munkatars: 'Betti', token: 'abcdef0123', fiok: 'mosaic-hair', allapot: 'aktiv', letrehozva: MOST }, 'email', { base: 'https://www.mosaicheadspa.hu', most: MOST });
      ert._leiratkozas = leiratkozasUrl('https://www.mosaicheadspa.hu', 'abcdef0123');
      const ki = emailKirajzol(uz, ert);
      assert.ok(ki.html.includes('/u/abcdef0123'), `${uzletag}/${uz.id}: HTML`);
      assert.ok(ki.szoveg.includes('/u/abcdef0123'), `${uzletag}/${uz.id}: szoveg`);
      db += 1;
    }
  }
  assert.ok(db > 10, `legalabb a katalogus nagy resze ellenorizve (${db})`);
  // link nelkul (pl. belso level) nincs lablec-sor
  const l = levelKirajzol({ elotag: 'x', blokkok: [{ t: 'p', sorok: ['szia'] }] });
  assert.ok(!/Leiratkozás/.test(l.html) && !/Leiratkozás/.test(l.szoveg));
});

test('motor: leiratkozas utan a fuggo vendeg-e-mailek torlodnek, ujak nem mennek ki (ugyanarra a cimre mas foglalasrol sem); az SMS megy tovabb', async () => {
  const db = d1(); const k = hamisKuldok();
  await ingest(db, ENV, foglaltLevel({ ...VENDEG }), MOST);
  await ingest(db, ENV, foglaltLevel({ uzenetId: 'g2', uuid: UUID2, ...VENDEG, datum: 'december 2. (szerda) 10:00' }), MOST);
  const token = await foglalasToken(db, UUID1);
  const fuggoElotte = szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE allapot = 'fuggoben' AND csatorna = 'email'").n;
  assert.ok(fuggoElotte > 0);
  const r = await leiratkoztat(db, token, MOST + 60);
  assert.equal(r.ok, true); assert.equal(r.torolt, fuggoElotte);
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE allapot = 'fuggoben' AND csatorna = 'email'").n, 0);
  assert.equal(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE ok = 'leiratkozott'").n, fuggoElotte);
  assert.ok(szam(db, "SELECT COUNT(*) AS n FROM kuldesek WHERE allapot = 'fuggoben' AND csatorna = 'sms'").n > 0, 'az SMS-ek maradnak');
  await tick(db, ENV, k, MOST + 120);
  await tick(db, ENV, k, MOST + 14 * ORA);
  assert.equal(k.ki.email.length, 0, 'leiratkozott cimre nincs e-mail');
  assert.ok(k.ki.sms.length > 0, 'az SMS tovabbra is megy');
  assert.equal(db.sqlite.prepare("SELECT tipus, reszlet FROM esemenyek WHERE tipus = 'leiratkozas'").all().length, 1);
  assert.ok(!db.sqlite.prepare("SELECT reszlet FROM esemenyek WHERE tipus = 'leiratkozas'").get().reszlet.includes('@'), 'az esemeny-naplo nem tartalmaz e-mailt');
});

test('motor: egy MASIK, nem leiratkozott vendeg levele nem erintett', async () => {
  const db = d1(); const k = hamisKuldok();
  await ingest(db, ENV, foglaltLevel({ ...VENDEG }), MOST);
  await ingest(db, ENV, foglaltLevel({ uzenetId: 'g3', uuid: UUID2, nev: 'Nagy Anna', email: 'nagy.anna@example.com', tel: '06301112233', datum: 'december 2. (szerda) 10:00' }), MOST);
  await leiratkoztat(db, await foglalasToken(db, UUID1), MOST + 1);
  await tick(db, ENV, k, MOST + 120);
  assert.ok(k.ki.email.some((m) => m.to === 'nagy.anna@example.com'));
  assert.ok(!k.ki.email.some((m) => m.to.toLowerCase() === 'kiss.reka@example.com'));
});

test('/u/<kod>: GET csak megerosit (nem iratkoztat le), POST leiratkoztat; hibas kod 404-es oldal; a gomb POST-ol', async () => {
  const db = d1();
  await ingest(db, ENV, foglaltLevel({ ...VENDEG }), MOST);
  const token = await foglalasToken(db);
  const get = await kerelem(db, `/u/${token}`);
  assert.equal(get.status, 200);
  const oldal = await get.text();
  assert.match(oldal, /Leiratkozom/); assert.match(oldal, new RegExp(`method="post" action="/u/${token}"`));
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM leiratkozasok').get().n, 0, 'a GET (pl. levelezo-bot) nem iratkoztat le');
  assert.match(get.headers.get('x-robots-tag') || '', /noindex/);
  const post = await kerelem(db, `/u/${token}`, 'POST');
  assert.equal(post.status, 200); assert.match(await post.text(), /Leiratkoztál/);
  assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM leiratkozasok').get().n, 1);
  const ujra = await (await kerelem(db, `/u/${token}`)).text();
  assert.match(ujra, /Leiratkoztál/); // mar leiratkozott: nincs gomb
  assert.equal((await kerelem(db, '/u/nincsilyen0')).status, 404); // a "nem talalom" oldal (a /f, /m mintajara)
  assert.match(await (await kerelem(db, '/u/nincsilyen0')).text(), /Nem találom/);
  assert.equal((await kerelem(db, `/u/${token}`, 'PUT')).status, 405);
  assert.equal((await leiratkozas(new Request(`https://x/u/${token}`), {})).status, 404); // nincs DB
});
