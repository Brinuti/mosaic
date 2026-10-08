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
- Commit-üzenet: magyarul, ékezet nélkül.
