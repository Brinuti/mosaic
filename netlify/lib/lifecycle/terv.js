// Az uzenetek utemezese egy foglalashoz (dokumentum 1.2-1.3: lead-time szabaly). Tiszta fuggveny: a katalogusbol es az idopontokbol
// kiszamolja, MELY uzenet MIKOR menjen, es melyik marad ki (es miert). A kuldes es az allapot-kezeles az engine.js dolga.
import { KATALOG, KOZOS } from './katalog/index.js';
import { helyi, helyiEpoch, ablakba } from './ido.js';

const ORA = 3600, NAP = 86400;
// napszak-ablakok (budapesti helyi ora): ezen kivul eso esedekesseg a legkozelebbi ablak-szelre kerul (hajnali/ejszakai uzenet nincs)
export const ABLAK = Object.freeze({ sms: [8, 20.5], email: [7, 21], feladat: [9, 17] });
/** T0-nal ennyivel kesobb mar nem kuldjuk ki (pl. a teszt-modban gyujtott foglalas elesiteskor) */
export const KESES_PLAFON = Object.freeze({ t0: 12 * ORA, egyeb: 2 * ORA });

/** Hany tartalmi e-mail jar a foglalas es az idopont kozti naponkent (dokumentum 1.3). */
export function tartalomKeret(leadNap) {
  if (leadNap >= 21) return 3;
  if (leadNap >= 10) return 2;
  if (leadNap >= 5) return 1;
  return 0;
}

export function szegmensEgyezik(uz, cimkek) {
  if (uz.szegmensek && !uz.szegmensek.some((s) => cimkek.includes(s))) return false;
  if (uz.nem_szegmensek && uz.nem_szegmensek.some((s) => cimkek.includes(s))) return false;
  return true;
}

/** a nap 10:00 (helyi) epoch-ja */
const tizOra = (epoch) => { const l = helyi(epoch); return helyiEpoch(l.y, l.m, l.d, 10, 0); };

/** Az uzenet "tipusa" a kuldesek-tablaban: t0 | t72 | t24 | tartalom | feladat | ... (a katalogusbol) */
export function uzenetek(uzletag) { return KATALOG[uzletag]?.uzenetek || []; }
export function kozosUzenet(tipus) { return KOZOS.uzenetek.filter((u) => u.mikor.tipus === tipus); }
export function keres(uzletag, id) { return [...uzenetek(uzletag), ...KOZOS.uzenetek].find((u) => u.id === id) || null; }

/**
 * @param {{uzletag:string, szegmensek:string[], kezdet:number}} f  a foglalas (kezdet = epoch mp)
 * @param {number} alap  a kiindulo idopont (a foglalas / az atfoglalas pillanata, epoch mp)
 * @param {{athelyezes?:boolean}} [opciok]  athelyezes: a T0 uzenetek nem mennek ujra
 * @returns {{ terv: {uzenet_id:string, csatorna:string, tipus:string, esedekes:number}[], kihagyva: {uzenet_id:string, csatorna:string, ok:string}[] }}
 */
export function tervez(f, alap, opciok = {}) {
  const lead = f.kezdet - alap; // masodperc
  const leadNap = lead / NAP;
  const terv = []; const kihagyva = [];
  const be = (u, esedekes) => terv.push({ uzenet_id: u.id, csatorna: u.csatorna, tipus: u.mikor.tipus, esedekes });
  const ki = (u, ok) => kihagyva.push({ uzenet_id: u.id, csatorna: u.csatorna, ok });
  const ablakos = (u, t) => { const [a, b] = ABLAK[u.csatorna]; return ablakba(t, a, b); };

  const tartalmiak = [];
  for (const u of uzenetek(f.uzletag)) {
    if (!szegmensEgyezik(u, f.szegmensek)) continue;
    const t = u.mikor.tipus;
    if (t === 't0') {
      if (opciok.athelyezes) { ki(u, 'athelyezes: a T0 nem megy ujra'); continue; }
      if (lead <= 0) { ki(u, 'az idopont mar elmult'); continue; }
      be(u, alap);
    } else if (t === 't72') {
      if (lead < 96 * ORA) { ki(u, 'lead < 96 ora: a T-72 kimarad'); continue; }
      be(u, ablakos(u, f.kezdet - 72 * ORA));
    } else if (t === 't24') {
      if (lead < 30 * ORA) { ki(u, 'lead < 30 ora: csak T0'); continue; }
      be(u, ablakos(u, f.kezdet - 24 * ORA));
    } else if (t === 'tartalom') {
      if (leadNap < u.mikor.min_lead_nap) { ki(u, `lead < ${u.mikor.min_lead_nap} nap`); continue; }
      tartalmiak.push(u);
    } else if (t === 'feladat_t0') {
      if (lead <= 0) { ki(u, 'az idopont mar elmult'); continue; }
      be(u, alap + 60);
    } else if (t === 'feladat') {
      if (Number.isFinite(u.mikor.min_lead_nap) && leadNap < u.mikor.min_lead_nap) { ki(u, `lead < ${u.mikor.min_lead_nap} nap`); continue; }
      let due = ablakos(u, f.kezdet - u.mikor.elott_ora * ORA);
      if (due < alap + 900) due = ablakos(u, alap + 900); // a keso foglalasnal: hamarosan
      if (due > f.kezdet - 2 * ORA) { ki(u, 'keso: mar nincs ideje a hivasnak'); continue; }
      be(u, due);
    }
  }

  // tartalmi e-mailek: a lead-time keret szerint a fontossagi sorrendben; nem eshetnek a T-72 koze (legalabb 24 oraval elotte), es nem az elso 6 oraba
  const keret = tartalomKeret(leadNap);
  const sorban = tartalmiak.sort((a, b) => (a.sorrend ?? 99) - (b.sorrend ?? 99));
  const valasztott = [];
  for (const u of sorban) {
    if (valasztott.length >= keret) { ki(u, `a ${keret} tartalmi e-mail kerete betelt`); continue; }
    let due = u.mikor.utan_napok !== undefined ? tizOra(alap + u.mikor.utan_napok * NAP) : tizOra(f.kezdet - u.mikor.elott_napok * NAP);
    if (due < alap + 6 * ORA) due = ablakos(u, alap + 6 * ORA);
    const hatar = f.kezdet - 96 * ORA; // a T-72 elott legalabb egy nappal
    if (due > hatar) due = hatar;
    if (due < alap + 6 * ORA) { ki(u, 'nincs ra hely az idopont elott'); continue; }
    due = ablakos(u, due);
    // ne legyen ket tartalmi level 24 oran belul
    if (valasztott.some((v) => Math.abs(v.esedekes - due) < 24 * ORA)) { ki(u, 'tul kozel egy masik tartalmi levelhez'); continue; }
    valasztott.push({ u, esedekes: due });
  }
  for (const v of valasztott) be(v.u, v.esedekes);
  return { terv: terv.sort((a, b) => a.esedekes - b.esedekes), kihagyva };
}

/** A "T0 + sürgős kiegészítés" szabály: ha az időpont kevesebb mint 30 órára van, a T0 e-mail a kritikus előkészületet is tartalmazza. */
export const surgos = (kezdet, most) => kezdet - most < 30 * ORA;
