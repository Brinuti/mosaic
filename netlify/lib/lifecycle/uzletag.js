// Uzletag-felismeres, szolgaltatas-nevek tisztitasa, szegmensek, idotartam (a Salonic-pillanatkepbol).
import snapshot from './szolgaltatasok.js';

const OLDAL = 'https://www.mosaicheadspa.hu';

/** Az ot uzletag: a Salonic-fiok (a vendeg-linkek hostja), a szalon adatai, a kozos oldalak. */
export const UZLETAGAK = Object.freeze({
  headspa: { kulcs: 'headspa', fiok: 'mosaicheadspa', nev: 'MOSAIC Head Spa', foglalasUrl: `${OLDAL}/headspa-budapest`, eredmenyekUrl: `${OLDAL}/headspa-budapest`, videoUrl: `${OLDAL}/headspa-budapest` },
  hair: { kulcs: 'hair', fiok: 'mosaic-hair', nev: 'MOSAIC Hair', foglalasUrl: `${OLDAL}/noi-fodraszat-budapest`, eredmenyekUrl: `${OLDAL}/noi-fodraszat-budapest`, videoUrl: `${OLDAL}/noi-fodraszat-budapest` },
  oxygen: { kulcs: 'oxygen', fiok: 'mosaic-oxigen', nev: 'MOSAIC Oxigénterápia', foglalasUrl: `${OLDAL}/oxigenterapia-budapest`, eredmenyekUrl: `${OLDAL}/oxigenterapia-budapest`, videoUrl: `${OLDAL}/oxigenterapia-budapest` },
  laser: { kulcs: 'laser', fiok: 'mosaic-elysion', nev: 'MOSAIC Lézeres szőrtelenítés', foglalasUrl: `${OLDAL}/lezeres-szortelenites-budapest`, eredmenyekUrl: `${OLDAL}/lezeres-szortelenites-budapest`, videoUrl: `${OLDAL}/lezeres-szortelenites-budapest` },
  pmu: { kulcs: 'pmu', fiok: 'mosaic-pmu', nev: 'MOSAIC PMU', foglalasUrl: `${OLDAL}/sminktetovalas-budapest`, eredmenyekUrl: `${OLDAL}/sminktetovalas-budapest`, videoUrl: `${OLDAL}/sminktetovalas-budapest` },
});

/** A szalon kozos adatai (minden uzletag ugyanott van). */
export const SZALON = Object.freeze({
  cim: '1023 Budapest, Bécsi út 2.',
  telefon: '06 20 247 4444',
  navigacioUrl: 'https://www.google.com/maps/search/?api=1&query=MOSAIC+Head+Spa+1023+Budapest+B%C3%A9csi+%C3%BAt+2',
  parkolas: 'Bécsi út (0202-es zóna) vagy ParkL, Bécsi út 11.',
});

const FIOK_UZLETAG = Object.fromEntries(Object.values(UZLETAGAK).map((u) => [u.fiok, u.kulcs]));

/** a Salonic-fiok nevebol ("mosaic-hair") VAGY a feladobol ("Mosaic Hair <app@salonic.hu>") az uzletag; null = ismeretlen */
export function uzletagFelismer({ fiok, kuldo }) {
  if (fiok && FIOK_UZLETAG[String(fiok).toLowerCase()]) return FIOK_UZLETAG[String(fiok).toLowerCase()];
  const k = String(kuldo || '').toLowerCase();
  if (/headspa|head spa/.test(k)) return 'headspa';
  if (/\bhair\b/.test(k)) return 'hair';
  if (/oxig/.test(k)) return 'oxygen';
  if (/elysion|laser|lézer/.test(k)) return 'laser';
  if (/\bpmu\b|melitta/.test(k)) return 'pmu';
  return null;
}

/** Osszehasonlitashoz: kisbetu, emoji/jelek nelkul, egyetlen szokozzel. */
export const szolgNorm = (s) => String(s || '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const PILLANATKEP = new Map(snapshot.szolgaltatasok.map((s) => [`${s.uzletag}|${szolgNorm(s.nev)}`, s]));

/** A szolgaltatas idotartama percben (a Salonic-pillanatkepbol), vagy null. */
export function idotartamPerc(uzletag, szolgaltatas) {
  const s = PILLANATKEP.get(`${uzletag}|${szolgNorm(szolgaltatas)}`);
  return s && Number.isFinite(s.perc) ? s.perc : null;
}

/** Olvashato szolgaltatas-nev az e-mailhez: emoji, "AKCIO"/"KUPONKODDAL" elotag, ar- es kedvezmeny-toldalek nelkul. */
export function tisztaNev(szolgaltatas) {
  let t = String(szolgaltatas || '').replace(/[\p{Extended_Pictographic}‍️]+/gu, '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(KUPONKÓDDAL|AKCIÓ)\s*-\s*/i, '').replace(/^(AKCIÓ|KUPONKÓDDAL)\s*-\s*/i, '');
  t = t.replace(/\s*\(\s*[\d.\s]+Ft helyett most[^)]*\)/i, '');
  t = t.replace(/\s*-\s*[\d.\s]+Ft helyett most.*$/i, '');
  t = t.replace(/\s*[+-]\s*állap\S*(\s+-?\d+%\s*kedvezménnyel)?/gi, '');
  t = t.replace(/\s*-\s*[\d.\s]*(FT\s*)?KEDVEZMÉNNYEL.*$/i, '');
  t = t.replace(/\s*\(TE RAKOD ÖSSZE!\)/i, '');
  return t.replace(/\s{2,}/g, ' ').replace(/[\s-]+$/, '').trim() || String(szolgaltatas || '').trim();
}

/** Rovid nev az SMS-hez (kb. 42 karakter, szohataron vagva). */
export function rovidNev(szolgaltatas) {
  let t = tisztaNev(szolgaltatas).replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  if (t.length <= 42) return t;
  const vag = t.slice(0, 42);
  return vag.slice(0, Math.max(vag.lastIndexOf(' '), 20)).replace(/[\s+,-]+$/, '');
}

/** Szegmens-cimkek a szolgaltatas nevebol (a katalogus `szegmensek` / `nem_szegmensek` szuroi ezekre vonatkoznak). */
export function szegmensek(uzletag, szolgaltatas) {
  const n = szolgNorm(szolgaltatas);
  const cimkek = [];
  const van = (re) => re.test(n);
  switch (uzletag) {
    case 'headspa':
      cimkek.push(van(/^kuponkoddal|kuponk/) ? 'ajandekkartya' : 'fizetos');
      if (van(/paros|páros/)) cimkek.push('paros');
      else if (van(/negykezes|négykezes/)) cimkek.push('negykezes');
      else cimkek.push('egyeni');
      if (van(/hair/)) cimkek.push('hair');
      break;
    case 'hair': {
      const konz = van(/konzult/);
      const festes = van(/fest|balayage|ombre|melír|melir|szőkít|szokit|airtouch|babylight|supernatural|színez|szinez|világosít/);
      if (konz) cimkek.push('konzultacio');
      if (festes) cimkek.push('festes');
      if (festes && van(/balayage|szőkít|szokit|teljes fest|melír|melir|airtouch|babylight/)) cimkek.push('nagy_valtozas');
      if (!konz && !festes) cimkek.push('vagas_kezeles');
      break;
    }
    case 'oxygen':
      if (van(/hajkamer|vizsg|konzult/)) cimkek.push('konzultacio');
      else if (van(/2 alkalomt/)) cimkek.push('visszatero');
      else cimkek.push('elso');
      break;
    case 'laser':
      if (van(/konzult/)) cimkek.push('konzultacio');
      else if (van(/allap|állap/)) cimkek.push('elso');
      else cimkek.push('visszatero');
      break;
    case 'pmu':
      if (van(/konzult/)) cimkek.push('konzultacio');
      else if (van(/korrekc/)) cimkek.push('korrekcio');
      else if (van(/eltavol|eltávol/)) cimkek.push('eltavolitas');
      else cimkek.push('fizetos');
      break;
    default:
  }
  return cimkek;
}
