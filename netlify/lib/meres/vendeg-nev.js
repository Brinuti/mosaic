// DECISION #202: a vendeg neve a hash-eleshez (Meta fn / ln, opt-in TikTok). A NYERS nev csak ebben a memoriabeli hivasban el (fk.vendeg.nev -> felhasznalo-hash.js SHA-256); sehova nem naplozodik, nem tarolodik.
// Forras-sorrend (az elso hasznalhato nev nyer; hianyzo / null / ures / ertelmezhetetlen = nincs nev -> nincs nev-hash, a tobbi mezo megy):
//   1. bejovo.nev (a Zap nev-mezoje: "nev" a hivas felso szintjen, az sd-szerzodes szerint)
//   2. bejovo.vendeg.nev
//   3. tartalek: a Salonic-level szovegebol - a szalonnak szolo "Uj online foglalas" level "Nev: ..." sora, a vendegnek szolo level "Kedves X!" / "Dear X!" koszonese (csak a Zap `email_html` mezojebol)
import { nevReszek } from './hash.js';

const ENTITASOK = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', Eacute: 'É', aacute: 'á', Aacute: 'Á', iacute: 'í', Iacute: 'Í', oacute: 'ó', Oacute: 'Ó', ouml: 'ö', Ouml: 'Ö', odblac: 'ő', Odblac: 'Ő', uacute: 'ú', Uacute: 'Ú', uuml: 'ü', Uuml: 'Ü', udblac: 'ű', Udblac: 'Ű' };
const entitas = (m, e) => (e[0] === '#' ? String.fromCodePoint(parseInt(e[1] === 'x' || e[1] === 'X' ? e.slice(2) : e.slice(1), e[1] === 'x' || e[1] === 'X' ? 16 : 10) || 32) : (ENTITASOK[e] ?? ' '));

/** HTML -> sima szoveg (sortoresek a blokk-elemeknel / <br>-nel). Csak a nev-tartalek-feldolgozashoz; nem biztonsagi hatar. */
function szovegge(html) {
  return String(html || '').slice(0, 400000)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(?:p|div|tr|li|h[1-6]|td|th)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, entitas)
    .replace(/[ \t ]+/g, ' ');
}

const ALTALANOS = new Set(['vendeg', 'vendég', 'vendegunk', 'vendégünk', 'ugyfelunk', 'ügyfelünk', 'guest', 'customer', 'client', 'user']);
const CIMKE_VEG = /\s+(?:mobil|telefon|tel\.|e-?mail|megjegyz|szolg[aá]ltat|id[oő]pont|munkat[aá]rs|d[aá]tum|price|phone|service|employee|date)\S*:?/i; // a kovetkezo mezo cimkeje: a nev itt veget er (egysoros, tabla nelkuli levelnel)

const tisztaNev = (x) => {
  const s = String(x || '').split(CIMKE_VEG)[0].replace(/[<>@:;{}[\]()\\/0-9]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!s || s.split(' ').some((t) => ALTALANOS.has(t.toLowerCase()))) return null;
  return nevReszek(s) ? s : null;
};

/** A Salonic-level szovegebol (a Zap `email_html` mezoje) a vendeg neve, vagy null. */
export function nevEmailbol(html) {
  const sz = szovegge(html);
  const salon = sz.match(/(?:^|[\s\n])N[eé]v\s*:\s*([^\n]{2,120})/i); // "Nev: Kovacs Anna Mobiltelefonszam: ..." (a szalonnak szolo level)
  const koszon = sz.match(/(?:Kedves|Dear)\s+([^!\n,.:]{2,80})\s*[!,]/i); // "Kedves Anna!" / "Dear Anna!" (a vendegnek szolo level)
  return tisztaNev(salon && salon[1]) || tisztaNev(koszon && koszon[1]);
}

/** bejovo: a hivo (Zap) torzse. -> a nyers nev (szoveg) vagy null. A visszaadott nev kizarolag hash-elesre valo. */
export function vendegNev(bejovo) {
  const b = bejovo && typeof bejovo === 'object' ? bejovo : {};
  const v = b.vendeg && typeof b.vendeg === 'object' ? b.vendeg : {};
  for (const x of [b.nev, v.nev]) { const s = typeof x === 'string' ? tisztaNev(x) : null; if (s) return s; }
  return typeof b.email_html === 'string' ? nevEmailbol(b.email_html) : null;
}
