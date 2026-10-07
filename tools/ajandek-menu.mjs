// Az "Ajandekkartya" fomenupont lenyiloja (2026-10-07): ket ajandekkartya van (Head Spa es lezeres szortelenites), ezert a fomenu
// ket pontja kozul lehet valasztani, a menupontra kattintva pedig a /ajandekkartya valaszto oldal nyilik.
//
// A fejlec a Wixrol mentett oldalakban (klon/*.html, klon/m/*.html) es a sajat oldalak darabjaiban (assets/fejlec/*.html) egyarant
// beegetve van, egyszerű "Ajandekkartya" menupontkent. Ezt a menupontot a build (tools/netlify-build.mjs) ALAKITJA at, igy a ~180 fajl
// nem valtozik, es egy helyen van a lenyilo (a fejlec-kivonat ujrafuttatasa sem rontja el). Az atalakitas ismetelhetetlen-biztos:
// az mar atalakitott menun nem csinal semmit.
//
// A lenyilo jelolese pontosan a Fodraszat menupontjat koveti (asztali: itemDepth0 + submenu, mobil: expandablemenu-toggle), igy a
// meglevo CSS-t es a klon.js lenyilo-kezeleset hasznalja, uj szkript nem kell.

export const AJANDEK_MENU = {
  cim: 'Ajándékkártya',
  utvonal: '/ajandekkartya',
  elemek: [
    { cim: 'Head Spa ajándékkártya', utvonal: '/headspa-ajandekkartya' },
    { cim: 'Szőrtelenítés ajándékkártya', utvonal: '/lezeres-ajandekkartya' },
    { cim: 'Oxigénterápia ajándékkártya', utvonal: '/oxigen-ajandekkartya' },
  ],
};

const NYIL_ASZTALI = '<svg width="0" height="0" viewBox="0 0 0 0" fill="black" xmlns="http://www.w3.org/2000/svg"><path d="M8 10.5L16 1.86193L14.7387 0.5L8 7.77613L1.26133 0.499999L-5.95321e-08 1.86193L8 10.5Z"></path></svg>';
const NYIL_MOBIL = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9.2828 4.89817"><path d="M4.64116,4.89817a.5001.5001,0,0,1-.34277-.13574L.15727.86448A.50018.50018,0,0,1,.84282.136L4.64116,3.71165,8.44.136a.50018.50018,0,0,1,.68555.72852L4.98393,4.76243A.5001.5001,0,0,1,4.64116,4.89817Z"></path></svg>';

const AJANDEK = 'Aj(?:á|&aacute;)ndékkártya';

// --- asztali (vizszintes) menu ---
const ASZTALI_REGI = new RegExp(
  '<li class="itemDepth02233374943__itemWrapper wixui-horizontal-menu__item" data-testid="menuItemDepth0" data-item-depth="0" ' +
  'data-is-current="(true|false)" aria-current="(?:true|false)"><div class="itemShared2352141355__rootContainer">' +
  '<a data-item-label="true" data-testid="linkElement" href="/headspa-ajandekkartya" target="_self" ' +
  'class="itemDepth02233374943__root(?: itemDepth02233374943--isCurrentPage)? StylableHorizontalMenu3372578893__menuItem itemShared2352141355__menuItem" tabindex="0">' +
  '<div class="itemDepth02233374943__container"><span class="itemDepth02233374943__label wixui-horizontal-menu__item-label">' + AJANDEK + '</span></div></a></div></li>', 'g');

const asztaliElem = (e) =>
  '<li class="itemDepth12472627565__itemWrapper" data-testid="menuItemDepth1" data-item-depth="1" data-is-current="false" aria-current="false">' +
  '<div class="itemShared2352141355__rootContainer"><a data-item-label="true" data-testid="linkElement" href="' + e.utvonal + '" target="_self" ' +
  'class="itemDepth12472627565__root submenu815198092__menuItem itemShared2352141355__menuItem" tabindex="0">' +
  '<div class="itemDepth12472627565__container"><span class="itemDepth12472627565__label">' + e.cim + '</span></div></a></div></li>';

const asztaliUj = (aktiv) =>
  '<li class="itemDepth02233374943__itemWrapper wixui-horizontal-menu__item" data-testid="menuItemDepth0" data-item-depth="0" data-is-current="' + aktiv + '" aria-current="' + aktiv + '">' +
  '<div class="itemShared2352141355__rootContainer itemShared2352141355--isRow">' +
  '<a data-item-label="true" data-testid="linkElement" href="' + AJANDEK_MENU.utvonal + '" target="_self" ' +
  'class="itemDepth02233374943__root' + (aktiv === 'true' ? ' itemDepth02233374943--isCurrentPage' : '') + ' StylableHorizontalMenu3372578893__menuItem itemShared2352141355__menuItem" ' +
  'aria-expanded="false" aria-haspopup="true" tabindex="0"><div class="itemDepth02233374943__container">' +
  '<span class="itemDepth02233374943__label wixui-horizontal-menu__item-label">' + AJANDEK_MENU.cim + '</span></div></a>' +
  '<div class="itemShared2352141355__accessibilityIconWrapper itemShared2352141355--isTopLevel"><button tabindex="0" class="itemShared2352141355__accessibilityIcon" ' +
  'aria-label="Toggle ' + AJANDEK_MENU.cim + '">' + NYIL_ASZTALI + '</button></div></div>' +
  '<div class="itemDepth02233374943__positionBox itemDepth02233374943--isColumn" role="group" aria-label="' + AJANDEK_MENU.cim + '" data-testid="positionBox">' +
  '<div class="submenu815198092__root StylableHorizontalMenu3372578893__columnsLayout itemDepth02233374943__animationBox">' +
  '<div class="itemDepth02233374943__alignBox submenu815198092__pageWrapper submenu815198092__overrideWidth">' +
  '<ul class="itemDepth02233374943__list submenu815198092__listWrapper" style="--horizontalSpacing:var(--style-mtfgjr81-horizontalSpacing)">' +
  AJANDEK_MENU.elemek.map(asztaliElem).join('') + '</ul></div></div></div></li>';

// --- mobil (fuggoleges, lenyilo) menu ---
const MOBIL_REGI = new RegExp(
  '<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-(\\d+)"( aria-current="page")? class="FWN1UT GrMktH WIf5uD wixui-vertical-menu__item(?: jqR3kU)?">' +
  '<div data-testid="itemWrapper" class="keDKhi"><span data-testid="linkWrapper" class="j945c8">' +
  '<a data-testid="linkElement" href="/headspa-ajandekkartya" target="_self" class="G7GdaI wixui-vertical-menu__item-label">' + AJANDEK + '</a></span></div></li>', 'g');

const mobilElem = (e, azon, i) =>
  '<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-' + azon + '-' + i + '" class="FWN1UT GrMktH jieHoL wixui-vertical-menu__item">' +
  '<div data-testid="itemWrapper" class="keDKhi"><span data-testid="linkWrapper" class="j945c8">' +
  '<a data-testid="linkElement" href="' + e.utvonal + '" target="_self" class="G7GdaI wixui-vertical-menu__item-label">' + e.cim + '</a></span></div></li>';

const mobilUj = (azon, aktiv) =>
  '<li data-testid="MENU_AS_CONTAINER_EXPANDABLE_MENU-' + azon + '"' + (aktiv ? ' aria-current="page"' : '') +
  ' class="FWN1UT GrMktH WIf5uD Hp2waC wixui-vertical-menu__item' + (aktiv ? ' jqR3kU' : '') + '">' +
  '<div data-testid="itemWrapper" class="keDKhi"><span data-testid="linkWrapper" class="j945c8">' +
  '<a data-testid="linkElement" href="' + AJANDEK_MENU.utvonal + '" target="_self" class="G7GdaI wixui-vertical-menu__item-label">' + AJANDEK_MENU.cim + '</a></span>' +
  '<button aria-expanded="false" aria-haspopup="true" aria-label="' + AJANDEK_MENU.cim + '" class="NUCS6n" data-testid="expandablemenu-toggle">' +
  '<div class="jIDNF8 wixui-vertical-menu__arrow">' + NYIL_MOBIL + '</div></button></div>' +
  '<ul class="tFexI9 wixui-vertical-menu__submenu">' + AJANDEK_MENU.elemek.map((e, i) => mobilElem(e, azon, i)).join('') + '</ul></li>';

// A fejlec-darab (vagy egy egesz oldal) "Ajandekkartya" menupontjat a lenyilora cseri. mobil: a fuggoleges (telefonos) menu.
export function ajandekMenu(html, mobil) {
  return mobil
    ? html.replace(MOBIL_REGI, (m, azon, aktiv) => mobilUj(azon, Boolean(aktiv)))
    : html.replace(ASZTALI_REGI, (m, aktiv) => asztaliUj(aktiv));
}
