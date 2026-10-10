# MOSAIC CRM - hasznalat roviden (kezelo, recepcio, szalonvezeto)

## Menuk (egyszerusitett)
- **Ma** - a mai vendegek (egy kepernyo, a regi munkalista helyett; kartyakon: igazolas, kerdoiv, jelzes). A kartyan: Kerdoiv-link, Nem jelent meg. Egy vendegre koppintva a vezetett folyamat indul: igazolas -> hajkamera-kep -> megfigyeles/cel/ritmus/rutin -> szemelyes uzenet -> A5 PDF es kuldes. (Recepcio / szalonvezeto: a mai foglalasok listaja.)
- **Vendegek** - kereses, vendeglap fulekkel (attekintes, foglalasok, kura, berlet, uzenetek, dokumentumok, panasz, hozzajarulas) es gyorsgombokkal (Kuraterv, Kepek, Berlet, Beszamitas, Hozzajarulas, Zaro dokumentum).
- **Uzenetek** - a vendegeknek kimeno uzenetek sablonjai, elonezet, naplo. Jelenleg DRY-RUN: valodi level / SMS nem megy.
- **Kepkuldes (tablet)** - a hajkameras tableten a kepek feltoltese vendeg nelkul (Galeria -> Megosztas -> MOSAIC CRM). A kezelo a telefonon a Ma folyamatban rendeli a vendeghez.
- **Mutatok**, **Beallitasok** - vezetoknek (megjelenesi arany, berletek, panaszok; munkatarsak, jogosultsagok, naplo).
- **Egyebek** (osszecsukhato) - a ritkabban hasznalt kepernyok: allapotfelmero atnezes, kuraterv-szerkeszto, kameraképek / osszehasonlitas, kurazaro, berletek, beszamitas, panasz, hozzajarulasok, osszevonasi sor.

## A vendeg utja
1. Foglalas (Salonic) -> ertesito e-mail -> Zapier -> a CRM letrehozza a vendeget es a foglalast (csak az Oxigen szolgaltatasok, csak az uj foglalasok).
2. Kezeles elott: a vendeg a telefonjan kitolti az allapotfelmerot (egy link); a kezelo atnezi. Kontraindikacio-jelzesnel a kezeles nem igazolhato, amig at nem neztek.
3. Kezeles napjan: Ma -> vendeg -> vezetett folyamat. A "teljesitett" csak a kezelo igazolasatol szamit.
4. Utana: A5 PDF e-mailben; a kura 11 alkalmat szamol; kep a 1., 3., 5., 10. alkalmon; az osszehasonlitas es a 30 napos vendeg-link opcionalis.
5. Berlet (5 / 10) es a 4 990 Ft hajkamera-beszamitas kezi jeloles a vendeglapon.
6. Elegedettseg, panasz, hozzajarulas / leiratkozas: a rendszer a szabalyokat betartatja (nyitott panasz alatt nincs marketing uzenet).

## Mi nem megy ki mostantol sem
A valodi kuldes (level / SMS) csak a tulajdonos kulon "GO"-jara kapcsolhato be. A meglevo eles oxigen levelsorozathoz a CRM nem nyul.

## Marketing uzenetek
Indulaskor marketing (visszahivo, berletajanlo, ujrafoglalasi) uzenet NEM megy ki: csak a kezeles koruli uzenetek (tranzakcios, gondozasi, belso). A kapcsolo a crm/lib/constants.js MARKETING objektuma (alapbol ki); bekapcsolni csak a tulajdonos kulon kereseere. Az uj landing hozzajarulas-blokkja is el van rejtve.
