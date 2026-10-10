// A marketing-kapcsolo (tulajdonosi dontes, 2026-10-10): alapbol KI, es kikapcsolva semmilyen marketing sablon nem ker es nem megy ki, a tranzakcios / gondozasi igen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MARKETING } from '../lib/constants.js';
import KATALOG from '../lib/messages/katalog.js';
import { kapuErtekel } from '../lib/messages/kapuk.js';

// a fixture a tesztekhez bekapcsolja; az eles alapertek a constants.js-ben a kikapcsolt allapot
test('MK01 az eles alapertek: a marketing ki van kapcsolva', async () => {
  const forras = (await import('node:fs')).readFileSync(new URL('../lib/constants.js', import.meta.url), 'utf8');
  assert.match(forras, /export const MARKETING = \{ be: false \};/);
});

test('MK02 kikapcsolt marketingnel minden marketing sablon KIHAGY (consenttel is), a tranzakcios es gondozasi mehet', () => {
  const regi = MARKETING.be;
  MARKETING.be = false;
  try {
    const jo = { consent_email: true, consent_sms: true, content_ready: true, recipient_email: 'a@example.invalid', recipient_phone: '+36301234567', booking_status: 'completed', next_active_booking: null };
    const sablonok = Object.values(KATALOG);
    const marketing = sablonok.filter((s) => s.csoport === 'marketing');
    assert.ok(marketing.length >= 8);
    for (const s of marketing) {
      const r = kapuErtekel(s, jo, { most: 1_800_000_000, esedekes: 1_800_000_000 });
      assert.equal(r.dontes, 'kihagy', `${s.azonosito} marketing kikapcsolva`);
      assert.ok(r.kodok.includes('marketing_kikapcsolva'), `${s.azonosito}: ok-kod`);
    }
    const gondozas = sablonok.filter((s) => s.csoport === 'care' || s.csoport === 'transactional');
    assert.ok(gondozas.length >= 10);
    for (const s of gondozas) {
      const r = kapuErtekel(s, jo, { most: 1_800_000_000, esedekes: 1_800_000_000 });
      assert.ok(!(r.kodok || []).includes('marketing_kikapcsolva'), `${s.azonosito} nem erintett`);
    }
  } finally { MARKETING.be = regi; }
});
