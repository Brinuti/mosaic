// Az uj oldalak sajat stilusai es szkriptjei tomoritve (minify) a dist/-ben (a build hivja, tools/build.mjs; gyorsitas, 2026-10-17: a Lighthouse /
// PageSpeed minden oldalon jelezte a "Minify CSS / JavaScript" tetelt). A forras (assets/) olvashato marad, csak a kiszolgalt fajl kisebb.
// A merokod fajljaihoz NEM nyulunk (suti.js, mp-meres.js, motor-indito.js, motor/salonic-adapter.js, motor/booking-id.js: valtozatlanul mennek ki),
// a regi (Wix-klon) lapok fajljaihoz sem. Ha az esbuild nincs telepitve, a lepes kimarad (a lap ugyanugy mukodik, csak nagyobb fajlokkal).
import fs from 'node:fs';
import path from 'node:path';

const CSS = ['uj-fooldal', 'uj-oldalak', 'uj-kategoria', 'uj-sajat', 'uj-egyseges', 'uj-b'].map((n) => `assets/css/${n}.css`);
const JS = ['assets/js/uj-fooldal.js', 'assets/js/uj-oldalak.js', 'assets/js/motor/motor.js', 'assets/js/motor/terkep.js', 'assets/js/motor/tipus.js'];

export async function tomorit(DIST) {
  let esbuild;
  try { esbuild = await import('esbuild'); } catch (e) { return 'az esbuild nincs telepitve: kihagyva'; }
  let elotte = 0, utana = 0, db = 0;
  for (const f of [...CSS, ...JS]) {
    const p = path.join(DIST, f);
    if (!fs.existsSync(p)) continue;
    const forras = fs.readFileSync(p, 'utf8');
    try {
      const r = await esbuild.transform(forras, { loader: f.endsWith('.css') ? 'css' : 'js', minify: true, legalComments: 'none', charset: 'utf8' });
      fs.writeFileSync(p, r.code);
      elotte += Buffer.byteLength(forras); utana += Buffer.byteLength(r.code); db++;
    } catch (e) { console.warn(`  ! tomorites kihagyva (${f}): ${e.message.split('\n')[0]}`); }
  }
  return `${db} fajl, ${Math.round(elotte / 1024)} kB -> ${Math.round(utana / 1024)} kB`;
}
