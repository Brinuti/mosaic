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
        'A legtöbb 50 perces HeadSpa kezelés után 30 perc kímélő hajszárítás következik, ezért érdemes 80-90 perccel számolnod.',
        'Nem kell semmit hoznod. Érkezz kb. 10 perccel korábban, hogy kényelmesen megérkezz. A GPS-be mindenképp ezt írd: 1023 Budapest, Bécsi út 2.',
        'Parkolás: a Bécsi úton a 0202-es parkolási zónában, vagy a szalonnal szemben a ParkL parkolóban, Bécsi út 11.',
        'Kérlek, mielőtt jössz, nézd meg ezt a rövid videót a legfontosabb tudnivalókról (kb. 2 perc):',
        { video: { src: 'headspa/tudnivalok-video.jpg', alt: 'Videó-előkép: a MOSAIC tulajdonosa a HeadSpa előtti legfontosabb tudnivalókról mesél, lejátszás jellel', felirat: 'A legfontosabb tudnivalók · 2:02', link: 'https://www.mosaicheadspa.hu/assets/video/c2eb0f_7adace486fb24a859b80f61510e8e675.mp4', szelesseg: 260 } },
        'Ha közben változna valami, itt tudod megnézni vagy módosítani a foglalásodat:',
        { gomb: { felirat: 'Foglalás megtekintése / módosítása', link: '{foglalás_részletei_link}' } },
        'Szeretettel várunk,',
      ],
    },
    {
      id: 'HS-EMAIL-02', csatorna: 'email', mikor: { tipus: 'tartalom', utan_napok: 2, min_lead_nap: 5 }, sorrend: 1,
      targy: 'Így fog telni a HeadSpa időd',
      elotag: 'Megérkezés, kezelés, szárítás - pontosan mire számíthatsz.',
      torzs: [
        'Szia {keresztnév}!',
        'Ha még nem voltál HeadSpán, valószínűleg nehéz pontosan elképzelni, mi történik majd. Ezért röviden megmutatjuk.',
        { kep: { src: 'headspa/megerkezes-recepcio.jpg', alt: 'A MOSAIC recepciós pultja a logóval, arany macskaszoborral és meleg fényekkel' } },
        'Amikor megérkezel, nem kell sietned. Leülsz, átbeszéljük, mire van szükséged, és a foglalt kezelésed szerint elindul a HeadSpa.',
        'A kezelőhelyiség már önmagában megnyugtat: lágy fények, meleg színek, csend. A kezelés alatt a hangsúly a lassú, nyugodt ritmuson van: tisztítás, ápolás és masszázs.',
        {
          kepek: [
            { src: 'headspa/kezelohelyiseg.jpg', alt: 'A MOSAIC HeadSpa kezelőhelyisége: gyertyák, lágy kék és lila fények, a vendég ellazulva fekszik', felirat: 'A kezelőhelyiség' },
            { src: 'headspa/kezeles-hajmosas.jpg', alt: 'A kezelő kék szilikon fejbőrmasszírozóval masszírozza a vendég fejbőrét a HeadSpa mosóágyon, hajmosás közben', felirat: 'Hajmosás' },
            { src: 'headspa/kezeles-masszazs.jpg', alt: 'Egy vendég ellazulva fekszik, a masszőr két kézzel masszírozza a fejét és az arcát', felirat: 'Masszázs' },
          ],
        },
        'Ha szeretnéd látni, hogyan néz ki egy teljes HeadSpa kezelés, nézd meg ezt a rövid videót:',
        { video: { src: 'headspa/video-teljes-kezeles.jpg', alt: 'Videó-előkép: a teljes MOSAIC HeadSpa élmény fejbőrmasszázzsal, lejátszás jellel', felirat: 'A teljes HeadSpa élmény · 1:00', link: '{videó_link}', szelesseg: 240 } },
        'A végén nem vizes hajjal engedünk el: a hajszárítás a szolgáltatás része, így rendezett hajjal tudsz továbbindulni.',
        { kep: { src: 'headspa/hajszaritas.jpg', alt: 'A MOSAIC munkatársa mosolyogva hajszárítóval szárítja a vendég haját', felirat: 'Hajszárítás a kezelés végén' } },
        { velemeny: 'hs-henriett' },
        { ertekeles: true },
        'Nemsokára találkozunk.',
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
            { src: 'headspa/vendegvideo-01.jpg', alt: 'Vendégvideó előképe: egy vendég a MOSAIC-ban mesél a HeadSpa élményéről, lejátszás jellel', link: '{eredmények_link}' },
            { src: 'headspa/vendegvideo-02.jpg', alt: 'Vendégvideó előképe: egy vendég a HeadSpa kezelés közben, lejátszás jellel', link: '{eredmények_link}' },
            { src: 'headspa/vendegvideo-03.jpg', alt: 'Vendégvideó előképe: egy másik vendég mesél a MOSAIC-ban szerzett élményéről, lejátszás jellel', link: '{eredmények_link}' },
          ],
        },
        { gomb: { felirat: 'Megnézem a vendégvideókat', link: '{eredmények_link}' } },
        'A te időpontod továbbra is:',
        { doboz: ['{szolgáltatás}', '{dátum}, {időpont}'] },
        'Várunk,',
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
  ],
};
