// Medical Piercing foglalomotor - a piercing-tipus rovid kodja (ugyanazok a kodok, mint a suti.js TikTok-esemenyeben):
// mi (migren / daith / fejfajas), sh (shenmen), kl (klimax), sl (slim / etvagycsokkento), al (allergia), mj (maj), lp (lep),
// vb (vastagbel), pm (pajzsmirigy), 3pc (3 piercing akcio), soft (kozerzetjavito soft), csomag (tobb piercing / tobb fo),
// divat (fulbevalo / divat fulpiercing), alt (egyeb). A hirdetesi platformok fele CSAK ez a rovid kod mehet (egeszsegugyi
// szoveg nem).
const ekezetNelkul = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const SZOLGALTATAS = [
  [/migren|daith|fejfajas/, 'mi'], [/shenmen/, 'sh'], [/klimax|menopauza/, 'kl'], [/slim|fogyas|etvagy/, 'sl'],
  [/allergia/, 'al'], [/(^|[^a-z])maj([^a-z]|$)/, 'mj'], [/(^|[^a-z])lep([^a-z]|$)/, 'lp'], [/vastagbel/, 'vb'], [/pajzsmirigy/, 'pm'],
  [/fulbevalo|divat/, 'divat'],
];

/** A Salonic-szolgaltatas nevebol: az elso (legkorabban elofordulo) talalat; a tobb piercinges csomagok kulon kodot kapnak. */
export function tipusKod(nev) {
  const s = ekezetNelkul(nev);
  if (/3\s*piercing|harmadik/.test(s)) return '3pc';
  if (/soft/.test(s)) return 'soft';
  let kod = null, hol = Infinity;
  for (const [re, k] of SZOLGALTATAS) { const m = re.exec(s); if (m && m.index < hol) { hol = m.index; kod = k; } }
  if (kod) return kod;
  if (/\d\s*db\s*piercing|szemelynek|2\s*piercing|feláron|felaron/.test(s)) return 'csomag';
  return 'alt';
}

/** Az oldal utvonalabol (mint a suti.js tipusKod-ja): melyik piercingrol szol az oldal, ahonnan a foglalas indul. */
export function oldalTipus(utvonal) {
  let u;
  try { u = decodeURIComponent(utvonal); } catch (e) { u = String(utvonal || ''); }
  u = ekezetNelkul(u);
  if (/3-piercing-2-araert/.test(u)) return '3pc';
  if (/kozerzetjavito-piercing-soft/.test(u)) return 'soft';
  const T = [[/migren|daith|fejfajas/, 'mi'], [/shenmen/, 'sh'], [/klimax/, 'kl'], [/slim|fogyas|etvagy/, 'sl'], [/allergia/, 'al'], [/(^|[-/])maj([-/]|$)/, 'mj'], [/(^|[-/])lep([-/]|$)/, 'lp'], [/vastagbel/, 'vb'], [/pajzsmirigy/, 'pm'], [/ful-piercing|fulbevalo/, 'divat']];
  let kod = 'alt', hol = Infinity;
  for (const [re, k] of T) { const m = re.exec(u); if (m && m.index < hol) { hol = m.index; kod = k; } }
  return kod;
}
