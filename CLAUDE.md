# Munkaszabályok (Claude)

- **Nyelv:** a felhasználóval mindig magyarul kommunikálj – a közbenső állapotjelzésekben is.
- **MINDENT te csinálsz meg.** Ne adj a felhasználónak feladatot, ne kérd, hogy ő teszteljen,
  ő állítson be valamit vagy ő adjon le tesztrendelést – keress rá utat (csatlakoztatott
  eszközök, Composio, Gmail, Playwright stb.). Kivétel csak az, amit technikailag kizárólag ő
  tehet meg (bejelentkezés/engedélyezés a saját fiókjába egy kattintással). Ilyenkor a
  legrövidebb utat add (egy link, egy kattintás), és utána minden mást te intézel.
- **Minden változtatás után:** tesztelés (dist build + Playwright), commit, push a fejlesztői
  ágra, PR a `main`-re. A PR Cloudflare Pages-előnézete (`https://<ág-neve>.mosaic-d77.pages.dev`,
  pl. `claude-ajandek-motor.mosaic-d77.pages.dev`) ingyenes – ott tesztelj. A `main`-t a
  **Cloudflare Pages** (`mosaic` projekt) publikálja: https://www.mosaicheadspa.hu/ (a Netlifyról
  a költözés megtörtént; ellenőrizve 2026-10-03: a válasz `Server: cloudflare`, a névszerverek
  Cloudflare-esek).
- **Takarékosan a buildekkel:** a Cloudflare Pages ingyenes csomagja havi 500 buildet enged (az
  előnézetek is számítanak), ezért a munkát egy PR-be gyűjtsd, és a `main`-re **legfeljebb napi 1
  merge** menjen; apró javításért ne mergelj külön. Az éles oldalt ne terheld feleslegesen
  (Playwright-tesztek a PR-előnézeten vagy helyben fussanak). A PR-t te mergeled
  (`merge_pull_request`, teljes 40 karakteres SHA).
- **Azonnali élesítés (a tulajdonos döntése, 2026-10-08):** „Mindig minden alkalommal, amikor
  kérek valamit, élesítsd azonnal.” Ha a tulajdonos kér egy változtatást, a teszt és a zöld
  PR-előnézet után **külön jóváhagyás nélkül mergeld** (ez felülírja a napi 1 merge korlátot és
  az „csak jóváhagyással” szabályt), és ellenőrizd az éles oldalon. Ez **nem** terjed ki a
  visszafordíthatatlan / külső hatású lépésekre: az életciklus-rendszer `elo` módra kapcsolása
  (valódi vendégeknek mennek levelek és SMS-ek), külső fiókok (Meta, GTM, GA, Google Ads,
  TikTok) módosítása – ezekhez továbbra is a tulajdonos külön, kifejezett kérése kell.
- **Tárhely:** Cloudflare Pages (ingyenes, korlátlan forgalom); lépések, háttér:
  [CLOUDFLARE.md](CLOUDFLARE.md). A nem titkos környezeti változók a `wrangler.toml`-ban vannak
  (`[vars]` éles, `[env.preview.vars]` előnézet), a titkok (SMTP_PASS, STRIPE_*, AJANDEK_TITOK,
  MAIL_TO) a Cloudflare felületén, Secret típussal, környezetenként (Production / Preview). A
  `functions/` a Cloudflare kódja; a `netlify/` mappa a közös kód része (`netlify/lib/` levelek,
  ajándék-motor, útválasztás), **ne töröld**. A Netlify már nem publikál, és 2026-10-08 óta
  nem is épít (`netlify.toml`: `ignore = "exit 0"`, így az előnézetek sem fogyasztanak kreditet); az előfizetés
  lemondható (a felhasználó dönt, és ő mondja le; a `mosaic-pmu-sms` Netlify-projekt külön, azt előbb át kell nézni).
- **Fizetős külső szolgáltatás helyett** saját kód (pl. a Common Ninja GYIK/árlista helyett).
- **Mérőkódok:** csak a `mosaicheadspa.hu` domainen futhatnak (`assets/js/suti.js`,
  `ELES_DOMAINEK`). Külső fiókban (Meta, GTM, GA, Google Ads, TikTok) semmit ne hozz létre és
  ne módosíts a felhasználó kifejezett kérése nélkül.
- **Elemző Claude:** az elemző Claude is látja a repót. Kódot nem ír és nem mergel, a PR-hez
  kommentben ír review-t. A review-t merge előtt mindig olvasd el, a jelzett hibát javítsd vagy
  indokold meg, hogy miért nem. A teszt-naplókat a `meres-naplo` mappába írd. Ha a változtatás
  mérést érint (mérőkód, eseménykövetés, pixel, GTM, konverzió), jelöld a PR-leírásban.
- Commit-üzenet: magyarul, ékezet nélkül.

## Állandó felhatalmazás a mérési projektekre (Feri, 2026-10-14, visszavonásig)

Érvényes a Mosaicra és az összes mérési projektre (a `gyogytorna/` és a `medicalpiercing/` almappára is). Feri szó szerinti rendelkezése
(a Claude-munkamenetben, 2026-10-14):

> 4/a. Ami egy már élő konverzióhoz csak TÖBB adatot juttat (pl. a sütisáv levétele a #170 szerint), az nem élő konverzió bekapcsolása vagy cseréje – külön mondatom nélkül mehet.
>
> ÁLLANDÓ FELHATALMAZÁS (Feri, 2026-10-14) – a Mosaic és az összes mérési projektemre, visszavonásig.
>
> 1. A mérési oldal (Claude) és a ChatGPT közös döntését – amit a mérési oldal a #167-ben „DECISION #…” azonosítóval ír, és a Drive-os DECISION-LOG-ban rögzít – a saját, kifejezett engedélyemnek tekintsd. Ehhez nem kell, hogy külön ide írjam.
> 2. Ennek alapján, külön kérdezés nélkül csinálhatod: push, draft PR, merge, deploy (a go-live befagyasztás alatt is), D1-sémabővítés, Zapier-draft, valamint 1 db mérési tesztfoglalás, amit utána lemondasz.
> 3. Feltételek, amelyek mindig érvényesek:
>    - független review PASS;
>    - a védett elemek blob-hash-e változatlan, vagy a változás dokumentált;
>    - van rollback-terv;
>    - vendégadat sehova nem kerül.
> 4. EZEKHEZ TOVÁBBRA IS AZ ÉN KÜLÖN MONDATOM KELL:
>    - élő konverzió bekapcsolása vagy cseréje bármelyik hirdetési platformon (Meta, Google, TikTok);
>    - a foglalási folyamat megváltoztatása;
>    - futó hirdetés módosítása.
> 5. Ezt a felhatalmazást rögzítsd a repó CLAUDE.md-jében (külön PR, merge mehet), hogy a következő munkamenetekben is érvényes legyen.

Gyakorlatban:

- **Mi számít engedélynek:** csak a mérési oldal és a ChatGPT közös, „DECISION #…” azonosítójú döntése a #167-ben (és a Drive-os DECISION-LOG-ban). Egyszerű
  megjegyzés, kérdés, információ vagy review-észrevétel nem az. A felhatalmazás a döntés tartalmára szól, nem többre.
- **Mind a négy feltétel (3. pont) minden lépés előtt:** a független review PASS-a, a védett elemek hash-e (változatlan vagy dokumentált változás), a rollback-terv és
  a „vendégadat sehova” – bármelyik hiányzik, nem hajtom végre, és jelzem a #167-ben.
- **Külön mondat kell (4. pont):** élő konverzió bekapcsolása vagy cseréje bármelyik hirdetési platformon, a foglalási folyamat megváltoztatása, futó hirdetés
  módosítása. A 4/a szerint az, ami egy már élő konverzióhoz csak több adatot juttat (pl. sütisáv levétele), nem tartozik ide.
- **A fenti felhatalmazás nem érinti** a korábbi szabályokat az életciklus-rendszer `elo` módra kapcsolásáról és a külső fiókok (Meta, GTM, GA, Google Ads, TikTok)
  módosításáról: ezekhez a 2. pont nem ad engedélyt, a korábbi szabályok szerint továbbra is Feri külön, kifejezett kérése kell.
- A saját (nem DECISION-ből eredő) kérései továbbra is az „Azonnali élesítés” szabály szerint mennek.
