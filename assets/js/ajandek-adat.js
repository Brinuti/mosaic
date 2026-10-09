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
    { ikon: 'check', cim: 'Fej-, arc- és nyakmasszázs', szoveg: 'Kézzel és eszközökkel végzett masszázs, gőzölés.' },
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
  var GOOGLE = { pont: '4,9', darab: '1.266' };   // a Trustindex-widget szama (2026-10-09; tartalek: az aktualis szamot a google-szam.js irja be); idonkent frissitendo
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
  // APPROVED_BY_VISUAL_REVIEW (2026-10-09, persona-oldalak): a MOSAIC SAJAT, az eles oldalon mar publikalt felvetelebol / fotojabol keszult asset (a forras a "forras" mezoben),
  // amelynek tartalmat a kepkockak atnezesevel ellenoriztuk (nincs felirat, ar, idegen vendeg-nev; nem hirdetes-szoveg). A tulajdonos kesobb barmikor lecserelheti.
  var ASSET_JO = { APPROVED_BY_METADATA: true, APPROVED_BY_EXPLICIT_FILENAME: true, APPROVED_BY_FOLDER_CONTEXT: true, APPROVED_BY_VISUAL_REVIEW: true };
  var HERO_FOTO = { src: '/assets/img/ajandek/hero-30-altalanos.jpg', alt: 'Vendég Head Spa kezelésen a MOSAIC-ban, az arany zuhanyív alatt' };
  var VARIANTOK = {
    general: {
      variant_id: 'general',
      hero_eyebrow: 'MOSAIC HEAD SPA AJÁNDÉKKÁRTYA',
      hero_title: 'Ajándékozz neki 80 percet, ami tényleg csak róla szól.',
      hero_subtitle: 'Japán Head Spa élmény Budán, digitális vagy nyomtatott ajándékkártyával.',
      hero_cta: 'Kiválasztom az ajándékot',
      // a hero videoja ("szöveg nélkül.mp4", APPROVED_BY_METADATA): a 24-36. masodperc 3:2-es kivagasa (hang nelkul, 1,1 MB); a fotó a poszter
      hero_media: { src: HERO_FOTO.src, alt: HERO_FOTO.alt, video: { src: '/assets/video/ajandek-hero-30-altalanos.mp4' }, forras: 'szöveg nélkül.mp4', status: 'APPROVED_BY_METADATA' },
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
      // a fo (altalanos) oldalon nincs magyarazo-szekcio: ott rogton a valaszto jon
      magyarazo: null,
      relationship: null, gift_context: 'general', occasion: null
    },
    friend: {
      variant_id: 'friend',
      hero_eyebrow: 'KÖZÖS MOSAIC HEAD SPA ÉLMÉNY',
      hero_title: 'A tökéletes csajos nap ezzel a programmal kezdődik.',
      hero_subtitle: 'Közös Head Spa élmény két főre — amikor egyikőtöknek sem kell semmit megszerveznie.',
      hero_cta: 'Közös élményt választok',
      // a tulajdonos kérése (2026-10-04): barátnők választják egymásnak, ezért a hero a páros kezelés videójának barátnős szakasza (két nő, fürdőlepedőben, pezsgővel; felülnézeti kép a két ágyról);
      // forrás: a Meta-fiók "Páros Headspa szept ajánlati WARM / Szept páros HEADSPA 20%" videója (ugyanaz, mint a Páros termék kezelés-videója), az árcsík és a felirat nélküli sáv, 3:2, hang nélkül (0,5 MB)
      // 2026-10-04: a tulajdonos a hosszabb (30 mp-es) montázs helyett ezt, a rövid, eredeti barátnős szakaszt kérte vissza (4,5 mp, ismétlődik); négyzetes (1:1) kerethez a 3:2-es képsáv a Páros kezelés-videó (`ajandek-kezeles-paros.mp4`) első 4,5 mp-éből, felirat nélkül, a keret szélén halvány elmosott sávval
      hero_media: { src: '/assets/img/ajandek/hero-baratnok-negyzet.jpg', alt: 'Két barátnő fürdőlepedőben pezsgővel, majd egymás mellett a Head Spa kezelésen a MOSAIC-ban', video: { src: '/assets/video/ajandek-hero-baratnok-negyzet.mp4' }, forras: 'Meta: Páros Headspa szept ajánlati WARM', status: 'APPROVED_BY_METADATA' },
      gift_finder_preselect: 'ketten',
      product_order: ['paros', 'egyeni', '4kezes'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Losonczi Rita — páros TikTok poszt', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Ellenőrizni: barátnős/csajos kapcsolat és testimonial-jelleg; ha nem egyértelmű, validált barátnős videó a testimonial poolból.' },
      featured_proof: 'general',
      reassurance: 'A program már készen van — csak az ajándékot kell kiválasztanod.',
      objection_title: null, objection_body: null,
      magyarazo: {
        felcim: 'EGY NAP KETTŐTÖKNEK',
        cim: 'Egy csajos nap, ahol csak egymásra kell figyelnetek',
        szovegek: [
          'A közös program sokszor azon bukik el, hogy valakinek kell szerveznie: időpontot egyeztetni, helyet keresni, mindent megbeszélni. Ez az ajándékkártya ezt leveszi a válladról: a program kész, csak el kell menni.',
          'Ketten fekszetek egymás mellett egy privát szobában, két kezelő foglalkozik veletek egyszerre: hajmosás, fej-, arc- és nyakmasszázs, a végén profi hajszárítás.',
          'Ajándékozd a barátnődnek, a testvérednek, vagy ajándékozzátok magatoknak: a páros kártya két főre szól, egy közös időpontra.'
        ],
        pontok: ['Két főre szóló páros kártya, egy közös időpont', 'Két kezelő dolgozik egyszerre, egymás mellett fekve', 'Digitális vagy nyomtatott kártya, 6 hónapig felhasználható'],
        // 2026-10-09 (2. kor): a hero-videoban mar szerepel a pezsgozes + a paros agyak, ezert ide MAS jelenet kerult: ket no karoltve a MOSAIC folyosojan
        media: { src: '/assets/img/ajandek/magyarazo-csajos-ketto.jpg', alt: 'Két barátnő fürdőlepedőben, karöltve sétál és nevet a MOSAIC folyosóján a Head Spa előtt', w: 1000, h: 906, poz: '50% 20%',
          forras: 'Drive: "páros csajos érzelmes.mp4" (MOSAIC hirdetési videó), a 17,5. másodperc kockája, a felirat nélküli sávra vágva' }
      },
      relationship: 'friend', gift_context: 'together', occasion: null
    },
    mother: {
      variant_id: 'mother',
      hero_eyebrow: 'AJÁNDÉK ANYUKÁNAK',
      hero_title: 'Adj anyukádnak egy kis időt, amit végre csak magára fordíthat.',
      hero_subtitle: 'Head Spa ajándékkártya anyukáknak: 80 perc nyugalom, egyedül vagy veled együtt, hogy most ne kelljen senkiről gondoskodnia.',
      hero_cta: 'Anyukámnak választok',
      // "Anya-lánya.MP4": a fajlnev egyertelmuen azonositja (APPROVED_BY_EXPLICIT_FILENAME). A forras fekvo-ellenes (9:16, feliratos);
      // a hero a 71,5-79,5. masodperc (a szekben ulo paros) 3:2-es savja a felirat folott, hang nelkul (0,6 MB)
      hero_media: { src: '/assets/img/ajandek/hero-30-anya.jpg', alt: 'Anya és lánya egymás mellett a MOSAIC szalonban', video: { src: '/assets/video/ajandek-hero-30-anya.mp4' }, forras: 'Anya-lánya.MP4', status: 'APPROVED_BY_EXPLICIT_FILENAME' },
      gift_finder_preselect: 'ketten',
      product_order: ['paros', 'egyeni', '4kezes'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Győri Anett — Moms / Páros TikTok', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Ellenőrizni: tényleges anya–lánya / anyának releváns proof-e; ha nem, validált releváns videó a testimonial poolból.' },
      featured_proof: 'general',
      reassurance: 'Az együtt töltött idő maga az ajándék.',
      objection_title: null, objection_body: null,
      magyarazo: {
        felcim: 'ANYUKÁKNAK',
        cim: 'Az anyukád megérdemli, hogy most vele foglalkozzanak',
        szovegek: [
          'Az anyukák gyakran maguk kerülnek utoljára: előbb a család, a munka, a ház, és csak aztán ők. Ezzel az ajándékkal te adhatod meg neki azt a nyugodt órát, amit magának talán sosem foglalna le.',
          'A Head Spa kényelmes fekvésben, privát és csendes szobában zajlik: hajmosás, fej-, arc- és nyakmasszázs, a végén profi hajszárítás. Neki csak le kell feküdnie.',
          'Választhatod egyedül neki, vagy páros kártyát, hogy együtt éljétek át: két kezelő, egy közös időpont, egymás mellett.'
        ],
        pontok: ['Nyugodt, privát szoba, nincs rohanás', 'Egyedül neki, vagy veled együtt (páros kártya)', 'Digitális vagy nyomtatott kártya, személyre szabható üzenettel'],
        // 2026-10-09 (2. kor): anya es lanya egymas mellett, beszelgetnek (a hero videojanak forrasabol, de mas kocka, mint a hero-poszter)
        media: { src: '/assets/img/ajandek/magyarazo-anya-lanya.jpg', alt: 'Anya és lánya egymás mellett ülnek a MOSAIC szalonban, beszélgetnek és mosolyognak', w: 1000, h: 998, poz: '50% 40%',
          forras: 'Drive: "Anya-lánya.MP4" (eredeti, 1080 x 1920), a 75,5. másodperc kockája (a hero ugyanebből a felvételből készült, de a poszter másik kocka), a felirat feletti sávra vágva' }
      },
      relationship: 'mother', gift_context: 'together', occasion: null
    },
    for_her: {
      variant_id: 'for_her',
      hero_eyebrow: 'AJÁNDÉK NEKI',
      hero_title: 'Adj neki 80 percet, amikor végre semmiről nem kell gondoskodnia.',
      hero_subtitle: 'MOSAIC Head Spa ajándékkártya — egy élmény, amit nem kell méretre, színre vagy ízlésre választanod.',
      hero_cta: 'Ajándékot választok',
      // 2026-10-09: sajat hero (a "Férfi új Hook videók / 1.mov" tartalma nem volt ellenorizve, ezert nem hasznaltuk): a MOSAIC publikalt felvetelebol
      // (profi foto: a nyugodtan pihenő nő az arany ív alatt; majd arc- / nyakmasszázs a "szöveg nélkül.mp4"-ből), hang es felirat nelkul (0,7 MB; tools/ajandek-variansok/hero-videok.py)
      hero_media: { src: '/assets/img/ajandek/hero-noknek.jpg', alt: 'Nyugodtan pihenő nő a Head Spa arany zuhanyíve alatt a MOSAIC-ban', video: { src: '/assets/video/ajandek-hero-noknek.mp4' },
        forras: 'assets/img/ajandek/hero.jpg + ajandek-headspa.mp4 (szöveg nélkül.mp4) arc- és nyakmasszázs szakaszai', status: 'APPROVED_BY_VISUAL_REVIEW' },
      gift_finder_preselect: 'egyedul',
      product_order: ['egyeni', '4kezes', 'paros'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Headspa testimonial pool — női ajándék-reakció', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Kötelező olyan női videót választani, amelyben a vendég ténylegesen ajándékba kapta / ajándékként ajánlja az élményt; nem állítható név alapján.' },
      featured_proof: 'general',
      reassurance: 'Nem kell tudnod, milyen kezelést választana magának.',
      objection_title: null, objection_body: null,
      magyarazo: {
        felcim: 'NEKI, AKI MINDIG MÁSOKRA FIGYEL',
        cim: 'Mert ő mindig mindenkire figyel. Most rá fognak figyelni.',
        szovegek: [
          'Sok nőnek a mindennapi rohanásban jut a legkevesebb idő saját magára. Ez az ajándék erről szól: 80 perc, amikor semmit nem kell intéznie, és mindenki más várhat.',
          'A Head Spa hajmosás, fej-, arc- és nyakmasszázs, gőzölés és profi hajszárítás egy privát, csendes szobában. A végén kipihent fejjel és szép hajjal áll fel.',
          'Ha nem tudod, mit szeretne, ez a kártya biztos választás: nem kell méretet, színt vagy ízlést eltalálnod, ő pedig akkor megy, amikor neki jó.'
        ],
        pontok: ['Nem kell méretet, színt vagy ízlést eltalálnod', 'Nyugodt, privát szoba, nincs rohanás', 'Digitális vagy nyomtatott kártya, személyre szabható'],
        media: { src: '/assets/img/ajandek/magyarazo-noknek.jpg', alt: 'Arcmasszázs egy pihenő vendégnek a MOSAIC kezelőszobájában, meleg fényben', w: 1000, h: 750, poz: '50% 40%',
          forras: 'a MOSAIC szalon fotója (a régi Wix-oldalról: c2eb0f_968e13…), 1000 px-re kicsinyítve' }
      },
      relationship: 'recipient_female', gift_context: 'for_her', occasion: null
    },
    partner: {
      variant_id: 'partner',
      hero_eyebrow: 'PÁROS MOSAIC HEAD SPA',
      hero_title: 'Egy felejthetetlen randi, ahol mindketten ellazultok.',
      hero_subtitle: 'Közös Head Spa élmény két főre — ajándék, amit nem csak átadsz, hanem együtt élitek át.',
      hero_cta: 'Páros élményt választok',
      // a tulajdonos kérése (2026-10-04): valódi férfi + nő pár. Forrás: Drive "Headspa férfiaknak" mappa / "Páros kezelés.MP4" (a pár a váróban, fürdőlepedőben, pezsgővel: 22,9-24,1 mp, lassítva),
      // közte a kezelés pillanatai (női és férfi vendég); a felirat és a szöveg nélküli 3:2-es sáv, hang nélkül (0,6 MB)
      hero_media: { src: '/assets/img/ajandek/hero-30-partner.jpg', alt: 'Egy pár fürdőlepedőben, pezsgővel a kezében a MOSAIC váróterében, a közös Head Spa előtt', video: { src: '/assets/video/ajandek-hero-30-partner.mp4' }, forras: 'Drive: Headspa férfiaknak / Páros kezelés.MP4', status: 'APPROVED_BY_FOLDER_CONTEXT' },
      gift_finder_preselect: 'ketten',
      product_order: ['paros', 'egyeni', '4kezes'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Páros testimonial', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Kizárólag valós romantikus/pár proof használható; ha nincs, GENERAL női proof fallback.' },
      featured_proof: 'general',
      reassurance: 'Nem csak ő kap ajándékot — közös emlék lesz belőle.',
      objection_title: null, objection_body: null,
      magyarazo: {
        felcim: 'KETTEN, EGYÜTT',
        cim: 'Ajándék, amit nem csak átadsz, hanem együtt éltek át',
        szovegek: [
          'Egy közös program többet mond, mint egy újabb tárgy: időt szánsz kettőtökre, és semmit nem kell megszerveznetek.',
          'Egymás mellett fekve, két kezelővel, privát szobában: hajmosás, fej-, arc- és nyakmasszázs, a végén profi hajszárítás. Egy randi, ahol mindketten tényleg lelassultok.',
          'A kártya páros: két főre szól, egy közös időpontra, és 6 hónapig felhasználható.'
        ],
        pontok: ['Két főre szóló páros kártya', 'Egymás mellett, privát szobában', 'Digitális vagy nyomtatott kártya, személyre szabható'],
        media: { src: '/assets/img/ajandek/magyarazo-paros.jpg', alt: 'Egy pár fürdőlepedőben, pezsgővel a kezében a MOSAIC váróterében, a közös Head Spa előtt', w: 720, h: 720, poz: '50% 50%',
          forras: 'Drive: Headspa férfiaknak / Páros kezelés.MP4 (ajandek-hero-30-partner.mp4) egy kockája' }
      },
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
      hero_media: { src: '/assets/img/ajandek/hero-30-utolso-pillanat.jpg', alt: 'Vendég Head Spa kezelésen a MOSAIC-ban, az arany zuhanyív alatt', video: { src: '/assets/video/ajandek-hero-30-utolso-pillanat.mp4' }, forras: 'Ajándékkártya / Hook1.MP4', status: 'APPROVED_BY_FOLDER_CONTEXT' },
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
      // a magyarazo sem tesz allitast a kezbesites idejere (csak az online vasarlast, a szemelyre szabast es a 6 honapos ervenyesseget)
      magyarazo: {
        felcim: 'EGY AJÁNDÉK, AMIN NEM KELL SOKAT GONDOLKODNI',
        cim: 'Az utolsó pillanatban is lehet igazán jó ajándékot adni',
        szovegek: [
          'Ha kevés az időd, a legjobb ajándék az, amiről nem kell hosszan gondolkodni. A Head Spa ajándékkártyát online választod ki, néhány lépésben fizeted, és személyre is szabhatod.',
          'Az ajándékozott 80 percet kap: hajmosást, fej-, arc- és nyakmasszázst, profi hajszárítást, egy privát, csendes szobában. Az időpontot ő választja, mert a kártya 6 hónapig felhasználható.'
        ],
        pontok: ['Online kiválasztható és megvásárolható', 'Digitális vagy nyomtatott formában is', '6 hónapig felhasználható, ő választ időpontot'],
        media: { src: '/assets/img/ajandek/magyarazo-utolso.jpg', alt: 'MOSAIC Head Spa kezelés közben: a kezelő a vendég kezét masszírozza', w: 1000, h: 667, poz: '50% 40%',
          forras: 'a MOSAIC fotója (DSC01457, az "Ezt adod át neki" blokk képe: atadas-kartya.jpg), kicsinyítve' }
      },
      relationship: null, gift_context: 'last_minute', occasion: 'dynamic'
    },
    // ---- 2026-10-09: a maradek persona-oldalak (a regi Wixes cimek) sajat varianssal; a hero-videok a MOSAIC meglevo felvetelebol keszultek
    // (tools/ajandek-variansok/hero-videok.py), a magyarazo-szekciok kepei a MOSAIC sajat fotoi ----
    birthday: {
      variant_id: 'birthday',
      hero_eyebrow: 'SZÜLETÉSNAPI AJÁNDÉK',
      hero_title: 'A legszebb szülinapi ajándék: 80 perc, ami csak az ünnepeltről szól.',
      hero_subtitle: 'Head Spa ajándékkártya születésnapra: nem kell méretet vagy ízlést eltalálnod, a kártyát pedig személyre is szabhatod.',
      hero_cta: 'Születésnapi ajándékot választok',
      // a MOSAIC ajandekkartya-boritekja (foto) -> gyertyafenyes kezeles (a galeria "Fejmasszázs eszközökkel" és "Rózsakvarc fejbőrfésű" klipjei)
      hero_media: { src: '/assets/img/ajandek/hero-szulinap.jpg', alt: 'A MOSAIC Head Spa ajándékkártya fekete borítékban, mögötte arany oroszlánfej-szobor', video: { src: '/assets/video/ajandek-hero-szulinap.mp4' },
        forras: 'c2eb0f_159a37… (ajándékkártya-boríték fotó) + a galéria két klipje (c2eb0f_a772c9…, c2eb0f_95f0e6…)', status: 'APPROVED_BY_VISUAL_REVIEW' },
      gift_finder_preselect: 'egyedul',
      product_order: ['egyeni', '4kezes', 'paros'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Headspa testimonial pool — ünnepelt / ajándék-reakció', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Csak olyan vendég-videó jelenhet meg elsőként, amelyben ténylegesen ajándékba kapta az élményt.' },
      featured_proof: 'general',
      reassurance: 'Személyre szabható kártya: az ünnepelt nevével és üzenettel.',
      objection_title: null, objection_body: null,
      magyarazo: {
        felcim: 'SZÜLINAPRA',
        cim: 'Egy szülinap, ahol most az ünnepelt a főszereplő',
        szovegek: [
          'Születésnapon az ünnepelt gyakran mindenki másról gondoskodik: vendégeket fogad, mosolyog, szervez. Ez az ajándék arról szól, hogy ő is megkapja azt az időt, amikor végre csak magára figyelhet.',
          'A Head Spa japán eredetű fejfürdő: hajmosás, fej-, arc- és nyakmasszázs egy privát, csendes szobában, a végén profi hajszárítással. 50 perc kezelés és 30 perc szárítás, vagyis 80 perc kényeztetés.',
          'Te választod ki és szabod személyre a kártyát: neki már csak időpontot kell foglalnia.'
        ],
        pontok: ['Nem kell méretet, színt vagy ízlést eltalálnod', 'Személyre szabható digitális vagy nyomtatott kártya', '6 hónapig felhasználható, ő választ időpontot'],
        media: { src: '/assets/img/ajandek/magyarazo-szulinap.jpg', alt: 'Személyre szabott MOSAIC ajándékkártya fotóval és üzenettel, kinyomtatva az asztalon', w: 900, h: 823, poz: '50% 50%',
          forras: 'a személyre szabott kártya mintaképe (atadas-szemelyre.jpg), kicsinyítve' }
      },
      relationship: null, gift_context: 'birthday', occasion: 'szuletesnap'
    },
    japan: {
      variant_id: 'japan',
      hero_eyebrow: 'JAPÁN HEAD SPA ÉLMÉNY',
      hero_title: 'Ajándékozz egy szelet japán nyugalmat.',
      hero_subtitle: 'Japán Head Spa élmény Budán: körvízsugaras hajmosás az arany zuhanyív alatt, masszázs és csend, 80 percen át.',
      hero_cta: 'Japán élményt ajándékozok',
      // a hajmoso-iv fotoja (galeria-06) -> az arany iv hatulrol (a "Körvízsugaras vízterápia" galeria-klip) -> szines iv ("szöveg nélkül.mp4")
      hero_media: { src: '/assets/img/ajandek/hero-japan.jpg', alt: 'Hajmosás a Head Spa zuhanyíve alatt, hátulról nézve a MOSAIC-ban', video: { src: '/assets/video/ajandek-hero-japan.mp4' },
        forras: 'assets/img/ajandek/galeria-06.jpg + c2eb0f_c68f72… (Körvízsugaras vízterápia) + ajandek-headspa.mp4 (szöveg nélkül.mp4) ív-jelenetei', status: 'APPROVED_BY_VISUAL_REVIEW' },
      gift_finder_preselect: null,
      product_order: ['egyeni', '4kezes', 'paros'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Headspa testimonial pool', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Általános pozitív Head Spa testimonial; ne állítsuk róla, hogy ajándékba kapta, ha nem mondja.' },
      featured_proof: 'general',
      reassurance: null,
      objection_title: null, objection_body: null,
      magyarazo: {
        felcim: 'JAPÁN ÉLMÉNY, BUDÁN',
        cim: 'Egy japán fejfürdő-rituálé, ami lelassítja a napot',
        szovegek: [
          'A Head Spa Japánból származik: a hajápolás és a masszázs találkozása, ahol a vendég végig fekszik, és minden figyelem rá irányul.',
          'Nálunk ez körvízsugaras hajmosást jelent az arany zuhanyív alatt, fej-, arc- és nyakmasszázst, gőzölést és profi hajszárítást: 50 perc kezelés és 30 perc szárítás.',
          'Ha olyannak keresel ajándékot, aki szereti a csendet, a rendet és a részletekre figyelő törődést, ez a kártya jó választás.'
        ],
        pontok: ['Körvízsugaras hajmosás az arany zuhanyív alatt', 'Fej-, arc- és nyakmasszázs privát szobában', 'Digitális vagy nyomtatott kártya, 6 hónapig felhasználható'],
        media: { src: '/assets/img/ajandek/magyarazo-japan.jpg', alt: 'Nyugodtan pihenő nő a Head Spa arany zuhanyíve alatt a MOSAIC-ban', w: 1000, h: 666, poz: '62% 45%',
          forras: 'a MOSAIC profi fotója (assets/img/ajandek/hero.jpg), 1000 px-re kicsinyítve' }
      },
      relationship: null, gift_context: 'japan', occasion: null
    },
    esoteric: {
      variant_id: 'esoteric',
      hero_eyebrow: 'HOLISZTIKUS HEAD SPA ÉLMÉNY',
      hero_title: 'Ajándékozz belső egyensúlyt: egy lassú, csendes Head Spa rituálét.',
      hero_subtitle: 'Privát, halk fényű szoba, meleg víz, masszázs és teljes csend — 80 perc annak, aki szereti a testi-lelki feltöltődést.',
      hero_cta: 'A rituálét ajándékozom',
      // a "szöveg nélkül.mp4" nyugodt jelenetei (a halk fényű kezelőszoba, a kezelő ráhangolódása) + a "Körvízsugaras vízterápia" fénygyűrűje
      hero_media: { src: '/assets/img/ajandek/hero-ezo.jpg', alt: 'Halk fényű Head Spa kezelőszoba a MOSAIC-ban, apró fényekkel a falon', video: { src: '/assets/video/ajandek-hero-ezo.mp4' },
        forras: 'ajandek-headspa.mp4 (szöveg nélkül.mp4) szoba- és kezelő-jelenetei + c2eb0f_c68f72… (Körvízsugaras vízterápia) fénygyűrűje', status: 'APPROVED_BY_VISUAL_REVIEW' },
      gift_finder_preselect: 'egyedul',
      product_order: ['egyeni', '4kezes', 'paros'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Headspa testimonial pool', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Általános pozitív Head Spa testimonial; a "meditatív / lelki" állítás csak a vendég saját szavaival szerepelhet.' },
      featured_proof: 'general',
      reassurance: 'A kezelés alatt semmi dolga: csak feküdnie kell.',
      objection_title: null, objection_body: null,
      magyarazo: {
        felcim: 'CSEND ÉS LASSÚSÁG',
        cim: 'Egy csendes rituálé a sablonos ajándékok helyett',
        szovegek: [
          'Van, akinek nem újabb tárgy kell, hanem csend, lassúság és az, hogy végre befelé figyelhet. Ennek az ajándéknak éppen ez a lényege.',
          'A Head Spa-n lehunyt szemmel fekszik egy privát, tompa fényű szobában: meleg víz a hajon, lassú fej-, arc- és nyakmasszázs, gőz, nyugalom. Ezért olyanoknak is jó ajándék, akik a meditációt, a jógát vagy a lelki feltöltődést szeretik.',
          'A kezelés 50 perc masszázs és hajápolás, utána 30 perc profi hajszárítás, hogy a végén ne csak kipihenten, hanem rendezetten is álljon fel.'
        ],
        pontok: ['Privát, csendes, tompa fényű szoba', 'Lassú fej-, arc- és nyakmasszázs, gőzölés', 'Digitális vagy nyomtatott kártya, 6 hónapig felhasználható'],
        media: { src: '/assets/img/ajandek/magyarazo-ezo.jpg', alt: 'A MOSAIC halk fényű kezelőszobája: apró fények a falon, növény, kezelőágy', w: 1000, h: 750, poz: '50% 50%',
          forras: 'a MOSAIC szalon fotója (a régi Wix-oldalról: mosaic-headspa-kezeloszoba.jpg), 1000 px-re kicsinyítve' }
      },
      relationship: null, gift_context: 'esoteric', occasion: null
    },
    self_care: {
      variant_id: 'self_care',
      hero_eyebrow: 'SELF-CARE AJÁNDÉK',
      hero_title: 'Ajándékozz egy kis self-care-t, mert megérdemli.',
      hero_subtitle: '80 perc csendes, csak róla szóló kényeztetés — ajándék annak, aki ritkán szán időt saját magára.',
      hero_cta: 'Self-care ajándékot választok',
      // galeria-klipek: arcpakolas, dekoltazs- es nyakmasszazs (lassu, lagy jelenetek, felirat nelkul)
      hero_media: { src: '/assets/img/ajandek/hero-selfcare.jpg', alt: 'Arcpakolás a MOSAIC Head Spa-ban: nyugodtan fekvő vendég, rózsaszín fényben', video: { src: '/assets/video/ajandek-hero-selfcare.mp4' },
        forras: 'a galéria klipjei: c2eb0f_4b5433… (arcpakolás), c2eb0f_cefa94… (dekoltázs masszázs), c2eb0f_c02456… (nyakmasszázs)', status: 'APPROVED_BY_VISUAL_REVIEW' },
      gift_finder_preselect: 'egyedul',
      product_order: ['egyeni', '4kezes', 'paros'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Headspa testimonial pool', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Általános pozitív Head Spa testimonial; ne állítsuk róla, hogy ajándékba kapta, ha nem mondja.' },
      featured_proof: 'general',
      reassurance: 'Ő választ időpontot, amikor neki a legjobb.',
      objection_title: null, objection_body: null,
      magyarazo: {
        felcim: 'MERT MEGÉRDEMLI',
        cim: 'A self-care nem luxus, hanem szünet',
        szovegek: [
          'Sokan tudják, hogy kellene egy kis idő magukra, mégis mindig van fontosabb. Egy ajándékkártya azt üzeni: most ez a fontos.',
          'A Head Spa-n nincs teendő: fekszik, a többit a kezelők végzik. Hajmosás, fej-, arc- és nyakmasszázs, gőzölés, a végén profi hajszárítás.',
          'A kártya 6 hónapig felhasználható, ő pedig akkor foglal, amikor neki jó, így tényleg ki tud szakadni a mindennapokból.'
        ],
        pontok: ['Nincs teendő, csak pihenés', 'Privát, csendes szoba', 'Digitális vagy nyomtatott kártya, személyre szabható üzenettel'],
        // 2026-10-09 (2. kor): a teljes ellazulast mutato kep (csukott szemmel pihenő arc), nem a hajkamerás (haj-diagnosztikai) felvétel
        media: { src: '/assets/img/ajandek/magyarazo-selfcare-pihenes.jpg', alt: 'Csukott szemmel, nyugodtan pihenő vendég a Head Spa arany zuhanyíve alatt a MOSAIC-ban', w: 1000, h: 1067, poz: '50% 38%',
          forras: 'Drive: "Self care headspa+ajikártya.mp4" (MOSAIC hirdetési videó), az 5,2. másodperc kockája, a felirat feletti sávra vágva' }
      },
      relationship: null, gift_context: 'self_care', occasion: null
    },
    young: {
      variant_id: 'young',
      hero_eyebrow: 'MENTÁLIS RESET ÉS GLOW UP',
      hero_title: 'Ajándékozz egy szünetet a zajból, amitől a haj is tökéletes lesz.',
      hero_subtitle: 'Head Spa ajándékkártya barátnőnek, tesónak vagy magadnak: 80 perc offline nyugalom, a végén profi hajszárítással.',
      hero_cta: 'Glow up ajándékot választok',
      // hajmosas es fejmasszazs (reset) -> a profi hajszaritas utani fodrok (glow up): a "szöveg nélkül.mp4" szakaszai
      hero_media: { src: '/assets/img/ajandek/hero-fiatalok.jpg', alt: 'Hajmosás a MOSAIC Head Spa-ban, majd a kész, hullámos haj', video: { src: '/assets/video/ajandek-hero-fiatalok.mp4' },
        forras: 'ajandek-headspa.mp4 (szöveg nélkül.mp4): hajmosás, fejmasszázs, hajformázás és a kész frizura', status: 'APPROVED_BY_VISUAL_REVIEW' },
      gift_finder_preselect: 'egyedul',
      product_order: ['egyeni', '4kezes', 'paros'],
      vendeg_sorrend: ['zsoka', 'zita', 'kinga', 'dori'],
      first_proof_javaslat: { forras: 'Headspa testimonial pool — fiatal vendég', status: 'NEEDS_MANUAL_VALIDATION', validalas: 'Csak valós, fiatal vendég saját szavai szerepelhetnek; életkort nem állítunk.' },
      featured_proof: 'general',
      reassurance: 'Egyéni kártya egy főnek, páros kártya, ha együtt mennétek.',
      objection_title: null, objection_body: null,
      magyarazo: {
        felcim: 'FIATALOKNAK',
        cim: 'Ajándékozd a tökéletes mentális reset és glow up élményét',
        szovegek: [
          'Munka, tanulás, értesítések, közösségi média: a fejünk szinte sosem pihen. A Head Spa-n végre minden kikapcsol: fekszel csukott szemmel, és csak a meleg víz meg a masszázs számít.',
          'Ez a mentális reset. A glow up pedig a végén jön: a profi hajszárítás után puha, fényes, rendezett a haj, és jó vele kilépni a világba.',
          'Ajándékozd a legjobb barátnődnek, a tesódnak vagy akár magadnak: egyéni kártya, vagy páros, ha együtt mennétek.'
        ],
        pontok: ['Offline nyugalom: fej-, arc- és nyakmasszázs, gőzölés', 'Profi hajszárítás: puha, fényes, rendezett haj', 'Egyéni vagy páros kártya, digitálisan is, 6 hónapig felhasználható'],
        media: { src: '/assets/img/ajandek/magyarazo-fiatalok.jpg', alt: 'Selymes, fényes, hullámos haj a Head Spa és a hajszárítás után', w: 760, h: 1014, poz: '50% 40%',
          forras: 'a MOSAIC fotója (galeria-10: selymes, fényes haj a Head Spa után), kicsinyítve' }
      },
      relationship: 'recipient_young', gift_context: 'young', occasion: null
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

  // A regi (Wixes) ajandekkartya-oldalak cimeit az uj oldal veszi at (a tulajdonos kerese, 2026-10-04): a cim dönti el az alapertelmezett
  // variantot (message-match), az elore kijelolt elmenyt es az alkalmat. Az URL-parameterek (?variant=, ?occasion=) felulirjak.
  // 2026-10-09 (a tulajdonos kerese): MINDEN persona-oldal az uj formatumot kapja, sajat varianssal (hero-video + magyarazo-szekcio); a harom korabbi,
  // hirdetesi (Wixes, majd ujrastilusozott) oldal - ezo, self-care, fiataloknak - is ide kerult (a regi peldany a rejtett "-regi" cimen megmarad).
  var OLDAL_ALAPERTEK = {
    '/headspa-ajandekkartya': { variant: 'general' },
    '/4-kezes-headspa-ajandekkartya': { variant: 'general', termek: '4kezes' },
    '/ajandekkartya-szulinapra': { variant: 'birthday', alkalom: 'szuletesnap' },
    '/ajandekkartya-ugc': { variant: 'general' },
    '/headspa-ajandekkartya-anyukaknak': { variant: 'mother' },
    '/headspa-ajandekkartya-noknek': { variant: 'for_her' },
    '/headspa-paros-csajos-ajandekkartya': { variant: 'friend' },
    '/japan-headspa-ajandekkartya': { variant: 'japan' },
    '/headspa-ajándékkártya-ezo': { variant: 'esoteric' },       // ekezetes cim: a bongeszo %-kodoltan adja (oldalAlapertek dekodolja)
    '/headspa-self-care': { variant: 'self_care' },
    '/headspa-ajandakkartya-fiataloknak': { variant: 'young' }
  };
  function oldalAlapertek(ut) {
    var nyers = String(ut == null ? '' : ut);
    // az ekezetes cimeket (headspa-ajándékkártya-ezo) a bongeszo location.pathname-je %-kodoltan adja: dekodoljuk, es NFC-re hozzuk
    try { nyers = decodeURIComponent(nyers); } catch (e) { /* hibas %-kodolas: a nyers szoveggel dolgozunk */ }
    if (nyers.normalize) nyers = nyers.normalize('NFC');
    var kulcs = nyers.replace(/\/+$/, '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(OLDAL_ALAPERTEK, kulcs) ? OLDAL_ALAPERTEK[kulcs] : {};
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

  // A SZAMLA SORAI (Stripe-szamla -> szamlabridge -> szamlazz.hu), termekenkent: PONTOSAN azok a tetelnevek, osszegek es Stripe-adokodok,
  // amelyeket a regi Stripe-fizetolinkek hasznaltak (a tulajdonos szamlai: E-BIG-2026-3184 egyeni, E-BIG-2026-3139 4 kezes, 2026-10-04).
  // A sorok osszege = a termek ara (teszt vedi). adokod: txcd_20040009 = 27%-os, brutto arba szamitva (Stripe Tax); txcd_00000000 = nem
  // adozo tetel: a szamlabridge a kapcsolat alapertelmezett adokodjara (TAM, targyi adomentes) forditja. afa: a szalon-level szovege.
  var SZAMLA_TETELEK = {
    egyeni: [
      { nev: 'Egyéni Headspa Ajándékkártya 20% kedvezménnyel - 50+30 perces', ft: 26900, adokod: 'txcd_20040009', afa: '27%' }
    ],
    paros: [
      { nev: 'MOSAIC Headspa Ajándékkártya 20% kedvezménnyel - 50+30 perces Páros', ft: 53800, adokod: 'txcd_20040009', afa: '27%' }
    ],
    '4kezes': [
      { nev: "4 kezes Headspa Ajándékkártya - 50+30 perces (8695'03) - Az Áfa tv. 85.§ (1) b) pont alapján adómentes szolgáltatás", ft: 15000, adokod: 'txcd_00000000', afa: 'TAM (tárgyi adómentes)' },
      { nev: '4 kezes Headspa Ajándékkártya - 50+30 perces (9623)', ft: 24900, adokod: 'txcd_20040009', afa: '27%' }
    ]
  };
  function szamlaTetelek(id) { return Object.prototype.hasOwnProperty.call(SZAMLA_TETELEK, id) ? SZAMLA_TETELEK[id] : null; }

  // A FIZETESI MODOK: a Payment Element (kliens) es a PaymentIntent / Stripe-szamla (szerver) UGYANAZT az explicit listat kapja. A valodi Stripe.js ugyanis
  // hibaval all le ("Payment details were collected through Stripe Elements using automatic payment methods and cannot be confirmed through the API
  // configured with payment_method_types"), ha a dinamikus Element explicit mod-listas PaymentIntentet kap (a Stripe-szamla PI-je mindig explicit listas).
  // Google Pay / Apple Pay a "card" resze. A lista a Stripe szamla-sablonjanak alapertelmezesevel is egyezik (card, revolut_pay).
  var FIZETESI_MODOK = ['card', 'revolut_pay'];

  g.AJANDEK_ADAT = {
    FIZETESI_MODOK: FIZETESI_MODOK,
    SZAMLA_TETELEK: SZAMLA_TETELEK,
    szamlaTetelek: szamlaTetelek,
    TERMEKEK: TERMEKEK,
    OLDAL_ALAPERTEK: OLDAL_ALAPERTEK,
    oldalAlapertek: oldalAlapertek,
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
