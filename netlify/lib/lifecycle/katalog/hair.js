// Fodrazat (hair) - booking-to-show uzenetlanc (MOSAIC_booking_to_show_lifecycle_2026-10-07.pdf, 4. fejezet). A szoveg a dokumentum szerint, szo szerint.
// A katalogus-formatum leirasa: netlify/lib/lifecycle/katalog/SEMA.md. Minta: headspa.js. Az eltereseket a megjegyzesek tomb sorolja fel.
export default {
  uzletag: 'hair',
  uzenetek: [
    {
      id: 'HAIR-SMS-01', csatorna: 'sms', mikor: { tipus: 't0' },
      szoveg: 'Szia {keresztnév}! Megvan az időpontod {fodrász}-hoz: {dátum} {időpont}, {szolgáltatás}. MOSAIC, 1023 Budapest, Bécsi út 2. Részletek/módosítás: {foglalás_részletei_link}.',
    },
    {
      id: 'HAIR-EMAIL-01', csatorna: 'email', mikor: { tipus: 't0' },
      targy: 'Megvan az időpontod {fodrász}-hoz',
      elotag: 'A legfontosabb részletek, és hogyan készülj, hogy tényleg azt kapd, amit szeretnél.',
      torzs: [
        'Szia {keresztnév}!',
        'Megvan az időpontod {fodrász}-hoz.',
        { doboz: ['{szolgáltatás}', '{dátum}, {időpont}', 'Várható idő: {várható_időtartam}', 'Várható ár a foglalás szerint: {aktuális_ár}', 'Helyszín: MOSAIC, 1023 Budapest, Bécsi út 2.'] },
        'Az első pár percben nem "nekiállunk" a hajadnak. Először átbeszélitek, mit szeretnél, megnézitek a hajad jelenlegi állapotát és előzményeit, és csak utána születik meg a közös terv.',
        'Ha festésre, balayage-ra, ombréra vagy melírra jössz, ments el a telefonodba 2-3 képet arról a hangulatról vagy színről, ami tetszik. Nem azért, hogy egy az egyben lemásoljuk, hanem hogy pontosan ugyanarról beszéljetek.',
        'A festések ára a hajhossztól, a kiindulási állapottól és a szükséges anyagmennyiségtől is függhet; ha a foglalásodnál csak "-tól" ár szerepelt, a pontos tervet az elején egyeztetitek.',
        'Foglalásod részletei / módosítás:',
        { gomb: { felirat: 'Foglalás megtekintése / módosítása', link: '{foglalás_részletei_link}' } },
        'Várunk,',
        { alairas: 'MOSAIC Head Spa and Hair' },
      ],
    },
    {
      id: 'HAIR-EMAIL-02', csatorna: 'email', mikor: { tipus: 'tartalom', utan_napok: 2, min_lead_nap: 5 }, sorrend: 1,
      targy: 'Ezt érdemes megmutatnod {fodrász}-nak',
      elotag: '2-3 kép sok félreértést megelőz - de nem másolunk vakon.',
      torzs: [
        'Szia {keresztnév}!',
        'Egy fodrásznál az egyik legfontosabb kérdés: vajon tényleg ugyanazt érti-e a fejében, amit te elképzeltél?',
        'Ezért nálunk az első lépés mindig a megbeszélés. {fodrász} megnézi a hajad kiindulási állapotát, az arcodhoz és a hajadhoz illő lehetőségeket, és csak olyan eredményt terveztek meg, ami a te hajadból reálisan elérhető.',
        'Itt megnézheted {fodrász} releváns munkáit a te foglalt szolgáltatásodhoz:',
        { gomb: { felirat: 'Megnézem a munkákat', link: '{eredmények_link}' } },
        'Ha van 2-3 referenciaképed, tartsd meg őket a telefonodban. A "mit szeretsz rajta?" és a "mit biztosan nem szeretnél?" sokszor többet segít, mint maga a kép.',
        'Találkozunk {dátum_ragos}.',
        { alairas: 'MOSAIC Head Spa and Hair' },
      ],
    },
    {
      id: 'HAIR-EMAIL-03', csatorna: 'email', mikor: { tipus: 'tartalom', elott_napok: 6, min_lead_nap: 10 }, sorrend: 2, szegmensek: ['nagy_valtozas'],
      targy: 'Honnan indulsz, és hova szeretnél eljutni?',
      elotag: 'Nagyobb festésnél ezt a négy dolgot érdemes előre átgondolni.',
      torzs: [
        'Szia {keresztnév}!',
        'A nagyobb színváltozásnál a jó eredmény egyik kulcsa a reális kiindulópont.',
        'A festés előtt {fodrász} megnézi a hajad jelenlegi színét, állapotát és festési múltját. Ha egy elképzelés egy alkalomból biztonságosan nem hozható ki, azt előre elmondjuk, és inkább több lépésben tervezünk, mint hogy a hajad állapotát kockáztassuk.',
        'A te foglalásod: {szolgáltatás}, {dátum} {időpont}.',
        'Ha tudod, gondold át addig:',
        { lista: ['mikor festették utoljára a hajad;', 'otthoni vagy szalonfestés volt-e;', 'van-e olyan árnyalat, amit biztosan nem szeretnél;', 'melyik 2-3 referencia áll hozzád a legközelebb.'] },
        'Ennyi bőven elég. A többit együtt megtervezitek.',
        { alairas: 'MOSAIC Head Spa and Hair' },
      ],
    },
    {
      id: 'HAIR-SMS-02', csatorna: 'sms', mikor: { tipus: 't72' },
      szoveg: 'Szia {keresztnév}! {nap} {időpont}-kor vár {fodrász} a MOSAIC Hairben. Ha jössz, erősítsd meg: {megerősítés_link}. Ha változott valami, itt tudod áttenni: {módosítás_link}.',
    },
    {
      // T-24, vagas / szaritas (a "vagas_kezeles" szegmens: minden, ami nem festes es nem konzultacio)
      id: 'HAIR-SMS-03A', csatorna: 'sms', mikor: { tipus: 't24' }, szegmensek: ['vagas_kezeles'],
      szoveg: 'Szia {keresztnév}! Holnap {időpont}-kor vár {fodrász}. Cím: 1023 Budapest, Bécsi út 2. Ha van 1-2 referenciafotód a kívánt fazonról, hozd a telefonodon. Várunk! MOSAIC Hair',
    },
    {
      // T-24, festes / balayage / konzultacio (a "nagy_valtozas" foglalas mindig "festes" is)
      id: 'HAIR-SMS-03B', csatorna: 'sms', mikor: { tipus: 't24' }, szegmensek: ['festes', 'konzultacio'],
      szoveg: 'Szia {keresztnév}! Holnap {időpont}-kor vár {fodrász}. Ha festésre jössz, legyen a telefonodban 2-3 referencia, és gondold át, mikor/mivel festették utoljára a hajad. 1023 Budapest, Bécsi út 2. Várunk!',
    },
    {
      // HAIR-CALL-01: telefonos feladat a szalonnak (a motor nem hiv, hanem belso e-mailben jelzi, kit kell hivni)
      id: 'HAIR-CALL-01', csatorna: 'feladat', mikor: { tipus: 'feladat', elott_ora: 48 }, szegmensek: ['konzultacio', 'nagy_valtozas'],
      targy: 'Fodrász - hívandó vendég (konzultáció / hosszú első festés)',
      torzs: [
        'Szia {keresztnév}, a MOSAIC Hairtől hívlak. {nap} {időpont}-ra van időpontod {fodrász}-hoz {szolgáltatás}-ra. Minden rendben az időponttal?',
        'Hogy {fodrász} már úgy készüljön, ahogy neked a leghasznosabb: inkább színváltozás, világosítás, vágás vagy teljes átalakulás a cél?',
        'Ha van 2-3 képed, ami tetszik, elég ha magaddal hozod a telefonodon. Ha festésről van szó, jó ha tudod, mikor és mivel volt utoljára festve a hajad.',
        'Ha közben változna valami, szólj minél előbb, és segítünk áttenni.',
      ],
    },
  ],
  megjegyzesek: [
    'HAIR-EMAIL-01: a dokumentum "Várható ár a foglalás szerint: {aktuális_ár}" sora át van véve (a dobozban); a motor kihagyja, amíg nincs garantáltan aktuális ár-forrás (a dokumentum: a konkrét bookingár legyen a forrás, ne ígérjünk fix végösszeget).',
    'Az "Ajánlat- és forrászár" blokk fix "-tól" árai, időtartamai és termék-nevei (Balayage/Ombre/Melír, Hajvágás, Tőfestés, Teljes festés + vágás) NEM kerültek a szövegekbe: csak háttér-információ, az üzenetekben nincs fix összeg.',
    'HAIR-EMAIL-01: a doboz előtt a dokumentum nem ír "A foglalásod:" bevezetőt, ezért nem is adtam hozzá; a doboz a dokumentum sorait tartalmazza (szolgáltatás, dátum/időpont, várható idő, várható ár, helyszín).',
    'HAIR-EMAIL-01: a "ha a foglalásodnál csak "-tól" ár szerepelt" mondat szó szerint megmaradt (nincs benne összeg); akkor is értelmes, ha az {aktuális_ár} sor kimarad.',
    'HAIR-EMAIL-02: a "Találkozunk {dátum}-án." mondat "Találkozunk {dátum_ragos}."-ra cserélve; a "Várunk," záró sor a dokumentumban itt nincs, ezért nincs.',
    'HAIR-EMAIL-02: nincs szegmens-megkötés (a dokumentum szerint minden 5+ napos foglalónak megy; a "releváns munkák" kiválasztása az {eredmények_link} dolga). mikor: a táblázat "T+1..3 nap" sora -> utan_napok: 2.',
    'HAIR-EMAIL-03: a "T-7..5 nap" sor -> elott_napok: 6; szegmens: nagy_valtozas (balayage, szőkítés, hosszú festés); a lista központozása (pontosvessző, a végén pont) a dokumentum szerint maradt.',
    'HAIR-SMS-03A / 03B: a dokumentum "Vágás és festés külön verzió" sora -> 03A: vagas_kezeles; 03B: festes + konzultacio (a nagy_valtozas foglalás a motor szerint mindig festes is, ezért oda is elmegy).',
    'HAIR-CALL-01: a dokumentum nem ad tárgyat, a tárgy általam írt ("Fodrász - hívandó vendég (konzultáció / hosszú első festés)"). Szegmens: konzultacio + nagy_valtozas; a dokumentum "első hosszú festésnél szelektíven" és "non-respondernél" feltételeit a címkék nem tudják megkülönböztetni, ezért minden nagy_valtozas foglalásra készül feladat, nem csak az elsőre.',
    'Gomb-feliratok (a dokumentum csak a bevezető mondatot és a linket adja): HAIR-EMAIL-01 "Foglalás megtekintése / módosítása", HAIR-EMAIL-02 "Megnézem a munkákat".',
    'A fodrász-üzenetek mindegyike a {fodrász}-ra épül (a dokumentum: mindig a ténylegesen lefoglalt fodrász személyére épüljön); ha a név nem ismert, a SEMA.md szerint a helyőrzős sor/bekezdés kimarad (SMS-nél ez az egész szöveg lehet: a render-nél ellenőrizendő).',
  ],
};
