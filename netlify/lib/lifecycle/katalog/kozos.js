// Kozos (minden uzletagra ervenyes) uzenetek: lemondas, atfoglalas, no-show (dokumentum 8. fejezet). Szo szerint.
export default {
  uzletag: 'kozos',
  uzenetek: [
    {
      id: 'COMMON-CANCEL-SMS', csatorna: 'sms', mikor: { tipus: 'lemondva' },
      szoveg: 'Szia {keresztnév}! Rendben, a {dátum} {időpont}-ra szóló {szolgáltatás} időpontodat töröltük. Ha csak az időpont nem volt jó, itt rögtön választhatsz másikat: {foglalás_link}. MOSAIC',
    },
    {
      id: 'COMMON-CANCEL-EMAIL', csatorna: 'email', mikor: { tipus: 'lemondva' },
      targy: 'Rendben, töröltük az időpontodat',
      elotag: 'Ha csak az időpont nem volt jó, innen egyből át tudod foglalni.',
      torzs: [
        'Szia {keresztnév}!',
        'Rendben, a következő időpontodat töröltük:',
        { doboz: ['{szolgáltatás}', '{dátum}, {időpont}'] },
        'Ha csak az időpont nem volt jó, nem kell elölről kezdened - itt rögtön választhatsz másikat:',
        { gomb: { felirat: 'Új időpontot választok', link: '{foglalás_link}' } },
        'Ha pedig most nem szeretnél új időpontot, az is teljesen rendben van.',
        { alairas: 'MOSAIC Head Spa and Hair' },
      ],
    },
    {
      id: 'COMMON-RESCHEDULE-SMS', csatorna: 'sms', mikor: { tipus: 'athelyezve' },
      szoveg: 'Szia {keresztnév}! Megvan az új időpontod: {új_dátum} {új_időpont}, {szolgáltatás}. A régi időpont helyett már ezt tartjuk neked. Részletek: {foglalás_részletei_link}. MOSAIC',
    },
    {
      id: 'COMMON-NOSHOW-SMS', csatorna: 'sms', mikor: { tipus: 'nem_jelent_meg' },
      szoveg: 'Szia {keresztnév}! {nem_találkoztunk}, reméljük, minden rendben van. Ha csak az időpont csúszott el, itt egyből tudsz újat választani: {foglalás_link}. Ha kérdésed van, hívj nyugodtan: {telefon}. MOSAIC',
    },
    {
      id: 'COMMON-NOSHOW-EMAIL', csatorna: 'email', mikor: { tipus: 'nem_jelent_meg' },
      targy: 'Nem találkoztunk - szeretnél új időpontot?',
      elotag: 'Ha csak az időpont csúszott el, innen egyből tudsz újat választani.',
      torzs: [
        'Szia {keresztnév}!',
        '{nem_találkoztunk}, reméljük, minden rendben van.',
        { doboz: ['{szolgáltatás}', '{dátum}, {időpont}'] },
        { kep: { src: 'kozos/varo.jpg', alt: 'A MOSAIC váróterme zöld bársonyfotelekkel, meleg fényekkel' } },
        'Előfordul, hogy közbejön valami. Ha csak az időpont csúszott el, nem kell elölről kezdened, itt rögtön választhatsz másikat:',
        { gomb: { felirat: 'Új időpontot választok', link: '{foglalás_link}' } },
        'Ha kérdésed van, hívj nyugodtan: {telefon}.',
        { alairas: 'MOSAIC Head Spa and Hair' },
      ],
    },
  ],
};
