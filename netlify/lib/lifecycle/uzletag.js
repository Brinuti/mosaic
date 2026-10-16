// Uzletag-felismeres, szolgaltatas-nevek tisztitasa, szegmensek, idotartam (a Salonic-pillanatkepbol).
import snapshot from './szolgaltatasok.js';
import mpSzolgaltatasok from './szolgaltatasok-mp.js';

const OLDAL = 'https://www.mosaicheadspa.hu';
const MP_OLDAL = 'https://www.medicalpiercing.hu';

/** Az ot uzletag: a Salonic-fiok (a vendeg-linkek hostja), a szalon adatai, a kozos oldalak. */
export const UZLETAGAK = Object.freeze({
  // eredmenyekUrl / videoUrl: kozvetlenul a szekciora visz (#horgony), hogy a vendeg ne keresgeljen az oldalon
  headspa: { kulcs: 'headspa', fiok: 'mosaicheadspa', nev: 'MOSAIC Head Spa', foglalasUrl: `${OLDAL}/headspa-budapest`, eredmenyekUrl: `${OLDAL}/head-spa-velemenyek#vendegek`, videoUrl: `${OLDAL}/head-spa-velemenyek#videok` },
  hair: { kulcs: 'hair', fiok: 'mosaic-hair', nev: 'MOSAIC Hair', foglalasUrl: `${OLDAL}/noi-fodraszat-budapest`, eredmenyekUrl: `${OLDAL}/noi-fodraszat-budapest`, videoUrl: `${OLDAL}/noi-fodraszat-budapest` }, // fodraszonkent lasd HAIR_FODRASZOK
  oxygen: { kulcs: 'oxygen', fiok: 'mosaic-oxigen', nev: 'MOSAIC Oxigénterápia', foglalasUrl: `${OLDAL}/oxigenterapia-budapest`, eredmenyekUrl: `${OLDAL}/oxigenterapia-budapest#eredmenyek`, videoUrl: `${OLDAL}/oxigenterapia-budapest#video` },
  laser: { kulcs: 'laser', fiok: 'mosaic-elysion', nev: 'MOSAIC Lézeres szőrtelenítés', foglalasUrl: `${OLDAL}/lezeres-szortelenites-budapest`, eredmenyekUrl: `${OLDAL}/lezeres-szortelenites-budapest#eredmenyek`, videoUrl: `${OLDAL}/lezeres-szortelenites-budapest#zsofi` },
  pmu: { kulcs: 'pmu', fiok: 'mosaic-pmu', nev: 'MOSAIC PMU', foglalasUrl: `${OLDAL}/sminktetovalas-budapest`, eredmenyekUrl: `${OLDAL}/sminktetovalas-budapest#eredmenyek`, videoUrl: `${OLDAL}/sminktetovalas-budapest#melitta` },
  // Medical Piercing (kulon ceg, kulon Salonic-fiok es weboldal): a vendeg-linkek (/f, /m) a sajat oldalara mutatnak (oldal), a level a sajat Gmail-fiokjabol megy
  // (a medicalpiercing Pages-projekt relay-vegpontjan at: kuldok.js), az SMS vegen "- Medical Piercing" (a katalogus-teszt ellenorzi).
  mp: { kulcs: 'mp', fiok: 'medicalpiercing', nev: 'Medical Piercing', oldal: MP_OLDAL, foglalasUrl: `${MP_OLDAL}/idopontfoglalas`, eredmenyekUrl: `${MP_OLDAL}/migren-shenmen-piercing-velemenyek`, videoUrl: `${MP_OLDAL}/a-szuras-folyamata#lepes-6`, email: 'medicalpiercing.hu@gmail.com' },
});

/** A fodraszok sajat oldala (Wixes klon): a munkaik szekcioja (#munkak) es a konzultacios videojuk (#video) - a levelekben a lefoglalt fodraszhoz vezet. */
export const HAIR_FODRASZOK = Object.freeze({
  Betti: { oldal: `${OLDAL}/noi-fodrasz-budapest-balayage-hajfestes`, munkak: '#comp-m5l1xx2o5', video: '#comp-m5p8g24q' },
  Noel: { oldal: `${OLDAL}/balayage-haj-festes-budapest`, munkak: '#comp-m95snrjw3', video: '#comp-mrypn3dp' },
  Evelin: { oldal: `${OLDAL}/noi-hajfestes-budapest`, munkak: '#comp-mblskd603', video: '#comp-mc7ays5b' },
});
/** { eredmenyek, video } link az uzletaghoz; fodrasznal a foglalt fodrasz oldala (ismeretlen fodrasz: a kozos fodrasz-oldal). */
export function linkek(uzletag, munkatars) {
  const uz = UZLETAGAK[uzletag];
  const f = uzletag === 'hair' ? HAIR_FODRASZOK[munkatars] : null;
  return f ? { eredmenyek: f.oldal + f.munkak, video: f.oldal + f.video } : { eredmenyek: uz.eredmenyekUrl, video: uz.videoUrl };
}

/** A szalon kozos adatai (a MOSAIC minden uzletaga ugyanott van). */
export const SZALON = Object.freeze({
  cim: '1023 Budapest, Bécsi út 2.',
  telefon: '06 20 247 4444',
  navigacioUrl: 'https://www.google.com/maps/search/?api=1&query=MOSAIC+Head+Spa+1023+Budapest+B%C3%A9csi+%C3%BAt+2',
  parkolas: 'Bécsi út (0202-es zóna) vagy ParkL, Bécsi út 11.',
});
/** A Medical Piercing budapesti szalonja (a videki helyszineket phase 1-ben nem ismerjuk: a level ott helyszin nelkul megy). */
export const MP_SZALON = Object.freeze({
  cim: '1137 Budapest, Újpesti rakpart 7., 5. emelet 25. (a Jászai Mari térnél)',
  cimRovid: 'Újpesti rakpart 7', // SMS: utana mondatvegi pont jon
  telefon: '+36 1 901 7444',
  navigacioUrl: 'https://www.google.com/maps/search/?api=1&query=Medical+Piercing+1137+Budapest+%C3%9Ajpesti+rakpart+7',
  erkezes: 'A Jászai Mari térnél vagyunk, a környező utcákban könnyen meg tudsz állni autóval; villamossal a Jászai Mari tér megálló van a legközelebb.',
});
/** Az uzletag szalon-adatai (cim, telefon, navigacio): a MOSAIC-uzletagak kozosek, a Medical Piercinge sajat. */
export const szalonAdat = (uzletag) => (uzletag === 'mp' ? MP_SZALON : SZALON);

const FIOK_UZLETAG = Object.fromEntries(Object.values(UZLETAGAK).map((u) => [u.fiok, u.kulcs]));
/** A feladó PONTOS megjelenitett neve (nem regex: nem iranyithat felre) -> uzletag. A Salonic lemondas-ertesitojeben nincs customer= link, ezert kell. */
const KULDO_PONTOS = Object.freeze({ 'medical piercing': 'mp' });

/** a Salonic-fiok nevebol ("mosaic-hair") VAGY a feladobol ("Mosaic Hair <app@salonic.hu>") az uzletag; null = ismeretlen */
export function uzletagFelismer({ fiok, kuldo }) {
  if (fiok && FIOK_UZLETAG[String(fiok).toLowerCase()]) return FIOK_UZLETAG[String(fiok).toLowerCase()];
  const nevResz = String(kuldo || '').replace(/<[^>]*>/g, '').replace(/["']/g, '').trim().toLowerCase();
  if (KULDO_PONTOS[nevResz]) return KULDO_PONTOS[nevResz];
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

const PILLANATKEP = new Map([...snapshot.szolgaltatasok, ...mpSzolgaltatasok].map((s) => [`${s.uzletag}|${szolgNorm(s.nev)}`, s]));

/** Igaz, ha a szolgaltatas az uzletag Salonic-pillanatkepeben szerepel (vendeg-szolgaltatas, nem belso blokk). */
export function ismertSzolgaltatas(uzletag, szolgaltatas) {
  return PILLANATKEP.has(`${uzletag}|${szolgNorm(szolgaltatas)}`);
}

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
  t = t.replace(/\s+zsófihoz!?\s*$/i, ''); // "Ingyenes konzultáció zsófihoz!" -> "Ingyenes konzultáció" (a munkatárs külön helyőrző; a toldalékolás is így helyes)
  return t.replace(/\s{2,}/g, ' ').replace(/[\s-]+$/, '').trim() || String(szolgaltatas || '').trim();
}

/** Az üzletág szava, ha a szolgáltatás neve önmagában nem árulja el, melyik üzletágé ("Ingyenes konzultáció", "Korrekció"). */
const UZLETAG_SZO = { headspa: 'HeadSpa', hair: 'fodrász', oxygen: 'oxigénterápia', laser: 'szőrtelenítés', pmu: 'sminktetoválás' };
/** Ezek a szavak a szolgáltatás nevében már elárulják az üzletágat: ilyenkor nem kell elé az üzletág szava. */
const UZLETAG_JEL = {
  headspa: /head\s?spa/i,
  hair: /fodr[aá]sz|haj|v[aá]g[aá]s|fest[eé]s|balayage|melír|ombr[eé]|sz[aá]r[ií]t[aá]s|kontúr|szőkít/i,
  oxygen: /oxig[eé]n|oxygen/i,
  laser: /sz[őo]rtelen[ií]t|l[eé]zer|laser|elysion/i,
  pmu: /sminktet|pmu|szem[oö]ld[oö]k|ajaktet|szemh[eé]j|szemkont/i,
};
/** A szolgáltatás neve az üzletág szavával, ha az általános ("Ingyenes konzultáció" -> "szőrtelenítés ingyenes konzultáció"; nagy: nagy kezdőbetűvel, az e-mailek dobozába). */
export function uzletaggal(uzletag, nev, nagy = false) {
  const t = String(nev || '').trim();
  const szo = UZLETAG_SZO[uzletag];
  if (!t || !szo || (UZLETAG_JEL[uzletag] && UZLETAG_JEL[uzletag].test(t))) return t;
  // csupa nagybetus elso szo ("AKCIÓS Hajkamerás vizsgálat"): az egesz szo kisbetus lesz, kulonben "aKCIÓS" lenne (Feri jelezte, 2026-10-16)
  const elso = t.split(' ')[0];
  const kisbetus = /^\p{Lu}{2,}$/u.test(elso) ? elso.toLowerCase() + t.slice(elso.length) : t.charAt(0).toLowerCase() + t.slice(1);
  const kapcsolt = `${szo} ${kisbetus}`;
  return nagy ? kapcsolt.charAt(0).toUpperCase() + kapcsolt.slice(1) : kapcsolt;
}

/** Rovid nev az SMS-hez (kb. 42 karakter, szohataron vagva). */
export function rovidNev(szolgaltatas) {
  let t = tisztaNev(szolgaltatas).replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  if (t.length <= 42) return t;
  const vag = t.slice(0, 42);
  return vag.slice(0, Math.max(vag.lastIndexOf(' '), 20)).replace(/[\s+,-]+$/, '');
}

// ---- Medical Piercing ----------------------------------------------------------------------------------------------------------------------------
const ekezetNelkul = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** A budapesti / videki munkatarsak (tools/mp-salonic-lekepezes.json, 2026-10-11). Kamilli Viktoria Budapesten ES Szekesfehervaron is dolgozik: ismeretlen helyszin. */
const MP_BP = [/\bkovacs gabriella\b/, /\bkovacs richard\b/, /\bmarko fanni\b/, /^fanni$/];
const MP_VIDEK = [/\bfekete henrietta\b/, /\bszuliman nikoletta\b/, /\btompek kornelia\b/, /\bszalai nora\b/, /\bmester brigitta\b/];
/** 'bp' | 'videk' | null (ismeretlen / tobb helyszinen dolgozo munkatars) a Salonic "Munkatárs" mezojebol. */
export function mpHelyszin(munkatars) {
  const n = ekezetNelkul(munkatars);
  if (!n) return null;
  if (MP_BP.some((re) => re.test(n))) return 'bp';
  if (MP_VIDEK.some((re) => re.test(n))) return 'videk';
  return null;
}
/** A piercing tipusa a szolgaltatas nevebol: migren | shenmen | klimax | slim | allergia | egyeb (a 2-3 db-os csomag = shenmen). */
export function mpTipus(szolgaltatas) {
  const n = ekezetNelkul(szolgaltatas);
  if (/migren|fejfajas/.test(n)) return 'migren';
  if (/shenmen|stressz/.test(n)) return 'shenmen';
  if (/klimax|valtozokor/.test(n)) return 'klimax';
  if (/\bslim\b|etvagy/.test(n)) return 'slim';
  if (/allergia/.test(n)) return 'allergia';
  if (/fulbevalo|divat/.test(n)) return 'egyeb';
  if (/\b[23] (db )?piercing|\b2 szemelynek/.test(n)) return 'shenmen';
  return 'egyeb';
}
/** Olvashato MP-szolgaltatasnev a levelbe (a Salonic-nev akcios / aras resze nelkul): "3 db piercing (csomag)". */
export function mpSzolgNev(szolgaltatas) {
  const n = ekezetNelkul(szolgaltatas);
  const csomag = /^([23]) piercing\b/.exec(n);
  if (csomag) return `${csomag[1]} db piercing (csomag)`;
  return tisztaNev(szolgaltatas).replace(/\s*-?\s*\d[\d.\s]*\s?Ft\b.*$/i, '').trim();
}
/** A latogatas varhato hossza (a Salonic-idotartam csak a szuras ideje): egy piercing ~30-40 perc, csomag ~40-50 perc. */
export function mpLatogatas(szolgaltatas) {
  const n = ekezetNelkul(szolgaltatas);
  return /^[23] piercing\b|\b[2-6] db\b|szemelynek|\b1 1 db\b/.test(n) ? 'kb. 40–50 perc' : 'kb. 30–40 perc';
}
/** A munkatars fotoja a Medical Piercing oldalarol (az alairas mellett); ismeretlen munkatarsnal nincs. */
const MP_FOTOK = [
  [/\bkovacs gabriella\b/, 'f18724_3ae9dfe53a07477fae1a816f79be5098.jpg'],
  [/\bkovacs richard\b/, 'f18724_934eb02c7f7440a9b97932a3d6a66909.jpg'],
  [/\bkamilli viktoria\b/, 'f18724_82ec0f0190fc482fa2aa112d0fe1e884.jpg'],
  [/\bmarko fanni\b|^fanni$/, 'f18724_f9c0a8fd686f422482c6a443ea951b6d.jpg'],
  [/\bmester brigitta\b/, 'f18724_ceb9d9dee26d47738ddde803fd53e4a4.jpg'],
];
export function mpFoto(munkatars) {
  const n = ekezetNelkul(munkatars);
  const t = n && MP_FOTOK.find(([re]) => re.test(n));
  return t ? `${MP_OLDAL}/assets/img/${t[1]}` : null;
}

/** Szegmens-cimkek a szolgaltatas nevebol (a katalogus `szegmensek` / `nem_szegmensek` szuroi ezekre vonatkoznak). munkatars: csak az mp-nel (helyszin). */
export function szegmensek(uzletag, szolgaltatas, munkatars = '') {
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
    case 'mp': // piercing-tipus + helyszin (ismeretlen helyszin: a budapesti valtozat, de helyszin-sorok nelkul - lasd render.js)
      cimkek.push(mpTipus(szolgaltatas), mpHelyszin(munkatars) === 'videk' ? 'videk' : 'bp');
      break;
    default:
  }
  return cimkek;
}
