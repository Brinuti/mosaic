// DECISION #202: a vendeg neve a hash-eleshez (Meta fn / ln, opt-in TikTok). A NYERS nev csak ebben a memoriabeli hivasban el (fk.vendeg.nev -> felhasznalo-hash.js SHA-256); sehova nem naplozodik, nem tarolodik.
// Forras-sorrend (az elso hasznalhato nev nyer; hianyzo / null / ures / ertelmezhetetlen = nincs nev -> nincs nev-hash, a tobbi mezo megy):
//   1. bejovo.nev (a Zap nev-mezoje: "nev" a hivas felso szintjen, az sd-szerzodes szerint)
//   2. bejovo.vendeg.nev
//   3. tartalek: a Salonic-level szovegebol - a szalonnak szolo "Uj online foglalas" level "Nev: ..." sora, a vendegnek szolo level "Kedves X!" / "Dear X!" koszonese (csak a Zap `email_html` mezojebol)
// A modul SOHA nem dob (egy ertelmezhetetlen nev / level nem akaszthatja meg az esemenyt): hiba eseten null.
import { nevReszek } from './hash.js';

const ENTITASOK = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', Eacute: 'É', aacute: 'á', Aacute: 'Á', iacute: 'í', Iacute: 'Í', oacute: 'ó', Oacute: 'Ó', ouml: 'ö', Ouml: 'Ö', odblac: 'ő', Odblac: 'Ő', uacute: 'ú', Uacute: 'Ú', uuml: 'ü', Uuml: 'Ü', udblac: 'ű', Udblac: 'Ű' };
const entitas = (m, e) => {
  if (e[0] !== '#') return Object.hasOwn(ENTITASOK, e) ? ENTITASOK[e] : ' '; // nem ismert / prototipus-kulcs (constructor, toString, __proto__) = szokoz
  const hex = e[1] === 'x' || e[1] === 'X';
  const n = parseInt(hex ? e.slice(2) : e.slice(1), hex ? 16 : 10);
  return Number.isInteger(n) && n > 0 && n <= 0x10FFFF && !(n >= 0xD800 && n <= 0xDFFF) ? String.fromCodePoint(n) : ' ';
};

/** ASCII-kisbetusites HOSSZMEGORZOEN (a toLowerCase() egyes betuknel - pl. "İ" - hosszt valtoztat, az indexek elcsuszanak). */
const asciiKis = (s) => s.replace(/[A-Z]+/g, (m) => m.toLowerCase());
/** <script> / <style> blokkok kivetele indexOf-ciklussal (LINEARIS; a lezaratlan blokk a vegeig eldobodik). */
function blokkKi(s, tag) {
  const kis = asciiKis(s); let ki = '', i = 0;
  for (;;) {
    const a = kis.indexOf('<' + tag, i);
    if (a < 0) return ki + s.slice(i);
    ki += s.slice(i, a) + ' ';
    const b = kis.indexOf('</' + tag, a + 1 + tag.length);
    const c = b < 0 ? -1 : kis.indexOf('>', b);
    if (c < 0) return ki;
    i = c + 1;
  }
}
const BEMENET_MAX = 120000; // a valodi Salonic-level ~17 KB; a vegpont-korlat 262144 bajt - a nev-kinyeres a feletti reszt nem nezi

/** HTML -> sima szoveg (sortoresek a blokk-elemeknel / <br>-nel). Csak a nev-tartalek-feldolgozashoz; nem biztonsagi hatar. Minden minta LINEARIS (korlatos kvantorok, nincs egymasba agyazott ismetles). */
function szovegge(html) {
  return blokkKi(blokkKi(String(html || '').slice(0, BEMENET_MAX), 'script'), 'style')
    .replace(/<br[ \t\r\n]{0,10}\/?>|<\/(?:p|div|tr|li|h[1-6]|td|th)>/gi, '\n')
    .replace(/<[^<>]*>/g, ' ')
    .replace(/&(#x?[0-9a-f]{1,12}|[a-z]{1,12});/gi, entitas)
    .replace(/[^\S\n]+/g, ' '); // minden nem-sortores szokoz-jellegu karakter (NBSP, \r, U+2003 ...) egyetlen szokozze
}

const ALTALANOS = new Set(['vendeg', 'vendég', 'vendegunk', 'vendégünk', 'ugyfelunk', 'ügyfelünk', 'guest', 'customer', 'client', 'user']);
const CIMKE = '(?:mobil|telefon|tel\\.|e-?mail|megjegyz|szolg[aá]ltat|id[oő]pont|munkat[aá]rs|d[aá]tum|price|phone|service|employee|date)';
const CIMKE_VEG = new RegExp('\\s+' + CIMKE + '\\S*:?', 'i'); // a kovetkezo mezo cimkeje: a nev itt veget er (egysoros, tabla nelkuli levelnel)
const CIMKE_ELEJE = new RegExp('^\\s*' + CIMKE, 'i'); // ures "Nev:" cella: a kovetkezo sor cimkeje NEM nev

const tisztaNev = (x) => {
  const eleje = String(x || '').slice(0, 200).split(CIMKE_VEG)[0]; // hosszkorlat a split ELOTT (a regex ne fusson hosszu szokozsorozaton)
  if (/[<>@]/.test(eleje) || CIMKE_ELEJE.test(eleje)) return null; // markup / e-mail szeru szoveg / mezocimke nem nev
  const s = eleje.replace(/[<>@:;{}[\]()\\/0-9&#]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!s || s.split(' ').some((t) => ALTALANOS.has(t.toLowerCase()))) return null;
  return nevReszek(s) ? s : null;
};

/** A Salonic-level szovegebol (a Zap `email_html` mezoje) a vendeg neve, vagy null. */
export function nevEmailbol(html) {
  try {
    const sz = szovegge(html);
    const salon = sz.match(/(?:^|[ \n])N[eé]v[ \t]{0,5}:[ \t]{0,5}\n?[ \t]{0,5}([^\n]{2,120})/i); // "Nev: Kovacs Anna Mobiltelefonszam: ..." (a szalonnak szolo level); tablazatnal a kettospont utan legfeljebb EGY sortores
    const koszon = sz.match(/(?:Kedves|Dear)[ \n]{1,6}([^!\n,.:]{2,80})[ ]{0,5}[!,]/i); // "Kedves Anna!" / "Dear Anna!" (a vendegnek szolo level)
    return tisztaNev(salon && salon[1]) || tisztaNev(koszon && koszon[1]);
  } catch (e) { return null; }
}

/** bejovo: a hivo (Zap) torzse. -> a nyers nev (szoveg) vagy null. A visszaadott nev kizarolag hash-elesre valo. */
export function vendegNev(bejovo) {
  try {
    const b = bejovo && typeof bejovo === 'object' ? bejovo : {};
    const v = b.vendeg && typeof b.vendeg === 'object' ? b.vendeg : {};
    for (const x of [b.nev, v.nev]) { const s = typeof x === 'string' ? tisztaNev(x) : null; if (s) return s; }
    return typeof b.email_html === 'string' ? nevEmailbol(b.email_html) : null;
  } catch (e) { return null; }
}
