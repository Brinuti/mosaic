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
// 04/05 KIKAPCSOLVA (2026-10-17, ChatGPT-javaslat): a kepen volt kollegano lehet; a tulajdonos megerositeseig az eredeti hos marad. 03 (Viki szemuveges): a tulajdonos engedelyezte (2026-10-17 18:26).
export const HIRDETESEK = {
  '120254773736230022': 'koll-01', // KOLLÁZS ÚJ 10-17 - 01 Ricsi barna haj v3
  '120254773737480022': 'koll-02', // 02 Sopron férfi v3
  '120254773738570022': 'koll-03', // 03 Viki szemüveges v3
  '120254773870230022': 'koll-03', // 03 Viki szemüveges v4
  // '120254773739360022': 'koll-04', // 04 Viki idősebb férfi v3
  // '120254773741100022': 'koll-05', // 05 Brigitta barna haj v3
  '120254773742040022': 'koll-06', // 06 Fekete felsős rövid haj v3
  '120254773743140022': 'koll-07', // 07 Gabi fekete garbós v3
  '120254773870060022': 'koll-07', // 07 Gabi fekete garbós v4
  '120254773744650022': 'koll-08', // 08 Szivli Ricsi v3
  // v6 (2026-10-17, adszet 120252935982690022)
  '120254774199610022': 'koll-01', '120254774201250022': 'koll-02', '120254774201590022': 'koll-03',
  '120254774203410022': 'koll-06', '120254774204070022': 'koll-07', '120254774204830022': 'koll-08',
};

// Tartalek a hirdetes neve alapjan (utm_content), ha az ad.id meg nincs a listaban (pl. masodpeldany).
const NEV_SZABALYOK = [
  [/KOLL[ÁA]ZS\s+[ÚU]J\s+10-17\s*-\s*0([123678])\b/i, (m) => 'koll-0' + m[1]],
];

// A tulajdonos dontese (2026-10-17): a 04/05 kollazs soha nem kerul a lapra (az automatikus tarolobol sem).
export const KIZART = new Set(['120254773739360022', '120254773741100022']);

// Automatikus tarolo (2026-10-17): a mosaic-szerver oranként menti az MP2 aktiv hirdeteseinek kepet a riport-D1
// hirdetes_hos tablajaba (ad.id kulccsal). Elsobbsege van; ha nincs talalat, jon a fix HIRDETESEK es a nev-szabaly.
export async function hosValasztas(url, db) {
  // Egyseges parameter minden vallalkozasnal: ad_id={{ad.id}} (2026-10-17); a regi mp_ad atmenetileg is mukodik.
  const ad = (url.searchParams.get('ad_id') || url.searchParams.get('mp_ad') || '').trim();
  if (/^\d{6,25}$/.test(ad) && !KIZART.has(ad) && db) {
    try {
      const sor = await db.prepare('SELECT forras FROM hirdetes_hos WHERE hirdetes_id = ?1 AND aktiv = 1').bind(ad).first();
      if (sor) return { ad, v: verzio(sor.forras) };
    } catch (e) { console.error('hirdetes-hos: D1 hiba', e && e.message); } // tablahiba eseten a fix lista marad
  }
  if (/^\d{6,25}$/.test(ad) && !KIZART.has(ad) && HIRDETESEK[ad]) return HIRDETESEK[ad];
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
// A hirdetes-kepek negyzetesek (kollazs-panelek): a hos kerete is negyzetes lesz, csak a csereltnel (a tulajdonos kerese, 2026-10-17).
const NEGYZET = '<style id="hirdetes-hos-negyzet">.hos-kep:has(>img[data-hirdetes-hos]){aspect-ratio:auto!important;min-height:0!important;height:auto!important;align-self:start}'
  + 'img[data-hirdetes-hos]{position:static!important;display:block;width:100%!important;max-width:100%!important;height:auto!important;max-height:none!important;aspect-ratio:1/1!important;object-fit:cover}</style>';

function verzio(forras) { let h = 0; for (const c of String(forras)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(36); }

// GET /hirdetes-hos-kep/<ad.id>: a tarolt kep (csak aktiv, nem kizart). Hosszu cache: a ?v= a kep verziojat jeloli.
export async function hosKepValasz(request, db) {
  const m = new URL(request.url).pathname.match(/^\/hirdetes-hos-kep\/(\d{6,25})$/);
  if (!m || KIZART.has(m[1]) || !db) return new Response('Not found', { status: 404 });
  let sor = null;
  try { sor = await db.prepare('SELECT tipus, kep, forras FROM hirdetes_hos WHERE hirdetes_id = ?1 AND aktiv = 1').bind(m[1]).first(); }
  catch (e) { console.error('hirdetes-hos: D1 hiba', e && e.message); }
  if (!sor) return new Response('Not found', { status: 404 });
  const etag = `"${verzio(sor.forras)}"`;
  const fej = { 'content-type': sor.tipus, 'cache-control': 'public, max-age=86400', etag, 'x-content-type-options': 'nosniff' };
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: fej });
  return new Response(request.method === 'HEAD' ? null : new Uint8Array(sor.kep), { headers: fej });
}

export function hosCsere(valasz, kulcs) {
  if (typeof kulcs === 'object') { // automatikus tarolobol: egy meret, negyzetes keret (CSS vagja)
    const src = `/hirdetes-hos-kep/${kulcs.ad}?v=${kulcs.v}`;
    return csereKozos(valasz, { src, srcset: null, w: 1080, h: 1080, alt: 'Medical Piercing – a hirdetésünk képe', jel: 'auto' });
  }
  const [alt, valt] = KEPEK[kulcs];
  const nagy = valt[valt.length - 1];
  const srcset = valt.map(([f, w]) => `${D}${f} ${w}w`).join(', ');
  return csereKozos(valasz, { src: D + nagy[0], srcset, w: nagy[1], h: nagy[2], alt, jel: kulcs });
}

function csereKozos(valasz, { src, srcset, w, h: mag, alt, jel }) {
  const ka = +(w / mag).toFixed(4);
  const meretek = '(max-width: 820px) 100vw, 640px';
  let kesz = false;
  const ujValasz = new HTMLRewriter()
    .on('link[rel="preload"][as="image"]', { element(el) { el.remove(); } })
    .on('head', { element(el) {
      el.append(`<link rel="preload" as="image" href="${src}"` + (srcset ? ` imagesrcset="${srcset}" imagesizes="${meretek}"` : '') + ' fetchpriority="high">' + NEGYZET, { html: true });
    } })
    .on('img[fetchpriority="high"]', { element(el) {
      if (kesz) return;
      kesz = true;
      el.setAttribute('src', src);
      if (srcset) { el.setAttribute('srcset', srcset); if (!el.getAttribute('sizes')) el.setAttribute('sizes', meretek); }
      else { el.removeAttribute('srcset'); el.removeAttribute('sizes'); }
      el.setAttribute('width', String(w));
      el.setAttribute('height', String(mag));
      el.setAttribute('alt', alt);
      el.setAttribute('data-hirdetes-hos', jel);
      const st = (el.getAttribute('style') || '').replace(/--kw:[^;]*;?/g, '').replace(/--ka:[^;]*;?/g, '').replace(/object-position:[^;]*;?/g, '');
      el.setAttribute('style', `--kw:${w}px;--ka:${ka};object-position:50% 30%;${st}`.replace(/;$/, '')); // az eredeti kep fokusza nem ervenyes az uj kepre
    } })
    .transform(valasz);
  const h = new Headers(ujValasz.headers);
  h.set('cache-control', 'private, no-store'); // a csere a parameterfuggo: ne tarolja kozos gyorsitotar
  h.delete('content-length');
  return new Response(ujValasz.body, { status: ujValasz.status, headers: h });
}
