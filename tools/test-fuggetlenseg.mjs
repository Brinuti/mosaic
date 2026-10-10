// QA-4 (DECISION #120, 1. pont): a lifecycle (emlekezteto-rendszer) es a meresi reteg (QA-1/QA-2: koszonooldali parosito-kulcs, arnyek-elosztas) kozott NINCS kozos irhato allapot
// vagy logika. Statikus ellenorzes: (1) egyik oldal sem importal a masikbol, (2) nincs kozos D1-kotes / adatbazis-azonosito, (3) nincs kozos tabla, (4) a ket oldal altal olvasott
// env-valtozok halmaza diszjunkt (a kozos infrastruktura-valtozok kizarolag a lent felsorolt, mindket oldalon CSAK OLVASOTT, nem irhato allapotot hordozo ertekek),
// (5) nincs kozos KV / R2 / Durable Object kotes. Futtatas: node --test tools/test-fuggetlenseg.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const GYOKER = path.resolve(new URL('..', import.meta.url).pathname);
const olvas = (f) => fs.readFileSync(path.join(GYOKER, f), 'utf8');
function fajlok(mappa, kit = /\.(m?js)$/) {
  const ki = [];
  const be = path.join(GYOKER, mappa);
  if (!fs.existsSync(be)) return ki;
  for (const e of fs.readdirSync(be, { withFileTypes: true })) {
    const rel = path.join(mappa, e.name);
    if (e.isDirectory()) ki.push(...fajlok(rel, kit)); else if (kit.test(e.name)) ki.push(rel);
  }
  return ki;
}

const LIFECYCLE = [...fajlok('netlify/lib/lifecycle'), ...fajlok('functions/api/lifecycle')];
const MERES = [
  ...fajlok('netlify/lib/meres'), 'netlify/lib/foglalas-kulcs.js',
  'functions/api/foglalas-kulcs.js', 'functions/api/foglalas-egyeztetes.js', 'functions/api/meres-erkezes.js', 'functions/api/meres-admin.js',
  'assets/js/attribucio.js', 'assets/js/foglalas-kulcs.js', 'assets/js/booking-engine/booking-id.js',
].filter((f) => fs.existsSync(path.join(GYOKER, f)));

/** Egy fajl relativ importjai (statikus + dinamikus), a repo-gyokerhez kepest feloldva. */
function importok(f) {
  const s = olvas(f);
  const ki = new Set();
  for (const m of s.matchAll(/(?:^|\n)\s*import\s+(?:[^'"\n]*?\s+from\s+)?['"]([^'"]+)['"]/g)) ki.add(m[1]);
  for (const m of s.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) ki.add(m[1]);
  for (const m of s.matchAll(/export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g)) ki.add(m[1]);
  return [...ki].filter((x) => x.startsWith('.')).map((x) => path.normalize(path.join(path.dirname(f), x)));
}
const envNevek = (fajlLista) => {
  const ki = new Set();
  for (const f of fajlLista) {
    const s = olvas(f);
    for (const m of s.matchAll(/\benv\.([A-Z][A-Z0-9_]{2,})/g)) ki.add(m[1]);
    for (const m of s.matchAll(/\benv\[\s*['"]([A-Z][A-Z0-9_]{2,})['"]\s*\]/g)) ki.add(m[1]);
  }
  return ki;
};
const tablak = (fajlLista) => {
  const ki = new Set();
  for (const f of fajlLista) {
    const s = olvas(f);
    for (const m of s.matchAll(/\b(?:CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|INSERT\s+(?:OR\s+\w+\s+)?INTO|(?<!DO\s)UPDATE|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE)\s+([a-z_][a-z0-9_]*)/gi)) if (!['set', 'values', 'select', 'where'].includes(m[1].toLowerCase())) ki.add(m[1].toLowerCase());
  }
  return ki;
};
const metszet = (a, b) => [...a].filter((x) => b.has(x)).sort();

test('a ket fajlkeszlet nem ures (az ellenorzes tenylegesen vizsgal valamit)', () => {
  assert.ok(LIFECYCLE.length >= 10, `lifecycle fajlok: ${LIFECYCLE.length}`);
  assert.ok(MERES.length >= 15, `meres fajlok: ${MERES.length}`);
});

test('1) nincs kozos logika: sem a lifecycle nem importal a meresi retegbol, sem a meresi reteg a lifecycle-bol (kozvetetten sem)', () => {
  const lifecycleMappa = (p) => p.startsWith(path.join('netlify', 'lib', 'lifecycle')) || p.startsWith(path.join('functions', 'api', 'lifecycle'));
  const meresFajl = new Set(MERES.map((f) => path.normalize(f)));
  const meresMappa = (p) => p.startsWith(path.join('netlify', 'lib', 'meres')) || meresFajl.has(path.normalize(p));
  // tranzitiv lezaras: honnan erheto el mit
  const eler = (indul, szures) => {
    const lathato = new Set(); const sor = [...indul];
    while (sor.length) {
      const f = sor.pop(); let tippek;
      try { tippek = importok(f); } catch { continue; }
      for (const t of tippek) { const cel = fs.existsSync(path.join(GYOKER, t)) ? t : (fs.existsSync(path.join(GYOKER, t + '.js')) ? t + '.js' : null); if (!cel || lathato.has(cel)) continue; lathato.add(cel); if (szures(cel)) sor.push(cel); }
    }
    return lathato;
  };
  const lifecycleEler = eler(LIFECYCLE, () => true);
  const meresEler = eler(MERES, () => true);
  assert.deepEqual([...lifecycleEler].filter(meresMappa), [], 'a lifecycle eleri a meresi reteg fajljait');
  assert.deepEqual([...meresEler].filter(lifecycleMappa), [], 'a meresi reteg eleri a lifecycle fajljait');
  // a ket fa kozos fajljai: csak ES-modul "levelek" (tiszta fuggvenykonyvtar), nem allapot. Kiirjuk, hogy lathato legyen.
  const kozos = [...lifecycleEler].filter((f) => meresEler.has(f)).sort();
  console.log('# kozos (mindket oldalrol elerheto) fajlok:', JSON.stringify(kozos));
  assert.deepEqual(kozos, [], 'kozos modul a ket oldal kozott: ellenorizd, hogy nem hordoz-e irhato allapotot');
});

test('2) nincs kozos adatbazis: a D1-kotes neve es az adatbazis-azonosito kulon (eles es elonezet is)', () => {
  const w = olvas('wrangler.toml');
  const blokkok = [...w.matchAll(/\[\[(env\.preview\.)?d1_databases\]\]\s*\n([^[]*)/g)].map((m) => ({
    kornyezet: m[1] ? 'elonezet' : 'eles',
    binding: (/binding\s*=\s*"([^"]+)"/.exec(m[2]) || [])[1],
    id: (/database_id\s*=\s*"([^"]+)"/.exec(m[2]) || [])[1],
    nev: (/database_name\s*=\s*"([^"]+)"/.exec(m[2]) || [])[1],
  }));
  const lc = blokkok.filter((b) => b.binding === 'LIFECYCLE_DB'), mr = blokkok.filter((b) => b.binding === 'KULCS_DB');
  assert.ok(lc.length >= 2, 'LIFECYCLE_DB kotes (eles + elonezet)');
  assert.ok(mr.length >= 1, 'KULCS_DB kotes');
  const ids = blokkok.filter((b) => b.id).map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, 'ket kotes ugyanarra az adatbazis-azonositora mutat');
  for (const a of lc) for (const b of mr) { assert.notEqual(a.id, b.id); assert.notEqual(a.nev, b.nev); assert.notEqual(a.binding, b.binding); }
  // a kodban a lifecycle csak LIFECYCLE_DB-t, a meres csak KULCS_DB-t er el
  const dbNevek = (lista) => { const ki = new Set(); for (const f of lista) for (const m of olvas(f).matchAll(/\b(?:env|k\.env|context\.env)\.([A-Z][A-Z0-9]*_DB)\b/g)) ki.add(m[1]); return ki; };
  assert.deepEqual([...dbNevek(LIFECYCLE)].sort(), ['LIFECYCLE_DB']);
  assert.deepEqual([...dbNevek(MERES)].sort(), ['KULCS_DB']);
});

test('3) nincs kozos tabla (a ket sema tablaneve diszjunkt; a mutalo SQL-t sem kozosen hasznalja a ket oldal)', () => {
  const lc = tablak([...LIFECYCLE, 'netlify/lib/lifecycle/sema.sql'].filter((f) => fs.existsSync(path.join(GYOKER, f))));
  const mr = tablak(MERES);
  // a sema.sql a lifecycle-hoz tartozik (nem .js): kulon beolvassuk
  for (const m of olvas('netlify/lib/lifecycle/sema.sql').matchAll(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z_][a-z0-9_]*)/gi)) lc.add(m[1].toLowerCase());
  assert.ok(lc.has('foglalasok') && lc.has('kuldesek') && lc.has('esemenyek'), 'lifecycle tablak: ' + [...lc]);
  assert.ok(mr.has('foglalas_kulcs') && mr.has('meres_kuldes'), 'meres tablak: ' + [...mr]);
  console.log('# lifecycle tablak:', JSON.stringify([...lc].sort()));
  console.log('# meres tablak:', JSON.stringify([...mr].sort()));
  assert.deepEqual(metszet(lc, mr), [], 'kozos tabla');
});

test('4) a ket oldal altal olvasott env-valtozok diszjunktak (a kozos infrastruktura-ertekek: lent, kizarolag olvasott, nem allapot)', () => {
  const lc = envNevek(LIFECYCLE), mr = envNevek(MERES);
  const kozos = metszet(lc, mr);
  // semleges, mindket oldalon CSAK OLVASOTT konfiguracio (nem irhato allapot): (nincs ilyen jelenleg)
  const MEGENGEDETT = [];
  const nemEngedett = kozos.filter((x) => !MEGENGEDETT.includes(x));
  console.log('# lifecycle env:', JSON.stringify([...lc].sort()));
  console.log('# meres env:', JSON.stringify([...mr].sort()));
  assert.deepEqual(nemEngedett, [], 'kozos env-valtozo: ' + nemEngedett.join(', '));
});

test('5) nincs kozos KV / R2 / Durable Object kotes (a ket oldal csak a sajat D1-et irja)', () => {
  const w = olvas('wrangler.toml');
  const kvK = [...w.matchAll(/binding\s*=\s*"([A-Z0-9_]+)"/g)].map((m) => m[1]).filter((b) => !/_DB$/.test(b));
  const hasznal = (lista) => { const ki = new Set(); for (const f of lista) for (const b of kvK) if (new RegExp(`\\b(?:env|k\\.env|context\\.env)\\.${b}\\b`).test(olvas(f))) ki.add(b); return ki; };
  assert.deepEqual(metszet(hasznal(LIFECYCLE), hasznal(MERES)), [], 'kozos nem-D1 kotes');
  assert.deepEqual([...hasznal(LIFECYCLE)], [], 'a lifecycle nem-D1 kotest er el: ' + [...hasznal(LIFECYCLE)]);
  assert.deepEqual([...hasznal(MERES)], [], 'a meresi reteg nem-D1 kotest er el: ' + [...hasznal(MERES)]);
});

test('6) a ket oldal vegpontjai kulon utvonalon vannak, a kulcsuk kulon (EGYEZTETES_KULCS_HASH / LIFECYCLE_KULCS_HASH)', () => {
  const lc = olvas('netlify/lib/lifecycle/http.js'), mr = olvas('netlify/lib/foglalas-kulcs.js');
  assert.match(lc, /LIFECYCLE_KULCS_HASH/); assert.doesNotMatch(lc, /EGYEZTETES_KULCS_HASH/);
  assert.match(mr, /EGYEZTETES_KULCS_HASH/); assert.doesNotMatch(mr, /LIFECYCLE_KULCS_HASH/);
  assert.ok(fs.existsSync(path.join(GYOKER, 'functions/api/lifecycle/[[kind]].js')));
  for (const f of ['functions/api/foglalas-kulcs.js', 'functions/api/foglalas-egyeztetes.js', 'functions/api/meres-erkezes.js', 'functions/api/meres-admin.js']) assert.ok(fs.existsSync(path.join(GYOKER, f)), f);
});
