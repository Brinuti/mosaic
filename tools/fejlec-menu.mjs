// A kozos fejlec / lablec atalakitasai (2026-10-07, a tulajdonos kerese: "a menu es a footer legyen szebb, asztalon a Paros Head Spa is ferjen bele a menube,
// az angol ikon dizajnosabb legyen"). Ugyanaz a mintazat, mint az ajandek-menu.mjs: a fejlec a Wixrol mentett oldalakban (klon/*.html, klon/m/*.html) es a
// sajat oldalak darabjaiban (assets/fejlec/*.html) egyarant beegetve van, ezeket a build (tools/netlify-build.mjs) ALAKITJA at - igy a ~180 fajl nem valtozik, es egy
// helyen van minden. Minden atalakitas ISMETELHETETLEN-BIZTOS: a mar atalakitott fejleccel nem csinal semmit. A fejlec-atalakitasok csak a <header id="SITE_HEADER">
// elemen BELUL dolgoznak (a mobil menu is ott van), hogy az oldal torzsenek hasonlo linkjeit ne erintsek.
//
//  1. a "Paros Head Spa" onallo fomenupont (kozvetlenul a "Head Spa" utan; a Head Spa lenyilojabol kikerul) - mert kulon tema
//  2. az angol zaszlo helyett finom "EN" jelveny (az angol oldalakon "HU", vissza a magyarra)
//  3. a lablec uj, tobboszlopos kialakitasa (cim, elerhetoseg, nyitvatartas, menu-linkek, ASZF / Impresszum / Suti beallitasok)
//  4. az ANGOL oldalakon (a forrasban <!--mh-nyelv:en--> jelolo): angol menucimkek, angol akciosav, angol lablec; a GYIK pont elmarad (az magyar oldalra visz)
import { ajandekMenu } from './ajandek-menu.mjs';

const PAROS_CIM = 'Páros Head Spa';
const PAROS = '/paros-headspa-budapest';
const NYELV_EN = '<!--mh-nyelv:en-->';
const HEADER = /<header id="SITE_HEADER"[\s\S]*?<\/header>/;
// A "Kapcsolat" es a "GYIK" fomenupont (2026-10-07) onallo oldalra visz: /kapcsolat, /gyik (a Wixben a nyitooldal szekcioira ugrottak: /#comp-m3znoarb, /#comp-m4l2o45p)
const MENU_ATIRANYITAS = [[/href="\/#comp-m3znoarb"/g, 'href="/kapcsolat"'], [/href="\/#comp-m4l2o45p"/g, 'href="/gyik"']];
// (a Wix a horgony-linkekre data-anchor attributumot tett: az uj, valodi oldal-linkeken ez felesleges es a kijelolt menupont felismeresit is zavarja)
const menuLinkek = (h) => MENU_ATIRANYITAS.reduce((x, [re, uj]) => x.replace(re, uj), h).replace(/ data-anchor="[^"]*"( href="\/(?:kapcsolat|gyik)")/g, '$1');

// --- Paros Head Spa onallo fomenupont ---------------------------------------------------------------------------------------------------------------
// asztali: a lenyilo (itemDepth1) eleme kikerul, helyette fomenupont (itemDepth0) a Szortelenites ele
const ASZTALI_PAROS_ALMENU = /<li class="itemDepth12472627565__itemWrapper"[^>]*data-is-current="(true|false)"(?:(?!<\/li>)[\s\S])*?href="\/paros-headspa-budapest"(?:(?!<\/li>)[\s\S])*?<\/li>/;
const ASZTALI_SZORTELENITES = /<li class="itemDepth02233374943__itemWrapper wixui-horizontal-menu__item"(?:(?!<\/li>)[\s\S])*?href="\/lezeres-szortelenites-budapest"/;
const asztaliParos = (aktiv) =>
  '<li class="itemDepth02233374943__itemWrapper wixui-horizontal-menu__item" data-testid="menuItemDepth0" data-item-depth="0" data-is-current="' + aktiv + '" aria-current="' + aktiv + '">' +
  '<div class="itemShared2352141355__rootContainer"><a data-item-label="true" data-testid="linkElement" href="' + PAROS + '" target="_self" ' +
  'class="itemDepth02233374943__root' + (aktiv === 'true' ? ' itemDepth02233374943--isCurrentPage' : '') + ' StylableHorizontalMenu3372578893__menuItem itemShared2352141355__menuItem" tabindex="0">' +
  '<div class="itemDepth02233374943__container"><span class="itemDepth02233374943__label wixui-horizontal-menu__item-label">' + PAROS_CIM + '</span></div></a></div></li>';

// mobil: ugyanez a fuggoleges menuben (a lenyilo eleme kikerul, a Head Spa pont utan onallo sor)
const MOBIL_PAROS_ALMENU = /<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-\d+-\d+"([^>]*)>(?:(?!<\/li>)[\s\S])*?href="\/paros-headspa-budapest"(?:(?!<\/li>)[\s\S])*?<\/li>/;
const MOBIL_SZORTELENITES = /<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-\d+"(?:(?!<\/li>)[\s\S])*?href="\/lezeres-szortelenites-budapest"/;
const mobilParos = (aktiv) =>
  '<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-paros"' + (aktiv ? ' aria-current="page"' : '') +
  ' class="FWN1UT GrMktH WIf5uD wixui-vertical-menu__item' + (aktiv ? ' jqR3kU' : '') + '">' +
  '<div data-testid="itemWrapper" class="keDKhi"><span data-testid="linkWrapper" class="j945c8">' +
  '<a data-testid="linkElement" href="' + PAROS + '" target="_self" class="G7GdaI wixui-vertical-menu__item-label">' + PAROS_CIM + '</a></span></div></li>';

// --- Arlista: onallo fomenupont (a FOGLALAS elott), 2026-10-07: egyetlen arlista minden uzletagnak (/arlista) ---
const ARLISTA = '/arlista';
const ARLISTA_CIM = 'Árlista';
const ASZTALI_FOGLALAS = /<li class="itemDepth02233374943__itemWrapper wixui-horizontal-menu__item"(?:(?!<\/li>)[\s\S])*?href="\/idpontfoglalas"/;
const MOBIL_FOGLALAS = /<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-\d+"(?:(?!<\/li>)[\s\S])*?href="\/idpontfoglalas"/;
const asztaliArlista = () =>
  '<li class="itemDepth02233374943__itemWrapper wixui-horizontal-menu__item" data-testid="menuItemDepth0" data-item-depth="0" data-is-current="false" aria-current="false">' +
  '<div class="itemShared2352141355__rootContainer"><a data-item-label="true" data-testid="linkElement" href="' + ARLISTA + '" target="_self" ' +
  'class="itemDepth02233374943__root StylableHorizontalMenu3372578893__menuItem itemShared2352141355__menuItem" tabindex="0">' +
  '<div class="itemDepth02233374943__container"><span class="itemDepth02233374943__label wixui-horizontal-menu__item-label">' + ARLISTA_CIM + '</span></div></a></div></li>';
const mobilArlista = () =>
  '<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-arlista" class="FWN1UT GrMktH WIf5uD wixui-vertical-menu__item">' +
  '<div data-testid="itemWrapper" class="keDKhi"><span data-testid="linkWrapper" class="j945c8">' +
  '<a data-testid="linkElement" href="' + ARLISTA + '" target="_self" class="G7GdaI wixui-vertical-menu__item-label">' + ARLISTA_CIM + '</a></span></div></li>';
function arlistaFomenu(h, mobil) {
  if (h.includes('href="' + ARLISTA + '"')) return h;   // mar atalakitott
  return h.replace(mobil ? MOBIL_FOGLALAS : ASZTALI_FOGLALAS, (m) => (mobil ? mobilArlista() : asztaliArlista()) + m);
}

// A Fodraszat lenyilobol a "Fodraszat Arak" pont kikerul (a tulajdonos kerese, 2026-10-09: nem mukodik; a regi Wixes oldal #comp-m5p3vmyh horgonya az ujratervezett
// fodrasz-oldalakon nincs meg). Az arlistak az oldalakon (#arak-szekcio) es a /arlista oldalon vannak. Mobilon es asztalon is; az angol menube is ez kerul at.
const FODRASZ_ARAK_ALMENU = /<li(?:(?!<li|<\/li>)[\s\S])*?href="\/noi-fodrasz-budapest-balayage-hajfestes#comp-m5p3vmyh"(?:(?!<\/li>)[\s\S])*?<\/li>/;
function fodraszArakKi(h) {
  return h.replace(FODRASZ_ARAK_ALMENU, '');
}

// Az akciosav (Októberi akcio ...) linkje ugyanabban az ablakban nyiljon (a tulajdonos kerese, 2026-10-09), ne uj lapon: a Wixes fejlecben target="_blank" volt.
function akciosavSajatAblak(h) {
  return h.replace(/(<a href="\/head-spa-kedvezmeny" )target="_blank"/g, '$1target="_self"');
}

function parosFomenu(h, mobil) {
  if (mobil) {
    const m = h.match(MOBIL_PAROS_ALMENU);
    if (!m) return h;   // nincs lenyilo-elem (mar atalakitott, vagy mas fejlec)
    const aktiv = /aria-current="page"/.test(m[1]);
    return h.replace(MOBIL_PAROS_ALMENU, '').replace(MOBIL_SZORTELENITES, (s) => mobilParos(aktiv) + s);
  }
  const m = h.match(ASZTALI_PAROS_ALMENU);
  if (!m) return h;
  return h.replace(ASZTALI_PAROS_ALMENU, '').replace(ASZTALI_SZORTELENITES, (s) => asztaliParos(m[1]) + s);
}

// --- nyelvi jelveny (a zaszlo helyett) -----------------------------------------------------------------------------------------------------------------
const GLOBUSZ = '<svg class="mh-glob" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z"/></svg>';
const ZASZLO = /(<div id="comp-m7jcfhgp"[^>]*>)<a data-testid="linkElement" href="\/headspa-budapest-hungary" target="_self" class="apPOZK"><img [^>]*><\/a>(<\/div>)/;
const NYELV_ELEM = /<div id="comp-m7jcfhgp"[^>]*>(?:(?!<\/a><\/div>)[\s\S])*<\/a><\/div>/;
function nyelvJelveny(h, angol, mobil) {
  if (mobil) return h.replace(NYELV_ELEM, '');
  return h.replace(ZASZLO, (m, nyit, zar) => nyit + (angol
    ? '<a data-testid="linkElement" href="/" target="_self" class="apPOZK mh-nyelv" hreflang="hu" lang="hu" aria-label="Magyar nyelv">' + GLOBUSZ + '<span>HU</span></a>'
    : '<a data-testid="linkElement" href="/headspa-budapest-hungary" target="_self" class="apPOZK mh-nyelv" hreflang="en" lang="en" aria-label="English">' + GLOBUSZ + '<span>EN</span></a>') + zar);
}

// --- mobil menu: az Ajandekkartya lenyilo alapbol nyitva (a latogato lassa, hogy haromfele ajandekkartya van; a klon.js a rErQ82 osztallyal nyit / zar) -----------
const MOBIL_AJANDEK = /(<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-\d+"(?:(?!<\/li>)[\s\S])*?class="[^"]*?)("[^>]*>(?:(?!<\/li>)[\s\S])*?href="\/ajandekkartya"(?:(?!<\/li>)[\s\S])*?aria-expanded=")false(")/;
function ajandekNyitva(h) {
  // a Wixes oldalakon a Head Spa lenyilo is nyitva jon (ahol egy almenu a kijelolt oldal): hogy a nyitott Ajandekkartya-lenyiloval az egesz menu elferjen, minden mas zarva indul
  // (a kijelolt oldal fomenupontja ettol meg arany marad: a CSS a kijelolt almenu szuleit is kiemeli)
  h = h.replace(/ rErQ82/g, '').replace(/(data-testid="expandablemenu-toggle")/g, '$1').replace(/aria-expanded="true"/g, 'aria-expanded="false"');
  return h.replace(MOBIL_AJANDEK, (m, x, y, z) => x + ' rErQ82' + y + 'true' + z);
}

// --- az "i" ikon felugro ablaka (Info): sajat, az oldal stilusahoz illo kialakitas a Wixes ablak helyett -----------------------------------------------------------
// A klon.js a [data-mh-popup="rk7x7"] gyokeret, a .mh-popup-doboz dobozt es a [data-mh-popup-zar] gombot hasznalja (nyitas / bezaras: X, Esc, hatterre kattintas).
const IKON_SVG = {
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 00-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  tel: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"/></svg>',
  level: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  ora: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  naptar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
};
const POPUP_SZOVEG = {
  hu: {
    cim: 'Infó', felcim: 'MOSAIC Head Spa and Hair', h2: 'A legfontosabb infók', bezar: 'Bezárás',
    elerh: 'Ahol elérsz minket', cim1: '1023 Budapest, Bécsi út 2.', cim2: '(A Zsigmond térnél)', tel: '06 20 247 4444',
    ora: 'Nyitvatartásunk', oraSor1: ['Hétfő – Szombat:', '8:00 – 20:00'], oraSor2: ['Vasárnap:', 'zárva'],
    arak: 'Árlista, csomagok, foglalás', arLink: 'Árlista és időpontok', foglalas: 'Időpontfoglalás', ajandek: 'Ajándékkártya',
  },
  en: {
    cim: 'Info', felcim: 'MOSAIC Head Spa and Hair', h2: 'The most important info', bezar: 'Close',
    elerh: 'Where to find us', cim1: '1023 Budapest, Bécsi út 2.', cim2: '(Near Zsigmond tér)', tel: '+36 20 247 4444',
    ora: 'Opening hours', oraSor1: ['Monday – Saturday:', '8:00 – 20:00'], oraSor2: ['Sunday:', 'closed'],
    arak: 'Prices, packages, booking', arLink: 'Price list & booking', foglalas: 'Book now', ajandek: 'Gift card',
  },
};
const MAPS = 'https://www.google.com/maps/search/?api=1&amp;query=MOSAIC%20Head%20Spa%2C%201023%20Budapest%2C%20B%C3%A9csi%20%C3%BAt%202.';
function popupHtml(nyelv) {
  const t = POPUP_SZOVEG[nyelv];
  const sor = (ikon, tartalom, tag = 'p', attr = '') => '<' + tag + ' class="mhp-sor"' + attr + '><span class="mhp-ikon">' + IKON_SVG[ikon] + '</span><span class="mhp-szoveg">' + tartalom + '</span></' + tag + '>';
  return '<div class="mh-popup-gyoker mhp" data-mh-popup="rk7x7" role="dialog" aria-modal="true" aria-label="' + t.cim + '" tabindex="-1" hidden>' +
    '<div class="mhp-fatyol"></div>' +
    '<aside class="mh-popup-doboz mhp-panel">' +
    '<button type="button" class="mhp-zar" data-mh-popup-zar aria-label="' + t.bezar + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    '<p class="mhp-felcim">' + t.felcim + '</p><h2>' + t.h2 + '</h2>' +
    '<div class="mhp-csoport"><h3>' + t.elerh + '</h3>' +
    sor('pin', t.cim1 + ' <small>' + t.cim2 + '</small>', 'a', ' href="' + MAPS + '" target="_blank" rel="noopener"') +
    sor('tel', t.tel, 'a', ' href="tel:+36202474444"') +
    sor('level', 'mosaicheadspa@gmail.com', 'a', ' href="mailto:mosaicheadspa@gmail.com"') + '</div>' +
    '<div class="mhp-csoport"><h3>' + t.ora + '</h3>' +
    sor('ora', '<b>' + t.oraSor1[0] + '</b> ' + t.oraSor1[1]) +
    '<p class="mhp-sor mhp-sor-masodik"><span class="mhp-ikon" aria-hidden="true"></span><span class="mhp-szoveg"><b>' + t.oraSor2[0] + '</b> ' + t.oraSor2[1] + '</span></p></div>' +
    '<div class="mhp-csoport"><h3>' + t.arak + '</h3>' +
    sor('naptar', t.arLink + ' <span class="mhp-nyil" aria-hidden="true">→</span>', 'a', ' href="/arlista"') +
    '<div class="mhp-gombok"><a class="mhp-gomb mhp-arany" href="/foglalo-motor?business=headspa">' + t.foglalas + ' <span aria-hidden="true">→</span></a>' +
    '<a class="mhp-gomb mhp-korvonal" href="/ajandekkartya">' + t.ajandek + ' <span aria-hidden="true">→</span></a></div></div>' +
    '</aside></div>';
}
const POPUP_SABLON = /<template id="mh-popup-rk7x7">[\s\S]*?<\/template>/;
function popup(html, nyelv) {
  return html.replace(POPUP_SABLON, (m) => (m.includes('mhp-panel') ? m : '<template id="mh-popup-rk7x7">' + popupHtml(nyelv) + '</template>'));
}

// --- angol menucimkek (az angol oldalakon) ------------------------------------------------------------------------------------------------------------
const ANGOL_CIMKEK = [
  ['/4-kezes-headspa-ajandekkartya', 'NEW! - 4 hands Head Spa!'], ['/headspa-budapest', 'What is Head Spa?'], [PAROS, 'Couples Head Spa'],
  ['/headspa-ferfiaknak', 'Head Spa for men'], ['/headspa-arak-budapest', 'Head Spa packages &amp; prices'], ['/head-spa-kedvezmeny', 'Head Spa - 20% OCTOBER discount!'],
  ['/head-spa-velemenyek', 'Head Spa reviews'], ['/headspa-termekek-oxygeni', 'OXYGENI products'], ['/lezeres-szortelenites-budapest', 'Laser hair removal'],
  ['/noi-fodraszat-budapest', 'Hairdressing'], ['/noi-fodrasz-budapest-balayage-hajfestes#comp-m5p3vmyh', 'Hairdressing prices'], ['/oxigenterapia-budapest', 'Oxygen therapy'],
  ['/sminktetovalas-budapest', 'Permanent makeup'], ['/ajandekkartya', 'Gift card'], ['/headspa-ajandekkartya', 'Head Spa gift card'],
  ['/lezeres-ajandekkartya', 'Hair removal gift card'], ['/oxigen-ajandekkartya', 'Oxygen therapy gift card'], [ARLISTA, 'Price list'], ['/idpontfoglalas', 'BOOKING'],
];
const regex = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
const AKCIOSAV_HU = /Okt(?:ó|&oacute;)beri akci(?:ó|&oacute;)! - 20% kedvezm(?:é|&eacute;)ny minden headspa foglal(?:á|&aacute;)sra \+ aj(?:á|&aacute;)nd(?:é|&eacute;)kk(?:á|&aacute;)rty(?:á|&aacute;)ra!/g;
const AKCIOSAV_HU_ROVID = /Okt(?:ó|&oacute;)beri akci(?:ó|&oacute;)! 20% kedvezm(?:é|&eacute;)ny minden headspa \+ aj(?:á|&aacute;)nd(?:é|&eacute;)kk(?:á|&aacute;)rty(?:á|&aacute;)ra/g;
function angolMenu(h, mobil) {
  // a GYIK pont a magyar nyitooldal GYIK-jara visz: az angol oldalakon elmarad
  h = h.replace(/<li class="itemDepth02233374943__itemWrapper wixui-horizontal-menu__item"(?:(?!<\/li>)[\s\S])*?href="\/gyik"(?:(?!<\/li>)[\s\S])*?<\/li>/, '')
    .replace(/<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-\d+"(?:(?!<\/li>)[\s\S])*?href="\/gyik"(?:(?!<\/li>)[\s\S])*?<\/li>/, '');
  // a Kapcsolat pont az angol oldal sajat elerhetoseg-szekciojara ugrik (id="helyszin")
  h = h.replace(/href="\/kapcsolat"/g, 'href="#helyszin"');
  h = h.replace(/(href="#helyszin"[^>]*>(?:<div[^>]*>)?(?:<span[^>]*>)?)[^<]+(?=<)/g, '$1Contact');
  for (const [href, cim] of ANGOL_CIMKEK) {
    h = h.replace(new RegExp('(href="' + regex(href) + '"[^>]*>(?:<div[^>]*>)?(?:<span[^>]*>)?)[^<]+(?=<)', 'g'), (m, k) => k + cim);
  }
  // a lenyilok kisegito (aria) cimkei is angolul
  h = h.replace(/aria-label="(Toggle )?Fodr(?:á|&aacute;)szat"/g, 'aria-label="$1Hairdressing"').replace(/aria-label="(Toggle )?Aj(?:á|&aacute;)nd(?:é|&eacute;)kk(?:á|&aacute;)rty(?:á|&aacute;)"/g, 'aria-label="$1Gift card"');
  h = h.replace(AKCIOSAV_HU, 'October offer! - 20% off every Head Spa booking + gift card!').replace(AKCIOSAV_HU_ROVID, 'October offer! 20% off every Head Spa + gift card');
  // a fejlec "Foglalas" gombja (mobilon)
  if (mobil) h = h.replace(/(aria-label=")FOGLAL(?:Á|&Aacute;)S(")/g, '$1Book now$2').replace(/(data-testid="stylablebutton-label">)(?:Foglal(?:á|&aacute;)s|FOGLAL(?:Á|&Aacute;)S)(<)/g, '$1Book$2');
  return h;
}

// --- lablec ------------------------------------------------------------------------------------------------------------------------------------------
const LABLEC_FORRAS = /<footer id="SITE_FOOTER"[^>]*>[\s\S]*?<\/footer>/;
const LABLEC_SZOVEG = {
  hu: {
    marka: 'Head Spa, fodrászat, szőrtelenítés és oxigénterápia a 3. kerületben, a Bécsi úton.',
    foglalas: 'Időpontfoglalás',
    headspa: 'Head Spa', szolg: 'Szolgáltatások', elerh: 'Elérhetőség',
    cim: '1023 Budapest, Bécsi út 2.<br>A Kolosy és a Zsigmond tér között.',
    ora: 'Hétfő – Szombat: 8:00 – 20:00<br>Vasárnap: ZÁRVA',
    linkek1: [['/', 'Head Spa kezelések'], [PAROS, 'Páros Head Spa'], ['/headspa-ferfiaknak', 'Head Spa Férfiaknak'], ['/headspa-arak-budapest', 'Csomagok és árak'], ['/head-spa-velemenyek', 'Vélemények'], ['/headspa-termekek-oxygeni', 'OXYGENI termékek']],
    linkek2: [['/lezeres-szortelenites-budapest', 'Szőrtelenítés'], ['/noi-fodraszat-budapest', 'Fodrászat'], ['/oxigenterapia-budapest', 'Oxigénterápia'], ['/sminktetovalas-budapest', 'Sminktetoválás'], ['/ajandekkartya', 'Ajándékkártya'], ['/arlista', 'Árlista']],
    jog: '© Big in Japan Kft. · <a href="/aszf">ÁSZF</a> · <a href="/impresszum">Impresszum</a> · <a id="mh-cc-lablec" href="#">Süti beállítások</a>',
    nyelv: ['/headspa-budapest-hungary', 'en', 'English'],
    tovabb: '<p class="mhl-tovabb"><a href="/kapcsolat">Kapcsolat és üzenetküldés →</a><br><a href="/gyik">Gyakori kérdések</a></p>',
  },
  en: {
    marka: 'Head Spa, hairdressing, laser hair removal and oxygen therapy in Budapest’s 3rd district.',
    foglalas: 'Book now',
    headspa: 'Head Spa', szolg: 'Services', elerh: 'Contact & opening hours',
    cim: '1023 Budapest, Bécsi út 2.<br>Between Kolosy tér and Zsigmond tér.',
    ora: 'Monday – Saturday: 8:00 – 20:00<br>Sunday: CLOSED',
    linkek1: [['/headspa-budapest-hungary', 'Head Spa Budapest'], [PAROS, 'Couples Head Spa'], ['/headspa-arak-budapest', 'Packages & prices'], ['/headspa-ajandekkartya', 'Gift card']],
    linkek2: [],
    jog: '© Big in Japan Kft. · <a href="/aszf">Terms (HU)</a> · <a href="/impresszum">Imprint (HU)</a> · <a id="mh-cc-lablec" href="#">Cookie settings</a>',
    nyelv: ['/', 'hu', 'Magyar'],
  },
};
const lista = (l) => l.map(([h, c]) => '<a href="' + h + '">' + c.replace(/&/g, '&amp;') + '</a>').join('');
function lablecHtml(nyelv) {
  const t = LABLEC_SZOVEG[nyelv];
  return '<footer id="SITE_FOOTER" class="mh-lablec-uj" tabindex="-1">' +
    '<div class="mhl-belso">' +
    '<div class="mhl-oszlop mhl-marka"><a class="mhl-logo" href="/" aria-label="MOSAIC Head Spa and Hair"><img src="/assets/img/logo-143x54@2x.png" width="143" height="54" alt="MOSAIC Head Spa and Hair" loading="lazy" decoding="async"></a>' +
    '<p>' + t.marka + '</p><a class="mhl-gomb" href="/foglalo-motor?business=headspa">' + t.foglalas + ' <span aria-hidden="true">→</span></a></div>' +
    '<nav class="mhl-oszlop" aria-label="' + t.headspa + '"><h3>' + t.headspa + '</h3>' + lista(t.linkek1) + '</nav>' +
    (t.linkek2.length ? '<nav class="mhl-oszlop" aria-label="' + t.szolg + '"><h3>' + t.szolg + '</h3>' + lista(t.linkek2) + '</nav>' : '') +
    '<div class="mhl-oszlop mhl-elerh"><h3>' + t.elerh.replace(/&/g, '&amp;') + '</h3><p>' + t.cim + '</p>' +
    '<p><a href="tel:+36202474444">+36 20 247 4444</a><br><a href="mailto:mosaicheadspa@gmail.com">mosaicheadspa@gmail.com</a></p><p>' + t.ora + '</p>' + (t.tovabb || '') + '</div>' +
    '</div>' +
    '<div id="comp-m40zyigs" class="mhl-also"><p>' + t.jog + '</p><a class="mhl-nyelv" href="' + t.nyelv[0] + '" hreflang="' + t.nyelv[1] + '" lang="' + t.nyelv[1] + '">' + GLOBUSZ + t.nyelv[2] + '</a></div>' +
    '</footer>';
}
function lablec(html, nyelv) {
  if (!LABLEC_FORRAS.test(html)) return html;
  return html.replace(LABLEC_FORRAS, (m) => (m.includes('mh-lablec-uj') ? m : lablecHtml(nyelv)));
}

/** A teljes fejlec / lablec atalakitas (az Ajandekkartya lenyilo + a fentiek). mobil: a fuggoleges (telefonos) menu. Ismetelhetetlen-biztos. */
export function fejlecAtalakit(html, mobil, angol = html.includes(NYELV_EN)) {
  html = ajandekMenu(html, mobil);
  html = html.replace(HEADER, (h) => {
    h = menuLinkek(h);
    h = fodraszArakKi(h);
    h = akciosavSajatAblak(h);
    h = parosFomenu(h, mobil);
    h = arlistaFomenu(h, mobil);
    h = nyelvJelveny(h, angol, mobil);
    if (mobil) h = ajandekNyitva(h);
    return angol ? angolMenu(h, mobil) : h;
  });
  return lablec(popup(html, angol ? 'en' : 'hu'), angol ? 'en' : 'hu');
}
export const ANGOL_JELOLO = NYELV_EN;

// Az "Októberi akció" (pink) felső sáv CSAK a Head Spa oldalakon látszik (a tulajdonos kérése, 2026-10-09): ezek az oldalak az <html> elemen
// data-mh-headspa jelölőt kapnak (build + helyi tesztszerver), a közös fejlec-lablec.css pedig minden más oldalon elrejti a sávot
// (html:not([data-mh-headspa]) #comp-mpv0ganp). A "-regi" (rejtett, Wixes) másolatok az eredetivel egyeznek.
export const HEADSPA_OLDALAK = new Set(['index', 'headspa-budapest', 'headspa-arak-budapest', 'headspa-termekek-oxygeni', 'headspa-ferfiaknak', 'head-spa-velemenyek',
  'paros-headspa-budapest', 'headspa-budapest-hungary', 'fooldal', 'headspa-10szazalek-kedvezmennyel', 'headspa-akcio-festessel-50szazalek', 'headspa-elofizetes', 'headspa-kupon']);
export function headspaOldal(nev) {
  const n = String(nev).replace(/\.html$/, '').normalize('NFC');
  return HEADSPA_OLDALAK.has(n) || (n.endsWith('-regi') && (HEADSPA_OLDALAK.has(n.slice(0, -5)) || n === 'fooldal-regi'));
}
export function headspaJelolo(html, nev) {
  const tag = (html.match(/<html\b[^>]*>/) || [''])[0];   // csak az elso (a dokumentum) <html> cimke szamit
  if (!headspaOldal(nev) || !tag || /\sdata-mh-headspa\b/.test(tag)) return html;
  return html.replace(/<html\b/, '<html data-mh-headspa');
}

