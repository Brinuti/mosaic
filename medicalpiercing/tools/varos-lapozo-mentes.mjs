// A varosoldalak (/varosok/...) CMS-lapozojanak ("Previous" / "Next") celjai az eles oldalrol.
//
//   node tools/varos-lapozo-mentes.mjs   -> assets/data/varos-lapozo.json
//
// A Wix a lapozogombokat a helyszin-gyujtemeny sorrendje szerint JS-bol kezeli (nincs bennuk
// link), es a gyujtemeny valtozasaval valtoznak: ahol nincs elozo / kovetkezo elem, ott a gomb
// tiltott. Itt minden varosoldalon megnyomjuk mindket gombot, es feljegyezzuk, hova visz (vagy
// hogy tiltott). A klon.js 9. szakasza ebbol allitja be a gombokat. A gyujtemeny bovulese utan
// ujra kell futtatni.
//
// Merokeres nem megy ki (tools/meres-tiltas.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from './pw.mjs';
import { mindenOldal } from './oldalak.mjs';
import { meresTiltas } from './meres-tiltas.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DOMAIN = 'https://www.medicalpiercing.hu';
const lapok = mindenOldal().filter((o) => o.ut.startsWith('/varosok/'));
const b = await chromium.launch();
const ki = {};
const sor = [...lapok];
await Promise.all(Array.from({ length: 2 }, async () => {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'hu-HU' });
  await meresTiltas(ctx);
  const p = await ctx.newPage();
  for (let o; (o = sor.shift());) {
    const cel = {};
    // a Wix neha nem engedi / nem lapoz elsore: ami ures maradt, azt meg egyszer megprobaljuk
    for (const [gomb, kulcs] of [['Previous', 'elozo'], ['Next', 'kovetkezo'], ['Previous', 'elozo'], ['Next', 'kovetkezo']]) {
      if (cel[kulcs]) continue;
      // a cim a Wixen a slug-on beluli perjelet is kodolja (%2F), pl. .../4031-debrecen%2C-derék-utca-100%2Fb
      await p.goto(DOMAIN + '/varosok/' + encodeURIComponent(o.ut.slice('/varosok/'.length)), { waitUntil: 'domcontentloaded', timeout: 60000 });
      const g = p.locator(`button[aria-label="${gomb}"]`).first();
      // a Wix a gombot csak a gyujtemeny betoltese utan engedi: legfeljebb 25 mp-ig varunk ra
      let tiltott = true;
      for (let i = 0; i < 50 && tiltott; i++) {
        await p.waitForTimeout(500);
        if (await g.count()) tiltott = await g.evaluate((e) => e.disabled || e.getAttribute('aria-disabled') === 'true');
      }
      if (tiltott) { cel[kulcs] = null; continue; }
      await p.waitForTimeout(1000);
      await g.click({ timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(4000);
      const uj = decodeURIComponent(new URL(p.url()).pathname);
      cel[kulcs] = uj !== o.ut ? uj : null;
    }
    ki[o.ut] = cel;
    console.log(`${o.ut}  <- ${cel.elozo || '-'}  -> ${cel.kovetkezo || '-'}`);
  }
  await ctx.close();
}));
await b.close();
fs.mkdirSync(path.join(ROOT, 'assets/data'), { recursive: true });
const rendezett = Object.fromEntries(Object.keys(ki).sort().map((k) => [k, ki[k]]));
fs.writeFileSync(path.join(ROOT, 'assets/data/varos-lapozo.json'), JSON.stringify(rendezett, null, 1) + '\n');
console.log(`${Object.keys(ki).length} varosoldal -> assets/data/varos-lapozo.json`);
