// Hirdeteshez illo hos-kep (2026-10-17, a tulajdonos kerese): ha a latogato Meta-hirdetesrol jon, a landolo oldal
// elso kiemelt kepe (az elso <img fetchpriority="high">, minden uj lapon ez a hos kepe) a hirdetes sajat kepere cserelodik,
// MEG A SZERVEREN (HTMLRewriter), igy nincs "villanas" es a betoltes sem lassul.
// Parosítas: 1) mp_ad={{ad.id}} a hirdetes URL-parametereben -> HIRDETESEK; 2) ha nincs talalat, utm_content={{ad.name}}
// a NEV_SZABALYOK szerint (pl. "KOLLÁZS ÚJ 10-17 - 03 ..." -> a 03-as kollazs kepe). Ha egyik sem talal, az oldal valtozatlan.
// Csak a sajat KEPEK listajabol valaszt (a parameterbol soha nem kerul URL vagy szoveg a lapra). Meres nem valtozik.
// Uj hirdetes: az ad.id-t es a kep kulcsat a HIRDETESEK-be, az uj kepet az assets/img/hirdetes-hos/ ala (WebP, 480/800/1200).

const D = '/assets/img/hirdetes-hos/';
// kulcs -> [alt, [[fajl, szelesseg, magassag], ...]] (a legnagyobb az utolso)
export const KEPEK = {
  'koll-01': ['Ricsi és egy mosolygós vendég a Medical Piercing szalonban', [['koll-01-480.webp', 480, 480], ['koll-01-800.webp', 800, 800]]],
  'koll-02': ['Két piercerünk egy férfi vendéggel a soproni szalonban', [['koll-02-480.webp', 480, 600], ['koll-02-800.webp', 800, 1000], ['koll-02-1200.webp', 1200, 1500]]],
  'koll-03': ['Viki egy vendéggel a Medical Piercing szalonban', [['koll-03-480.webp', 480, 320], ['koll-03-800.webp', 800, 533], ['koll-03-1200.webp', 1200, 800]]],
  'koll-04': ['Viki egy férfi vendéggel a Medical Piercing szalonban', [['koll-04-480.webp', 480, 320], ['koll-04-800.webp', 800, 533], ['koll-04-1200.webp', 1200, 800]]],
  'koll-05': ['Piercerünk egy barna hajú vendéggel a szalonban', [['koll-05-480.webp', 480, 480], ['koll-05-800.webp', 800, 800]]],
  'koll-06': ['Piercerünk egy rövid hajú vendéggel a szalonban', [['koll-06-480.webp', 480, 480], ['koll-06-800.webp', 800, 800]]],
  'koll-07': ['Gabi egy vendéggel a Medical Piercing szalonban', [['koll-07-480.webp', 480, 320], ['koll-07-800.webp', 800, 533], ['koll-07-1200.webp', 1200, 800]]],
  'koll-08': ['Ricsi és egy mosolygós vendég a Medical Piercing szalonban', [['koll-08-480.webp', 480, 597], ['koll-08-800.webp', 800, 995]]],
};

// Meta hirdetes-azonosito (ad.id) -> KEPEK kulcs. Fiok: MP2 hirdetesi fiok (303312235362247).
export const HIRDETESEK = {
  '120254773736230022': 'koll-01', // KOLLÁZS ÚJ 10-17 - 01 Ricsi barna haj v3
  '120254773737480022': 'koll-02', // 02 Sopron férfi v3
  '120254773738570022': 'koll-03', // 03 Viki szemüveges v3
  '120254773870230022': 'koll-03', // 03 Viki szemüveges v4
  '120254773739360022': 'koll-04', // 04 Viki idősebb férfi v3
  '120254773741100022': 'koll-05', // 05 Brigitta barna haj v3
  '120254773742040022': 'koll-06', // 06 Fekete felsős rövid haj v3
  '120254773743140022': 'koll-07', // 07 Gabi fekete garbós v3
  '120254773870060022': 'koll-07', // 07 Gabi fekete garbós v4
  '120254773744650022': 'koll-08', // 08 Szivli Ricsi v3
};

// Tartalek a hirdetes neve alapjan (utm_content), ha az ad.id meg nincs a listaban (pl. masodpeldany).
const NEV_SZABALYOK = [
  [/KOLL[ÁA]ZS\s+[ÚU]J\s+10-17\s*-\s*0([1-8])\b/i, (m) => 'koll-0' + m[1]],
];

export function hosValasztas(url) {
  const ad = (url.searchParams.get('mp_ad') || '').trim();
  if (/^\d{6,25}$/.test(ad) && HIRDETESEK[ad]) return HIRDETESEK[ad];
  const nev = url.searchParams.get('utm_content') || '';
  if (nev && nev.length <= 200) {
    for (const [re, kulcs] of NEV_SZABALYOK) {
      const m = nev.match(re);
      if (m && KEPEK[kulcs(m)]) return kulcs(m);
    }
  }
  return null;
}

// A HTML-valaszban az elso <img fetchpriority="high"> kepet csereli, a kep-eloltolto <link> sort a sajat kepre irja.
export function hosCsere(valasz, kulcs) {
  const [alt, valt] = KEPEK[kulcs];
  const nagy = valt[valt.length - 1];
  const srcset = valt.map(([f, w]) => `${D}${f} ${w}w`).join(', ');
  const ka = +(nagy[1] / nagy[2]).toFixed(4);
  let kesz = false;
  const ujValasz = new HTMLRewriter()
    .on('link[rel="preload"][as="image"]', { element(el) { el.remove(); } })
    .on('head', { element(el) {
      el.append(`<link rel="preload" as="image" href="${D}${nagy[0]}" imagesrcset="${srcset}" imagesizes="(max-width: 820px) 100vw, 640px" fetchpriority="high">`, { html: true });
    } })
    .on('img[fetchpriority="high"]', { element(el) {
      if (kesz) return;
      kesz = true;
      el.setAttribute('src', D + nagy[0]);
      el.setAttribute('srcset', srcset);
      if (!el.getAttribute('sizes')) el.setAttribute('sizes', '(max-width: 820px) 100vw, 640px');
      el.setAttribute('width', String(nagy[1]));
      el.setAttribute('height', String(nagy[2]));
      el.setAttribute('alt', alt);
      el.setAttribute('data-hirdetes-hos', kulcs);
      const st = (el.getAttribute('style') || '').replace(/--kw:[^;]*;?/g, '').replace(/--ka:[^;]*;?/g, '').replace(/object-position:[^;]*;?/g, '');
      el.setAttribute('style', `--kw:${nagy[1]}px;--ka:${ka};object-position:50% 30%;${st}`.replace(/;$/, '')); // az eredeti kep fokusza nem ervenyes az uj kepre
    } })
    .transform(valasz);
  const h = new Headers(ujValasz.headers);
  h.set('cache-control', 'private, no-store'); // a csere a parameterfuggo: ne tarolja kozos gyorsitotar
  h.delete('content-length');
  return new Response(ujValasz.body, { status: ujValasz.status, headers: h });
}
