// A katalogus kozos szotara: az engedelyezett helyorzok es uzenet-tipusok. A render.js ezekbol tolti ki a szoveget; a
// katalogus-teszt (tools/lifecycle-teszt/katalog.test.mjs) ezekkel ellenorzi a szovegeket.

/** helyorzo -> { kotelezo: a katalogus-uzenet csak akkor kuldheto, ha ez ismert; ha nem kotelezo es ismeretlen, a TARTALMAZO SOR kimarad } */
export const HELYORZOK = Object.freeze({
  'keresztnév': { opcionalis: true, leiras: 'a vendég keresztneve; ha nem állapítható meg: "Szia!" megszólítás' },
  'dátum': { leiras: '"november 25. (szerda)"' },
  'dátum_ragos': { leiras: '"november 25-én" (a "Találkozunk {dátum_ragos}." mondathoz)' },
  'nap': { leiras: 'a hét napja: "szerda"' },
  'időpont': { leiras: '"16:00"' },
  'szolgáltatás': { leiras: 'a lefoglalt szolgáltatás tisztított neve (SMS-ben rövidített)' },
  'munkatárs': { opcionalis: true, leiras: 'a foglalt munkatárs neve (ha "Páros kezelés"/ismeretlen, a sor kimarad)' },
  'fodrász': { opcionalis: true, leiras: 'a munkatárs neve fodrászoknál (= {munkatárs})' },
  'várható_időtartam': { opcionalis: true, leiras: '"1 óra 20 perc" (a Salonic-pillanatképből)' },
  'aktuális_ár': { opcionalis: true, leiras: 'jelenleg NINCS garantáltan aktuális ár-forrás: a sor kimarad' },
  'aktuális_ajánlat': { opcionalis: true, leiras: 'jelenleg nincs garantált ajánlat-forrás: a sor kimarad' },
  'foglalás_részletei_link': { leiras: 'a saját oldalunk: részletek / módosítás (mosaicheadspa.hu/f/<kód>; a Salonic-oldal a mi oldalunkba ágyazva)' },
  'módosítás_link': { leiras: 'ugyanaz, mint a részletek (itt tud átfoglalni / módosítani)' },
  'megerősítés_link': { leiras: 'egykattintásos megerősítés (mosaicheadspa.hu/api/lifecycle/megerosites...)' },
  'foglalás_link': { leiras: 'új időpont foglalása (az üzletág oldala)' },
  'navigáció_link': { leiras: 'Google Maps-link a szalonhoz' },
  'eredmények_link': { leiras: 'az üzletág oldala (munkák / eredmények)' },
  'videó_link': { leiras: 'az üzletág oldala (videók)' },
  'új_dátum': { leiras: 'áthelyezésnél az új dátum' },
  'új_időpont': { leiras: 'áthelyezésnél az új időpont' },
  'telefon': { leiras: 'a szalon telefonszáma: 06 20 247 4444' },
  'cím': { leiras: '1023 Budapest, Bécsi út 2.' },
  'nem_találkoztunk': { leiras: 'no-show üzenethez: "Tegnap nem találkoztunk" / "Ma nem találkoztunk" / "A … időpontodon nem találkoztunk" (a küldés napja szerint)' },
});

export const CSATORNAK = Object.freeze(['sms', 'email', 'feladat']);
/** mikor.tipus: t0 | t72 | t24 | tartalom | feladat | feladat_t0 (+ a kozos: lemondva | athelyezve | nem_jelent_meg) */
export const MIKOR_TIPUSOK = Object.freeze(['t0', 't72', 't24', 'tartalom', 'feladat', 'feladat_t0', 'lemondva', 'athelyezve', 'nem_jelent_meg']);
export const SZEGMENSEK = Object.freeze(['ajandekkartya', 'fizetos', 'paros', 'negykezes', 'egyeni', 'hair', 'konzultacio', 'festes', 'nagy_valtozas', 'vagas_kezeles', 'elso', 'visszatero', 'korrekcio', 'eltavolitas']);
export const BLOKK_KULCSOK = Object.freeze(['lista', 'szamozott', 'doboz', 'gomb', 'alairas', 'kep', 'kepek', 'velemeny', 'video', 'szemely', 'ertekeles']);
/** a blokk mellett megengedett feltetel-kulcs: a blokk csak az adott munkatarsnal jelenik meg */
export const BLOKK_FELTETEL_KULCSOK = Object.freeze(['ha_munkatars']);
export const ALAIRAS = 'MOSAIC Head Spa and Hair'; // minden level alairasa (a tulajdonos kerese, 2026-10-08)
export const SMS_MAX_KARAKTER = 480; // a legrosszabb eset (hosszu helyorzo-ertekekkel) is ennyin belul legyen
