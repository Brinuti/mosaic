// A probaeszkozok sajat-iras kapcsoloja (DECISION #198): MERES_SAJAT_IRAS=1 nelkul minden POST az elo domainre tiltott; kapcsolo mellett KIZAROLAG a
// /api/meres-erkezes es a /api/foglalas-kulcs (POST, www.mosaicheadspa.hu). A jegyzettomb, a tolcser-szamlalo, a masik host, a GET es a hirdetesi vegpontok tovabbra is tiltottak.
import assert from 'node:assert/strict';
import { sajatIras, engedett, platformOf } from './meres-proba/tilt.mjs';

const H = 'https://www.mosaicheadspa.hu';
const ESETEK_ENGEDETT = [
  [H + '/api/meres-erkezes', 'POST'],
  [H + '/api/foglalas-kulcs', 'POST'],
  [H + '/api/meres-erkezes?x=1', 'POST'],
];
const ESETEK_TILTOTT = [
  [H + '/api/foglalas-esemeny', 'POST'],                   // jegyzettomb
  [H + '/api/foglalo-szamlalo', 'POST'],                   // tolcser-szamlalo
  [H + '/api/meres-admin', 'POST'],                        // admin
  [H + '/api/meres-erkezes-masik', 'POST'],                // nem pontos utvonal
  [H + '/api/foglalas-kulcs/x', 'POST'],
  [H + '/api/meres-erkezes', 'GET'],                       // csak POST
  ['https://mosaic-d77.example.com/api/meres-erkezes', 'POST'],
  ['https://evil.example/https://www.mosaicheadspa.hu/api/meres-erkezes', 'POST'],
  ['https://stape.mosaicheadspa.hu/g/collect', 'POST'],    // mero vegpont
  ['https://capig.stape.do/x', 'POST'],
];

delete process.env.MERES_SAJAT_IRAS;
for (const [u, m] of [...ESETEK_ENGEDETT, ...ESETEK_TILTOTT]) assert.equal(sajatIras(u, m), false, 'kapcsolo nelkul tiltott: ' + m + ' ' + u);
assert.equal(engedett(H + '/api/meres-erkezes', 'POST'), false, 'kapcsolo nelkul az engedett() sem enged');

process.env.MERES_SAJAT_IRAS = '1';
for (const [u, m] of ESETEK_ENGEDETT) { assert.equal(sajatIras(u, m), true, 'kapcsolo mellett engedett: ' + u); assert.equal(engedett(u, m), true); }
for (const [u, m] of ESETEK_TILTOTT) { assert.equal(sajatIras(u, m), false, 'kapcsolo mellett is tiltott: ' + m + ' ' + u); }
assert.equal(platformOf('https://stape.mosaicheadspa.hu/g/collect'), 'stape', 'a stape tovabbra is mero-platform');
for (const v of ['0', 'true', 'igen', '']) { process.env.MERES_SAJAT_IRAS = v; assert.equal(sajatIras(H + '/api/meres-erkezes', 'POST'), false, 'csak az "1" ertek kapcsol: ' + JSON.stringify(v)); }
delete process.env.MERES_SAJAT_IRAS;
console.log('test-tilt-sajat-iras: OK (' + (ESETEK_ENGEDETT.length + ESETEK_TILTOTT.length) + ' eset x 2 allapot)');
