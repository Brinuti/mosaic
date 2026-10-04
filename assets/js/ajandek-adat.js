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
      osszefoglalo_rovid: '50 + 30 perc',
      leiras: 'Teljes figyelem, mély kikapcsolódás, rendezett haj: a legegyszerűbb választás, ha egy embernek keresel igazán pihentető ajándékot.',
      tartalom: ['50 perc Head Spa', '30 perc szárítás', '1 fő', '6 hónapig felhasználható'],
      kartya_sor: 'Teljes, egyéni kényeztetés',
      badge: 'NEKI EGYEDÜL',
      ar_ft: 26900,
      vendeg_db: 1,
      // a Salonic utalvany-terméke (Marketing > Ajandekutalvanyok), a szalon "utalvany ertekesitesehez" (utalasos rendelesnel)
      salonic: { id: 4040, nev: '50 perces MOSAIC Head Spa kezelés + 30 perc hajszárítás-20% (26 900 Ft)' },
      pontosan: { ido: '50 perc Head Spa + 30 perc hajszárítás', fo: '1 vendég', kezelo: 'Tapasztalt, profi masszőr' },
      kezeles: {
        leiras: ['Személyre szabott hajápolási szeánsz mélyrelaxáló masszázs elemekkel: 50 perc Head Spa, utána 30 perc profi hajszárítás.'],
        // a "Hogyan épül fel a kezelés?" felugró tartalma: az éles oldal árlistájának kezelés-kártyája (az egyéni = a "Relax" kezelés); a [szöveg, true] kiemelt elem
        menet: {
          nev: '50 perces MOSAIC "Relax" Head Spa kezelés',
          bevezeto: 'Masszázs fókuszú kezelés, ami tartalmaz hajápolási elemeket is.',
          elemek: [['Mélytisztító hajmosás'], ['Körvízsugaras terápia'], ['OXYGENI hajpakolás'], ['Fejmasszázs kézzel és eszközökkel'], ['Arctisztítás'], ['Arc tonizálás'], ['Arcmasszázs kézzel és választott eszközzel'], ['Nyak-, és vállmasszázs'], ['Dekoltázs masszázs'], ['Gőz terápia'], ['Fény terápia']],
          utana: '+ 30 perc kímélő hajszárítás', ido: '50+30 perc'
        },
        // a tulajdonos Meta-fiókjából ("Headspa szeptember 20_ natív kezelés.mp4"): a beégetett „szeptemberi akció" sáv és a záró kártya levágva (3:4, 0:55)
        video: { src: '/assets/video/ajandek-kezeles-egyeni.mp4?v=2', poster: '/assets/img/ajandek/kezeles-egyeni.jpg?v=2', ido: '0:55' }
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
      osszefoglalo_rovid: '50 + 30 perc',
      leiras: 'Két terapeuta dolgozik egyszerre: intenzívebb, különlegesebb Head Spa élmény.',
      tartalom: ['50 perc 4 kezes Head Spa', '30 perc szárítás', '1 fő', '2 terapeuta', '6 hónapig felhasználható'],
      kartya_sor: 'Két terapeuta, még különlegesebb élmény',
      badge: 'VALAMI IGAZÁN KÜLÖNLEGES',
      ar_ft: 39900,
      vendeg_db: 1,
      salonic: { id: 4000, nev: '50 perces 4 Kezes Headspa ajándékkártya - 39.900 Ft' },
      pontosan: { ido: '50 perc 4 kezes Head Spa + 30 perc hajszárítás', fo: '1 vendég', kezelo: 'Két profi masszőr egyszerre, a végén profi fodrász szárít' },
      kezeles: {
        leiras: ['A MOSAIC saját találmánya: két profi masszőr dolgozik egyszerre, a végén egy profi fodrász szárít, vagyis hárman kényeztetnek 50+30 percen át.'],
        menet: {
          nev: '50 perces MOSAIC "4 Kezes" Head Spa kezelés',
          bevezeto: '',
          elemek: [['Exkluzív, új szolgáltatás 2026 januártól'], ['A Headspa kezelések csúcsa'], ['2 profi masszőr kényeztet', true], ['8 féle masszázs', true], ['Profi, szalon szintű beszárítás'], ['Csak ajándékkártya készült']],
          utana: '+ 30 perc kímélő hajszárítás', ido: '50+30 perc'
        },
        // a Meta-fiók 4 kezes videóihoz nincs letölthető fájl; ez a "Hook1.MP4" (Ajándékkártya mappa) teljes hossza (39,5 s), feliratokkal; a ?v=2 a gyorsítótárat töri (a régi 7,8 s-os változat ott ragadt)
        video: { src: '/assets/video/ajandek-kezeles-4kezes.mp4?v=2', poster: '/assets/img/ajandek/kezeles-4kezes.jpg?v=2', ido: '0:40' }
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
      osszefoglalo_rovid: '50 + 30 perc / fő',
      leiras: 'Közös élmény, közös kikapcsolódás: barátnővel, anyukáddal vagy a pároddal.',
      tartalom: ['2 vendég', '2 terapeuta', 'egy közös időpont', '6 hónapig felhasználható'],
      kartya_sor: 'Közös élmény: barátnővel, anyukával, párral',
      badge: 'KETTEN, EGYÜTT',
      ar_ft: 53800,
      vendeg_db: 2,
      salonic: { id: 4081, nev: '50 perces PÁROS MOSAIC Head Spa Ajándékutalvány -20% (53 800 Ft)' },
      pontosan: { ido: '50 perc Head Spa + 30 perc hajszárítás fejenként', fo: '2 vendég, egymás mellett', kezelo: 'Két profi masszőr, egyszerre' },
      kezeles: {
        leiras: ['Ketten fekszetek egymás mellé egy privát, csendes kezelőszobában, két profi masszőr kényeztet titeket egyszerre: közös élmény barátnővel, anyukával vagy a párral.'],
        menet: {
          nev: '50 perces MOSAIC Páros Head Spa kezelés',
          bevezeto: '',
          elemek: [['Mélytisztító hajmosás'], ['Körvízsugaras terápia'], ['OXYGENI hajpakolás fejmasszázzsal'], ['Arctisztítás'], ['Arc radírozás', true], ['Arc tonizálás'], ['Arcmasszázs kézzel és választott eszközzel'], ['Méregtelenítő arcpakolás', true], ['Nyak-, és vállmasszázs'], ['Dekoltázs masszázs'], ['Gőz terápia'], ['Pezsgő alkoholos/alkohol mentes', true]],
          utana: '+ 30 perc kímélő hajszárítás', ido: '50+30 perc'
        },
        // a Meta-fiókból ("Szept páros HEADSPA 20_.mp4"): a beégetett „szeptemberi akció" sáv és a záró (akciós) kártya levágva (3:4, 0:29)
        video: { src: '/assets/video/ajandek-kezeles-paros.mp4?v=2', poster: '/assets/img/ajandek/kezeles-paros.jpg?v=2', ido: '0:29' }
      },
      // a spec szerint a GENERAL vizual ket baratno (nem romantikus par); ez a MOSAIC egyetlen valodi paros fotoja
      // (ket vendeg, ket terapeuta, egymas mellett) - ha van baratnos kep, ide kell cserelni
      vizual: { src: '/assets/img/c2eb0f_2c17645e97d943fda9265b973f1bb6a9.jpg', alt: 'Páros Head Spa: két vendég, két terapeuta, egy közös helyiségben', w: 1500, h: 1500, poz: '50% 50%' }
    }
  };

  // "Ilyen a Head Spa": a kezelest bemutato video = a tulajdonos "szöveg nélkül.mp4" felvetele (APPROVED_BY_METADATA; 1080x1080 forras,
  // weben 640x640, 5 MB; a "forma" a modalis lejatszo alakja). + a vendeg szempontjabol megfogalmazott elmeny-elemek (nem technikai leiras)
  var HEADSPA_VIDEO = { src: '/assets/video/ajandek-headspa.mp4', poster: '/assets/img/ajandek/headspa-poszter.jpg', ido: '0:57', forma: 'negyzet', forras: 'szöveg nélkül.mp4' };
  // "Pontosan ezt kapja": egy MOSAIC Head Spa szeánsz elemei - az élő főoldal lapozója (klon.js VIDEOTAR; a videók és a posztereik már az oldalon vannak:
  // /assets/video/<id>.mp4, /assets/img/<id>f002.jpg). Minden elem egy rövid, valódi felvétel.
  var ELEMEK = [
    ['c2eb0f_a772c9222aa949a0888a4aa2298ef0b5', 'Fejmasszázs eszközökkel', '0:37'],
    ['c2eb0f_a12ccd3c1d8741698774232c8bee7efd', 'Kézmasszázs', '0:39'],
    ['c2eb0f_08e23fa612e846eca8137312513c1fec', 'Arcmasszázs', '0:37'],
    ['c2eb0f_29c8623e64464bdb96b1d61fa5ed6556', 'Mélytisztító hajmosás', '0:21'],
    ['c2eb0f_225ee4f9b6164d3c858705c394f7d04e', 'Fejbőr masszírozó fésű', '0:34'],
    ['c2eb0f_430fb9fbd2e744b08703615db12f4018', '20 ujjas fejmasszírozó', '0:12'],
    ['c2eb0f_bbb818fad4674d2097775970ca10c3d0', 'Arcroller', '0:18'],
    ['c2eb0f_4dd11049dc03482e8b6a169484d1b976', 'Hajmasszírozó körkefe', '0:13'],
    ['c2eb0f_c02456fd01664cb59eb593266e0a8279', 'Nyakmasszázs', '0:13'],
    ['c2eb0f_7eec543c5b944e89966b93b4649ed71a', 'Személyre kikevert hajpakolás', '0:23'],
    ['c2eb0f_cefa94f02ca34e3388845e308afc24f7', 'Dekoltázs masszázs', '0:13'],
    ['c2eb0f_95f0e62128e946b98eff0a6adda4c14c', 'Rózsakvarc fejbőrfésű', '0:26'],
    ['c2eb0f_c68f720ea07c4cc6b19dd56b1ab51f35', 'Körvízsugaras vízterápia', '0:38'],
    ['c2eb0f_85f266a4010d40aba40c28ee4af9230e', 'Rózsakvarc arcmasszírozás', '0:26'],
    ['c2eb0f_4b543396abd34dcc92dfe594049c8a78', 'Személyre kikevert arcpakolás', '0:19']
  ].map(function (e) { return { id: e[0], nev: e[1], ido: e[2], video: '/assets/video/' + e[0] + '.mp4', poster: '/assets/img/' + e[0] + 'f002.jpg' }; });
  // "Miert MOSAIC?" galeria: valodi MOSAIC-fotok (a tulajdonos Drive-mappajabol es az elo oldalrol); [fajl, szelesseg, magassag, alt]
  var GALERIA = [
    ['galeria-01', 1100, 734, 'A MOSAIC kezelőhelyisége'],
    ['galeria-02', 1000, 668, 'A MOSAIC váróterme, mintás tapétával'],
    ['galeria-03', 900, 600, 'Zöld fotelek a MOSAIC váróterében'],
    ['galeria-04', 1000, 668, 'Kezelőszoba növényekkel a MOSAIC-ban'],
    ['galeria-05', 1000, 1000, 'Mikrokamerás fejbőrvizsgálat a MOSAIC-ban'],
    ['galeria-06', 1200, 1042, 'A hajmosás az eredeti Head Spa zuhanyívvel'],
    ['galeria-07', 900, 600, 'Arany lámpák és plakát a MOSAIC falán'],
    ['galeria-08', 1000, 668, 'A MOSAIC váróterme zöld fotelekkel'],
    ['galeria-09', 1000, 1000, 'Profi hajszárítás a MOSAIC-ban'],
    ['galeria-10', 1000, 1334, 'Selymes, fényes haj a Head Spa után'],
    ['galeria-11', 1000, 668, 'A MOSAIC előtere'],
    ['galeria-12', 1000, 668, 'A MOSAIC folyosója'],
    ['galeria-13', 1000, 668, 'A MOSAIC közös tere'],
    ['galeria-14', 1000, 668, 'A MOSAIC bejárata a logóval']
  ].map(function (e) { return { src: '/assets/img/ajandek/' + e[0] + '.jpg', w: e[1], h: e[2], alt: e[3] }; });
  var BENEFITOK = [
    { ikon: 'leaf', cim: 'Teljes stresszoldás', szoveg: 'A kezelés teljes ideje a vendégről szól, nincs rohanás.' },
    { ikon: 'sparkle', cim: 'Fej-, arc- és nyakmasszázs', szoveg: 'Kézzel és eszközökkel végzett masszázs, gőzölés.' },
    { ikon: 'waves', cim: 'Lazító fejzuhany', szoveg: 'A hajmosás az eredeti Head Spa arany zuhanyív alatt történik.' },
    { ikon: 'heart', cim: 'Privát, csendes szoba', szoveg: 'Nyugodt, privát környezet.' },
    { ikon: 'check', cim: 'Gyönyörű haj', szoveg: 'A végén profi hajszárítás is jár hozzá.' }
  ];

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

  // A variant NEM kulon oldal: egyetlen master landing, csak a felso sales-allapot valtozik: a hero cim / alcim / CTA / media,
  // a Gift Finder elovalasztasa, a termeksorrend, az elso testimonial/proof es egy persona-specifikus megnyugtato sor.
  // Minden mas (fejlec, Head Spa-bemutato, termekadat / ar, kartya-elonezet, MOSAIC-proof, hogyan mukodik, GYIK, checkout,
  // fizetes, vasarlas utan, order hub) kozos. Forras: a tulajdonos variant-dokumentuma (MOSAIC_GIFT_VARIANT_CONTENT_*, 2026-10-03).
  //
  // ASSET-VALIDALAS: csak valodi MOSAIC-asset hasznalhato. A hero_media / first_proof "status" mezo:
  //   APPROVED_BY_METADATA | APPROVED_BY_EXPLICIT_FILENAME | APPROVED_BY_FOLDER_CONTEXT -> hasznalhato
  //   NEEDS_MANUAL_VALIDATION -> NEM hasznalhato: a variant a GENERAL assetet kapja, amig a tulajdonos kezzel nem validalta
  // (az eredeti javaslat a hero_media_javaslat / first_proof_javaslat mezoben marad). Az ervenytelen / hianyzo variant: GENERAL.
  // A "gift_finder_preselect" ertekei a FINDER azonositoi: 'egyedul' (a dokumentumban for_one) | 'ketten' (together) | 'kulonleges'.
  var ASSET_JO = { APPROVED_BY_METADATA: true, APPROVED_BY_EXPLICIT_FILENAME: true, APPROVED_BY_FOLDER_CONTEXT: true };
  var HERO_FOTO = { src: '/assets/img/ajandek/hero.jpg', alt: 'Vendég Head Spa kezelésen a MOSAIC-ban, az arany zuhanyív alatt' };
  var VARIANTOK = {
    general: {
      variant_id: 'general',
      hero_eyebrow: 'MOSAIC HEAD SPA AJÁNDÉKKÁRTYA',
      hero_title: 'Ajándékozz neki 80 percet, ami tényleg csak róla szól.',
      hero_subtitle: 'Japán Head Spa élmény Budán, digitális vagy nyomtatott ajándékkártyával.',
      hero_cta: 'Kiválasztom az ajándékot',
      // a hero videoja ("szöveg nélkül.mp4", APPROVED_BY_METADATA): a 24-36. masodperc 3:2-es kivagasa (hang nelkul, 1,1 MB); a fotó a poszter
      hero_media: { src: HERO_FOTO.src, alt: HERO_FOTO.alt, video: { src: '/assets/video/ajandek-hero-altalanos.mp4' }, forras: 'szöveg nélkül.mp4', status: 'APPROVED_BY_METADATA' },
      hero_trust: [
        { csillag: true, szoveg: GOOGLE.pont + ' · ' + GOOGLE.darab, alszoveg: 'Google-vélemény', alszoveg_rovid: 'vélemény', href: '#ah-google' },
        { ikon: 'calendar', szoveg: '6 hónapig', alszoveg: 'érvényes' },
        { ikon: 'monitor', szoveg: 'Online', alszoveg: 'megvásárolható' },
        { ikon: 'card', szoveg: 'Gyönyörű, személyre', alszoveg: 'szabható kártya' }
      ],
      gift_finder_preselect: null,
      product_order: ['egyeni', '4kezes', 'paros'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Karolin.mov', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Ellenőrizni: általános pozitív Head Spa testimonial-e; ne állítsuk róla, hogy ajándékba kapta, ha nem mondja.' },
      featured_proof: 'general',
      // a hero ikonos sora már mondja a 6 hónapot / online / kártyát: itt nincs külön (ismétlődő) megnyugtató sor
      reassurance: null,
      objection_title: null, objection_body: null,
      relationship: null, gift_context: 'general', occasion: null
    },
    friend: {
      variant_id: 'friend',
      hero_eyebrow: 'KÖZÖS MOSAIC HEAD SPA ÉLMÉNY',
      hero_title: 'Ne még egy tárgyat adjatok egymásnak. Menjetek inkább együtt.',
      hero_subtitle: 'Közös Head Spa élmény két főre — amikor egyikőtöknek sem kell semmit megszerveznie.',
      hero_cta: 'Közös élményt választok',
      hero_media: { forras: 'Új páros videó.MP4', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Csak akkor FRIEND hero, ha ténylegesen két nő/barátnő látható. Ha nem, GENERAL fallback.' },
      gift_finder_preselect: 'ketten',
      product_order: ['paros', 'egyeni', '4kezes'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Losonczi Rita — páros TikTok poszt', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Ellenőrizni: barátnős/csajos kapcsolat és testimonial-jelleg; ha nem egyértelmű, validált barátnős videó a testimonial poolból.' },
      featured_proof: 'general',
      reassurance: 'A program már készen van — csak az ajándékot kell kiválasztanod.',
      objection_title: null, objection_body: null,
      relationship: 'friend', gift_context: 'together', occasion: null
    },
    mother: {
      variant_id: 'mother',
      hero_eyebrow: 'KÖZÖS IDŐ ANYÁNAK ÉS LÁNYÁNAK',
      hero_title: 'Adj neki közös időt — ne még egy dolgot.',
      hero_subtitle: 'Páros Head Spa élmény anyának és lányának, ahol most egyikőtöknek sem kell másról gondoskodnia.',
      hero_cta: 'Közös élményt választok',
      // "Anya-lánya.MP4": a fajlnev egyertelmuen azonositja (APPROVED_BY_EXPLICIT_FILENAME). A forras fekvo-ellenes (9:16, feliratos);
      // a hero a 71,5-79,5. masodperc (a szekben ulo paros) 3:2-es savja a felirat folott, hang nelkul (0,6 MB)
      hero_media: { src: '/assets/img/ajandek/hero-anya-lanya.jpg', alt: 'Anya és lánya egymás mellett a MOSAIC szalonban', video: { src: '/assets/video/ajandek-hero-anya-lanya.mp4' }, forras: 'Anya-lánya.MP4', status: 'APPROVED_BY_EXPLICIT_FILENAME' },
      gift_finder_preselect: 'ketten',
      product_order: ['paros', 'egyeni', '4kezes'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Győri Anett — Moms / Páros TikTok', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Ellenőrizni: tényleges anya–lánya / anyának releváns proof-e; ha nem, validált releváns videó a testimonial poolból.' },
      featured_proof: 'general',
      reassurance: 'Az együtt töltött idő maga az ajándék.',
      objection_title: null, objection_body: null,
      relationship: 'mother', gift_context: 'together', occasion: null
    },
    for_her: {
      variant_id: 'for_her',
      hero_eyebrow: 'AJÁNDÉK NEKI',
      hero_title: 'Adj neki 80 percet, amikor végre semmiről nem kell gondoskodnia.',
      hero_subtitle: 'MOSAIC Head Spa ajándékkártya — egy élmény, amit nem kell méretre, színre vagy ízlésre választanod.',
      hero_cta: 'Ajándékot választok',
      hero_media: { forras: 'Férfi új Hook videók / 1.mov', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'A mappa férfi hookként azonosított, de az 1.mov tartalmát ellenőrizni kell; ha nem ajándékozó férfi-intentre jó, GENERAL treatment hero.' },
      gift_finder_preselect: 'egyedul',
      product_order: ['egyeni', '4kezes', 'paros'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Headspa testimonial pool — női ajándék-reakció', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Kötelező olyan női videót választani, amelyben a vendég ténylegesen ajándékba kapta / ajándékként ajánlja az élményt; nem állítható név alapján.' },
      featured_proof: 'general',
      reassurance: 'Nem kell tudnod, milyen kezelést választana magának.',
      objection_title: null, objection_body: null,
      relationship: 'recipient_female', gift_context: 'for_her', occasion: null
    },
    partner: {
      variant_id: 'partner',
      hero_eyebrow: 'PÁROS MOSAIC HEAD SPA',
      hero_title: 'Egy randi, ahol most mindketten kikapcsoltok.',
      hero_subtitle: 'Közös Head Spa élmény két főre — ajándék, amit nem csak átadsz, hanem együtt éltek át.',
      hero_cta: 'Páros élményt választok',
      hero_media: { forras: 'Páros headspa kezelés 1.MP4', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Csak valódi romantikus pár látható esetén PARTNER; ha két nő/barátnő vagy nem egyértelmű, GENERAL fallback. Romantikus vizuál GENERAL-ben tilos.' },
      gift_finder_preselect: 'ketten',
      product_order: ['paros', 'egyeni', '4kezes'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Páros testimonial', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Kizárólag valós romantikus/pár proof használható; ha nincs, GENERAL női proof fallback.' },
      featured_proof: 'general',
      reassurance: 'Nem csak ő kap ajándékot — közös emlék lesz belőle.',
      objection_title: null, objection_body: null,
      relationship: 'partner', gift_context: 'together', occasion: null
    },
    last_minute: {
      variant_id: 'last_minute',
      hero_eyebrow: 'MOSAIC HEAD SPA AJÁNDÉKKÁRTYA',
      hero_title: 'Ajándékot keresel az utolsó pillanatban?',
      hero_subtitle: 'Válaszd ki online az élményt, fizesd ki néhány lépésben, majd személyre szabhatod az ajándékkártyát.',
      hero_cta: 'Ajándékot választok',
      // "Ajándékkártya / Hook1.MP4" (APPROVED_BY_FOLDER_CONTEXT: élesítés előtt gyors vizuális QA ajánlott). A forrás hirdetés: a
      // férfi-beszélős jelenetek ("csak 200 darab", "zárjuk a foglalást", "csak két kattintás") NEM kerülnek be (nem igazolt szűkösség- és
      // gyorsasági állítás); a hero csak a kezelés-képek két szakaszát használja (3,5-6 s + 8-10,5 s), a felirat-sáv nélkül (0,3 MB)
      hero_media: { src: '/assets/img/ajandek/hero-hook.jpg', alt: 'Vendég Head Spa kezelésen a MOSAIC-ban, az arany zuhanyív alatt', video: { src: '/assets/video/ajandek-hero-hook.mp4' }, forras: 'Ajándékkártya / Hook1.MP4', status: 'APPROVED_BY_FOLDER_CONTEXT' },
      gift_finder_preselect: null,
      product_order: ['egyeni', '4kezes', 'paros'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Ajándékkártya vizuál / DSC01457.jpg', status: 'APPROVED_BY_FOLDER_CONTEXT', validalas: 'Az "Ezt adod át neki" blokk fotója (közös).' },
      featured_proof: 'general',
      // Fontos: a kezbesitesi idore NEM teszunk allitast (se "azonnal", se "1 perc alatt", se "meg ma"), amig a teljesitesi SLA
      // nincs egyetlen hiteles forrasbol igazolva - a megjeleno szoveg ezert csak az online vasarlast mondja
      reassurance: null,   // a hero ikonos sora már mondja: „Online megvásárolható"; kézbesítési időre nincs állítás
      sla_megjegyzes: 'Kézbesítési időre csak igazolt fulfillment SLA alapján szabad állítást tenni.',
      objection_title: null, objection_body: null,
      relationship: null, gift_context: 'last_minute', occasion: 'dynamic'
    }
  };

  // Kozos tartalek: a variant, ami nem ad sajat bizalmi sort, a GENERAL-et kapja; a nem validalt (NEEDS_MANUAL_VALIDATION) hero-asset
  // helyett a GENERAL hero-assetje jelenik meg (az eredeti javaslat a hero_media_javaslat mezoben marad)
  Object.keys(VARIANTOK).forEach(function (k) {
    var v = VARIANTOK[k], g = VARIANTOK.general;
    if (!v.hero_trust) v.hero_trust = g.hero_trust;
    if (!v.hero_media || !ASSET_JO[v.hero_media.status] || !v.hero_media.src) {
      v.hero_media_javaslat = v.hero_media || null;
      v.hero_media = g.hero_media;
    }
  });

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
    HEADSPA_VIDEO: HEADSPA_VIDEO,
    ELEMEK: ELEMEK,
    GALERIA: GALERIA,
    BENEFITOK: BENEFITOK,
    ALKALMAK: ALKALMAK,
    ATVETELEK: ATVETELEK,
    ATADASOK: ATADASOK,
    PROOFOK: PROOFOK,
    GOOGLE: GOOGLE,
    VARIANTOK: VARIANTOK,
    ASSET_JO: ASSET_JO,
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
