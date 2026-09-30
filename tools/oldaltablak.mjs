// A klon.js kezzel vezetett tablazatainak (KATTINTOS, BEAGYAZASOK, GYIK_DOBOZOK,
// ARLISTA_DOBOZOK) automatikus kiegeszitese minden olyan oldalra, amelyet kesobb
// hoztunk at (pl. a menuben nem szereplo kampany- es koszonooldalak).
//
//   node tools/oldaltablak.mjs
//
// Bemenet: tools/wix-oldaladatok.json es tools/wix-json/*.json (a
// tools/wix-oldaladatok.mjs tolti le), assets/embed/*.html, tools/commonninja/*.json.
// Kimenet: assets/js/oldaltablak.js  (window.MH_TABLAK), a klon.js olvassa be.
// A klon.js-ben kezzel felvett dobozokat nem irja felul.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const adat = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/wix-oldaladatok.json'), 'utf8'));
const klonJs = fs.readFileSync(path.join(ROOT, 'assets/js/klon.js'), 'utf8');
const kezi = new Set(klonJs.match(/'comp-[a-z0-9]+'/g).map((s) => s.slice(1, -1)));

// doboz -> Wix komponenstipus (a nyers page JSON-okbol)
const tipus = {};
const JSONOK = path.join(ROOT, 'tools/wix-json');
for (const f of fs.readdirSync(JSONOK)) {
  const s = fs.readFileSync(path.join(JSONOK, f), 'utf8');
  for (const m of s.matchAll(/"(comp-[a-z0-9]+)":\{"componentType":"([A-Za-z.]+)"/g)) {
    tipus[m[1]] = m[2].split('.').pop();
  }
}

// beagyazasok fajtaja: Common Ninja (GYIK / tablazat / torolt), Trustindex, egyeb keret
const cnTipus = (nev) => {
  const f = path.join(ROOT, 'tools/commonninja', nev + '.json');
  if (!fs.existsSync(f)) return null;
  const v = JSON.parse(fs.readFileSync(f, 'utf8'));
  return v.data ? v.data.widgetData.appMeta.type : 'torolt';
};
const embedFajta = (nev) => {
  const f = path.join(ROOT, 'assets/embed', nev + '.html');
  if (!fs.existsSync(f)) return ['hianyzik'];
  const s = fs.readFileSync(f, 'utf8');
  if (/commoninja/.test(s)) return ['cn', cnTipus(nev)];
  if (/trustindex/.test(s)) return ['keret', 'Vendégértékelések', 'Trustindex'];
  if (/123formbuilder/.test(s)) return ['keret', 'Időpontkérés', '123FormBuilder'];
  return ['keret', 'Beágyazott tartalom', 'külső szolgáltató'];
};

const GYIK_1 = 'c2eb0f_e2a637ece2437154df156d36cae403f4';
const GYIK_2 = 'c2eb0f_dab261d3e84629df7798238e716f0266';

const ki = { kattintos: {}, beagyazasok: {}, embedek: {}, gyik: {}, arlista: {}, rejtett: [] };
const figyelem = [];
for (const [oldal, dobozok] of Object.entries(adat)) {
  const gyikOldalon = {};
  for (const [azon, t] of Object.entries(dobozok)) {
    if (kezi.has(azon)) continue;
    const tip = tipus[azon] || '';
    // VideoPlayer: poszter + kattintasra indulo video; az asztalin magatol
    // indulok "auto" jelolest kapnak (klon.js 4b)
    if (t.lejatszo) {
      const l = t.lejatszo.asztali || t.lejatszo.mobil;
      const yt = (l.src.match(/youtube\.com\/watch\?v=([\w-]+)|youtu\.be\/([\w-]+)/) || []).slice(1).find(Boolean);
      if (yt) { ki.beagyazasok[azon] = 'yt:' + yt; continue; }
      const id = (l.src.match(/video\/([a-z0-9]+_[a-f0-9]{32})/) || [])[1];
      const kocka = ((l.poszter || '').match(/(f\d{3})\.jpg$/) || [])[1] || 'f000';
      if (!id) { figyelem.push(`${oldal} ${azon}: video azonosito nelkul`); continue; }
      const auto = t.lejatszo.asztali && t.lejatszo.asztali.autoplay;
      ki.kattintos[azon] = `${id}/${kocka}${auto ? '/auto' : ''}`;
      continue;
    }
    const html = t.url.map((u) => (u.match(/filesusr\.com\/html\/([a-z0-9_]+)\.html/) || [])[1]).find(Boolean);
    if (html && tip !== 'WRichText') {
      const [fajta, a, b] = embedFajta(html);
      if (fajta === 'cn') {
        if (a === 'accordion') (gyikOldalon[html] || (gyikOldalon[html] = [])).push(azon);
        else if (a === 'comparison_table') ki.arlista[azon] = html;
        // a torolt widget helye az eles oldalon is ures
      } else if (fajta === 'keret') {
        ki.beagyazasok[azon] = html;
        ki.embedek[html] = [a, b];
      } else figyelem.push(`${oldal} ${azon}: hianyzo beagyazas ${html}`);
      continue;
    }
    // A Wix-szerkesztobe szovegkent beirt Trustindex-kod: az eles oldalon nyers
    // szovegkent latszik, a klonban elrejtjuk (mint a #comp-m7qaa89h-t)
    if (t.url.some((u) => /trustindex\.io\/loader/.test(u)) && tip === 'WRichText') {
      ki.rejtett.push(azon);
    }
  }
  // Ahol a ket fooldali GYIK egymas alatt van, egy listaba kerulnek (mint a fooldalon)
  const g1 = gyikOldalon[GYIK_1], g2 = gyikOldalon[GYIK_2];
  if (g1 && g2) {
    ki.gyik[g1[0]] = [GYIK_1, GYIK_2];
    ki.gyik[g2[0]] = null;
    delete gyikOldalon[GYIK_1]; delete gyikOldalon[GYIK_2];
  }
  for (const [nev, lista] of Object.entries(gyikOldalon)) for (const azon of lista) ki.gyik[azon] = [nev];
}
// Google-terkepek
for (const [azon, tip] of Object.entries(tipus)) {
  if (tip === 'GoogleMap' && !kezi.has(azon)) ki.beagyazasok[azon] = 'terkep';
}

fs.writeFileSync(path.join(ROOT, 'assets/js/oldaltablak.js'),
  '// A tools/oldaltablak.mjs generalja - kezzel ne szerkeszd.\n' +
  '// A klon.js tablazatainak kiegeszitese a kesobb athozott oldalakhoz.\n' +
  'window.MH_TABLAK = ' + JSON.stringify(ki, null, 1) + ';\n');
console.log(Object.entries(ki).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : Object.keys(v).length}`).join(', '));
for (const f of figyelem) console.log('FIGYELEM:', f);
