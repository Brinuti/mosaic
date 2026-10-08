// Lezeres szortelenites - booking-to-show uzenetlanc (MOSAIC_booking_to_show_lifecycle_2026-10-07.pdf, 6. fejezet). A szoveg a dokumentum szerint, szo szerint.
// A katalogus-formatum leirasa: netlify/lib/lifecycle/katalog/SEMA.md. Az eltereseket a megjegyzesek tomb sorolja fel.
export default {
  uzletag: 'laser',
  uzenetek: [
    {
      id: 'LASER-SMS-01', csatorna: 'sms', mikor: { tipus: 't0' },
      szoveg: 'Szia {keresztnév}! Megvan az időpontod: {dátum} {időpont}, {szolgáltatás}. MOSAIC, 1023 Budapest, Bécsi út 2. Részletek/módosítás: {foglalás_részletei_link}.',
    },
    {
      // T0 - uj konzultacio / elso kezeles. Ha a foglalas < 30 orara van az idopontig, a kritikus elokeszulet ide kerul (surgos_kiegeszites).
      id: 'LASER-EMAIL-01', csatorna: 'email', mikor: { tipus: 't0' }, szegmensek: ['konzultacio', 'elso'],
      targy: 'Megvan a lézeres időpontod - itt a lényeg',
      elotag: 'Személyre szabott beállítás, alkalmankénti fizetés, pontos felkészítés.',
      torzs: [
        'Szia {keresztnév}!',
        'Megvan az időpontod: {dátum} {időpont}, {szolgáltatás}.',
        'Az első alkalomnál nem sablonbeállítással kezdünk. Megnézzük a bőr- és szőrtípusodat, átbeszéljük a fontos körülményeket, és ehhez igazítjuk a kezelést.',
        'Ha közvetlenül kezelésre foglaltál, az aktuális MOSAIC program lényege:',
        {
          lista: [
            'legfeljebb 8 alkalom;',
            'a 4. és a 8. alkalom ajándék;',
            'alkalmanként fizetsz, nem kell előre több százezer forintot kifizetned;',
            'a programhoz 12 hónapos MOSAIC garancia tartozik a mindenkori feltételek szerint.',
          ],
        },
        'A te foglalásod ára: {aktuális_ár}.',
        'A pontos előkészületi tudnivalókat külön is elküldjük. Addig a legfontosabb: a kúra alatt ne gyantázd és ne epiláld a kezelt területet.',
        'Foglalás részletei / módosítás:',
        { gomb: { felirat: 'Foglalás megtekintése / módosítása', link: '{foglalás_részletei_link}' } },
        'Várunk,',
        { alairas: 'MOSAIC Head Spa and Hair' },
      ],
      // a LASER-EMAIL-04 kritikus elokeszuleti listaja: a T0 e-mail vegere kerul, ha a foglalas < 30 orara van az idopontig
      surgos_kiegeszites: [
        'Ahhoz, hogy aznap biztonságosan és időben tudjunk kezelni, kérjük figyelj ezekre:',
        {
          szamozott: [
            'A kezelendő területet kb. 24 órával előtte borotváld le.',
            'A kezelés előtti 2 hétben kerüld a napozást, szoláriumot és önbarnítót az érintett területen.',
            'A kúra alatt ne gyantázz és ne epilálj, mert a lézernek szüksége van a szőrtüszőre.',
            'A kezelés napján az érintett területen ne legyen krém, olaj vagy dezodor.',
            'Ha új gyógyszert kezdtél, egészségügyi állapotod változott vagy friss barnulásod van, jelezd nekünk előre: 06 20 247 4444.',
          ],
        },
      ],
    },
    {
      // T+1..3 nap, 5+ nap lead time, uj vendeg
      id: 'LASER-EMAIL-02', csatorna: 'email', mikor: { tipus: 'tartalom', utan_napok: 2, min_lead_nap: 5 }, szegmensek: ['konzultacio', 'elso'], sorrend: 1,
      targy: 'Nálad mitől lesz jó választás a lézer?',
      elotag: 'Nem mindenkinek ugyanaz a beállítás és ugyanaz a kezelési út.',
      torzs: [
        'Szia {keresztnév}!',
        { kep: { src: 'laser/kezelohelyiseg.jpg', alt: 'A MOSAIC lézeres kezelőhelyisége: kezelőágy és az Elysion Pro lézer', felirat: 'A kezelőhelyiség az Elysion Pro lézerrel' } },
        'A lézeres szőrtelenítésnél az egyik legfontosabb kérdés nem az, hogy "mennyire erős a gép", hanem hogy a te bőr- és szőrtípusodhoz hogyan használjuk.',
        'Az első alkalom előtt ezért megnézzük a kezelendő területet, a bőröd és a szőröd jellemzőit, és ez alapján állítjuk be az Elysion Pro kezelést.',
        // Zsófi az egyetlen lezeres kezelo (a lezeres oldal: "Zsófival fogsz találkozni"); a Salonic munkatars-neve itt "Elysion Pro Szőrtelenítés" (a motor kiszűri), ezert nincs ha_munkatars feltetel
        { szemely: { src: 'laser/zsofi-portre.jpg', nev: 'Zsófi', szerep: 'Elysion Pro szakértő', szoveg: 'Vele találkozol nálunk: minden vendégnek személyre szabott kezelést állít össze.' } },
        'Nem mindenkinél ugyanaz a reakció és ugyanannyi alkalom reális. Világosabb szőr, friss barnulás, hormonális háttér, bizonyos egészségügyi állapotok vagy gyógyszerek esetén különösen fontos az előzetes egyeztetés.',
        'Ha bizonytalan vagy valamiben, inkább mondd el előre - nem az a cél, hogy mindenáron kezeljünk, hanem hogy biztonságosan és értelmesen induljon el a program.',
        { kep: { src: 'laser/zsofi-konzultacio.jpg', alt: 'Zsófi mosolyogva beszélget egy vendéggel a konzultáción', felirat: 'Zsófi konzultáció közben egy vendéggel' } },
        'A te időpontod: {dátum} {időpont}.',
        { ertekeles: true },
        { alairas: 'MOSAIC Head Spa and Hair' },
      ],
    },
    {
      // T-7..5 nap, 10+ nap lead time, uj elso kezeles
      id: 'LASER-EMAIL-03', csatorna: 'email', mikor: { tipus: 'tartalom', elott_napok: 6, min_lead_nap: 10 }, szegmensek: ['elso'], sorrend: 2,
      targy: '8 alkalom, de csak 6 fizetős - pontosan mit jelent?',
      elotag: 'Nincs nagy előrefizetés: alkalmanként fizetsz.',
      torzs: [
        'Szia {keresztnév}!',
        'Egy gyors pontosítás a MOSAIC 8 alkalmas programjáról, mert elsőre könnyű félreérteni.',
        'Nem 8 alkalmat fizetsz ki előre. A 4. és a 8. alkalom ajándék, vagyis egy teljes 8 alkalmas programból 6 fizetős. Ráadásul alkalmanként fizetsz.',
        'A program legfeljebb 8 alkalommal számol. Ha nálad kevesebb is elég, a jelenlegi ajánlat logikája szerint kevesebbet fizetsz. Az első alkalommal a bőr- és szőrtípusod alapján becsüljük meg, milyen kezelési út reális.',
        // valodi vendegek, ugyanazok a kepek, mint a lezeres oldal "Ilyen eredmenyeket erhetsz el" szakaszaban
        {
          kepek: [
            { src: 'laser/eredmeny-honalj.jpg', alt: 'Hónalj lézeres szőrtelenítés előtt (bal) és után (jobb) - valódi MOSAIC vendég', felirat: 'Hónalj – valódi vendég előtte és utána. Az eredmény egyénenként eltérő.' },
            { src: 'laser/eredmeny-labszar.jpg', alt: 'Lábszár lézeres szőrtelenítés előtt (bal) és után (jobb) - valódi MOSAIC vendég', felirat: 'Lábszár – valódi vendég előtte és utána. Az eredmény egyénenként eltérő.' },
          ],
        },
        'Ha szeretnél valódi MOSAIC előtte-utána eredményeket látni ugyanarról a területről, itt találod őket:',
        { gomb: { felirat: 'Megnézem az eredményeket', link: '{eredmények_link}' } },
        'Nemsokára találkozunk.',
        { alairas: 'MOSAIC Head Spa and Hair' },
      ],
    },
    {
      // T-72 - kritikus elokeszulet (uj vendeg; konzultacional is)
      id: 'LASER-EMAIL-04', csatorna: 'email', mikor: { tipus: 't72' }, szegmensek: ['konzultacio', 'elso'],
      targy: '5 dolog, amin múlik, hogy aznap tudjunk kezelni',
      elotag: 'A borotválástól a napozásig - rövid, fontos lista.',
      torzs: [
        'Szia {keresztnév}!',
        { kep: { src: 'laser/varo-recepcio.jpg', alt: 'A MOSAIC váró- és recepciós tere zöld bársonyfotelekkel és a MOSAIC emblémával', felirat: 'A MOSAIC váró- és recepciós tere' } },
        '3 nap múlva találkozunk. Ahhoz, hogy aznap biztonságosan és időben tudjunk kezelni, kérjük figyelj ezekre:',
        {
          szamozott: [
            'A kezelendő területet kb. 24 órával előtte borotváld le.',
            'A kezelés előtti 2 hétben kerüld a napozást, szoláriumot és önbarnítót az érintett területen.',
            'A kúra alatt ne gyantázz és ne epilálj, mert a lézernek szüksége van a szőrtüszőre.',
            'A kezelés napján az érintett területen ne legyen krém, olaj vagy dezodor.',
            'Ha új gyógyszert kezdtél, egészségügyi állapotod változott vagy friss barnulásod van, jelezd nekünk előre: 06 20 247 4444.',
          ],
        },
        'Ha csak az időpont nem jó, itt tudod áttenni:',
        { gomb: { felirat: 'Itt tudom áttenni', link: '{módosítás_link}' } },
        'Várunk,',
        { alairas: 'MOSAIC Head Spa and Hair' },
      ],
    },
    {
      id: 'LASER-SMS-02', csatorna: 'sms', mikor: { tipus: 't72' }, szegmensek: ['konzultacio', 'elso'],
      szoveg: 'Szia {keresztnév}! 3 nap múlva {időpont}-kor várunk {szolgáltatás}-ra. Ha jössz: {megerősítés_link}. Ha változott valami: {módosítás_link}. A részletes előkészületet e-mailben is elküldtük. MOSAIC',
    },
    {
      // a visszatérő kúravendég nem kap T-72 e-mailt (LASER-EMAIL-04 csak új vendégnek): nála a mondat az e-mailről kimarad
      id: 'LASER-SMS-02B', csatorna: 'sms', mikor: { tipus: 't72' }, szegmensek: ['visszatero'],
      szoveg: 'Szia {keresztnév}! 3 nap múlva {időpont}-kor várunk {szolgáltatás}-ra. Ha jössz: {megerősítés_link}. Ha változott valami: {módosítás_link}. MOSAIC',
    },
    {
      id: 'LASER-SMS-03', csatorna: 'sms', mikor: { tipus: 't24' },
      szoveg: 'Szia {keresztnév}! Holnap {időpont}-kor várunk. A terület legyen leborotválva; ne legyen friss barnulás/önbarnító, és aznap ne használj krémet, olajat vagy dezodort rajta. Kérdés: 06 20 247 4444. MOSAIC',
    },
    {
      // LASER-CALL-01: telefonos feladat a szalonnak (a motor nem hiv, hanem belso e-mailben jelzi, kit kell hivni)
      id: 'LASER-CALL-01', csatorna: 'feladat', mikor: { tipus: 'feladat', elott_ora: 48 }, szegmensek: ['konzultacio', 'elso'],
      targy: 'Lézeres szőrtelenítés - hívandó vendég (pre-call)',
      torzs: [
        'Szia {keresztnév}, a MOSAIC lézeres szőrtelenítéstől hívlak. {nap} {időpont}-ra van időpontod {szolgáltatás}-ra. Minden rendben az időponttal?',
        'Melyik területre jössz? Azért kérdezem, hogy biztosan a megfelelő előkészülettel érkezz.',
        'Ha aznap kezelés is szóba jöhet, kérlek előző este borotváld le a területet, és ne legyen friss barnulás vagy önbarnító. Gyanta/epilátor ne legyen a kúra alatt.',
        'Volt mostanában új gyógyszer, egészségügyi változás vagy bármi, ami miatt szerinted érdemes előre rákérdezni? Ha igen, inkább egyeztetünk a kezelővel.',
        'Van még valami kérdésed az első alkalom előtt?',
      ],
    },
  ],
  megjegyzesek: [
    'Szegmensek: A. konzultacio, B. elso, C. visszatero ("Nurture nélkül: confirmation + T-72 + T-24"): a visszatérő vendég csak a LASER-SMS-01, LASER-SMS-02 és LASER-SMS-03 üzenetet kapja (az e-mailek és a hívás konzultacio/elso szűrőjűek).',
    'LASER-EMAIL-01: kihagyva a "az első kezelésre jelenleg 20% kedvezmény jár;" lista-sor (fix százalék tilos; a dokumentum szerint az ajánlat csak a központi forrásból mehet).',
    'LASER-EMAIL-01: az "A te foglalásod ára: {aktuális_ár}." sor átvéve (a motor kihagyja, ha nincs garantált ár); a "Foglalás részletei / módosítás:" + önálló sorban álló link = bevezető mondat + gomb.',
    'LASER-EMAIL-01 surgos_kiegeszites: a LASER-EMAIL-04 számozott 5 pontja ugyanazzal a szöveggel; a bevezető mondatból a "3 nap múlva találkozunk." rész kimaradt (T0-ban a foglalás kevesebb mint 30 órával az időpont előtt jött, ezért nem lenne igaz).',
    'LASER-EMAIL-01 és LASER-EMAIL-03: a fix ajánlat-elemek (legfeljebb 8 alkalom, a 4. és 8. alkalom ajándék, 8-ból 6 fizetős, alkalmankénti fizetés, 12 hónapos garancia) szövegesen maradtak, mert nem összeg/százalék; a dokumentum forrászára szerint viszont csak addig szerepelhetnének, amíg a központi ajánlatforrás szerint aktívak (a motorban jelenleg nincs ilyen forrás).',
    'LASER-EMAIL-02: "T+1..3 nap" -> utan_napok 2, min_lead_nap 5 ("5+ nap lead time"), szegmensek konzultacio/elso ("új vendég"), sorrend 1. LASER-EMAIL-03: "T-7..5 nap" -> elott_napok 6, min_lead_nap 10 ("10+ nap lead time"), szegmens elso ("új első kezelés"), sorrend 2.',
    'LASER-EMAIL-03: a gomb felirata "Megnézem az eredményeket"; az önálló soros {eredmények_link} elé tartozó mondat külön bekezdés.',
    'LASER-EMAIL-04 (T-72) és a LASER-SMS-02 egy időpontban megy; a LASER-SMS-02 "A részletes előkészületet e-mailben is elküldtük." mondata visszatérő vendégnél nem lenne igaz (nekik nincs LASER-EMAIL-04), a szöveg ennek ellenére a dokumentum szerinti.',
    'LASER-CALL-01: a dokumentum "új vendég vagy T-72 non-responder" triggeréből csak az új vendég (konzultacio/elso) szűrő modellezhető; a T-72 meg nem erősítő vendégek külön nincsenek megkülönböztetve. Időzítés: T-24..48 -> elott_ora 48.',
    'Az "Aktuális példák" blokk forint-árai és a "fenntartó kezelés 50% kedvezménnyel" sor nem üzenet-szöveg, ezért nem kerültek be.',
  ],
};
