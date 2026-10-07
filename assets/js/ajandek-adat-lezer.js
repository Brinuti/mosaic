// MOSAIC Gift Commerce Engine - a LEZERES SZORTELENITES ajandekkartya adatai (kulon kereskedo: sajat Stripe-fiok, sajat Szamlazz.hu-fiok).
//
// Ez a fajl a HeadSpa kozos adatara (ajandek-adat.js) epul: ugyanazokat a segedeket (arSzoveg, ervenyesIg, ...), fizetesi modokat,
// alkalmakat es a Google-osszegzest hasznalja, a termekeket, a szoveget, a szalon-adatokat es a kereskedo-beallitasokat sajatra cseréli.
//   - a bongeszoben klasszikus szkript (a HeadSpa adat UTAN toltodik): beallitja a window.AJANDEK_ADAT-ot erre az adatra
//   - a szerveren (functions/api/ajandek-lezer/[[kind]].js) mellekhatas-importtal: globalThis.AJANDEK_ADAT_LEZER
//
// KARTYAK: egy-egy konkret kezeles (terulet / csomag) ELSO alkalma allapotfelmerssel, a Salonic "1. alkalom" szolgaltatasainak arain (2026-10-07): a Salonicban nincs
// ertek-utalvany, csak kedvezmeny-kupon, ezert minden kartya egy 100%-os, egyszer felhasznalhato kupont jelent az adott szolgaltatasra. A kartyak listaja es arai
// CSAK ITT vannak (a szerver ebbol szamolja a PaymentIntent osszeget es a Szamlazz.hu-tetelt, a bongeszo ebbol irja ki az arat).
//
// SZAMLA: a Szamlazz.hu Szamla Agenttel, a vasarlaskor (a HeadSpa-hoz hasonloan). A kibocsato "uj KATA", alanyi adomentes (AAM):
// az Agent az ujKATA-s fiokbol vallalkozasnak nem szamlazhat, ezert ceges szamla NINCS; a tetelen az AAM-jelzes szerepel.
(function (g) {
  'use strict';
  var H = g.AJANDEK_ADAT;
  if (!H) throw new Error('ajandek-adat-lezer: elobb az ajandek-adat.js kell');

  var KEP = { src: '/assets/img/c2eb0f_f5b87c4c4fd64d6d89f970a318a56da0.jpg', alt: 'Lézeres szőrtelenítés kezelés a MOSAIC-ban', w: 700, h: 927, poz: '50% 40%' };

  // A KARTYAK: egy-egy konkret kezeles ELSO alkalma allapotfelmerssel (a Salonic "1. alkalom" szolgaltatasai, specId 66404; az ar a Salonicban mar tartalmazza az
  // elso kezeles 20%-os kedvezmenyet). A Salonicban csak kedvezmeny-kupon van (nincs ertek-utalvany), ezert a szalon minden eladashoz egy 100%-os, egyszer
  // felhasznalhato kupont hoz letre az adott szolgaltatasra (mint a HeadSpa-nal). A szolgaltatas-azonositok es az arak forrasa:
  // docs/booking-engine/SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json (2026-10-07); a teszt ellenorzi, hogy az ar egyezik a Salonic-listaaraval.
  // Tulajdonosi dontes (2026-10-07): ez a 6 kartya, ebben a sorrendben (a nev nem ismetli az arat: az az ar-soron latszik).
  var CSOMAGOK = [
    { id: 'honalj', nev: 'Hónalj', felirat: 'TELJES HÓNALJ', ar: 15200, perc: 60, mit: 'Teljes hónalj', rovid: 'Teljes hónalj',
      sal: { id: 476488, nev: 'TEST - Teljes hónalj + állapotfelmérés -20% kedvezménnyel' } },
    { id: 'basic', nev: 'Basic csomag', felirat: 'BASIC CSOMAG', ar: 36400, perc: 60, mit: 'Teljes hónalj + teljes intim (elöl) + fenékcsík', rovid: 'Hónalj, intim, fenékcsík',
      sal: { id: 476479, nev: 'AKCIÓ - BASIC CSOMAG - Állapofelmérés -20% kedvezménnyel' } },
    { id: 'lab', nev: 'Teljes láb', felirat: 'TELJES LÁB', ar: 47200, perc: 60, mit: 'Mindkét teljes láb (comb + lábszár)', rovid: 'Mindkét teljes láb',
      sal: { id: 476496, nev: 'LÁBAK - 2 Teljes láb + állapofelmérés -20% kedvezménnyel' } },
    { id: 'summer', nev: 'Summer csomag', felirat: 'SUMMER CSOMAG', ar: 66800, perc: 120, mit: 'Teljes láb + hónalj + teljes intim + fenékcsík', rovid: 'Láb, hónalj, intim, fenékcsík',
      sal: { id: 476482, nev: 'AKCIÓ - SUMMER CSOMAG + állapofelmérés -20% kedvezménnyel' } },
    { id: 'total', nev: 'Total csomag', felirat: 'TOTAL CSOMAG', ar: 86000, perc: 90, mit: 'Teljes láb + teljes kar + hónalj + intim', rovid: 'Láb, kar, hónalj, intim',
      sal: { id: 476483, nev: 'AKCIÓ - TOTAL CSOMAG + állapofelmérés -20% kedvezménnyel' } },
    { id: 'mantotal', nev: 'Man Total csomag', felirat: 'MAN TOTAL CSOMAG', ar: 54400, perc: 120, mit: 'Teljes hát + váll + mellkas + has + hónalj', rovid: 'Hát, váll, mellkas, has, hónalj',
      sal: { id: 476484, nev: 'AKCIÓ - MAN TOTAL CSOMAG + állapofelmérés -20% kedvezménnyel' } }
  ];

  function ft(n) { return H.arSzoveg(n); }
  var TERMEKEK = {};
  var SZAMLA_TETELEK = {};
  CSOMAGOK.forEach(function (c) {
    var id = c.id;
    TERMEKEK[id] = {
      id: id,
      product_type: 'lezer-' + id,
      item_id: 'mosaic-lezer-ajandekkartya-' + id,
      nev: c.nev,
      kartya_cim: 'Lézeres szőrtelenítés ajándékkártya – ' + c.nev,
      // a nyomtathato kartyan a savba kerulo felirat (2 sor, nagybetusen jelenik meg); az ertek a felirat alatt kulon latszik
      kartya_felirat: ['LÉZERES SZŐRTELENÍTÉS', c.felirat],
      osszefoglalo: c.rovid,   // a lista egy sorba fer (a 6 kartya a harom lepes magassagaba kerul); a teljes szoveg a jobb oldali doboz leirasaban van
      osszefoglalo_rovid: c.rovid,
      osszefoglalo_ikon: 'sparkle',
      leiras: c.nev + ': az első lézeres kezelés állapotfelméréssel.',
      tartalom: [c.mit, 'Az első kezelés + állapotfelmérés', '6 hónapig felhasználható'],
      kartya_sor: 'Lézeres szőrtelenítés – ' + c.nev,
      ar_ft: c.ar,
      vendeg_db: 0,
      // a szalon-levelben: melyik Salonic-szolgaltatasra kell a 100%-os kupont letrehozni
      salonic_szolgaltatas: { id: c.sal.id, nev: c.sal.nev, spec: 66404 },
      pontosan: { ido: 'kb. ' + c.perc + ' perc', fo: '1 vendég', kezelo: 'Zsófi, a MOSAIC lézeres szakértője' },
      kezeles: {
        leiras: [
          c.mit + ': az első kezelés állapotfelméréssel, kb. ' + c.perc + ' perc.',
          'Az ajándékozott az online időpontfoglalásnál, a kártyán lévő kuponkóddal váltja be. A további alkalmak a megszokott áron foglalhatók.'
        ],
        menet: null,
        // a kezeles lepeseit bemutato video (a Meta-hirdetesi fiok "szőrtelenítés lépések" videoja, 9:16, 720p, 47 mp, 4,7 MB)
        video: { src: '/assets/video/lezer-lepesek.mp4', poster: '/assets/img/lezer-lepesek-poszter.jpg', ido: '0:47' }
      },
      vizual: KEP
    };
    // a szamla sora: a vasarlas osszege, alanyi adomentes (AAM); a tetelnev a vevo szamlajan is latszik (a konyvelo jovahagyta, 2026-10-07)
    SZAMLA_TETELEK[id] = [{ nev: 'MOSAIC lézeres szőrtelenítés ajándékkártya – ' + c.nev + ' – ' + ft(c.ar) + ' értékben', ft: c.ar, afa: 'AAM' }];
  });
  function szamlaTetelek(id) { return Object.prototype.hasOwnProperty.call(SZAMLA_TETELEK, id) ? SZAMLA_TETELEK[id] : null; }

  var RENDEZES = Object.keys(TERMEKEK);
  var VARIANTOK = {
    general: {
      variant_id: 'general',
      hero_eyebrow: 'MOSAIC LÉZERES SZŐRTELENÍTÉS',
      hero_title: 'Ajándékozz lézeres szőrtelenítést.',
      hero_subtitle: 'Válassz területet vagy kész csomagot: az ajándékozott az első kezelést kapja állapotfelméréssel, digitális vagy kinyomtatott ajándékkártyán.',
      hero_cta: 'Kiválasztom a kártyát',
      // a Drive "szőrtelenítés képek" mappa DSC07827 fotója (kezeles) + a sajat kartya-renderelo (smaragd, lezeres idezet) ferdén ráhelyezve; a lézeres landing hero-jától eltér
      hero_media: { src: '/assets/img/ajandek/hero-lezer-ajandek.jpg', alt: 'Lézeres szőrtelenítés kezelés a MOSAIC-ban, előtérben a személyre szabott ajándékkártya', forras: 'Drive: szőrtelenítés képek / DSC07827 + kártya', status: 'APPROVED_BY_FOLDER_CONTEXT' },
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
    kupon_cim: 'TEENDŐ: 100%-OS KUPON A SALONICBAN (ELYSION)',
    kupon_szoveg: 'ezért a Salonicban <b>nem utalvány-értékesítést</b>, hanem sima <b>100%-os kupont</b> hozz létre a(z) <b>{szolgaltatas}</b> szolgáltatásra (Elysion, 1. alkalom), egyszer felhasználható, érvényes {ervenyes} (6 hónap). A kuponkód pontosan egyezzen az alábbival (kötőjel nélkül).'
  };

  // oldal-cim -> alapertelmezett termek (a kartyak oldal-cime a /lezeres-ajandekkartya; a variant mindig a GENERAL)
  var OLDAL_ALAPERTEK = { '/lezeres-ajandekkartya': { variant: 'general', termek: 'basic' } };
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
