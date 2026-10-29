// A foglalas oldal ("A foglalasod") es a levelek varhato idotartama ugyanaz a Salonic-alapu szabaly (kb. perc–perc+10), a kitalalt 30–40 / 40–50 perc nem szerepelhet.
//   node tools/test-mp-idotartam.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MP_PERC, latogatasHossza } from '../lib/mp-idotartam.js';
import { foglalasOldal } from '../lib/foglalasom.js';
import mpSzolg from '../../netlify/lib/lifecycle/szolgaltatasok-mp.js';
import { mpLatogatas } from '../../netlify/lib/lifecycle/uzletag.js';
import katalog from '../../netlify/lib/lifecycle/katalog/mp.js';

const szoveg = async (f, opc = {}) => { const r = foglalasOldal(f, opc); return typeof r === 'string' ? r : await r.text(); };
const alap = { token: 'tok', id: '00000000-0000-4000-8000-000000000000', allapot: 'aktiv', kezdet: Math.floor(Date.now() / 1000) + 3 * 86400, munkatars: 'Kovács Richárd' };

test('a masolt lista ugyanaz, mint a levelek Salonic-pillanatkepe', () => {
  assert.deepEqual(MP_PERC.map(([n, p]) => [n, p]), mpSzolg.map((s) => [s.nev, s.perc]));
});
test('minden szolgaltatasnal az oldal idotartama egyezik a levelekevel', () => {
  for (const s of mpSzolg) assert.equal(latogatasHossza(s.nev), mpLatogatas(s.nev), s.nev);
});
test('3 piercing: kb. 15–25 perc, nem 40–50', async () => {
  const h = await szoveg({ ...alap, szolgaltatas: '🔥 3 PIERCING - A HARMADIK 5.000 Ft!🔥' });
  assert.match(h, /Időtartam<\/div><div class="e">kb\. 15–25 perc</);
  assert.ok(!/40–50|30–40/.test(h));
});
test('1 piercing: kb. 10–20 perc; 2 szemelynek 6 db: kb. 30–40 perc', async () => {
  assert.match(await szoveg({ ...alap, szolgaltatas: '1 db Fejfájás / Migrén Piercing' }), /Időtartam<\/div><div class="e">kb\. 10–20 perc</);
  assert.match(await szoveg({ ...alap, szolgaltatas: '👭 2 személynek - 6 db piercing' }), /Időtartam<\/div><div class="e">kb\. 30–40 perc</);
});
test('ismeretlen szolgaltatasnal az idotartam-sor kimarad', async () => {
  assert.ok(!/Időtartam/.test(await szoveg({ ...alap, szolgaltatas: 'Valami ismeretlen' })));
});
test('a kimeno MP levelek katalogusaban nincs kitalalt hossz ("fel ora", 30–40 / 40–50 perc)', () => {
  const mind = JSON.stringify(katalog);
  assert.ok(!/fél óra|félóra|40–50|30–40 perc/.test(mind.replace(/kb\. 30–40 perc/g, '')), 'a katalogus kitalalt idotartamot tartalmaz');
});
