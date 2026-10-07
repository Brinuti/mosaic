// MOSAIC Gift Commerce Engine - az OXIGENTERAPIA ajandekkartya adatai (kulon kereskedo: sajat Stripe-fiok, sajat Szamlazz.hu-fiok: Bozsoki - Harangozo Tunde e.v.).
//
// Ez a fajl a HeadSpa kozos adatara (ajandek-adat.js) epul, ugyanugy, mint a lezeres kereskedo (ajandek-adat-lezer.js): ugyanazokat a segedeket (arSzoveg,
// ervenyesIg, ...), fizetesi modokat, alkalmakat es a Google-osszegzest hasznalja, a termekeket, a szoveget, a szalon-adatokat es a kereskedo-beallitasokat sajatra cseréli.
//   - a bongeszoben klasszikus szkript (a HeadSpa adat UTAN toltodik): beallitja a window.AJANDEK_ADAT-ot erre az adatra
//   - a szerveren (functions/api/ajandek-oxigen/[[kind]].js) mellekhatas-importtal: globalThis.AJANDEK_ADAT_OXIGEN
//
// KARTYAK (tulajdonosi dontes, 2026-10-07): hajkamera-vizsgalat, az elso kezeles, 5 es 10 tovabbi kezeles. A Salonicban nincs ertek-utalvany, csak kedvezmeny-kupon
// (a kuponnak van "darabszama" = hanyszor hasznalhato), ezert minden kartya egy 100%-os kupont jelent az adott szolgaltatasra: az 1 kezelesesek egyszer, az 5 es 10
// kezelesesek 5, illetve 10 felhasznalassal. A kartyak listaja es arai CSAK ITT vannak (a szerver ebbol szamolja a PaymentIntent osszeget es a Szamlazz.hu-tetelt,
// a bongeszo ebbol irja ki az arat); az arak a Salonic (mosaic-oxigen) listaarai: a teszt ellenorzi, hogy egyeznek.
//
// SZAMLA: a Szamlazz.hu Szamla Agenttel, a vasarlaskor (mint a lezeres kartyanal). A kibocsato "uj KATA", alanyi adomentes (AAM): az Agent az ujKATA-s fiokbol
// vallalkozasnak nem szamlazhat, ezert ceges szamla NINCS; a tetelen az AAM-jelzes szerepel.
(function (g) {
  'use strict';
  var H = g.AJANDEK_ADAT;
  if (!H) throw new Error('ajandek-adat-oxigen: elobb az ajandek-adat.js kell');

  var KEP_FELMERES = { src: '/assets/img/oxigen/oxigen-kezeles.jpg', alt: 'Hajkamerás állapotfelmérés a MOSAIC oxigénterápián', w: 760, h: 760, poz: '50% 50%' };
  var KEP_KEZELES = { src: '/assets/img/oxigen/elso-alkalom.jpg', alt: 'Oxigénterápiás hajkezelés a MOSAIC-ban', w: 840, h: 970, poz: '50% 40%' };

  // A KARTYAK (Salonic: mosaic-oxigen, hely 14409). A szolgaltatas-azonositok es az arak forrasa:
  // docs/booking-engine/SALONIC_SERVICE_STAFF_MAPPING_CURRENT.json (2026-10-07). "alkalom" = a kupon felhasznalasainak szama; "egysegar" = a Salonic listaara alkalmankent.
  var CSOMAGOK = [
    { id: 'kamera', nev: 'Hajkamerás vizsgálat', felirat: 'HAJKAMERÁS VIZSGÁLAT', alkalom: 1, egysegar: 4990, perc: 30, vizual: KEP_FELMERES,
      mit: 'Hajkamerás állapotfelmérés + konzultáció', rovid: 'Hajkamerás állapotfelmérés + konzultáció',
      leiras: 'Megnézzük a fejbőr és a haj állapotát, és átbeszéljük, milyen eredményt várhatsz.',
      sal: { id: 466147, nev: 'AKCIÓS Hajkamerás vizsgálat és konzultáció', spec: 64122, felh: 'egyszer felhasználható kupon' } },
    { id: 'elso', nev: 'Első kezelés', felirat: 'ELSŐ KEZELÉS', alkalom: 1, egysegar: 29900, perc: 80, vizual: KEP_KEZELES,
      mit: 'Az első oxigénterápiás kezelés', rovid: 'Az első oxigénterápiás kezelés, kb. 80 perc',
      leiras: 'Az első oxigénterápiás hajkezelés a MOSAIC-ban, kb. 80 perc.',
      sal: { id: 466110, nev: 'Haj Oxigénterápia - 1. alkalom', spec: 64122, felh: 'egyszer felhasználható kupon' } },
    { id: 'ot', nev: '5 kezelés', felirat: '5 KEZELÉS', alkalom: 5, egysegar: 26000, perc: 80, vizual: KEP_KEZELES,
      mit: '5 oxigénterápiás kezelés (a 2. alkalomtól)', rovid: '5 további kezelés, alkalmanként kb. 80 perc',
      leiras: 'Öt további oxigénterápiás kezelés (az első kezelést követő alkalmak), alkalmanként kb. 80 perc.',
      sal: { id: 466158, nev: 'Haj Oxigénterápia - 2. alkalomtól', spec: 64128, felh: '5-ször felhasználható kupon (a kupon „darabszáma” 5)' } },
    { id: 'tiz', nev: '10 kezelés', felirat: '10 KEZELÉS', alkalom: 10, egysegar: 26000, perc: 80, vizual: KEP_KEZELES,
      mit: '10 oxigénterápiás kezelés (a 2. alkalomtól)', rovid: '10 további kezelés, alkalmanként kb. 80 perc',
      leiras: 'Tíz további oxigénterápiás kezelés (az első kezelést követő alkalmak), alkalmanként kb. 80 perc.',
      sal: { id: 466158, nev: 'Haj Oxigénterápia - 2. alkalomtól', spec: 64128, felh: '10-szer felhasználható kupon (a kupon „darabszáma” 10)' } }
  ];

  function ft(n) { return H.arSzoveg(n); }
  var TERMEKEK = {};
  var SZAMLA_TETELEK = {};
  CSOMAGOK.forEach(function (c) {
    var id = c.id, ar = c.alkalom * c.egysegar, tobb = c.alkalom > 1;
    TERMEKEK[id] = {
      id: id,
      product_type: 'oxigen-' + id,
      item_id: 'mosaic-oxigen-ajandekkartya-' + id,
      nev: c.nev,
      kartya_cim: 'Oxigénterápia ajándékkártya – ' + c.nev,
      // a nyomtathato kartyan a savba kerulo felirat (2 sor, nagybetusen jelenik meg); az ertek a felirat alatt kulon latszik
      kartya_felirat: ['OXIGÉNTERÁPIA', c.felirat],
      osszefoglalo: c.rovid,
      osszefoglalo_rovid: tobb ? 'A 2. alkalomtól szóló kezelések' : c.rovid,
      osszefoglalo_ikon: 'sparkle',
      leiras: c.nev + ': ' + c.leiras,
      tartalom: [c.mit, tobb ? 'Alkalmanként kb. ' + c.perc + ' perc' : 'Kb. ' + c.perc + ' perc', '6 hónapig felhasználható'],
      kartya_sor: 'Oxigénterápia – ' + c.nev,
      ar_ft: ar,
      vendeg_db: 0,
      // a szalon-levelben: melyik Salonic-szolgaltatasra, hany felhasznalasra kell a 100%-os kupont letrehozni
      salonic_szolgaltatas: { id: c.sal.id, nev: c.sal.nev, spec: c.sal.spec, felhasznalas: c.sal.felh },
      alkalom: c.alkalom,
      pontosan: { ido: tobb ? c.alkalom + ' × kb. ' + c.perc + ' perc' : 'kb. ' + c.perc + ' perc', fo: '1 vendég', kezelo: 'a MOSAIC oxigénterápiás szakemberei' },
      kezeles: {
        leiras: [
          c.leiras,
          tobb ? 'Az ajándékozott az online időpontfoglalásnál, a kártyán lévő kuponkóddal váltja be, alkalmanként egyszer (összesen ' + c.alkalom + ' alkalomra jó). Az első kezelés külön foglalható.'
               : 'Az ajándékozott az online időpontfoglalásnál, a kártyán lévő kuponkóddal váltja be.'
        ],
        menet: null
        // videot egyelore nem mutatunk (nincs jovahagyott oxigenes kezeles-videó): a doboz a kezeles fotojat mutatja, felirat nelkul
      },
      vizual: c.vizual
    };
    // a szamla sora: a vasarlas osszege, alanyi adomentes (AAM); a tetelnev a vevo szamlajan is latszik
    SZAMLA_TETELEK[id] = [{ nev: 'MOSAIC oxigénterápia ajándékkártya – ' + c.nev + ' – ' + ft(ar) + ' értékben', ft: ar, afa: 'AAM' }];
  });
  function szamlaTetelek(id) { return Object.prototype.hasOwnProperty.call(SZAMLA_TETELEK, id) ? SZAMLA_TETELEK[id] : null; }

  var RENDEZES = Object.keys(TERMEKEK);
  var VARIANTOK = {
    general: {
      variant_id: 'general',
      hero_eyebrow: 'MOSAIC OXIGÉNTERÁPIA',
      hero_title: 'Ajándékozz oxigénterápiát.',
      hero_subtitle: 'Hajkamerás vizsgálat, az első kezelés vagy több kezelésre szóló ajándék: digitális vagy kinyomtatott ajándékkártyán, személyre szabva.',
      hero_cta: 'Kiválasztom a kártyát',
      hero_media: { src: '/assets/img/ajandek/hero-oxigen-ajandek.jpg', alt: 'Hajkamerás állapotfelmérés a MOSAIC oxigénterápián, előtérben a személyre szabott ajándékkártya', forras: 'assets/img/oxigen/oxigen-kezeles.jpg + a sajat kartya-renderelo', status: 'APPROVED_BY_FOLDER_CONTEXT' },
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
    ['oxigen/kezeloszoba', 760, 507, 'A MOSAIC oxigénterápiás kezelőszobája'],
    ['oxigen/elso-alkalom', 840, 970, 'Oxigénterápiás hajkezelés a MOSAIC-ban'],
    ['oxigen/oxigen-kezeles', 760, 760, 'Hajkamerás állapotfelmérés a MOSAIC oxigénterápián'],
    ['oxigen/recepcio', 760, 507, 'A MOSAIC recepciója a Bécsi úton']
  ].map(function (e) { return { src: '/assets/img/' + e[0] + '.jpg', w: e[1], h: e[2], alt: e[3] }; });

  var ATVETELEK = [
    { id: 'otthon', cim: 'E-mailben, otthon kinyomtatom', rovid: 'Nyomtatható formában kapod meg, és személyre is szabhatod.', szemelyre: true }
  ];

  var SZALON = {
    nev: 'MOSAIC Oxigénterápia',
    cegnev: 'Bozsoki - Harangozó Tünde e.v.',
    cim: '1023 Budapest, Bécsi út 2.',
    telefon: '06 20 247 4444',
    email: 'mosaicheadspa@gmail.com',
    foglalas_url: 'https://www.mosaicheadspa.hu/oxigenterapia-budapest',
    foglalas_szoveg: 'mosaicheadspa.hu/oxigenterapia-budapest',
    // a nyomtathato A4 kartya hattere: a HeadSpa-terv, a bal alsó foto az oxigenes kepre cserelve (az arany iv, a szovegek, a logo valtozatlanok)
    kartya_hatter: '/assets/img/ajandek/kartya-hatter-oxigen.jpg',
    // a szalonnak szolo level "kupont fel kell vinni" blokkja: a kartya kezeles-kupon (a szolgaltatas neve mellett a felhasznalasok szama is szerepel)
    kupon_cim: 'TEENDŐ: 100%-OS KUPON A SALONICBAN (OXIGÉN)',
    kupon_szoveg: 'ezért a Salonicban <b>nem utalvány-értékesítést</b>, hanem sima <b>100%-os kupont</b> hozz létre a(z) <b>{szolgaltatas}</b> szolgáltatásra (Oxigén fiók), érvényes {ervenyes} (6 hónap). A kuponkód pontosan egyezzen az alábbival (kötőjel nélkül).'
  };

  // oldal-cim -> alapertelmezett termek (a kartyak oldal-cime a /oxigen-ajandekkartya; a variant mindig a GENERAL)
  var OLDAL_ALAPERTEK = { '/oxigen-ajandekkartya': { variant: 'general', termek: 'elso' } };
  function oldalAlapertek(ut) {
    var kulcs = String(ut == null ? '' : ut).replace(/\/+$/, '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(OLDAL_ALAPERTEK, kulcs) ? OLDAL_ALAPERTEK[kulcs] : {};
  }
  function variantFeloldas() { return VARIANTOK.general; }

  // a rendeles lathato azonositoja: OX-<8 karakter> (a HeadSpa MH-, a lezeres LZ-, igy a harom sosem keveredik)
  function rendelesAzonosito(piId) { return 'OX-' + String(piId || '').replace(/^pi_/, '').slice(-8).toUpperCase(); }

  var OXIGEN = {
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
    // az oxigenes kereskedo sajat adatai
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
    SZEMELYES_ATVETEL: false,   // nincs papir kartya: csak az e-mailben kuldott, kinyomtathato
    MERES: false,               // egyelore nincs dataLayer-esemeny (a GA4 / Ads beallitas a meres-felelos dolga; igy a HeadSpa-konverziokba sem kerulhet bele)
    MERES_REGI: false,          // az oxigenes kartya nem szamit a HeadSpa-konverziokba (regi koszonooldal-keret)
    API_ELOTAG: '/api/ajandek-oxigen/',
    TAROLO_ELOTAG: 'ah_ox',
    LEIRAS_ELOTAG: 'MOSAIC oxigénterápia ajándékkártya',
    EMAIL_TARGY: 'Ajándék a MOSAIC oxigénterápiára',
    VIDEO_FELIRAT: ''
  };

  g.AJANDEK_ADAT_OXIGEN = OXIGEN;
  // a bongeszoben a kliens (ajandek.js) a window.AJANDEK_ADAT-ot olvassa: ezen az oldalon ez az oxigenes adat
  if (typeof window !== 'undefined' && g === window) g.AJANDEK_ADAT = OXIGEN;
})(typeof self !== 'undefined' ? self : globalThis);
