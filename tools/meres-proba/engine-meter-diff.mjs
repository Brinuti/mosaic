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
export function meterNelkul(src, hivasok = null) { // hivasok (opcionalis tomb): minden torolt meter-hivas { nev, elozo (az elozo nem-szokoz karakter / 'else' / ''), arg (az argumentum szovege) }
  const n = src.length; let i = 0; let out = ''; let elozo = ''; let torlesPoz = -1; let torlesJel = ''; // elozo: az utolso nem-szokoz karakter (regex-felismeres); torlesPoz / torlesJel: az utolso torolt hivas helye az `out`-ban es lezaro jele (; vagy ))
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
      const nyit = hivas.lastIndex - 1; const v = hivasVeg(nyit);
      if (hivasok) {
        const t = out.trimEnd();
        // az ELOZO utasitas vege: ha kozvetlenul elotte (csak szokoz / megjegyzes koze) egy masik meter-hivas allt, annak lezaro jele; kulonben az `out` vege (az `else` kulon jelezve)
        const elozoHivasUtan = torlesPoz >= 0 && out.slice(torlesPoz).trim() === '';
        hivasok.push({ nev: src.slice(i + 6, nyit), elozo: elozoHivasUtan ? torlesJel : /\belse$/.test(t) ? 'else' : t.slice(-1), arg: src.slice(nyit + 1, v - 1).replace(/\s+/g, ' ').trim() });
      }
      i = v;
      let k = i; while (k < n && (src[k] === ' ' || src[k] === '\t')) k += 1;
      torlesJel = ')'; torlesPoz = out.length;
      if (src[k] === ';') { i = k + 1; torlesJel = ';'; } // a hivas lezaro pontosvesszoje is a hivashoz tartozik
      continue;
    }
    out += c; if (!/\s/.test(c)) elozo = c; i += 1;
  }
  return out.replace(/\s+/g, ' ').trim();
}

// A torolt hivasok SZIGORU ellenorzese (a puszta "torles utan azonos" nem fogna meg pl. `if (c) meter.x(); stmt;` alakot, ahol a meter-hivas lesz az if torzse, vagy a mellekhatasos argumentumot):
//  - a hivas csak UTASITAS-HATAR utan allhat (`;` `{` `}` vagy a fajl eleje; az `else meter.x();` alak sem megengedett, ha nem volt a kiindulasban);
//  - az argumentum szuk nyelvtan: azonosito / tagolvasas / literal / osszehasonlitas / `&&` `||` `?:` / `nowUnix()`; nincs ertekadas, hivas (a nowUnix() kivetelevel), `await`, `new`, `++` / `--`, fuggvenyliteral.
// A kiindulasban MAR meglevo (jo vagy rossz) alakokat nem szamoljuk uj hibanak: csak az alak-aláirasok TOBBLETE szamit (nev + elozo karakter + argumentum).
export function hivasHiba(h) {
  const hibak = [];
  if (!(h.elozo === '' || h.elozo === ';' || h.elozo === '{' || h.elozo === '}')) hibak.push(`nem utasitas-hataron all (elozo: ${JSON.stringify(h.elozo)})`);
  if (h.arg.includes('${')) hibak.push('sablon-literal interpolacio az argumentumban');
  const a = h.arg.replace(/nowUnix\(\)/g, 'N').replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, 'S').replace(/`[^`]*`/g, 'S');
  if (/\b(await|new|delete|typeof|void|function|class|yield)\b|=>/.test(a)) hibak.push('tiltott kulcsszo az argumentumban');
  if (/[\w$\]]\s*\(/.test(a)) hibak.push('fuggvenyhivas az argumentumban');
  if (/(^|[^=!<>])=(?!=)/.test(a)) hibak.push('ertekadas az argumentumban');
  if (/\+\+|--|\+=|-=|\*=|\/=|%=|&=|\|=|\^=|<<=|>>=|>>>=|\*\*=|&&=|\|\|=|\?\?=/.test(a)) hibak.push('novel / csokkent / osszetett ertekadas az argumentumban');
  if (!/^[\w$.\s,&|!=?:<>()+\-\[\]]*$/.test(a)) hibak.push('nem megengedett karakter az argumentumban');
  return hibak;
}
const alairas = (h) => `${h.nev}|${h.elozo}|${h.arg}`;

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
  const ha = []; const hb = [];
  try { a = meterNelkul(regi, ha); b = meterNelkul(uj, hb); } catch (e) { console.error('elemzesi hiba: ' + e.message); process.exit(2); }
  const nev = (l) => { const m = {}; for (const x of l) m[x] = (m[x] || 0) + 1; return m; };
  const hr = meterHivasok(regi); const hu = meterHivasok(uj);
  console.log(`fajl: ${fajl}; kiindulas: ${ref}`);
  console.log(`meter.* hivasok: kiindulas ${hr.length}, most ${hu.length} (uj: ${hu.length - hr.length})`);
  console.log('  most: ' + JSON.stringify(nev(hu)));
  let statisztika = '';
  try { statisztika = execFileSync('git', ['diff', '--numstat', ref, '--', fajl], { cwd: gyoker, encoding: 'utf8' }).trim(); } catch (e) { /* nem kritikus */ }
  console.log('git diff --numstat (hozzaadott / torolt sor): ' + (statisztika || '(nincs kulonbseg)'));
  if (a === b) {
    // szigoru alak-ellenorzes: a kiindulasban mar meglevo alakokon felul NEM johet be uj nem-utasitas-hataron allo hivas / mellekhatasos argumentum
    const hibak = (l) => nev(l.flatMap((h) => hivasHiba(h).map((m) => `${alairas(h)} => ${m}`)));
    const bazis = hibak(ha); const most = hibak(hb);
    const ujHibak = Object.entries(most).filter(([kulcs, db]) => db > (bazis[kulcs] || 0));
    if (ujHibak.length) { console.log('SZIGORU ALAK-ELLENORZES: a torles utan azonos a szoveg, DE uj meter-hivas alak nem engedelyezett:\n' + ujHibak.map(([kulcs]) => '  ' + kulcs).join('\n')); process.exit(1); }
    console.log('EGYEZIK: a meter.* hivasok es a megjegyzesek nelkul a motor forrasa beture azonos a kiindulassal (' + b.length + ' karakter); minden uj hivas utasitas-hataron all, az argumentuma szuk nyelvtanu (azonosito / tagolvasas / literal / osszehasonlitas / nowUnix()).');
    console.log('NEM bizonyitja (kezi + differencialis jsdom-ellenorzes kell hozza): hogy az argumentum tagolvasasa nem dob (pl. undefined mezo), es hogy a hivas SORRENDJE a nem-meter utasitasokhoz kepest jo.');
    process.exit(0);
  }
  let k = 0; while (k < a.length && a[k] === b[k]) k += 1;
  console.log('ELTERES a ' + k + '. karakternel:\n  kiindulas: ...' + a.slice(Math.max(0, k - 80), k + 120) + '\n  most:      ...' + b.slice(Math.max(0, k - 80), k + 120));
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) fo();
