// A mobil oldalak (dist/_m) kepei: minden /assets/img/m/... hivatkozasnak lennie kell a dist-ben.
// Miert: a build az assets/img/m/ mappaba kicsinyitett kepeket tesz, a tobbit (mar eleve kicsit) atmasolja. Ha az m/ alatt mar
// letezik egy mappa (pl. m/fooldal/), a build korabban az egesz mappat kihagyta, igy a fooldal/haj/ kepei telefonon torve
// jelentek meg ("Milyen lesz a hajad" sor, 2026-10-09). Ez a teszt a legszelesebb fogast adja: a build kimenete.
//
//   node tools/netlify-build.mjs && node --test tools/fooldal-teszt/mobil-kepek.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { GYOKER } from '../headspa-teszt/szerver.mjs';

const DIST = path.join(GYOKER, 'dist');
if (!fs.existsSync(path.join(DIST, '_m', 'fooldal.html'))) execFileSync('node', [path.join(GYOKER, 'tools', 'netlify-build.mjs')], { cwd: GYOKER, stdio: 'ignore' });

test('a mobil oldalak minden /assets/img/m/ hivatkozasa letezik a dist-ben (almappak is: fooldal/haj/)', () => {
  const mappa = path.join(DIST, '_m');
  const hianyzo = [];
  let db = 0;
  for (const f of fs.readdirSync(mappa).filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(mappa, f), 'utf8');
    for (const m of html.matchAll(/\/assets\/img\/m\/[^"'()\s,>]+/g)) {
      db++;
      const fajl = path.join(DIST, decodeURIComponent(m[0].split(/[?#]/)[0]));
      if (!fs.existsSync(fajl)) hianyzo.push(m[0] + '  <-  ' + f);
    }
  }
  assert.ok(db > 1000, 'a vizsgalat tenylegesen sok hivatkozast talalt: ' + db);
  assert.deepEqual([...new Set(hianyzo)].slice(0, 20), [], 'hianyzo mobil kepek');
});

test('a fooldal haj-sor mind a 21 kepe megvan a mobil mappaban is', () => {
  for (let i = 1; i <= 21; i++) {
    const n = String(i).padStart(2, '0');
    assert.ok(fs.existsSync(path.join(DIST, 'assets', 'img', 'm', 'fooldal', 'haj', `haj-${n}.jpg`)), `m/fooldal/haj/haj-${n}.jpg`);
  }
});

test('a build a mappakat egyesiti: a mar kicsinyitett kepeket nem irja felul, a hianyzokat potolja', () => {
  const build = fs.readFileSync(path.join(GYOKER, 'tools', 'netlify-build.mjs'), 'utf8');
  assert.match(build, /cpSync\(path\.join\(IMG, f\), path\.join\(IMG_M, f\), \{ recursive: true, force: false/);
  const forras = path.join(GYOKER, 'assets', 'img', 'm', 'fooldal', 'kezelo.jpg');
  if (fs.existsSync(forras)) {
    assert.equal(fs.statSync(path.join(DIST, 'assets', 'img', 'm', 'fooldal', 'kezelo.jpg')).size, fs.statSync(forras).size, 'a kicsinyitett kep megmaradt (nem az eredeti masolat)');
  }
});
