// A Salonic szalon-ertesitoinek (app@salonic.hu -> mosaicheadspa@gmail.com) ertelmezese.
// Harom foglalas-esemeny letezik (a Salonicnak nincs API-ja / webhookja; ez az egyetlen valos idoben erkezo jelzes):
//   "Új online foglalás érkezett: <szolgaltatas>"          -> foglalt
//   "Foglalás módosítva vendég által: <szolgaltatas>"       -> athelyezve (RÉGI dátum / Új dátum)
//   "Foglalás lemondás - <nev> - <szolgaltatas>"            -> lemondva
// A HTML-ben a foglalas egyedi azonositoja ("bookingId=<UUID>") es a Salonic-fiok ("customer=<fiok>") is benne van - ebbol lesz a vendeg-link:
//   https://<fiok>.salonic.hu/booking/bookingDetails/<UUID>   (reszletek / modositas)
//   https://<fiok>.salonic.hu/booking/cancelBooking/<UUID>    (lemondas)
import { huDatumEpoch } from './ido.js';
import { uzletagFelismer } from './uzletag.js';
import { vendegKulcs } from './telefon.js';

const TIPUSOK = [
  { re: /^\s*Új online foglalás érkezett/i, tipus: 'foglalt' },
  { re: /^\s*Foglalás módosítva/i, tipus: 'athelyezve' },
  { re: /^\s*Foglalás lemondás/i, tipus: 'lemondva' },
];
const CIMKEK = ['Foglaló adatai', 'Időpont adatok', 'Név', 'Mobiltelefonszám', 'E-mail cím', 'Szolgáltatás', 'Munkatárs', 'Kezdő dátum', 'RÉGI dátum', 'Új dátum', 'Tervezett kezdés', 'Várható időtartam', 'Lemondás oka'];
const CIMKE_RE = new RegExp(`(?:\\d+\\.\\s*)?(${CIMKEK.join('|')})\\s*:|(Foglalás megtekintése)`, 'gi');
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const entitas = (s) => s.replace(/&nbsp;/gi, ' ').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/gi, '&');

/** HTML -> szoveg: a blokk-elemek helyen sortores, a cimkek igy kulon sorba kerulnek. */
export function htmlSzoveg(html) {
  return entitas(String(html || '')
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\s*br\s*\/?>|<\/(p|div|td|tr|li|h\d|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')).replace(/[ \t\r\f\v]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

/** FNV-1a (32 bit) - szintetikus azonosito, ha a levelben nincs foglalas-UUID. */
function hash(s) {
  let h = 0x811c9dc5;
  for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
export const szintetikusId = (uzletag, email, telefon, kezdet) => `szint-${hash(`${uzletag}|${vendegKulcs(email, telefon)}|${kezdet}`)}`;

/**
 * @param {{targy:string, kuldo?:string, szoveg?:string, html?:string}} level
 * @param {number} most epoch mp (az ev megallapitasahoz)
 * @returns {{ok:true,...}|{ok:false,miert:string}}
 */
export function ertelmez(level, most) {
  const targy = String(level.targy || '');
  const t = TIPUSOK.find((x) => x.re.test(targy));
  if (!t) return { ok: false, miert: 'nem foglalasi ertesito' };
  const szoveg = level.html ? htmlSzoveg(level.html) : String(level.szoveg || '');
  const teljes = szoveg || String(level.szoveg || '');
  if (!teljes) return { ok: false, miert: 'ures level' };

  // cimke -> ertek (a kovetkezo cimkeig; a "Foglalás megtekintése" lezar)
  const ertekek = {}; const szolgaltatasok = [];
  const talalatok = [...teljes.matchAll(CIMKE_RE)];
  talalatok.forEach((m, i) => {
    if (m[2]) return;
    const cimke = m[1].toLowerCase();
    const vege = i + 1 < talalatok.length ? talalatok[i + 1].index : teljes.length;
    const ertek = teljes.slice(m.index + m[0].length, vege).replace(/\s+/g, ' ').trim();
    if (cimke === 'szolgáltatás') szolgaltatasok.push(ertek);
    if (!(cimke in ertekek)) ertekek[cimke] = ertek;
  });

  const nev = ertekek['név'] || '';
  const telefonNyers = (/^[+\d][\d\s()+\-./]*/.exec(ertekek['mobiltelefonszám'] || '') || [''])[0].trim();
  const emailE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/.exec(ertekek['e-mail cím'] || '');
  const email = emailE ? emailE[0].toLowerCase() : '';
  const szolgaltatas = szolgaltatasok[0] || targy.replace(/^[^:]+:\s*/, '').replace(/^Foglalás lemondás\s*-\s*[^-]+-\s*/i, '') || '';
  const munkatars = ertekek['munkatárs'] || '';

  let kezdet = null; let regiKezdet = null;
  if (t.tipus === 'foglalt') kezdet = huDatumEpoch(ertekek['kezdő dátum'] || teljes, most);
  else if (t.tipus === 'athelyezve') {
    kezdet = huDatumEpoch(ertekek['új dátum'], most);
    regiKezdet = huDatumEpoch(ertekek['régi dátum'], most);
  } else kezdet = huDatumEpoch(teljes.slice(Math.max(0, teljes.search(/lemondta/i))), most) || huDatumEpoch(teljes, most);
  if (!kezdet) return { ok: false, miert: 'nem ertelmezheto idopont' };
  if (!nev && !email && !telefonNyers) return { ok: false, miert: 'nincs vendeg-adat' };

  const html = String(level.html || '');
  const azon = new RegExp(`bookingId(?:%3D|=)(${UUID})`, 'i').exec(html) || new RegExp(`bookingDetails/(${UUID})|cancelBooking/(${UUID})`, 'i').exec(html);
  const fiokE = /customer=([a-z0-9-]+)/i.exec(html);
  const fiok = fiokE ? fiokE[1].toLowerCase() : null;
  const uzletag = uzletagFelismer({ fiok, kuldo: level.kuldo });
  if (!uzletag) return { ok: false, miert: 'ismeretlen uzletag' };
  const foglalasId = azon ? (azon[1] || azon[2]).toLowerCase() : null;

  return { ok: true, tipus: t.tipus, uzletag, fiok, foglalasId, nev, telefonNyers, email, szolgaltatas, szolgaltatasok, munkatars, kezdet, regiKezdet };
}
