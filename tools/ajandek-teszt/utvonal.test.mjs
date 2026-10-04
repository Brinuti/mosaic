// A kozos utvonal-logika (netlify/lib/utvonal.js) biztonsagi tesztje: nincs nyitott atiranyitas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { utvonal } from '../../netlify/lib/utvonal.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0)';
// a Location fejlecbe kerulo ertek (mint az edge-fuggvenyben: encodeURI(atiranyit) + search)
const loc = (d) => encodeURI(d.atiranyit);
// a bongeszo akkor kovet kulso hostra, ha a Location "//" vagy "\" elotaggal kezdodik
const kulsoRe = /^(\/\/|\/\\|\\|[a-z][a-z0-9+.-]*:)/i;

test('nyitott atiranyitas: tobbszoros perjel / visszaper elejen helyi cimre iranyit', () => {
  for (const ut of ['//evil.example/', '///evil.example/', '//evil.example', '/\\evil.example/', '/\\/evil.example/', '////', '//']) {
    const d = utvonal(ut, UA);
    if (d.atiranyit !== undefined) {
      assert.match(loc(d), /^\/(?![/\\])/, `${ut} -> ${loc(d)} nem helyi cim`);
      assert.doesNotMatch(loc(d), kulsoRe, `${ut} -> ${loc(d)} kulso cimre mutat`);
    } else {
      // nincs atiranyitas: a lapfajl neve a '/_a/' ala kerul, kulso host nem erintett
      assert.match(d.atir, /^\/_[am]\//);
    }
  }
});

test('a rendes cimek valtozatlanok', () => {
  assert.deepEqual(utvonal('/headspa-budapest', UA), { atir: '/_a/headspa-budapest' });
  assert.deepEqual(utvonal('/ajandek', UA), { atir: '/_a/ajandek' });
  assert.deepEqual(utvonal('/ajandek', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), { atir: '/_m/ajandek' });
  assert.deepEqual(utvonal('/ajandek/', UA), { atiranyit: '/ajandek' });
  assert.deepEqual(utvonal('/m/headspa-budapest', UA), { atiranyit: '/headspa-budapest' });
  assert.deepEqual(utvonal('/headspa-budapest.html', UA), { atiranyit: '/headspa-budapest' });
  assert.deepEqual(utvonal('/', UA), { atir: '/_a/fooldal' });
  assert.equal(utvonal('/api/ajandek/rendeles', UA), null);
  assert.equal(utvonal('/assets/img/x.jpg', UA), null);
});

test('a regi Wix-cimek (/contact, /services, /en) 301-gyel a nyitooldalra mennek, egy lepesben', () => {
  for (const ut of ['/contact', '/services', '/en', '/contact/', '/services/', '/en/', '/en.html', '/m/contact']) {
    assert.deepEqual(utvonal(ut, UA), { atiranyit: '/' }, ut);
  }
  // a mobil felhasznalo-azonosito sem szamit; a Location nem kulso cim
  assert.deepEqual(utvonal('/en', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), { atiranyit: '/' });
  // az ideiglenes lezer-cim tovabbra is az eredetire mutat, a hasonlo nevu cimek valtozatlanok
  assert.deepEqual(utvonal('/lezeres-szortelenites-budapest-uj', UA), { atiranyit: '/lezeres-szortelenites-budapest' });
  assert.deepEqual(utvonal('/lezeres-szortelenites-budapest-uj/', UA), { atiranyit: '/lezeres-szortelenites-budapest' });
  assert.deepEqual(utvonal('/services-extra', UA), { atir: '/_a/services-extra' });
  assert.deepEqual(utvonal('/english', UA), { atir: '/_a/english' });
  // az objektum-prototipus kulcsai nem lehetnek atiranyitasok
  assert.deepEqual(utvonal('/constructor', UA), { atir: '/_a/constructor' });
  assert.deepEqual(utvonal('/__proto__', UA), { atir: '/_a/__proto__' });
});
