// A MOSAIC Google-ertekeleseinek szama minden oldalon az AKTUALIS (assets/js/google-szam.js; a tulajdonos kerese, 2026-10-09).
//
//   node --test tools/google-szam-teszt/google-szam.test.mjs
//
// - a regi (beegetett) szamok (1257 / 1255 / 971 / 831 / 1262) sehol nincsenek a sajat oldalak forrasaban (a PMU-specifikus 1.145 kivetelevel)
// - a szkript a Trustindex-widget (hamisitott valasz: 1342) szamat irja be a szovegekbe es az aria-label-ekbe, a tagolast megtartva
// - a build a szkriptet felteszi azokra az oldalakra, ahol a szam szerepel (a PMU-foglalo oldalakra nem)
// Kornyezeti valtozok: CHROME_UTVONAL, PLAYWRIGHT_UTVONAL (lasd headspa.test.mjs).
import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { szerverInditas, GYOKER } from '../headspa-teszt/szerver.mjs';

const OLDALAK = ['index', 'head-spa-kedvezmeny', 'paros-headspa-budapest', 'lezeres-szortelenites-budapest', 'headspa-budapest-hungary', 'szortelenites-5-dolog', 'oxigenterapia-budapest', 'szajtetovalas-budapest', 'sminktetovalas-budapest'];
const PMU_SPECIFIKUS = new Set(['foglalo-pmu.html', 'pmu-ok.html', 'pmu-vh.html']);
const SZKRIPT = path.join(GYOKER, 'assets', 'js', 'google-szam.js');

describe('a forrasban nincsenek regi, beegetett szamok', () => {
  test('a foglalas/*.html oldalakon (a PMU-specifikus kivetelevel) nincs 1257 / 1255 / 971 / 831 / 1262 Google-szam; az ajandek-motor tartaleka is az aktualis', () => {
    const minta = /(?:\d{1,2}[.,\u00a0 \u202f]\d{3}|\d{3,5})\+?\s*(?:db\s+)?(?:Google[- ](?:v[eé]lem[eé]ny|[eé]rt[eé]kel[eé]s)|Google reviews|vend[eé]gv[eé]lem[eé]ny|val[oó]di [eé]rt[eé]kel[eé]s|v[eé]lem[eé]ny|[eé]rt[eé]kel[eé]s)/gi;
    const regi = /^(1[.,\u00a0 ]?257|1[.,\u00a0 ]?255|971|831|1[.,\u00a0 ]?262)\b/;
    for (const f of fs.readdirSync(path.join(GYOKER, 'foglalas')).filter((x) => x.endsWith('.html') && !PMU_SPECIFIKUS.has(x))) {
      const h = fs.readFileSync(path.join(GYOKER, 'foglalas', f), 'utf8').replace(/<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/g, '');
      for (const m of h.matchAll(minta)) assert.ok(!regi.test(m[0]), `${f}: regi Google-szam: "${m[0]}"`);
    }
    assert.match(fs.readFileSync(path.join(GYOKER, 'assets', 'js', 'ajandek-adat.js'), 'utf8'), /var GOOGLE = \{ pont: '4,9', darab: '1\.2[6-9]\d' \}/);
  });
  test('a build felteszi a google-szam.js-t a sajat oldalakra, ahol a szam szerepel; a PMU-specifikus foglalo oldalakat kihagyja', () => {
    const b = fs.readFileSync(path.join(GYOKER, 'tools', 'netlify-build.mjs'), 'utf8');
    assert.match(b, /google-szam\.js/);
    assert.match(b, /GV_KIHAGY = \/\^\(foglalo-pmu\|pmu-ok\|pmu-vh\)\\\.html\$\//);
    assert.match(b, /SAJAT_OLDALAK\.has\(f\) && GV_MINTA\.test\(h\)/);
  });
});

describe('bongeszoben: a szkript az aktualis szamot irja be', () => {
  let bongeszo, szerver, bazis;
  before(async () => {
    const keres = [process.env.PLAYWRIGHT_UTVONAL, path.join(GYOKER, 'node_modules')].filter(Boolean);
    let pw; for (const k of keres) { try { pw = createRequire(path.join(k, 'x.js'))('playwright-core'); break; } catch { /* kovetkezo */ } }
    if (!pw) throw new Error('playwright-core nem talalhato (PLAYWRIGHT_UTVONAL)');
    ({ szerver, bazis } = await szerverInditas());
    bongeszo = await pw.chromium.launch({ executablePath: process.env.CHROME_UTVONAL || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  });
  after(async () => { await bongeszo.close(); szerver.close(); });

  for (const oldal of OLDALAK) {
    test(`/${oldal}: a Trustindex 1342-t ad -> a szovegekben es az aria-label-ekben 1342 (tagolasa megmarad) latszik, a regi szam sehol`, async () => {
      const ctx = await bongeszo.newContext({ viewport: { width: 1280, height: 900 } });
      const p = await ctx.newPage();
      await p.route(/^(?!http:\/\/localhost)/, (r) => {
        if (/cdn\.trustindex\.io\/widgets\/8a\/8a7562c4[^/]*\/content\.html/.test(r.request().url())) return r.fulfill({ contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: '<div class="ti-header"><div class="ti-rating-text"><strong class="ti-rating">Kiváló értékelés</strong><span><a href="#">1342 vélemény</a> alapján</span></div></div>' });
        return r.abort();
      });
      await p.goto(bazis + '/' + oldal, { waitUntil: 'domcontentloaded' });
      await p.evaluate(() => localStorage.removeItem('mh_gv_db'));
      await p.addScriptTag({ path: SZKRIPT });
      await p.waitForFunction(() => { try { return !!JSON.parse(localStorage.getItem('mh_gv_db') || 'null'); } catch { return false; } }, null, { timeout: 5000 });
      await p.waitForTimeout(400);
      const r = await p.evaluate(() => {
        const minta = /(?:\d{1,2}[.,\u00a0 \u202f]\d{3}|\d{3,5})\+?\s*(?:db\s+)?(?:Google[- ](?:v[eé]lem[eé]ny|[eé]rt[eé]kel[eé]s)|Google reviews|vend[eé]gv[eé]lem[eé]ny|val[oó]di [eé]rt[eé]kel[eé]s|v[eé]lem[eé]ny|[eé]rt[eé]kel[eé]s)/gi;
        const szovegek = (document.body.innerText.match(minta) || []);
        const attr = [...document.querySelectorAll('[aria-label],[title],[alt]')].flatMap((e) => ['aria-label', 'title', 'alt'].map((a) => e.getAttribute(a) || '')).flatMap((v) => v.match(minta) || []);
        const jel = [...document.querySelectorAll('[data-gv-szam],[data-ertekeles-db],#te-db-m')].map((e) => e.textContent.trim());
        return { szovegek, attr, jel };
      });
      const mind = [...r.szovegek, ...r.attr, ...r.jel];
      assert.ok(mind.length >= 1, `${oldal}: nincs egyetlen "<szam> ... velemeny" szoveg sem`);
      for (const x of mind) assert.ok(/^1[.,\u00a0 \u202f]?342\+?/.test(x), `${oldal}: nem az aktualis szam: "${x}"`);
      await ctx.close();
    });
  }

  test('a szkript NEM nyul ervenyes mas szamokhoz: "800+ vendegunk", ar, datum, "3-5 alkalom" valtozatlan', async () => {
    const ctx = await bongeszo.newContext();
    const p = await ctx.newPage();
    await p.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
    await p.goto(bazis + '/index', { waitUntil: 'domcontentloaded' });
    await p.evaluate(() => { localStorage.setItem('mh_gv_db', JSON.stringify({ n: 1342, t: Date.now() })); document.body.insertAdjacentHTML('beforeend', '<p id="proba">800+ vendégünk 4,9-es értékelése · Ár: 26 900 Ft · 2026.09.16. · 3–5 alkalom után · 7 vélemény a Google-on · 1.257 db Google-értékelés</p>'); });
    await p.addScriptTag({ path: SZKRIPT });
    await p.waitForTimeout(500);
    assert.equal(await p.$eval('#proba', (e) => e.textContent), '800+ vendégünk 4,9-es értékelése · Ár: 26 900 Ft · 2026.09.16. · 3–5 alkalom után · 7 vélemény a Google-on · 1.342 db Google-értékelés');
    await ctx.close();
  });
});
