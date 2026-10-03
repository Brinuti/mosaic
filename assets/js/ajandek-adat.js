// MOSAIC Gift Commerce Engine - kozos adat (a bongeszo es a szerver is ezt olvassa).
//
// EGY forras: a termekek, arak, variantok es feliratok itt vannak, es sehol maskor.
//   - a bongeszoben klasszikus szkript:   window.AJANDEK_ADAT
//   - a szerveren (netlify/lib/ajandek.js) mellekhatas-importtal:  globalThis.AJANDEK_ADAT
// (Szandekosan nem ES-modul: az assets/js/* fajlokra a build tartalom-hash verziojelet tesz
// a HTML-ben, a modulokon beluli importokra viszont nem - egy javitas igy nem jutna el a
// latogatohoz, mert az assets/js/* egy evig gyorsitotarazhato.)
//
// ARAK: a MOSAIC mostani, ELES Stripe-fizetolinkjeinek aral (2026-10-03-an lekerdezve):
//   Egyeni 26.900 Ft, 4 kezes 39.900 Ft, Paros 53.800 Ft (az oktoberi 20% kedvezmennyel;
//   listaar 32.900 / 49.900 / 65.900 Ft). Kedvezmeny-valtozaskor CSAK ITT kell atirni -
//   a szerver ebbol szamolja a PaymentIntent osszeget, a bongeszo ebbol irja ki az arat.
(function (g) {
  'use strict';

  var TERMEKEK = {
    egyeni: {
      id: 'egyeni',
      product_type: 'egyeni',
      item_id: 'mosaic-ajandekkartya-egyeni',
      nev: 'Egyéni Head Spa',
      kartya_cim: 'Egyéni MOSAIC Head Spa ajándékkártya',
      // a nyomtathato kartyan a savba kerulo felirat (2 sor, nagybetusen jelenik meg)
      kartya_felirat: ['50+30 perces egyéni MOSAIC', 'HEAD SPA KEZELÉS'],
      fejlec: 'Teljes figyelem, csak neki.',
      osszefoglalo: '50 perc kezelés + 30 perc szárítás',
      leiras: 'Teljes figyelem, mély kikapcsolódás, rendezett haj: a legegyszerűbb választás, ha egy embernek keresel igazán pihentető ajándékot.',
      tartalom: ['50 perc Head Spa', '30 perc szárítás', '1 fő', '6 hónapig felhasználható'],
      badge: 'NEKI EGYEDÜL',
      ar_ft: 26900,
      vendeg_db: 1,
      // a Salonic utalvany-terméke (Marketing > Ajandekutalvanyok), a szalon "utalvany ertekesitesehez" (utalasos rendelesnel)
      salonic: { id: 4040, nev: '50 perces MOSAIC Head Spa kezelés + 30 perc hajszárítás-20% (26 900 Ft)' },
      kezeles: {
        leiras: ['Személyre szabott hajápolási szeánsz mélyrelaxáló masszázs elemekkel: 50 perc Head Spa, utána 30 perc profi hajszárítás.'],
        lepesek: [
          'Mikrokamerás fejbőrvizsgálattal indul, hogy a fejbőrtípusodhoz illő kezelést kapd',
          'Mélytisztító hajmosás az eredeti Head Spa arany zuhanyívvel',
          'A fej- és arcbőrtípusodnak megfelelő, 100%-ban természetes OXYGENI haj- és arcpakolás',
          'Fej-, arc-, nyak- és dekoltázsmasszázs, gőzölés',
          'A végén 30 perc profi hajszárítás'
        ],
        video: null
      },
      // valodi MOSAIC fotok (assets/img): egy terapeuta / ket terapeuta / ket vendeg
      vizual: { src: '/assets/img/ajandek/egyeni.jpg', alt: 'Egyéni Head Spa: a vendég hajmosása az arany zuhanyív alatt a MOSAIC-ban', w: 1100, h: 1650, poz: '50% 42%' }
    },
    '4kezes': {
      id: '4kezes',
      product_type: '4kezes',
      item_id: 'mosaic-ajandekkartya-4kezes',
      nev: '4 kezes Head Spa',
      kartya_cim: '4 kezes MOSAIC Head Spa ajándékkártya',
      kartya_felirat: ['50+30 perces 4 kezes MOSAIC', 'HEAD SPA KEZELÉS'],
      fejlec: 'Ha igazán különlegeset adnál.',
      osszefoglalo: '50 perc 4 kezes kezelés + 30 perc szárítás',
      leiras: 'Két terapeuta dolgozik egyszerre: intenzívebb, különlegesebb Head Spa élmény.',
      tartalom: ['50 perc 4 kezes Head Spa', '30 perc szárítás', '1 fő', '2 terapeuta', '6 hónapig felhasználható'],
      badge: 'VALAMI IGAZÁN KÜLÖNLEGES',
      ar_ft: 39900,
      vendeg_db: 1,
      salonic: { id: 4000, nev: '50 perces 4 Kezes Headspa ajándékkártya - 39.900 Ft' },
      kezeles: {
        leiras: ['A MOSAIC saját találmánya: két gyógymasszőr dolgozik egyszerre, a végén egy profi fodrász szárít, vagyis hárman kényeztetnek 50+30 percen át.'],
        lepesek: [
          'Fej-, arc-, nyak-, dekoltázs-, kar-, kéz-, láb- és vállmasszázs',
          'Mélytisztító hajmosás és körvízsugaras terápia az arany zuhanyívvel',
          'A fej- és arcbőrtípusodnak megfelelő, természetes OXYGENI pakolás, gőzölés',
          'A végén 30 perc profi hajszárítás'
        ],
        video: null
      },
      vizual: { src: '/assets/img/ajandek/negy-kezes.jpg', alt: '4 kezes Head Spa: két terapeuta dolgozik egyszerre egy vendégen a MOSAIC-ban', w: 1200, h: 800, poz: '50% 45%' }
    },
    paros: {
      id: 'paros',
      product_type: 'paros',
      item_id: 'mosaic-ajandekkartya-paros',
      nev: 'Páros Head Spa',
      kartya_cim: 'Páros MOSAIC Head Spa ajándékkártya',
      kartya_felirat: ['50+30 perces páros MOSAIC', 'HEAD SPA KEZELÉS (2 FŐ)'],
      fejlec: 'Közös élmény két főre.',
      osszefoglalo: '50 perc kezelés + 30 perc szárítás / fő',
      leiras: 'Közös élmény, közös kikapcsolódás: barátnővel, anyukáddal vagy a pároddal.',
      tartalom: ['2 vendég', '2 terapeuta', 'egy közös időpont', '6 hónapig felhasználható'],
      badge: 'KETTEN, EGYÜTT',
      ar_ft: 53800,
      vendeg_db: 2,
      salonic: { id: 4081, nev: '50 perces PÁROS MOSAIC Head Spa Ajándékutalvány -20% (53 800 Ft)' },
      kezeles: {
        leiras: ['Ketten fekszetek egymás mellé egy privát, csendes kezelőszobában, két gyógymasszőr kényeztet titeket egyszerre: közös élmény barátnővel, anyukával vagy a párral.'],
        lepesek: [
          'Mikrokamerás fejbőrvizsgálat, a bőrtípusotokhoz illő természetes haj- és arcpakolás',
          'Mélytisztító hajmosás az eredeti Head Spa arany zuhanyívvel',
          'Arc-, nyak-, fej- és dekoltázsmasszázs kézzel és eszközökkel, gőzölés',
          '50 perc kezelés + 30 perc hajszárítás fejenként, egymás mellett'
        ],
        video: null
      },
      // a spec szerint a GENERAL vizual ket baratno (nem romantikus par); ez a MOSAIC egyetlen valodi paros fotoja
      // (ket vendeg, ket terapeuta, egymas mellett) - ha van baratnos kep, ide kell cserelni
      vizual: { src: '/assets/img/c2eb0f_2c17645e97d943fda9265b973f1bb6a9.jpg', alt: 'Páros Head Spa: két vendég, két terapeuta, egy közös helyiségben', w: 1500, h: 1500, poz: '50% 50%' }
    }
  };

  var FINDER = [
    { id: 'egyedul', ikon: 'user', cim: 'Neki egyedül', leiras: 'Ha azt szeretnéd, hogy végre csak vele foglalkozzanak.', termek: 'egyeni', nyil: 'Egyéni Head Spa ajánlása' },
    { id: 'ketten', ikon: 'users', cim: 'Ketten mennének', leiras: 'Barátnővel, anyukával vagy a párjával.', termek: 'paros', nyil: 'Páros Head Spa ajánlása' },
    { id: 'kulonleges', ikon: 'gift', cim: 'Valami igazán különlegeset szeretnék', leiras: 'Prémium Head Spa két terapeutával egyszerre.', termek: '4kezes', nyil: '4 kezes Head Spa ajánlása' }
  ];

  // Hogyan veszi at az ajandekkartyat (a fizetes elott valasztja): az otthon kinyomtatott kartya szabhato szemelyre
  var ATVETELEK = [
    { id: 'otthon', cim: 'E-mailben, otthon kinyomtatom', rovid: 'Nyomtatható formában kapod meg, és személyre is szabhatod.', szemelyre: true },
    { id: 'szemelyesen', cim: 'Személyesen, a szalonban', rovid: 'Papír alapon, díszborítékban veheted át.', szemelyre: false }
  ];

  var ALKALMAK = [
    { id: 'szuletesnap', cim: 'Születésnap' },
    { id: 'karacsony', cim: 'Karácsony' },
    { id: 'anyak_napja', cim: 'Anyák napja' },
    { id: 'nevnap', cim: 'Névnap' },
    { id: 'evfordulo', cim: 'Évforduló' },
    { id: 'csak_ugy', cim: 'Csak úgy' },
    { id: 'egyeb', cim: 'Egyéb' }
  ];

  var ATADASOK = [
    { id: 'digitalis', cim: 'Digitálisan' },
    { id: 'nyomtatott', cim: 'Kinyomtatom' },
    { id: 'fizikai', cim: 'Fizikai kártyát kérek / MOSAIC-ban átveszem' }
  ];

  // Valodi vendegvelemeny CSAK akkor mehet ide, ha letezik es a vendeg/Google-megjelenites
  // engedi. Soha ne generalj idezetet. A Google-osszegzes (GOOGLE) a tulajdonos 2026-10-03-i adata:
  // ha az ertekeles szama jelentosen valtozik, itt kell frissiteni.
  var GOOGLE = { pont: '4,9', darab: '1.259' };
  var GOOGLE_SZOVEG = GOOGLE.pont + ' · ' + GOOGLE.darab + ' Google-vélemény';
  var PROOFOK = {
    general: {
      // szo szerint a Google-velemeny (a tulajdonos adta meg 2026-10-03-an), nem rovidítve, nem javítva
      idezet: 'Nagyon elégedett vagyok! Brutálisan színvonalas hely, kellemes, nagyon szeretetteljes környezet! A vendégszeretet és a szolgáltatás zseniális. Biztosan visszamegyek! Ajánlom mindenkinek! Sajnos csak ezt az egy képet készítettem, mert annyira el voltam ámulva. De a szolgáltatás 5*-os! Minden 5*-os!',
      forras: GOOGLE_SZOVEG,
      valodi: true
    }
  };

  // A variant NEM kulon oldal: csak a hero szoveg/vizual, a termeksorrend, az elso proof, az
  // ellenvetes-blokk es a CTA felirat cserelodhet. Minden mas (checkout, termekadat, fizetes,
  // teljesites, meres) kozos. P0: csak a GENERAL el; a P1 variantok (for_her, together_friend,
  // together_mother, together_partner, last_minute) ugyanebbe az objektumba kerulnek.
  var VARIANTOK = {
    general: {
      variant_id: 'general',
      hero_eyebrow: 'MOSAIC HEAD SPA AJÁNDÉKKÁRTYA',
      hero_title: 'Adj neki 80 percet, amikor végre csak vele foglalkoznak.',
      hero_subtitle: 'Japán Head Spa élmény Budán: mély kikapcsolódás, digitális vagy nyomtatott ajándékkártyával.',
      hero_cta: 'Ajándékkártya választása',
      hero_media: {
        src: '/assets/img/ajandek/hero.jpg',
        alt: 'Vendég Head Spa kezelésen a MOSAIC-ban, az arany zuhanyív alatt'
      },
      hero_trust: [
        { csillag: true, szoveg: GOOGLE.pont + ' · ' + GOOGLE.darab, alszoveg: 'Google-vélemény' },
        { ikon: 'calendar', szoveg: '6 hónapig', alszoveg: 'érvényes' },
        { ikon: 'monitor', szoveg: 'Online', alszoveg: 'megvásárolható' },
        { ikon: 'card', szoveg: 'Gyönyörű, személyre', alszoveg: 'szabható kártya' }
      ],
      product_order: ['egyeni', 'paros', '4kezes'],
      featured_proof: 'general',
      objection_title: null,
      objection_body: null,
      relationship: null,
      gift_context: 'general',
      occasion: null
    }
  };

  var SZALON = {
    nev: 'MOSAIC Head Spa',
    cegnev: 'Big In Japan Kft.',
    cim: '1023 Budapest, Bécsi út 2.',
    telefon: '06 20 247 4444',
    email: 'mosaicheadspa@gmail.com'
  };

  // A mostani elounalasos (atutalas) adatai - lasd netlify/lib/levelek.js, success-ajandekkartya.html
  var BANK = {
    kedvezmenyezett: 'Big In Japan Kft.',
    szamlaszam: '10700378-76447714-51100005'
  };

  var SALONIC_BAZIS = 'https://app.salonic.hu';
  var ERVENYESSEG_HONAP = 6;
  var PENZNEM = 'HUF';

  // Ismeretlen / hianyzo / ervenytelen variant -> GENERAL. (hasOwnProperty: a 'constructor',
  // '__proto__' stb. ne talaljon el semmit.)
  function variantFeloldas(nyers) {
    var kulcs = String(nyers == null ? '' : nyers).trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(VARIANTOK, kulcs) ? VARIANTOK[kulcs] : VARIANTOK.general;
  }

  // 26900 -> "26.900 Ft" (mint a MOSAIC oldalain mindenhol)
  function arSzoveg(ft) {
    return String(Math.round(Number(ft) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Ft';
  }

  // A rendeles lathato azonositoja a Stripe PaymentIntent azonositojabol: pi_3UMSqd... -> MH-D0A0ESD51
  function rendelesAzonosito(piId) {
    return 'MH-' + String(piId || '').replace(/^pi_/, '').slice(-8).toUpperCase();
  }

  // YYYY-MM-DD, a vasarlas napjatol szamitott ERVENYESSEG_HONAP honappal (a honap vegere igazitva)
  function ervenyesIg(vasarlasEkkor) {
    var d = new Date(vasarlasEkkor);
    var nap = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + ERVENYESSEG_HONAP);
    var utolso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(nap, utolso));
    return d.toISOString().slice(0, 10);
  }

  g.AJANDEK_ADAT = {
    TERMEKEK: TERMEKEK,
    FINDER: FINDER,
    ALKALMAK: ALKALMAK,
    ATVETELEK: ATVETELEK,
    ATADASOK: ATADASOK,
    PROOFOK: PROOFOK,
    GOOGLE: GOOGLE,
    VARIANTOK: VARIANTOK,
    SZALON: SZALON,
    BANK: BANK,
    SALONIC_BAZIS: SALONIC_BAZIS,
    ERVENYESSEG_HONAP: ERVENYESSEG_HONAP,
    PENZNEM: PENZNEM,
    variantFeloldas: variantFeloldas,
    arSzoveg: arSzoveg,
    rendelesAzonosito: rendelesAzonosito,
    ervenyesIg: ervenyesIg
  };
})(typeof self !== 'undefined' ? self : globalThis);
