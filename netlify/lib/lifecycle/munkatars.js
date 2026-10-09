// A Salonic MUNKATARSI ertesitoi: "❌ Időpont törölve: <szolgaltatas>" / "🗓️ Időpont módosítva: <szolgaltatas>" (DECISION #117, issue #167).
// A level csak JELZES: nincs benne foglalas-azonosito, link, torlesi ok, telefon vagy e-mail; van vendegnev ("Neve:"), szolgaltatas, datum (ev nelkul),
// helyszin (= a szalon neve = az uzletag) es munkatars. Modositasnal csak az UJ idopont szerepel. Mezok soronkent "Cimke: ertek".
// Tiszta fuggvenyek: a D1-et es a hivasokat az engine.js vegzi.
import { htmlSzoveg } from './parser.js';
import { huDatumEpoch } from './ido.js';
import { uzletagFelismer, szolgNorm } from './uzletag.js';

const TIPUSOK = [
  { re: /^[^\p{L}\p{N}]*Időpont törölve/iu, tipus: 'szalon_torolte' },
  { re: /^[^\p{L}\p{N}]*Időpont módosítva/iu, tipus: 'szalon_athelyezte' },
  { re: /^[^\p{L}\p{N}]*Új időpont létrehozva/iu, tipus: 'szalon_letrehozva' },
];
/** A level tipusa a targy alapjan (az emoji-elotag nem szamit), vagy null. */
export function munkatarsTipus(targy) {
  const t = TIPUSOK.find((x) => x.re.test(String(targy || '')));
  return t ? t.tipus : null;
}

const CIMKE = { 'neve': 'nev', 'név': 'nev', 'szolgáltatás': 'szolgaltatas', 'dátum': 'datum', 'helyszín': 'helyszin', 'munkatárs': 'munkatars' };
const CIMKE_SOR = /^(Neve|Név|Szolgáltatás|Dátum|Helyszín|Munkatárs)\s*:\s*(.*)$/i;

const ekezetlen = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
/** Vendegnev-osszehasonlitas: kisbetu, ekezet es irasjel nelkul, egyetlen szokozzel. Pontos egyezes - nincs kozelito (fuzzy) egyeztetes. */
export const nevNorm = (s) => ekezetlen(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** Munkatars-kulcs: a Salonic-nev a promocios toldalek ("Noel - 20% kedvezmény!") nelkul, normalizalva. */
export const munkatarsKulcs = (s) => nevNorm(String(s || '').split(/\s+[-–—]\s+/)[0]);
/** Szolgaltatas-kulcs: kisbetu, emoji/jelek nelkul (mint az uzletag.js szolgNorm), ekezettel. */
export const szolgKulcs = (s) => szolgNorm(s);

/**
 * @param {{targy?:string, kuldo?:string, szoveg?:string, html?:string}} level
 * @param {number} most epoch mp (az ev megallapitasahoz: a level kuldesenek ideje)
 * @returns {{ok:true,tipus:string,uzletag:string,nev:string,szolgaltatas:string,munkatars:string,kezdet:number,helyszin:string}|{ok:false,miert:string}}
 */
export function ertelmezMunkatars(level, most) {
  const tipus = munkatarsTipus(level.targy);
  if (!tipus) return { ok: false, miert: 'nem munkatarsi ertesito' };
  const szoveg = level.html ? htmlSzoveg(level.html) : String(level.szoveg || '');
  const sorok = szoveg.split('\n').map((s) => s.trim()).filter(Boolean);
  const mezok = {};
  for (let i = 0; i < sorok.length; i++) {
    const m = CIMKE_SOR.exec(sorok[i]);
    if (!m) continue;
    const kulcs = CIMKE[m[1].toLowerCase()];
    let ertek = m[2].trim();
    // tablazatos kiosztas: a cimke es az ertek kulon sorban
    if (!ertek && sorok[i + 1] && !CIMKE_SOR.test(sorok[i + 1])) ertek = sorok[i + 1].trim();
    if (!(kulcs in mezok)) mezok[kulcs] = ertek;
  }
  if (!mezok.szolgaltatas) return { ok: false, miert: 'hianyzo mezo: szolgaltatas' };
  if (!mezok.datum) return { ok: false, miert: 'hianyzo mezo: datum' };
  const feladoUzletag = uzletagFelismer({ kuldo: level.kuldo });
  const helyszinUzletag = mezok.helyszin ? uzletagFelismer({ kuldo: mezok.helyszin }) : null;
  if (feladoUzletag && helyszinUzletag && feladoUzletag !== helyszinUzletag) return { ok: false, miert: 'uzletag ellentmondas (felado / helyszin)' };
  const uzletag = feladoUzletag || helyszinUzletag;
  if (!uzletag) return { ok: false, miert: 'ismeretlen uzletag' };
  const kezdet = huDatumEpoch(mezok.datum, most);
  if (!kezdet) return { ok: false, miert: 'nem ertelmezheto datum' };
  return { ok: true, tipus, uzletag, nev: mezok.nev || '', szolgaltatas: mezok.szolgaltatas, munkatars: mezok.munkatars || '', kezdet, helyszin: mezok.helyszin || '' };
}

/**
 * Belso blokk (nem vendegfoglalas) - CSAK egyertelmu szaballyal: ebedszunet, szunet, vagy a munkatars sajat nevere szolo blokk
 * (a "szolgaltatas" maga a munkatars neve). Minden mas NEM belso (bizonytalan -> riasztas, allapotvaltas nelkul).
 * @returns {'ebedszunet'|'szunet'|'munkatars_blokk'|null}
 */
export function belsoBlokk({ szolgaltatas, munkatars }) {
  const sz = ekezetlen(szolgNorm(szolgaltatas));
  if (/^(ebed ?szunet|ebed)$/.test(sz)) return 'ebedszunet';
  if (/^szunet$/.test(sz)) return 'szunet';
  const mk = munkatarsKulcs(munkatars);
  if (mk && nevNorm(szolgaltatas) === mk) return 'munkatars_blokk';
  return null;
}
