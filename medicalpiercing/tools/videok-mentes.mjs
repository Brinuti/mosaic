// A Wix videolejatszoinak (YouTube, Facebook) kesz allapota az eles oldalrol.
//
//   node tools/videok-mentes.mjs [--ujra]   -> tools/wix-videok.json
//
// A Wix a videolejatszo dobozat a szerveroldali HTML-ben uresen hagyja, es csak akkor
// tolti ki (YouTube-keret, illetve a Facebook SDK-javal kirajzolt Facebook-keret), amikor
// a doboz a kepernyore gorog. Ami igy a mentett oldalba (tools/raw, tools/elo-dom) uresen
// vagy rejtve kerult, azt itt a Wixen egyenkent a kepernyore gorgetjuk, megvarjuk a
// keretet, es a doboz tartalmat elmentjuk; a wix2static.mjs (es a klon/ meglevo lapjaira a
// tools/videok-potlas.mjs) ezzel tolti ki. A mar elmentett dobozokat csak --ujra eseten
// kerdezi le ujra.
//
// Merokeres nem megy ki (tools/meres-tiltas.mjs); egyedul a Facebook SDK-ja toltodhet be,
// mert a Facebook-videot az rajzolja ki (a Meta-pixel, fbevents.js, tovabbra is tiltva).
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from './pw.mjs';
import { MERES } from './meres-tiltas.mjs';
import { uresVideok, ADAT } from './videok-potlas.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const UJRA = process.argv.includes('--ujra');
const adat = fs.existsSync(ADAT) ? JSON.parse(fs.readFileSync(ADAT, 'utf8')) : {};

// lapok (nezet + kulcs) es a kitoltendo dobozok
const kell = {};
for (const nezet of ['asztali', 'mobil']) {
  const mappa = path.join(ROOT, nezet === 'mobil' ? 'klon/m' : 'klon');
  for (const f of fs.readdirSync(mappa, { recursive: true }).filter((x) => x.endsWith('.html'))) {
    if (nezet === 'asztali' && f.startsWith('m/')) continue;
    const kulcs = f.replace(/\.html$/, '');
    // a koszonooldalak megnyitasa a Wixen konverziot jelezhetne: azokat kihagyjuk
    if (kulcs.startsWith('foglalas-ok')) continue;
    const lap = `${nezet} ${kulcs}`;
    const idk = uresVideok(fs.readFileSync(path.join(mappa, f), 'utf8'));
    if (UJRA) idk.push(...Object.keys(adat[lap] || {}));
    if (idk.length) kell[lap] = [...new Set(idk)];
  }
}
console.log(Object.values(kell).flat().length + ' doboz, ' + Object.keys(kell).length + ' lap');

const SDK = /connect\.facebook\.net\/[A-Za-z_]+\/(bundle\/)?sdk(\.js|\/)/;
const b = await chromium.launch();
const sorok = Object.entries(kell);
let hiba = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  for (let s; (s = sorok.shift());) {
    const [lap, idk] = s;
    const [nezet, kulcs] = lap.split(' ');
    const ctx = await b.newContext(nezet === 'mobil' ? { ...devices['Pixel 5'], locale: 'hu-HU' } : { viewport: { width: 1440, height: 900 }, locale: 'hu-HU' });
    await ctx.route(MERES, (r) => (SDK.test(r.request().url()) ? r.continue() : r.abort()));
    const p = await ctx.newPage();
    try {
      await p.goto('https://www.medicalpiercing.hu/' + (kulcs === 'index' ? '' : kulcs), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await p.waitForTimeout(4000);
      for (const id of idk) {
        const r = await p.evaluate(async (id) => {
          const e = document.getElementById(id);
          if (!e) return { hiba: 'nincs ilyen doboz' };
          const kesz = () => {
            const fb = e.querySelector('.fb-video');
            if (fb) { const k = fb.querySelector('iframe'); return fb.getAttribute('fb-xfbml-state') === 'rendered' && k && k.style.visibility === 'visible'; }
            return !!e.querySelector('iframe[src], video, [data-testid="playable"]');
          };
          for (let i = 0; i < 40 && !kesz(); i++) { e.scrollIntoView({ block: 'center' }); await new Promise((ok) => setTimeout(ok, 500)); }
          if (!kesz()) return { hiba: 'nem toltodott be: ' + e.innerHTML.slice(0, 200) };
          return { html: e.innerHTML };
        }, id);
        if (r.hiba) { hiba++; console.log(`HIBA ${lap} ${id}: ${r.hiba}`); continue; }
        // a GTM YouTube-figyelojenek jelzese nem a lejatszo resze
        (adat[lap] ||= {})[id] = r.html.replace(/ data-gtm-yt-inspected-[\w-]+="[^"]*"/g, '');
        console.log(`${lap} ${id}: ${(r.html.match(/(?:youtube\.com\/embed\/[\w-]+|facebook\.com%2F[^&]*videos%2F\d+)/) || ['?'])[0]}`);
      }
    } catch (e) { hiba++; console.log(`HIBA ${lap}: ${e.message.slice(0, 120)}`); }
    await ctx.close();
  }
}));
await b.close();
const rendezett = Object.fromEntries(Object.keys(adat).sort().map((k) => [k, adat[k]]));
fs.writeFileSync(ADAT, JSON.stringify(rendezett, null, 1) + '\n');
console.log(hiba ? `${hiba} HIBA` : 'kesz');
process.exit(hiba ? 1 : 0);
