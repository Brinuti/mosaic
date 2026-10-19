// Statikus ellenorzes (DECISION #205, csak-meres): a motor (engine.js) a meter.* hivasok nelkul AZONOS a kiindulassal.
//
//   node tools/meres-proba/engine-meter-diff.mjs [<git-ref> = origin/main] [<fajl> = assets/js/booking-engine/engine.js]
//
// Mit bizonyit: ha a kiindulas (<git-ref>) es a mostani fajl FORRASABOL kitoroljuk az osszes `meter.<nev>(...)` hivast (kiegyensulyozott zarojelekkel, sztringek / sablonok / regex-ek / megjegyzesek
// figyelembevetelevel), a megjegyzeseket, es osszevonjuk a szokozoket, a ket szoveg BETURE EGYEZIK. Vagyis a diff csak mero hivasokat ad: nem kerul be uj dontes, ag, idozito, atiranyitas, kattintas-kezeles,
// API-hivas, nezetvaltas, a Salonic-kapcsolat nem valtozik; a meter hivasok argumentumai a motor allapotanak olvasasai (a meter maga try / catch-ben fut, a kimenete nem hat a vezerlesre).
// Kilepesi kod: 0 = azonos, 1 = elteres (a kulonbseg helye kiirva), 2 = hasznalati / olvasasi hiba.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEZDET_ELOTT = new Set([...'(,=:[!&|?{};+-*%<>~^']); // ezek utan a `/` regex-literal (nem osztas)

// Az src-bol a `meter.<nev>(...)` hivasok (es a kozvetlenul koveto `;`), a megjegyzesek kitorlese; a szokozok osszevonva. Sztring / sablon / regex tartalmat nem bantja.
export function meterNelkul(src) {
  const n = src.length; let i = 0; let out = ''; let elozo = ''; // elozo: az utolso nem-szokoz karakter (regex-felismeres)
  const hivas = /(?<![A-Za-z0-9_$.])meter\.[A-Za-z_$][\w$]*\(/y;
  // egy sztring / sablon / regex vegenek keresese (i a nyito karakteren); visszaadja a veg utani indexet
  const sztringVeg = (j) => {
    const q = src[j]; j += 1;
    while (j < n) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (q === '`' && c === '$' && src[j + 1] === '{') { j = kifejezesVeg(j + 2); continue; }
      if (c === q) return j + 1;
      j += 1;
    }
    throw new Error('lezaratlan sztring / sablon');
  };
  const regexVeg = (j) => { // j a nyito `/`
    j += 1; let osztaly = false;
    while (j < n) {
      const c = src[j];
      if (c === '\\') { j += 2; continue; }
      if (c === '[') osztaly = true; else if (c === ']') osztaly = false;
      else if (c === '/' && !osztaly) { j += 1; while (/[a-z]/i.test(src[j] || '')) j += 1; return j; }
      else if (c === '\n') throw new Error('lezaratlan regex');
      j += 1;
    }
    throw new Error('lezaratlan regex');
  };
  // a ${ ... } kifejezes vege (j a `{` utani elso karakter); a belso sztringeket / sablonokat atlepi
  const kifejezesVeg = (j) => {
    let melyseg = 1;
    while (j < n) {
      const c = src[j];
      if (c === '\'' || c === '"' || c === '`') { j = sztringVeg(j); continue; }
      if (c === '{') melyseg += 1; else if (c === '}') { melyseg -= 1; if (!melyseg) return j + 1; }
      j += 1;
    }
    throw new Error('lezaratlan ${}');
  };
  // a hivas zarojelenek vege (j a `(` karakteren); visszaadja a `)` utani indexet
  const hivasVeg = (j) => {
    let melyseg = 0;
    while (j < n) {
      const c = src[j];
      if (c === '\'' || c === '"' || c === '`') { j = sztringVeg(j); continue; }
      if (c === '/' && src[j + 1] === '/') { while (j < n && src[j] !== '\n') j += 1; continue; }
      if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j + 2) + 2; continue; }
      if (c === '(') melyseg += 1; else if (c === ')') { melyseg -= 1; if (!melyseg) return j + 1; }
      j += 1;
    }
    throw new Error('lezaratlan meter-hivas');
  };
  while (i < n) {
    const c = src[i];
    if (c === '\'' || c === '"' || c === '`') { const v = sztringVeg(i); out += src.slice(i, v); elozo = c; i = v; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i += 1; continue; } // sormegjegyzes (a `https://` sztringben van: oda nem jutunk)
    if (c === '/' && src[i + 1] === '*') { const v = src.indexOf('*/', i + 2); if (v < 0) throw new Error('lezaratlan megjegyzes'); i = v + 2; continue; }
    if (c === '/' && (elozo === '' || KEZDET_ELOTT.has(elozo) || /\b(return|typeof|case|in|of)$/.test(out.trimEnd().slice(-8)))) { const v = regexVeg(i); out += src.slice(i, v); elozo = '/'; i = v; continue; }
    hivas.lastIndex = i;
    if (c === 'm' && hivas.test(src)) {
      const v = hivasVeg(hivas.lastIndex - 1);
      i = v;
      let k = i; while (k < n && (src[k] === ' ' || src[k] === '\t')) k += 1;
      if (src[k] === ';') i = k + 1; // a hivas lezaro pontosvesszoje is a hivashoz tartozik
      continue;
    }
    out += c; if (!/\s/.test(c)) elozo = c; i += 1;
  }
  return out.replace(/\s+/g, ' ').trim();
}

const meterHivasok = (src) => [...src.matchAll(/(?<![A-Za-z0-9_$.])meter\.([A-Za-z_$][\w$]*)\(/g)].map((m) => m[1]);

function fo() {
  const ref = process.argv[2] || 'origin/main';
  const fajl = process.argv[3] || 'assets/js/booking-engine/engine.js';
  const gyoker = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  let regi; let uj;
  try {
    regi = execFileSync('git', ['show', `${ref}:${fajl}`], { cwd: gyoker, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    uj = fs.readFileSync(path.join(gyoker, fajl), 'utf8');
  } catch (e) { console.error('olvasasi hiba: ' + e.message); process.exit(2); }
  let a; let b;
  try { a = meterNelkul(regi); b = meterNelkul(uj); } catch (e) { console.error('elemzesi hiba: ' + e.message); process.exit(2); }
  const nev = (l) => { const m = {}; for (const x of l) m[x] = (m[x] || 0) + 1; return m; };
  const hr = meterHivasok(regi); const hu = meterHivasok(uj);
  console.log(`fajl: ${fajl}; kiindulas: ${ref}`);
  console.log(`meter.* hivasok: kiindulas ${hr.length}, most ${hu.length} (uj: ${hu.length - hr.length})`);
  console.log('  most: ' + JSON.stringify(nev(hu)));
  let statisztika = '';
  try { statisztika = execFileSync('git', ['diff', '--numstat', ref, '--', fajl], { cwd: gyoker, encoding: 'utf8' }).trim(); } catch (e) { /* nem kritikus */ }
  console.log('git diff --numstat (hozzaadott / torolt sor): ' + (statisztika || '(nincs kulonbseg)'));
  if (a === b) { console.log('EGYEZIK: a meter.* hivasok es a megjegyzesek nelkul a motor forrasa beture azonos a kiindulassal (' + b.length + ' karakter).'); process.exit(0); }
  let k = 0; while (k < a.length && a[k] === b[k]) k += 1;
  console.log('ELTERES a ' + k + '. karakternel:\n  kiindulas: ...' + a.slice(Math.max(0, k - 80), k + 120) + '\n  most:      ...' + b.slice(Math.max(0, k - 80), k + 120));
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) fo();
