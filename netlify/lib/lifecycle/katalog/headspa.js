// HeadSpa - booking-to-show uzenetlanc (MOSAIC_booking_to_show_lifecycle_2026-10-07.pdf, 3. fejezet). A szoveg a dokumentum szerint, szo szerint.
// A katalogus-formatum leirasa: netlify/lib/lifecycle/katalog/SEMA.md. MINTA a tobbi uzletagnak.
export default {
  uzletag: 'headspa',
  uzenetek: [
    {
      id: 'HS-SMS-01', csatorna: 'sms', mikor: { tipus: 't0' },
      szoveg: 'Szia {keresztnév}! Megvan a HeadSpa időpontod: {dátum} {időpont}, {szolgáltatás}. Cím: MOSAIC, 1023 Budapest, Bécsi út 2. Részletek vagy módosítás: {foglalás_részletei_link}. Várunk!',
    },
    {
      id: 'HS-EMAIL-01', csatorna: 'email', mikor: { tipus: 't0' },
      targy: 'Megvan a HeadSpa időpontod - {dátum} {időpont}',
      elotag: 'Minden fontos részlet egy helyen, hogy tényleg csak meg kelljen érkezned.',
      torzs: [
        'Szia {keresztnév}!',
        'Megvan az időpontod, örülünk, hogy minket választottál. Innentől nincs más dolgod, csak megérkezni.',
        'A foglalásod:',
        { doboz: ['{szolgáltatás}', '{dátum}, {időpont}', '{munkatárs}', 'Várható helyszíni idő: {várható_időtartam}', 'Cím: 1023 Budapest, Bécsi út 2.'] },
        'A legtöbb 50 perces HeadSpa kezelés után 30 perc kímélő hajszárítás következik, ezért érdemes 80-90 perccel számolnod. Ha Hair HeadSpára foglaltál, a kezelés mikrokamerás fejbőrvizsgálattal indul, és ez alapján választjuk ki a kezeléshez illő ápolást.',
        'Nem kell semmit hoznod. Érkezz kb. 10 perccel korábban, hogy kényelmesen megérkezz. A GPS-be mindenképp ezt írd: 1023 Budapest, Bécsi út 2.',
        'Parkolás: a Bécsi úton a 0202-es parkolási zónában, vagy a szalonnal szemben a ParkL parkolóban, Bécsi út 11.',
        'Ha közben változna valami, itt tudod megnézni vagy módosítani a foglalásodat:',
        { gomb: { felirat: 'Foglalás megtekintése / módosítása', link: '{foglalás_részletei_link}' } },
        'Szeretettel várunk,',
        { alairas: 'MOSAIC Head Spa and Hair' },
      ],
    },
    {
      id: 'HS-EMAIL-02', csatorna: 'email', mikor: { tipus: 'tartalom', utan_napok: 2, min_lead_nap: 5 }, sorrend: 1,
      targy: 'Így fog telni a HeadSpa időd',
      elotag: 'Megérkezés, kezelés, szárítás - pontosan mire számíthatsz.',
      torzs: [
        'Szia {keresztnév}!',
        'Ha még nem voltál HeadSpán, valószínűleg nehéz pontosan elképzelni, mi történik majd. Ezért röviden megmutatjuk.',
        { kep: { src: 'headspa/megerkezes-recepcio.jpg', alt: 'A MOSAIC váró- és recepciós tere zöld bársonyfotelekkel, meleg fényekkel' } },
        'Amikor megérkezel, nem kell sietned. Leülsz, átbeszéljük, mire van szükséged, és a foglalt kezelésed szerint elindul a HeadSpa.',
        'A kezelés alatt a hangsúly a lassú, nyugodt ritmuson van: tisztítás, ápolás és masszázs. Hair HeadSpánál előtte mikrokamerával is megnézzük a fejbőröd állapotát.',
        {
          kepek: [
            { src: 'headspa/kezeles-mikrokamera.jpg', alt: 'Mikrokamerás fejbőrvizsgálat: a vendég fekszik, a kezelő a fejbőrön vezeti a kamerát, a tableten látszik a kép', felirat: 'Mikrokamera · Hair HeadSpa' },
            { src: 'headspa/kezeles-hajmosas.jpg', alt: 'A haj a HeadSpa kezelőágy körvízsugara alatt, hajmosás közben', felirat: 'Hajmosás' },
            { src: 'headspa/kezeles-masszazs.jpg', alt: 'Egy vendég ellazulva fekszik a kezelőágyon, a masszőr két kézzel masszírozza', felirat: 'Masszázs' },
          ],
        },
        'A végén nem vizes hajjal engedünk el: a hajszárítás a szolgáltatás része, így rendezett hajjal tudsz továbbindulni.',
        { kep: { src: 'headspa/hajszaritas.jpg', alt: 'A MOSAIC munkatársa mosolyogva hajszárítóval szárítja a vendég haját', felirat: 'Hajszárítás a kezelés végén' } },
        { velemeny: 'hs-henriett' },
        { ertekeles: true },
        'Ha szeretnéd már most látni, milyen a hangulat, itt van egy rövid videó:',
        { video: { src: 'headspa/video-fejmasszazs.jpg', alt: 'Videó-előkép: fejmasszázs eszközökkel a MOSAIC kezelőágyán, lejátszás jellel', felirat: 'Fejmasszázs eszközökkel · 0:36', link: '{videó_link}' } },
        { gomb: { felirat: 'Megnézem a videót', link: '{videó_link}' } },
        'Nemsokára találkozunk.',
        { alairas: 'MOSAIC Head Spa and Hair' },
      ],
    },
    {
      id: 'HS-EMAIL-03', csatorna: 'email', mikor: { tipus: 'tartalom', elott_napok: 7, min_lead_nap: 21 }, sorrend: 2,
      targy: 'Egy kis előzetes a HeadSpa időpontodhoz',
      elotag: 'Nem kell készülnöd - csak érkezz meg.',
      torzs: [
        'Szia {keresztnév}!',
        'Még van egy kis idő az időpontodig, ezért nem újabb "reklámot" küldünk - csak egy dolgot szeretnénk: hogy már előre jó érzés legyen rá gondolnod.',
        { kep: { src: 'headspa/hero-ellazulas.jpg', alt: 'Egy vendég lehunyt szemmel pihen a HeadSpa kezelés alatt, a masszőr fejbőrmasszázs-eszközzel dolgozik' } },
        'A HeadSpa nem teljesítmény. Nem kell semmire készülnöd, semmit nem kell jól csinálnod. Az egész alkalom arról szól, hogy egy időre ne neked kelljen figyelni másokra.',
        { velemeny: 'hs-anett' },
        { velemeny: 'hs-melinda' },
        { ertekeles: true },
        'Ha kíváncsi vagy, milyen élménnyel mennek haza mások, itt megnézhetsz néhány valódi vendégvideót:',
        {
          kepek: [
            { src: 'headspa/vendegvideo-01.jpg', alt: 'Vendégvideó előképe: egy vendég a MOSAIC-ban mesél a HeadSpa élményéről, lejátszás jellel' },
            { src: 'headspa/vendegvideo-02.jpg', alt: 'Vendégvideó előképe: egy vendég a HeadSpa kezelés közben, lejátszás jellel' },
            { src: 'headspa/vendegvideo-03.jpg', alt: 'Vendégvideó előképe: egy másik vendég mesél a MOSAIC-ban szerzett élményéről, lejátszás jellel' },
          ],
        },
        { gomb: { felirat: 'Megnézem a vendégvideókat', link: '{eredmények_link}' } },
        'A te időpontod továbbra is: {dátum} {időpont}.',
        'Várunk,',
        { alairas: 'MOSAIC Head Spa and Hair' },
      ],
    },
    {
      id: 'HS-SMS-02', csatorna: 'sms', mikor: { tipus: 't72' },
      szoveg: 'Szia {keresztnév}! 3 nap múlva, {nap} {időpont}-kor várunk HeadSpára. Ha jössz, erősítsd meg itt: {megerősítés_link}. Ha változott valami, itt tudod áttenni az időpontot: {módosítás_link}. MOSAIC',
    },
    {
      id: 'HS-SMS-03', csatorna: 'sms', mikor: { tipus: 't24' },
      szoveg: 'Szia {keresztnév}! Holnap {időpont}-kor várunk a MOSAIC-ban. Érkezz kb. 10 perccel korábban. GPS: 1023 Budapest, Bécsi út 2. Parkolás: Bécsi út (0202) vagy ParkL, Bécsi út 11. Tervezz kb. 80-90 percet. Várunk!',
    },
    {
      // HS-CALL-01: telefonos feladat a szalonnak (a motor nem hiv, hanem belso e-mailben jelzi, kit kell hivni)
      id: 'HS-CALL-01', csatorna: 'feladat', mikor: { tipus: 'feladat', elott_ora: 48 }, szegmensek: ['paros', 'negykezes'],
      targy: 'HeadSpa - hívandó vendég (max. 90 mp)',
      torzs: [
        'Szia {keresztnév}, a MOSAIC HeadSpától hívlak. {nap} {időpont}-ra van időpontod {szolgáltatás}-ra, csak szeretném megerősíteni, hogy minden rendben van-e.',
        'Röviden: a kezelésed {várható_időtartam}; a legtöbb 50 perces HeadSpa után 30 perc kímélő hajszárítás is van. Nem kell semmit hoznod.',
        'A Bécsi út 2.-ben várunk, kérlek érkezz kb. 10 perccel korábban. Van bármi kérdésed, amire jó lenne előre válaszolnunk?',
        'Ha mégis közbejönne valami, szólj minél előbb, és segítünk áttenni az időpontot.',
      ],
    },
  ],
};
