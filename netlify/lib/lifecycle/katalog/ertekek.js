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
  'eredmények_link': { leiras: 'az üzletág oldalának eredmények / vélemények szekciója (#horgonnyal); fodrásznál a foglalt fodrász oldala a munkái szekciónál' },
  'videó_link': { leiras: 'az üzletág oldalának videó szekciója (#horgonnyal); fodrásznál a foglalt fodrász konzultációs videója' },
  'új_dátum': { leiras: 'áthelyezésnél az új dátum' },
  'új_időpont': { leiras: 'áthelyezésnél az új időpont' },
  'telefon': { leiras: 'a szalon telefonszáma: 06 20 247 4444' },
  'cím': { leiras: '1023 Budapest, Bécsi út 2.' },
  // ---- Medical Piercing (mp): a katalogus `html` sablonjaiban es SMS-eiben -----------------------------------------------------------------------
  'helyszín': { opcionalis: true, leiras: 'MP: a szalon cime (csak ha a munkatarsbol biztosan tudjuk a helyszint; phase 1: csak Budapest)' },
  'helyszín_rövid': { opcionalis: true, leiras: 'MP SMS: "Újpesti rakpart 7" (ismeretlen helyszinnel a mondatresz kimarad)' },
  'érkezés': { opcionalis: true, leiras: 'MP: hogyan talalsz meg minket (parkolas, villamos) - csak ismert helyszinnel' },
  'útvonal_link': { opcionalis: true, leiras: 'MP: Google Maps-utvonal a szalonhoz - csak ismert helyszinnel' },
  'munkatárs_fotó': { opcionalis: true, leiras: 'MP: a foglalt piercer fotoja (az alairas mellett); ismeretlen munkatarsnal nincs' },
  'látogatás_hossza': { opcionalis: true, leiras: 'MP: "kb. 30–40 perc" (egy piercing) / "kb. 40–50 perc" (csomag) - a teljes latogatas, nem a Salonic-idotartam' },
  'google_vélemények': { leiras: 'MP: a Google-velemenyek szama ("5 033"; a /api/ertekeles-bol, kulonben a legutobbi ismert kerek szam)' },
  'nem_találkoztunk': { leiras: 'no-show üzenethez: "Tegnap nem találkoztunk" / "Ma nem találkoztunk" / "A … időpontodon nem találkoztunk" (a küldés napja szerint)' },
});

export const CSATORNAK = Object.freeze(['sms', 'email', 'feladat']);
/** mikor.tipus: t0 | t72 | t24 | tartalom | feladat | feladat_t0 (+ a kozos: lemondva | athelyezve | nem_jelent_meg) */
/** elott_ora: { ora: 48, min_lead_ora: 72 } - az idopont elott N oraval, ha a foglalas legalabb min_lead_ora oraval elotte tortent (MP: T-48 felkeszito level) */
export const MIKOR_TIPUSOK = Object.freeze(['t0', 't72', 't24', 'tartalom', 'elott_ora', 'feladat', 'feladat_t0', 'lemondva', 'athelyezve', 'nem_jelent_meg']);
export const SZEGMENSEK = Object.freeze(['ajandekkartya', 'fizetos', 'paros', 'negykezes', 'egyeni', 'hair', 'konzultacio', 'festes', 'nagy_valtozas', 'vagas_kezeles', 'elso', 'visszatero', 'korrekcio', 'eltavolitas',
  'migren', 'shenmen', 'klimax', 'slim', 'allergia', 'egyeb', 'bp', 'videk']); // utolso sor: Medical Piercing (piercing-tipus + helyszin)
/** Az esemeny-tipusok (lemondas, athelyezes, no-show): nem a tervezo utemezi oket, hanem az engine az esemenykor. Az uzletag sajat katalogusaban levo ilyen uzenet
 *  felulirja a kozos (COMMON-*) uzeneteket (MP: sajat lemondas / modositas / no-show uzenetek). */
export const ESEMENY_TIPUSOK = Object.freeze(['lemondva', 'athelyezve', 'nem_jelent_meg']);
export const BLOKK_KULCSOK = Object.freeze(['lista', 'szamozott', 'doboz', 'gomb', 'cim', 'kiemelt', 'kep', 'kepek', 'velemeny', 'video', 'szemely', 'ertekeles']);
/** a blokk mellett megengedett feltetel-kulcs: a blokk csak az adott munkatarsnal jelenik meg */
export const BLOKK_FELTETEL_KULCSOK = Object.freeze(['ha_munkatars']);
export const SMS_MAX_KARAKTER = 160; // 1 SMS-szegmens (ekezet nelkul, a render.js smsTomorit utan) a legrosszabb esetben is (a tulajdonos kerese, 2026-10-16)
