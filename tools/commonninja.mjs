// A Common Ninja widgetek (GYIK-ok, arlistak) tartalmanak kivaltasa sajat kodra.
//
// Az eles oldalon a GYIK-ok es a fodrasz-arlistak fizetos Common Ninja widgetek.
// A klon ezek helyett sajat harmonikat es tablazatot rajzol (klon.js 5b.), a
// tartalmat pedig ez a szkript tolti le egyszer a Common Ninja API-jarol:
//
//   node tools/commonninja.mjs
//
// Kell hozza halozat a cdn.commoninja.com fele. (Ha a Node fetch-et a Common
// Ninja 403-mal elutasitja, a curl mukodik: a szkript ilyenkor azt hivja.) A nyers valaszok a
// tools/commonninja/ ala kerulnek, igy halozat nelkul is ujrageneralhato
// (node tools/commonninja.mjs --helyi). Kimenet:
//   assets/js/gyik.js      window.MH_GYIK    = { <embed>: [[kerdes, valasz-HTML], ...] }
//   assets/js/arlistak.js  window.MH_ARLISTAK = { <embed>: { fejlec: [...], sorok: [[...], ...] } }
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const EMBED = path.join(ROOT, 'assets/embed');
const NYERS = path.join(ROOT, 'tools/commonninja');
const HELYI = process.argv.includes('--helyi');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
fs.mkdirSync(NYERS, { recursive: true });

// csak a biztonsagos formazo cimkeket hagyjuk meg a valaszokban
const tisztit = (h) => String(h || '')
  .replace(/<(?!\/?(p|br|b|strong|i|em|u|ul|ol|li|a)\b)[^>]*>/gi, '')
  .replace(/<a\b[^>]*?href="([^"]*)"[^>]*>/gi, '<a href="$1" target="_blank" rel="noopener">')
  .replace(/\s+/g, ' ').trim();
const szoveg = (h) => tisztit(h).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

// Kezi javitasok a Common Ninja-ban elirt adatokon: widget -> [[rossz, jo], ...]
const JAVITASOK = {
  // Noel arlista, "Tofestes + vagas + szaritas" / Extra hosszu haj: az akcios ar
  // magasabb volt az eredetinel; a tobbi sor alapjan (-20%) 27.960 Ft a helyes.
  'c2eb0f_ebe819c8a20603ef818d0ff477702c21': [['34.950 Ft helyett 35.160 Ft', '34.950 Ft helyett 27.960 Ft']],
};
const javit = (nev, x) => (JAVITASOK[nev] || []).reduce((a, [rossz, jo]) => (a === rossz ? jo : a), x);

const gyik = {}, arlistak = {};
for (const f of fs.readdirSync(EMBED).filter((x) => x.endsWith('.html'))) {
  const pid = (fs.readFileSync(path.join(EMBED, f), 'utf8').match(/pid-([0-9a-f-]{36})/) || [])[1];
  if (!pid) continue;
  const nev = f.replace(/\.html$/, '');
  const mentes = path.join(NYERS, nev + '.json');
  if (!HELYI) {
    const url = `https://cdn.commoninja.com/api/v1/embed/${pid}`;
    const v = await fetch(url, { headers: { 'user-agent': UA } }).catch(() => null);
    if (v && v.ok) fs.writeFileSync(mentes, await v.text());
    else {
      try { execFileSync('curl', ['-sf', '--max-time', '30', '-A', UA, url, '-o', mentes]); }
      catch { console.log(`${nev}: letoltes sikertelen (${v ? 'HTTP ' + v.status : 'halozati hiba'}), a mentett adatot hasznalom`); }
    }
  }
  if (!fs.existsSync(mentes)) { console.log(`${nev}: nincs mentett adat`); continue; }
  const valasz = JSON.parse(fs.readFileSync(mentes, 'utf8'));
  // a Common Ninja-ban torolt widget: az eles oldalon is ures a helye
  if (!valasz.data) { console.log(`${nev}: nincs ilyen widget (${valasz.message || 'ures valasz'})`); continue; }
  const w = valasz.data.widgetData;
  const adat = w.pluginData.data;
  if (w.appMeta.type === 'accordion') {
    gyik[nev] = adat.questions.map((q) => [szoveg(q.text), tisztit(q.answer && q.answer.text)]);
    console.log(`${nev}: GYIK "${w.pluginData.name}", ${gyik[nev].length} kerdes`);
  } else if (w.appMeta.type === 'comparison_table') {
    arlistak[nev] = {
      nev: w.pluginData.name,
      fejlec: adat.columns.map((c) => szoveg(c.content && c.content.text)),
      sorok: adat.rows.map((r) => r.cells.map((c) => javit(nev, szoveg(c.content && c.content.text)))),
    };
    console.log(`${nev}: tablazat "${w.pluginData.name}", ${arlistak[nev].sorok.length} sor`);
  } else {
    console.log(`${nev}: ismeretlen tipus (${w.appMeta.type})`);
  }
}

const fejlec = '// A tools/commonninja.mjs generalja - kezzel ne szerkeszd.\n';
fs.writeFileSync(path.join(ROOT, 'assets/js/gyik.js'), fejlec + 'window.MH_GYIK = ' + JSON.stringify(gyik) + ';\n');
fs.writeFileSync(path.join(ROOT, 'assets/js/arlistak.js'), fejlec + 'window.MH_ARLISTAK = ' + JSON.stringify(arlistak) + ';\n');
