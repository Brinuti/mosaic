// A modellkereso napok nyilatkozata (a vendeg a visszaigazolo levelben kapja, es egy kattintassal elfogadja: /mf/<kod>).
// FORRAS: a Salonic "Kezelesi urlap" szovege (a tulajdonos beillesztette, 2026-11-01), a modellnapra igazitva. Az eltereseket a docs/MODELLNAP_NYILATKOZAT.md sorolja fel:
//   1. a cim es az 1. bekezdes a modellnap piercingjeit nevezi meg (szemoldok, orr, ajak, koldok, rook) a migren / shenmen / slim / klimax helyett, "a fulbe helyezese" -> "a testbe helyezese";
//   2. UJ bekezdes: gyakorlonap (vidéki piercerek, Kovacs Richard felugyelete) + foto- es videofelvetel (a tulajdonos: "keszul, az fontos");
//   3. a zaro mondat "alairasaval" helyett "elfogadasaval" (nincs alairas, kattintas van).
// A tobbi bekezdes szo szerint a Salonic szovege. JOVAHAGYAS: a tulajdonosnak kell megerositenie (kulonosen a "kivant hatas / penzvisszaterites / garancia" mondatokat), mielott eles.
// A VERZIO az elfogadassal egyutt eltarolodik (melyik szoveget fogadta el a vendeg); a szoveg barmilyen valtoztatasakor uj verzio kell.
export const VERZIO = '2026-11-01-v1';
export const CIM = 'Kezelési űrlap';
export const ALCIM = 'Szemöldök, orr, ajak, köldök és rook piercing elkészítéséhez (oktatási gyakorlónap)';

/** t: 'p' bekezdes, 'h' kis cimsor. */
export const SZOVEG = [
  { t: 'p', s: 'A Medical Piercing tájékoztatja a szolgáltatás igénybe vevőjét, arról, hogy a szemöldök-, orr-, ajak-, köldök- és rook piercing elkészítése, és a testbe helyezése nem minősül orvosi tevékenységnek. Orvosi tevékenységi körbe tartozó tevékenységet a Medical Piercing egyik alkalmazottja sem végez.' },
  { t: 'h', s: 'Tájékoztatás és tudomásulvétel a piercing viselésével járó kockázatokról' },
  { t: 'p', s: 'A Vendég tudomásul veszi, hogy a piercing típusa, mérete és elhelyezkedése függvényében – a szolgáltató részéről tanúsított legnagyobb szakmai gondosság ellenére is – előfordulhat, hogy az ékszer külső fizikai behatás (pl. ruházat, haj, mozgás, alvás, sporttevékenység) következtében beakad, elmozdul, meglazul, lecsavarodik, illetve szennyeződés kerülhet a piercing környezetébe.' },
  { t: 'p', s: 'A Vendég tudomásul veszi továbbá, hogy a piercing behelyezését követően – különösen a gyógyulási időszakban – megfelelő utókezelés és higiénia hiányában gyulladás, irritáció, duzzanat, váladékozás vagy egyéb szövődmény alakulhat ki, melyek kockázatáról a Szolgáltató előzetesen tájékoztatást adott.' },
  { t: 'p', s: 'A Vendég elfogadja, hogy a piercing behelyezését követően, a Szolgáltató telephelyének elhagyása után bekövetkező, nem a beavatkozás szakszerűtlenségére visszavezethető eseményekért, illetve az utókezelési szabályok be nem tartásából eredő következményekért a Szolgáltató felelősséget nem vállal, és ezek pénzvisszatérítési igényt nem alapoznak meg. A Vendég tudomásul veszi továbbá, hogy a piercing viseléséhez fűződő esetleges szubjektív vagy funkcionális hatások, illetve a kívánt hatás elmaradása személyenként eltérő lehet, arra a Szolgáltató eredménygaranciát nem vállal, és önmagában az, hogy a piercing a Vendég elvárásainak nem felel meg vagy a várt hatást nem váltja ki, pénzvisszatérítésre nem jogosít.' },
  { t: 'p', s: 'A Vendég tudomásul veszi, hogy az ilyen jellegű esetek kezelésére vonatkozó lehetőségek (pl. garanciális feltételek, ékszercsere) a Szolgáltató honlapján kerültek részletesen feltüntetésre.' },
  { t: 'h', s: 'Oktatási gyakorlónap, fotó- és videófelvétel' },
  { t: 'p', s: 'A Vendég tudomásul veszi, hogy a piercinget a Szolgáltató vidéki piercerei végzik gyakorlásként, Kovács Richárd felügyelete mellett, valamint hogy a szúrásról fotó- és videófelvétel készül, amelyeket a Szolgáltató a weboldalán és a közösségi média felületein felhasználhat.' },
  { t: 'p', s: 'Fentiek tudomásul vételét a szolgáltatás igénybe vevője jelen nyilatkozat elfogadásával kifejezetten tudomásul veszi és elfogadja.' },
];

/** A szoveg sima szovegkent (a levelek szoveges valtozatahoz). */
export const szovegKent = () => [`${CIM}: ${ALCIM}`, ...SZOVEG.map((x) => x.s)].join('\n\n');
