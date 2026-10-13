// A Google-ertekeles osszegzese (pontszam, vélemenyek szama) a Trustindex fooldali widgetjebol (ugyanaz a szam, amit a widget fejlece mutat).
// Tiszta fuggveny: a Cloudflare-fuggveny (/api/ertekeles), a helyi kiszolgalo es a tesztek is ezt hasznaljak.
export const TRUSTINDEX_KULCS = 'daf9c4e6731895546126ce4c8b5';
export const TRUSTINDEX_TARTALOM = `https://cdn.trustindex.io/widgets/${TRUSTINDEX_KULCS.slice(0, 2)}/${TRUSTINDEX_KULCS}/content.html`;

// <span class="ti-rating-text">Kiváló</span> ... <span class="ti-header-rating">4.8</span><span class="ti-header-rating-reviews">5022 vélemény</span>
export function ertekelesAdat(html) {
  const szoveg = /class="ti-rating-text">([^<]+)</.exec(html)?.[1]?.trim();
  const pont = /class="ti-header-rating">\s*([\d.,]+)\s*</.exec(html)?.[1]?.replace(',', '.');
  const db = parseInt((/class="ti-header-rating-reviews">\s*([\d\s .]+?)\s*(?:vélemény|értékelés)/i.exec(html)?.[1] || '').replace(/\D/g, ''), 10);
  if (!szoveg || !pont || !(db > 0) || !(+pont > 0 && +pont <= 5)) return null;
  return { szoveg, pont: String(+pont), db };
}
