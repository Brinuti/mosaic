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

/** HTML -> sima szoveg (sortoresek a blokk-elemeknel / <br>-nel). Csak a nev-tartalek-feldolgozashoz; nem biztonsagi hatar. */
function szovegge(html) {
  return String(html || '').slice(0, 400000)
    .replace(/<(script|style)[^<>]*>[^<]*(?:<(?!\/\1)[^<]*)*<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(?:p|div|tr|li|h[1-6]|td|th)>/gi, '\n')
    .replace(/<[^<>]*>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, entitas)
    .replace(/[ \t ]+/g, ' ');
}

const ALTALANOS = new Set(['vendeg', 'vendég', 'vendegunk', 'vendégünk', 'ugyfelunk', 'ügyfelünk', 'guest', 'customer', 'client', 'user']);
const CIMKE = '(?:mobil|telefon|tel\\.|e-?mail|megjegyz|szolg[aá]ltat|id[oő]pont|munkat[aá]rs|d[aá]tum|price|phone|service|employee|date)';
const CIMKE_VEG = new RegExp('\\s+' + CIMKE + '\\S*:?', 'i'); // a kovetkezo mezo cimkeje: a nev itt veget er (egysoros, tabla nelkuli levelnel)
const CIMKE_ELEJE = new RegExp('^\\s*' + CIMKE, 'i'); // ures "Nev:" cella: a kovetkezo sor cimkeje NEM nev

const tisztaNev = (x) => {
  const eleje = String(x || '').slice(0, 200).split(CIMKE_VEG)[0]; // hosszkorlat a split ELOTT (a regex ne fusson hosszu szokozsorozaton)
  if (/[<>@]/.test(eleje) || CIMKE_ELEJE.test(eleje)) return null; // markup / e-mail szeru szoveg / mezocimke nem nev
  const s = eleje.replace(/[<>@:;{}[\]()\\/0-9]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!s || s.split(' ').some((t) => ALTALANOS.has(t.toLowerCase()))) return null;
  return nevReszek(s) ? s : null;
};

/** A Salonic-level szovegebol (a Zap `email_html` mezoje) a vendeg neve, vagy null. */
export function nevEmailbol(html) {
  try {
    const sz = szovegge(html);
    const salon = sz.match(/(?:^|[\s\n])N[eé]v[ \t]*:[ \t]*\n?[ \t]*([^\n]{2,120})/i); // "Nev: Kovacs Anna Mobiltelefonszam: ..." (a szalonnak szolo level); tablazatnal a kettospont utan legfeljebb EGY sortores
    const koszon = sz.match(/(?:Kedves|Dear)\s+([^!\n,.:]{2,80})\s*[!,]/i); // "Kedves Anna!" / "Dear Anna!" (a vendegnek szolo level)
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
