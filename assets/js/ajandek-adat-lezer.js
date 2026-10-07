// MOSAIC Gift Commerce Engine - a LEZERES SZORTELENITES ajandekkartya adatai (kulon kereskedo: sajat Stripe-fiok, sajat Szamlazz.hu-fiok).
//
// Ez a fajl a HeadSpa kozos adatara (ajandek-adat.js) epul: ugyanazokat a segedeket (arSzoveg, ervenyesIg, ...), fizetesi modokat,
// alkalmakat es a Google-osszegzest hasznalja, a termekeket, a szoveget, a szalon-adatokat es a kereskedo-beallitasokat sajatra cseréli.
//   - a bongeszoben klasszikus szkript (a HeadSpa adat UTAN toltodik): beallitja a window.AJANDEK_ADAT-ot erre az adatra
//   - a szerveren (functions/api/ajandek-lezer/[[kind]].js) mellekhatas-importtal: globalThis.AJANDEK_ADAT_LEZER
//
// OSSZEGEK: fix ertekű ajandekkartyak, a vendeg barmelyik lezeres kezelesre felhasznalhatja. Az osszegeket CSAK ITT kell atirni
// (a szerver ebbol szamolja a PaymentIntent osszeget es a Szamlazz.hu-tetelt, a bongeszo ebbol irja ki az arat).
// A tulajdonos dontese (2026-10-07): 30 000 / 50 000 / 100 000 / 200 000 Ft. A maradek osszeg is felhasznalhato (a kartya ervenessegi idejen belul).
//
// SZAMLA: a Szamlazz.hu Szamla Agenttel, a vasarlaskor (a HeadSpa-hoz hasonloan). A kibocsato "uj KATA", alanyi adomentes (AAM):
// az Agent az ujKATA-s fiokbol vallalkozasnak nem szamlazhat, ezert ceges szamla NINCS; a tetelen az AAM-jelzes szerepel.
(function (g) {
  'use strict';
  var H = g.AJANDEK_ADAT;
  if (!H) throw new Error('ajandek-adat-lezer: elobb az ajandek-adat.js kell');

  var ERTEKEK = [30000, 50000, 100000, 200000];
  var KEP = { src: '/assets/img/c2eb0f_f5b87c4c4fd64d6d89f970a318a56da0.jpg', alt: 'Lézeres szőrtelenítés kezelés a MOSAIC-ban', w: 700, h: 927, poz: '50% 40%' };

  function ft(n) { return H.arSzoveg(n); }
  var TERMEKEK = {};
  var SZAMLA_TETELEK = {};
  ERTEKEK.forEach(function (n) {
    var id = 'lezer' + (n / 1000);
    TERMEKEK[id] = {
      id: id,
      product_type: 'lezer-ertek',
      item_id: 'mosaic-lezer-ajandekkartya-' + (n / 1000),
      nev: ft(n) + ' értékű kártya',
      kartya_cim: 'Lézeres szőrtelenítés ajándékkártya – ' + ft(n),
      // a nyomtathato kartyan a savba kerulo felirat (2 sor, nagybetusen jelenik meg); az ertek a felirat alatt kulon latszik
      kartya_felirat: ['MOSAIC LÉZERES', 'SZŐRTELENÍTÉS'],
      osszefoglalo: 'Bármelyik lézeres kezelésre',
      osszefoglalo_rovid: 'Bármelyik kezelésre',
      osszefoglalo_ikon: 'gift',
      leiras: 'Fix összegű ajándékkártya: az ajándékozott maga választja ki, melyik testtájat szeretné kezeltetni.',
      tartalom: [ft(n) + ' érték', 'Bármelyik lézeres kezelésre', '6 hónapig felhasználható'],
      kartya_sor: 'Lézeres szőrtelenítés ' + ft(n) + ' értékben',
      ar_ft: n,
      vendeg_db: 0,
      pontosan: { ido: 'Bármelyik lézeres kezelésre', fo: '1 vendég', kezelo: 'Zsófi, a MOSAIC lézeres szakértője' },
      kezeles: {
        leiras: [
          'Az ajándékkártya értéke a MOSAIC lézeres szőrtelenítésén használható fel, bármelyik testtájra. Ha a kezelés ára kevesebb a kártya értékénél, a maradék összeg is felhasználható.',
          'Az ajándékozott az online időpontfoglalásnál a kártyán lévő kuponkóddal váltja be.'
        ],
        menet: null,
        // Zsofi konzultacios videoja (9:16, az eles lezeres oldal videoja)
        video: { src: '/assets/video/c2eb0f_ba9a927739a64ab090ddb79bc84c6dc0.mp4', poster: '/assets/img/c2eb0f_ba9a927739a64ab090ddb79bc84c6dc0f000.jpg', ido: '0:44' }
      },
      vizual: KEP
    };
    // a szamla sora: a vasarlas osszege, alanyi adomentes (AAM). A tetelnev a vevo szamlaján is latszik.
    SZAMLA_TETELEK[id] = [{ nev: 'MOSAIC lézeres szőrtelenítés ajándékkártya – ' + ft(n) + ' értékben', ft: n, afa: 'AAM' }];
  });
  function szamlaTetelek(id) { return Object.prototype.hasOwnProperty.call(SZAMLA_TETELEK, id) ? SZAMLA_TETELEK[id] : null; }

  var RENDEZES = Object.keys(TERMEKEK);
  var VARIANTOK = {
    general: {
      variant_id: 'general',
      hero_eyebrow: 'MOSAIC LÉZERES SZŐRTELENÍTÉS',
      hero_title: 'Ajándékozz lézeres szőrtelenítést – ő választja ki, melyik területet.',
      hero_subtitle: 'Fix összegű ajándékkártya a MOSAIC lézeres szőrtelenítésére Budapesten, digitálisan vagy kinyomtatva.',
      hero_cta: 'Kiválasztom az összeget',
      hero_media: { src: '/assets/img/c2eb0f_095b37f37006437d8942bb760bc4740b.jpg', alt: 'Zsófi, a MOSAIC lézeres szőrtelenítés szakértője', forras: 'a lézeres landing jóváhagyott képe', status: 'APPROVED_BY_FOLDER_CONTEXT' },
      hero_trust: [
        { csillag: true, szoveg: H.GOOGLE.pont + ' · ' + H.GOOGLE.darab, alszoveg: 'Google-vélemény', alszoveg_rovid: 'vélemény', href: '#ah-google' },
        { ikon: 'calendar', szoveg: '6 hónapig', alszoveg: 'érvényes' },
        { ikon: 'monitor', szoveg: 'Online', alszoveg: 'megvásárolható' },
        { ikon: 'card', szoveg: 'Gyönyörű, személyre', alszoveg: 'szabható kártya' }
      ],
      gift_finder_preselect: null,
      product_order: RENDEZES,
      vendeg_sorrend: [],
      featured_proof: 'general',
      reassurance: null,
      objection_title: null, objection_body: null,
      relationship: null, gift_context: 'general', occasion: null
    }
  };

  var GALERIA = [
    ['c2eb0f_ac85eea74409484091e12f8d72fbee98', 1000, 667, 'A MOSAIC bejárata a Bécsi úton'],
    ['c2eb0f_b93a709a951c401b9e44d4083dc5172d', 1000, 831, 'Konzultáció a MOSAIC lézeres szőrtelenítésén'],
    ['c2eb0f_f5b87c4c4fd64d6d89f970a318a56da0', 700, 927, 'Lézeres szőrtelenítés kezelés a MOSAIC-ban'],
    ['c2eb0f_095b37f37006437d8942bb760bc4740b', 850, 875, 'Zsófi, a MOSAIC lézeres szőrtelenítés szakértője']
  ].map(function (e) { return { src: '/assets/img/' + e[0] + '.jpg', w: e[1], h: e[2], alt: e[3] }; });

  var ATVETELEK = [
    { id: 'otthon', cim: 'E-mailben, otthon kinyomtatom', rovid: 'Nyomtatható formában kapod meg, és személyre is szabhatod.', szemelyre: true }
  ];

  var SZALON = {
    nev: 'MOSAIC Lézeres Szőrtelenítés',
    cegnev: 'Szabó Zsófia e.v.',
    cim: '1023 Budapest, Bécsi út 2.',
    telefon: '06 20 247 4444',
    email: 'mosaicheadspa@gmail.com',
    foglalas_url: 'https://www.mosaicheadspa.hu/lezeres-szortelenites-budapest',
    foglalas_szoveg: 'mosaicheadspa.hu/lezeres-szortelenites-budapest',
    // a nyomtathato A4 kartya hattere: a HeadSpa-terv, a bal alsó foto Zsófi konzultacios kepere cserelve (az arany iv, a szovegek, a logo valtozatlanok)
    kartya_hatter: '/assets/img/ajandek/kartya-hatter-lezer.jpg',
    // a szalonnak szolo level "kupont fel kell vinni" blokkja: a lezeres kartya osszeg-kupon (fix ertek), nem kezeles-kupon
    kupon_cim: 'Fel kell vinni egy összeg-kupont a Salonicba (Elysion)',
    kupon_szoveg: 'ezért a Salonicban <b>nem utalvány-értékesítést</b>, hanem egy <b>{osszeg}</b> értékű, fix összegű kupont (utalványt) hozz létre a lézeres szőrtelenítés szolgáltatásaira. <b>A kártya maradék összege is felhasználható</b>, ezért olyan kupon kell, amiből a maradék megmarad (nem 100%-os, és nem egyszer használatos). Érvényes {ervenyes} (6 hónap). A kuponkód pontosan egyezzen az alábbival (kötőjel nélkül).'
  };

  // oldal-cim -> alapertelmezett termek (a kartyak oldal-cime a /lezeres-ajandekkartya; a variant mindig a GENERAL)
  var OLDAL_ALAPERTEK = { '/lezeres-ajandekkartya': { variant: 'general', termek: 'lezer50' } };
  function oldalAlapertek(ut) {
    var kulcs = String(ut == null ? '' : ut).replace(/\/+$/, '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(OLDAL_ALAPERTEK, kulcs) ? OLDAL_ALAPERTEK[kulcs] : {};
  }
  function variantFeloldas() { return VARIANTOK.general; }

  // a rendeles lathato azonositoja: LZ-<8 karakter> (a HeadSpa MH-, igy a ketto sosem keveredik)
  function rendelesAzonosito(piId) { return 'LZ-' + String(piId || '').replace(/^pi_/, '').slice(-8).toUpperCase(); }

  var LEZER = {
    // a HeadSpa-adat segedei es valtozatlan reszei
    FIZETESI_MODOK: H.FIZETESI_MODOK,
    ALKALMAK: H.ALKALMAK,
    ATADASOK: H.ATADASOK,
    PROOFOK: H.PROOFOK,
    GOOGLE: H.GOOGLE,
    ASSET_JO: H.ASSET_JO,
    BANK: H.BANK,
    SALONIC_BAZIS: H.SALONIC_BAZIS,
    ERVENYESSEG_HONAP: H.ERVENYESSEG_HONAP,
    PENZNEM: H.PENZNEM,
    arSzoveg: H.arSzoveg,
    ervenyesIg: H.ervenyesIg,
    // a lezeres kereskedo sajat adatai
    SZAMLA_TETELEK: SZAMLA_TETELEK,
    szamlaTetelek: szamlaTetelek,
    TERMEKEK: TERMEKEK,
    OLDAL_ALAPERTEK: OLDAL_ALAPERTEK,
    oldalAlapertek: oldalAlapertek,
    FINDER: [],
    HEADSPA_VIDEO: null,
    ELEMEK: [],
    GALERIA: GALERIA,
    BENEFITOK: [],
    ATVETELEK: ATVETELEK,
    VARIANTOK: VARIANTOK,
    SZALON: SZALON,
    variantFeloldas: variantFeloldas,
    rendelesAzonosito: rendelesAzonosito,
    // kereskedo-beallitasok (a motor es a kliens ezeket olvassa)
    SZAMLAZAS: { szolgaltato: 'szamlazz-agent', fizmod: 'Stripe' },   // vasarlaskor, a Szamlazz.hu Szamla Agenttel (nincs Stripe-szamla, nincs szamlabridge)
    CEGES_SZAMLA: false,        // az ujKATA-s fiokbol az Agent vallalkozasnak nem szamlaz
    ATUTALAS: false,            // elso korben nincs banki atutalas
    SZEMELYES_ATVETEL: false,   // nincs papir lezeres kartya: csak az e-mailben kuldott, kinyomtathato
    MERES: false,               // egyelore nincs dataLayer-esemeny (a GA4 / Ads beallitas a meres-felelos dolga; igy a HeadSpa-konverziokba sem kerulhet bele)
    MERES_REGI: false,          // a lezeres kartya nem szamit a HeadSpa-konverziokba (regi koszonooldal-keret)
    API_ELOTAG: '/api/ajandek-lezer/',
    TAROLO_ELOTAG: 'ah_lz',
    LEIRAS_ELOTAG: 'MOSAIC lézeres szőrtelenítés ajándékkártya',
    EMAIL_TARGY: 'Ajándék a MOSAIC lézeres szőrtelenítésre',
    VIDEO_FELIRAT: ''
  };

  g.AJANDEK_ADAT_LEZER = LEZER;
  // a bongeszoben a kliens (ajandek.js) a window.AJANDEK_ADAT-ot olvassa: ezen az oldalon ez a lezeres adat
  if (typeof window !== 'undefined' && g === window) g.AJANDEK_ADAT = LEZER;
})(typeof self !== 'undefined' ? self : globalThis);
