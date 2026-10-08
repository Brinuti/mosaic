# Salonic-naptár jelölése („Ott leszek” gomb)

**Mit csinál:** a sminktetoválás köszönő oldalán (`/pmu-ok`) a vendég az „Ott leszek” gombra kattint. Ekkor
1. a szalon e-mailt kap (mint eddig), és
2. a Salonic-naptárban a vendég időpontja **belső megjegyzést** kap: `✅ Megerősítve a weboldalon`.

A megjegyzést a vendég nem látja, és **a vendég nem kap róla értesítést** (az „Értesítés” mező „Nincs értesítés” marad). Meglévő megjegyzést nem töröl, csak hozzáfűz.

**Hogyan:** a Saloniknak nincs API-ja / webhookja, ezért a szerver (`netlify/lib/salonic-jeloles.js`, a `functions/[[path]].js` hívja a `pmu-megerosites` űrlapnál, háttérben) azt teszi, amit a szalon kézzel: belép az admin felületre, megkeresi a vendég időpontját az online foglalások között, megnyitja a szerkesztő űrlapot, kiegészíti a belső megjegyzést és elmenti az űrlapot.

**Biztonsági elvek**
- Csak akkor ír, ha **pontosan egy** időpont egyezik a kapott dátummal / idővel **és** a vendég azonosítójával (`g`, a Salonic visszairányító címében). Bizonytalan esetben nem ír semmit.
- Értesítés nélkül ment (`notifyEdit = 0`); ha az űrlapon nincs ilyen opció, nem ír.
- Mentés után visszaolvassa az időpontot, és ellenőrzi, hogy a jelölés ott van-e.
- Ugyanazt az időpontot kétszer nem jelöli.
- Nem dob hibát: a szalon e-mailje ettől függetlenül kimegy; a hiba csak a naplóba kerül (jelszó és személyes adat nélkül).
- Jelszó nélkül **ki van kapcsolva** (nem csinál semmit).

**Beállítás (Cloudflare Pages → a `mosaic` projekt → Settings → Variables and Secrets, Production és Preview)**

| Név | Típus | Érték |
|---|---|---|
| `SALONIC_PMU_JELSZO` | **Secret** | a `mosaic-pmu` Salonic-fiók jelszava (csak a tulajdonos írja be; chatbe, repóba, Drive-ra nem kerül) |
| `SALONIC_PMU_UGYFEL` | szöveg (nem kötelező) | az ügyfélazonosító; alapból `mosaic-pmu` |
| `SALONIC_JELOLES` | szöveg (nem kötelező) | `0` = kikapcsolva (a jelszó maradhat) |

**Tesztek:** `node --test tools/salonic-teszt/salonic-jeloles.test.mjs` (a Salonic admin helyi mása ellen) és `node --test tools/salonic-teszt/pmu-megerosites-hook.test.mjs` (a Pages-függvény bekötése). A valódi Salonic-fiókhoz a tesztek nem nyúlnak.
