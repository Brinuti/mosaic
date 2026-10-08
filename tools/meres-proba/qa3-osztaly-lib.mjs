// QA-3 tesztszures: a Zapier "tesztFoglalas" szabalya (Zap 01a0e724, 2026-10-05) + a negyosztalyos besorolas (DONTES #108).
// Osztalyok: CONTROLLED_TEST (a futtato UUID-listaja) · OTHER_TEST (korabbi QA-UUID, vagy a Zap-szabaly / ismert tesztnev talal) · REAL · UNKNOWN.
// Elv: a REAL-hez POZITIV bizonyitek kell (van Gmail-adat, semmilyen tesztjel, nem Feri jelzett probasavjaban). Ami nem a szokott tesztazonositoval megy,
// de gyanus (kozeli talalat) vagy nem ertekelheto (nincs adat), az UNKNOWN - SOHA nem REAL.
// A vendegadat (nev, e-mail, telefon) csak a memoriaban jar; a kimenet csak UUID + osztaly + okkod.

// A Zap kodjabol szo szerint (a Zap: `/(^|[\s,.-])teszt($|[\s,.-])/i.test(nev)`): a "teszt" onallo szo legyen (szokoz, vesszo, pont, kotojel hatarolja).
export const ZAP_NEV_RE = /(^|[\s,.-])teszt($|[\s,.-])/i;

// A Zap a level szovegebol (szokozok egyetlen szokozre vonva) igy olvassa ki a mezoket; a tel/e-mail kinyeresi mintak szo szerint azonosak.
const pick = (text, re) => { const m = String(text || '').match(re); return m ? m[1].trim() : ''; };
export function kinyer(szoveg) {
  const t = String(szoveg || '').replace(/\s+/g, ' ');
  return { nev: pick(t, /Név:\s*(.+?)\s*Mobiltelefonszám:/), telefon: pick(t, /Mobiltelefonszám:\s*(.+?)\s*E-mail cím/), email: pick(t, /E-mail cím:\s*(.+?)\s*Időpont adatok/) };
}

// A DONTES #108 / a TESZT-mappa dokumentalt tesztnevei (a Zap nev-szabalya ezek kozul NEM mindet fogja meg, pl. "Próbafoglalás (TESZT)").
export const ISMERT_NEVEK = Object.freeze(['TESZT – Claude', 'TESZT Claude', 'Feri teszt', 'teszt teszt', 'Próbafoglalás (TESZT)']);
const nevNorm = (s) => String(s || '').toLowerCase().replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ').trim();
const ISMERT_NORM = ISMERT_NEVEK.map(nevNorm);
const ekezetnelkul = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * szabaly: { tesztEmailek: [...kisbetus e-mailek, a Zap TESZT_EMAILEK-je], telefonVegzodesek: [...csak szamjegy, a Zap telefon-vegzodesei], gyanusEmailReszek?: [...] }
 * A listak ertekei szemelyes adatok: kulon fajlbol jonnek (a repoban nincsenek), a Zap kodja a forras (get_workflow 01a0e724).
 * A Zap-szabaly pontosan: nev-minta VAGY e-mail a listaban VAGY a telefon szamjegyei a vegzodesek egyikevel vegzodnek.
 */
export function zapTalalat({ nev, telefon, email }, szabaly) {
  const okok = [];
  if (ZAP_NEV_RE.test(String(nev || '').trim())) okok.push('zap:nev');
  const mail = String(email || '').trim().toLowerCase();
  if (mail && (szabaly.tesztEmailek || []).map((x) => String(x).toLowerCase()).includes(mail)) okok.push('zap:email');
  const szj = String(telefon || '').replace(/\D/g, '');
  if (szj && (szabaly.telefonVegzodesek || []).some((v) => szj.endsWith(String(v)))) okok.push('zap:telefon');
  return okok;
}
export function ismertNev(nev) { const n = nevNorm(nev); return !!n && ISMERT_NORM.some((k) => n.includes(k)); }

// "Nem a szokott azonosito, de gyanus": a Zap-szabaly NEM fogta meg, mégis tesztre/probara utal -> UNKNOWN (soha REAL).
export function kozeliJelek({ nev, telefon, email }, szabaly) {
  const okok = [];
  if (/teszt|test|pr[oó]ba|claude/.test(ekezetnelkul(nev))) okok.push('kozeli:nev-resz');
  const m = ekezetnelkul(email);
  if (m && (/teszt|test|proba|claude/.test(m) || (szabaly.gyanusEmailReszek || []).some((r) => m.includes(String(r).toLowerCase())))) okok.push('kozeli:email-resz');
  const szj = String(telefon || '').replace(/\D/g, '');
  if (szj && (szabaly.telefonVegzodesek || []).some((v) => String(v).length >= 6 && szj.slice(-6) === String(v).slice(-6) && !szj.endsWith(String(v)))) okok.push('kozeli:telefon');
  return okok;
}

const ido = (x) => { if (x === null || x === undefined || x === '') return NaN; if (typeof x === 'number') return x < 1e12 ? x * 1000 : x; const s = String(x).trim(); return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z'); };
export const probasavban = (t, savok) => { const ms = ido(t); return Number.isFinite(ms) && (savok || []).some((s) => ms >= ido(s.tol) && ms < ido(s.ig)); };

/**
 * sor: { uuid, d1?: {letrehozva, ...}, gmail?: {nev, email, telefon} | {szoveg}, salonic?: {allapot} }
 * ctx: { controlled: Set<uuid>, other: Set<uuid>, szabaly, probasavok? }
 * -> { osztaly, alosztaly, okok: [kodok] }
 */
export function osztalyoz(sor, ctx) {
  const u = String(sor.uuid).toLowerCase();
  if (ctx.controlled.has(u)) return { osztaly: 'CONTROLLED_TEST', alosztaly: 'futtato-lista', okok: ['lista:controlled'] };
  if (ctx.other.has(u)) return { osztaly: 'OTHER_TEST', alosztaly: 'uuid-lista', okok: ['lista:other'] };
  const g = sor.gmail ? (sor.gmail.szoveg ? { ...kinyer(sor.gmail.szoveg), ...sor.gmail } : sor.gmail) : null;
  const mezo = g ? { nev: g.nev, telefon: g.telefon, email: g.email } : null;
  if (mezo) {
    const zap = zapTalalat(mezo, ctx.szabaly);
    if (zap.length) return { osztaly: 'OTHER_TEST', alosztaly: 'zap-szabaly', okok: zap };
    if (ismertNev(mezo.nev)) return { osztaly: 'OTHER_TEST', alosztaly: 'ismert-nev', okok: ['ismert-nev'] };
  }
  const okok = [];
  if (!mezo) okok.push('nincs-gmail-adat');
  else {
    if (!String(mezo.nev || '').trim()) okok.push('hianyzo:nev');
    if (!String(mezo.email || '').trim() && !String(mezo.telefon || '').replace(/\D/g, '')) okok.push('hianyzo:email-es-telefon');
    okok.push(...kozeliJelek(mezo, ctx.szabaly));
  }
  const letrehozva = sor.d1 && sor.d1.letrehozva;
  if (probasavban(letrehozva, ctx.probasavok)) okok.push('probasav');
  if (okok.length) return { osztaly: 'UNKNOWN', alosztaly: null, okok };
  return { osztaly: 'REAL', alosztaly: null, okok: ['pozitiv:nincs-tesztjel'] };
}

export const OSZTALYOK = ['CONTROLLED_TEST', 'OTHER_TEST', 'REAL', 'UNKNOWN'];
export const LABAK = [['SGD', 'mindhárom helyen'], ['SG', 'Salonic + Gmail megvan, #128 sor hiányzik'], ['SD', 'Salonic + #128 megvan, Gmail hiányzik'], ['GD', 'Gmail + #128 megvan, Salonic hiányzik'], ['S', 'csak Salonic'], ['G', 'csak Gmail'], ['D', 'csak #128']];
const lab = (s) => (s.salonic ? 'S' : '') + (s.gmail ? 'G' : '') + (s.d1 ? 'D' : '');

/** forrasok: { d1: [{uuid,...}], gmail: [{uuid,...}], salonic: [{uuid, allapot}] } -> { sorok, osszesito, matrix, real_szam } (vendegadat nelkul) */
export function haromutas(forrasok, ctx) {
  const tar = new Map();
  const ad = (lista, kulcs) => { for (const x of lista || []) { const u = String(x.uuid || '').trim().toLowerCase(); if (!u) continue; if (!tar.has(u)) tar.set(u, { uuid: u }); tar.get(u)[kulcs] = x; } };
  ad(forrasok.d1, 'd1'); ad(forrasok.gmail, 'gmail'); ad(forrasok.salonic, 'salonic');
  for (const u of [...ctx.controlled, ...ctx.other]) if (!tar.has(u)) tar.set(u, { uuid: u }); // a listak UUID-ja jelen nem levo labbal is megjelenik
  const sorok = [...tar.values()].map((s) => {
    const o = osztalyoz(s, ctx);
    return { uuid: s.uuid, osztaly: o.osztaly, alosztaly: o.alosztaly, okok: o.okok, labak: lab(s), salonic: s.salonic ? (s.salonic.allapot || s.salonic.statusz || 'ismeretlen') : null, d1_allapot: s.d1 ? (s.d1.allapot || null) : null, d1_kuldesi_sorok: s.d1 && s.d1.kuldesi_sorok !== undefined ? Number(s.d1.kuldesi_sorok) : null };
  }).sort((a, b) => a.uuid.localeCompare(b.uuid));
  // a listabol jovo, de egyik forrasban sem levo UUID ("labak" = "") nem szamit sornak a matrixban, csak a listaban jelenik meg
  const matrix = {}; const osszesito = {};
  for (const o of OSZTALYOK) { osszesito[o] = 0; matrix[o] = Object.fromEntries(LABAK.map(([k]) => [k, 0])); }
  for (const s of sorok) { if (!s.labak) continue; osszesito[s.osztaly]++; matrix[s.osztaly][s.labak]++; }
  const otherBontas = {}; for (const s of sorok) if (s.labak && s.osztaly === 'OTHER_TEST') otherBontas[s.alosztaly] = (otherBontas[s.alosztaly] || 0) + 1;
  return { sorok, osszesito, matrix, real_szam: osszesito.REAL, other_test_bontas: otherBontas };
}

/** A Cloudflare D1 MCP / sima JSON kimenetbol sorok: tomb, {results}, [{results}], {result:[{results}]} */
export function sorokBetolt(j) {
  if (Array.isArray(j)) return j.flatMap((x) => (x && Array.isArray(x.results) ? x.results : [x]));
  if (j && Array.isArray(j.results)) return j.results;
  if (j && Array.isArray(j.result)) return sorokBetolt(j.result);
  return [];
}
export const uuidLista = (szoveg) => new Set(String(szoveg || '').split(/\r?\n/).map((x) => x.replace(/#.*/, '').trim().toLowerCase()).filter((x) => /^[0-9a-f-]{36}$/.test(x)));
