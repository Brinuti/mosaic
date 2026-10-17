// Hirdeteshez illo hos-kep (Mosaic, 2026-10-17, a Medical Piercing mintajara: medicalpiercing/lib/hirdetes-hos.js).
// Ha a latogato URL-jeben ad_id=<Meta hirdetes-ID> van, a landolo oldal elso kiemelt kepe a hirdetes sajat kepere cserelodik,
// MEG A SZERVEREN (HTMLRewriter): nincs villanas, a betoltes nem lassul. A kep a mosaic-szerver riport-D1-ebol jon
// (hirdetes_hos tabla, HOS_DB kotes, CSAK SELECT), csak a Mosaic fiok soraibol (fiok_id). Nincs fix tartalek-lista:
// ha nincs kotes / tabla / sor, az oldal valtozatlan. A parameterbol soha nem kerul URL vagy szoveg a lapra. Meres nem valtozik.
//
// A hos jeloloje: az elso <img fetchpriority="high">, ami NEM Wix-klon elem (a Wix-klon lapokon az elso ilyen a logo: id="img_comp-...",
// ill. a mobil videoposzter: class="IXKZdA"), nem az ajandek-motor hos-kepe (#ah-hero-kep: azt az ajandek.js a konfigbol felulirna -> villanas)
// es nem az ajandekkartya-valaszto kartyakepe (.av-kep). Igy csak a sajat (foglalas/*.html) landolo lapok hosa cserelodik.
// Videos hero (.vh-hatter): a klip (video.vh-video) a nyitokep fole usztatna, ezert csere eseten a klipet kivesszuk.

export const FIOK = '560662246028147'; // Mosaic (Big in Japan) hirdetesi fiok
export const KIZART = new Set(); // a tulajdonos altal tiltott hirdetesek (ad.id); jelenleg nincs

const SZELEKTOR = 'img[fetchpriority="high"]'; // a kizarasokat (Wix-klon, ajandek-motor) a kezelo vegzi: egyszeru szelektor, biztos HTMLRewriter-tamogatas
const KIHAGY_ID = /^(img_comp-|ah-hero-kep$)/;
// Wix-klon videoposzter (IXKZdA: regi mobil lapok, hibas src), az ajandekkartya-valaszto kartyakepe (av-kep: nem hos, hanem az elso kartya),
// es a feliratos hos-galeriak elso diaja (galeria-kep: /sminktetovalas-budapest, a felirat az elorajzolasrol szol; .hg-kep: /oxigenterapia-budapest,
// "Előtte / Utána" cimke + kura-felirat a kepen - a hirdetes kepe ala ez felrevezeto lenne). Ezeken a lapokon a hos valtozatlan marad.
const KIHAGY_OSZTALY = /(^|\s)(IXKZdA|av-kep|galeria-kep)(\s|$)/;
const AD_RE = /^\d{6,25}$/;

function verzio(forras) { let h = 0; for (const c of String(forras)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h.toString(36); }

// -> { ad, v } vagy null. Bármilyen hiba: null (az oldal valtozatlan).
export async function hosValasztas(url, db) {
  const ad = (url.searchParams.get('ad_id') || '').trim();
  if (!AD_RE.test(ad) || KIZART.has(ad) || !db) return null;
  try {
    const sor = await db.prepare('SELECT forras FROM hirdetes_hos WHERE hirdetes_id = ?1 AND fiok_id = ?2 AND aktiv = 1').bind(ad, FIOK).first();
    return sor ? { ad, v: verzio(sor.forras) } : null;
  } catch (e) { console.error('hirdetes-hos: D1 hiba', e && e.message); return null; } // pl. meg nincs tabla
}

// GET/HEAD /hirdetes-hos-kep/<ad.id>: a tarolt kep (csak Mosaic fiok, aktiv, nem kizart). Hosszu cache: a ?v= a kep verziojat jeloli.
export async function hosKepValasz(request, db) {
  const m = new URL(request.url).pathname.match(/^\/hirdetes-hos-kep\/(\d{6,25})$/);
  if (!m || KIZART.has(m[1]) || !db) return new Response('Not found', { status: 404 });
  let sor = null;
  try { sor = await db.prepare('SELECT tipus, kep, forras FROM hirdetes_hos WHERE hirdetes_id = ?1 AND fiok_id = ?2 AND aktiv = 1').bind(m[1], FIOK).first(); }
  catch (e) { console.error('hirdetes-hos: D1 hiba', e && e.message); }
  if (!sor || !/^image\//.test(sor.tipus || '')) return new Response('Not found', { status: 404 });
  const etag = `"${verzio(sor.forras)}"`;
  const fej = { 'content-type': sor.tipus, 'cache-control': 'public, max-age=86400', etag, 'x-content-type-options': 'nosniff' };
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: fej });
  return new Response(request.method === 'HEAD' ? null : new Uint8Array(sor.kep), { headers: fej });
}

// A HTML-valaszban a hos-kepet csereli (az elso SZELEKTOR-talalat, a KIHAGY_ID-k kivetelevel).
export function hosCsere(valasz, { ad, v }) {
  const src = `/hirdetes-hos-kep/${ad}?v=${v}`;
  let kesz = false, videosHos = false, kihagyKov = false;
  const ujValasz = new HTMLRewriter()
    // A <head> kep-eloltolto sorahoz NEM nyulunk: a fej feldolgozasakor meg nem tudni, lesz-e csere (nehany lapon - pl. szajtetovalas,
    // paros-headspa-budapest-uj, ajandek- es Wix-klon lapok - nincs csere), es ott a torles lassitana. Ara: csere eseten az eredeti
    // hos-kep is letoltodik (felesleges, de artalmatlan). Az uj kep <img>-je fetchpriority="high"-jal a lap elejen all.
    // ugyanarra az elemre a SZELEKTOR-kezelo elott fut: feliratos galeria-dia (.hg-kep) vagy a build altal beirt Wix-klon videoposzter
    // (.mh-video, lejatszo gombbal: regi Wix-lapok, pl. /home, /success-foglalas*), vagy Wix-hatterkep (wow-image) -> nincs csere
    .on('.hg-kep > img, .mh-video > img, wow-image > img', { element() { if (!kesz) kihagyKov = true; } })
    .on(SZELEKTOR, { element(el) {
      if (kihagyKov) { kihagyKov = false; kesz = true; return; } // az elso kiemelt kep feliratos galeria-dia: nincs csere
      if (kesz || KIHAGY_ID.test(el.getAttribute('id') || '') || KIHAGY_OSZTALY.test(el.getAttribute('class') || '')) return;
      kesz = true;
      videosHos = /(^|\s)vh-hatter(\s|$)/.test(el.getAttribute('class') || '');
      el.setAttribute('src', src);
      el.removeAttribute('srcset'); el.removeAttribute('srcSet'); el.removeAttribute('sizes');
      el.setAttribute('width', '1080');
      el.setAttribute('height', '1080');
      el.setAttribute('alt', 'MOSAIC – a hirdetésünk képe');
      el.setAttribute('data-hirdetes-hos', 'auto');
      // az eredeti kep fokusza nem ervenyes az uj kepre
      const st = (el.getAttribute('style') || '').replace(/object-position:[^;]*;?/g, '').replace(/--vh-poz[^:]*:[^;]*;?/g, '');
      el.setAttribute('style', (`object-position:50% 35%;--vh-poz:50% 35%;--vh-poz-mobil:50% 35%;` + st).replace(/;$/, ''));
    } })
    .on('video.vh-video', { element(el) { if (videosHos) el.remove(); } }) // a klip a hos-kep utan all a HTML-ben
    .transform(valasz);
  const h = new Headers(ujValasz.headers);
  h.set('cache-control', 'private, no-store'); // parameterfuggo: ne tarolja kozos gyorsitotar
  h.delete('content-length');
  h.delete('etag');
  return new Response(ujValasz.body, { status: ujValasz.status, headers: h });
}
