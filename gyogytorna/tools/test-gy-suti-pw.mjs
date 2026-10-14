// A sajat sutisav (public/assets/js/suti.js) bongeszos tesztje: dontes elott / Elfogadom / Elutasitom / beallitasok / visszavonas / ervenytelen suti; dataLayer, Consent Mode jelek, szerveroldali hozzajarulas-allapot.
//   node tools/build.mjs && node tools/test-gy-suti-pw.mjs [desktop|mobil]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { indit } from './serve.mjs';
const { chromium } = createRequire('/opt/node-tools/node_modules/')('playwright');
const mod = process.argv[2] === 'mobil' ? 'mobil' : 'desktop';
const srv = await indit({ env: { GY_HMAC_KULCS: 'suti-proba-kulcs-0123456789abcdef' } });
const O = `http://127.0.0.1:${srv.port}`;
const b = await chromium.launch();
const nev = [];
let savKi = false;
const uj = async () => {
  const c = await b.newContext(mod === 'mobil' ? { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } });
  await c.route('**/*', (r) => (new URL(r.request().url()).origin === O ? r.continue() : (nev.push(r.request().url()), r.abort())));
  if (!savKi) await c.addInitScript(() => { window.GY_SAV_KI = false; }); // a regi (savos) mod tesztelese
  return c;
};
const suti = (p) => p.evaluate(() => (document.cookie.match(/(?:^|;\s*)gy_suti=([^;]*)/) || [])[1] || null);
const esemenyek = (p) => p.evaluate(() => window.dataLayer.filter((e) => e && e.event && /^gy_suti_/.test(e.event)).map((e) => ({ ...e })));
const consent = (p) => p.evaluate(() => window.dataLayer.filter((e) => e[0] === 'consent').map((e) => [e[1], e[2]]));
let n = 0; const lep = (t) => console.log(`  ok ${++n}. ${t}`);

// 1) dontes elott: sav latszik (nagy), nincs suti, allapot-esemeny dontott=false, nincs consent-update
let c = await uj(); let p = await c.newPage();
await p.goto(`${O}/booking-test/`);
await p.locator('#gy-cc').waitFor();
assert.equal(await p.locator('#gy-cc').getAttribute('data-nezet'), 'nagy');
assert.equal(await suti(p), null);
assert.deepEqual((await esemenyek(p)).map((e) => [e.event, e.gy_suti_dontott]), [['gy_suti_allapot', false]]);
assert.deepEqual(await consent(p), []);
// az Elfogadom es az Elutasitom ugyanakkora
const mer = async (s) => (await p.locator(`#gy-cc-fo ${s}`).boundingBox());
const e1 = await mer('[data-gy=elutasit]'), e2 = await mer('[data-gy=elfogad]');
assert.ok(Math.abs(e1.width - e2.width) < 2 && Math.abs(e1.height - e2.height) < 2, 'a ket gomb egyforma meretu');
lep('dontes elott: sav (nagy), nincs suti, nincs hozzajarulas, a ket gomb egyforma');
// a motor tovabbra is mukodik dontes nelkul (a foglalas nem fugg a hozzajarulastol): a link a motorra megy
await p.goto(`${O}/booking-test/?motor=1`);
await p.click('#gomb-allapot');
await p.locator('[data-gy-motor] .ablak').waitFor();
await p.keyboard.press('Escape');
lep('dontes nelkul a foglalo megnyilik');

// 2) elutasitas
await p.goto(`${O}/booking-test/`);
await p.locator('#gy-cc [data-gy=elutasit]:visible').first().click();
assert.match(await suti(p), /^v1-s0-m0-t\d{10}$/);
assert.equal(await p.locator('#gy-cc').isVisible(), false);
assert.deepEqual((await consent(p)).at(-1)[1], { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' });
assert.equal((await esemenyek(p)).at(-1).event, 'gy_suti_valtozas');
await p.reload();
assert.equal(await p.locator('#gy-cc').isVisible().catch(() => false), false);
lep('Elutasitom: v1-s0-m0 suti, minden denied, a sav nem jon vissza');

// 3) beallitasok: csak statisztika
await p.evaluate(() => window.gySuti.beallitasok());
await p.locator('#gy-cc-stat').check();
await p.locator('[data-gy=mentes]').click();
assert.match(await suti(p), /^v1-s1-m0-t/);
assert.equal((await consent(p)).at(-1)[1].analytics_storage, 'granted');
assert.equal((await consent(p)).at(-1)[1].ad_storage, 'denied');
lep('Beallitasok: csak statisztika -> analytics granted, ad_storage denied');

// 4) elfogadas -> visszavonas (modositas a lablecbol / API-bol)
await p.evaluate(() => window.gySuti.beallitasok());
await p.locator('#gy-cc-beall [data-gy=elfogad]').click();
assert.match(await suti(p), /^v1-s1-m1-t/);
const kj = (await consent(p)).at(-1)[1];
assert.equal(kj.ad_storage, 'granted'); assert.equal(kj.ad_user_data, 'granted'); assert.equal(kj.ad_personalization, 'denied');
// a szerver ugyanezt olvassa: forras-ping hozzajarulassal -> 30 napos suti (gy_lpt) csak ha fizetett belepes is volt
await p.goto(`${O}/booking-test/?utm_source=google&utm_campaign=12757996014&gclid=TESZT123`);
await p.waitForTimeout(800);
const sor = await srv.env.GY_DB.prepare("SELECT fajta, hozzajarulas FROM gy_munkamenet ORDER BY fajta").all();
assert.ok(sor.results.some((r) => r.fajta === 'l' && r.hozzajarulas === 'igen'), 'marketing-hozzajarulassal 30 napos rekord');
await p.evaluate(() => window.gySuti.beallitasok());
await p.locator('#gy-cc-beall [data-gy=elutasit]').click();
assert.match(await suti(p), /^v1-s0-m0-t/);
await p.goto(`${O}/booking-test/?motor=1`); // visszavonas utan a kovetkezo hivasnal a 30 napos rekord torlodik
await p.waitForTimeout(800);
assert.equal((await srv.env.GY_DB.prepare("SELECT COUNT(*) AS n FROM gy_munkamenet WHERE fajta = 'l'").first()).n, 0);
lep('Elfogadom -> a szerver marketing-hozzajarulast lat (30 napos rekord); visszavonas -> a rekord torlodik, jelek denied');

// 5) ervenytelen / jovobeli suti = nincs hozzajarulas, a sav ujra kerdez
c = await uj(); p = await c.newPage();
await p.goto(`${O}/booking-test/`);
await p.evaluate(() => { document.cookie = 'gy_suti=v1-s1-m1-t9999999999; path=/'; });
await p.reload();
await p.locator('#gy-cc').waitFor();
assert.deepEqual((await esemenyek(p)).map((e) => e.gy_suti_dontott), [false]);
lep('ervenytelen (jovobeli) suti = nincs hozzajarulas, a sav ujra kerdez');

// 6) keretben nem jelenik meg
await p.setContent(`<iframe src="${O}/booking-test/" id="f"></iframe>`).catch(() => {});
await p.goto(`${O}/index.html`);
await p.evaluate((o) => { const f = document.createElement('iframe'); f.id = 'f'; f.src = o + '/booking-test/'; document.body.appendChild(f); }, O);
await p.waitForTimeout(1000);
const fr = p.frames().find((x) => x.url().includes('/booking-test/'));
assert.equal(await fr.locator('#gy-cc').count(), 0);
lep('iframe-ben a sav nem jelenik meg');

// 6/b) SAV_KI mod (az eles beallitas: nincs sav; alapertelmezes "megadott"; a latogato kifejezett dontese elsobbseget el)
savKi = true; srv.env.GY_SAV_KI = '1';
c = await uj(); p = await c.newPage();
await p.goto(`${O}/booking-test/`);
await p.waitForTimeout(600);
assert.equal(await p.locator('#gy-cc').count() === 0 || !(await p.locator('#gy-cc').isVisible()), true, 'SAV_KI: nincs sav');
assert.equal(await suti(p), null, 'SAV_KI: nem irunk sutit dontes nelkul');
{
  const ev = await esemenyek(p);
  assert.equal(ev.length, 1);
  assert.deepEqual([ev[0].event, ev[0].gy_suti_dontott, ev[0].gy_suti_stat, ev[0].gy_suti_mark, ev[0].gy_suti_sav_ki, ev[0].gy_suti_alap], ['gy_suti_allapot', false, true, true, true, true]);
}
assert.deepEqual(await consent(p), [], 'SAV_KI: a default-ot a GTM adja, a szkript nem allit consentet dontes nelkul');
assert.equal(await p.evaluate(() => window.gySuti.engedely('mark') && window.gySuti.engedely('stat') && !window.gySuti.dontott()), true);
// a lableci "Suti beallitasok" link (az eles lablec szerkezete: ul#nav2 > li > a[rel=privacy-policy]) megnyitja a savot; az elutasitas elsobbseget el
assert.equal(await p.locator('#nav2 li #gy-cc-lablec').count(), 1, 'lableci link megvan');
assert.match(await p.locator('#gy-cc-lablec').innerText(), /Süti beállítások/);
await p.locator('#gy-cc-lablec').click();
await p.locator('#gy-cc-beall').waitFor();
await p.locator('#gy-cc-stat').uncheck(); await p.locator('#gy-cc-mark').uncheck();
await p.locator('[data-gy=mentes]').click();
assert.match(await suti(p), /^v1-s0-m0-t\d+$/);
assert.deepEqual((await consent(p)).map((x) => x[1].ad_storage + '/' + x[1].analytics_storage), ['denied/denied']);
assert.equal(await p.evaluate(() => window.gySuti.engedely('mark') || window.gySuti.engedely('stat')), false);
await p.reload(); await p.waitForTimeout(500);
assert.equal(await p.locator('#gy-cc').isVisible().catch(() => false), false);
assert.equal(await p.evaluate(() => window.gySuti.engedely('mark')), false, 'a kifejezett elutasitas visszalepes utan is elsobbseget el');
lep('SAV_KI: nincs sav, nincs suti, alap "megadott" (event + engedely), nincs consent-update dontes nelkul; a kifejezett elutasitas elsobbseget el es megmarad');
savKi = false;

// 7) statisztika: csak szamlalo, azonosito nelkul
const st = (await srv.env.GY_DB.prepare('SELECT esemeny, SUM(db) AS db FROM gy_suti_stat GROUP BY esemeny').all()).results;
assert.ok(st.length >= 2);
assert.deepEqual(Object.keys((await srv.env.GY_DB.prepare('SELECT * FROM gy_suti_stat LIMIT 1').first())).sort(), ['db', 'esemeny', 'eszkoz', 'kornyezet', 'nap', 'nezet', 'verzio']);
lep('nevtelen statisztika: csak napi darabszam, azonosito / URL nelkul');
assert.deepEqual(nev.filter((u) => !/\.salonic\.hu\//.test(u)), [], 'kulso (nem Salonic-olvasas) kerelem'); // a foglalo megnyitasakor csak a Salonic olvasasa megy
lep('0 kulso kerelem');
await b.close(); await srv.leall();
console.log(`SUTI ${mod}: ${n} lepes rendben`);
process.exit(0);
