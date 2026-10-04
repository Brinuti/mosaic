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
- **Tárhely:** Cloudflare Pages (ingyenes, korlátlan forgalom); lépések, háttér:
  [CLOUDFLARE.md](CLOUDFLARE.md). A nem titkos környezeti változók a `wrangler.toml`-ban vannak
  (`[vars]` éles, `[env.preview.vars]` előnézet), a titkok (SMTP_PASS, STRIPE_*, AJANDEK_TITOK,
  MAIL_TO) a Cloudflare felületén, Secret típussal, környezetenként (Production / Preview). A
  `functions/` a Cloudflare kódja; a `netlify/` mappa a közös kód része (`netlify/lib/` levelek,
  ajándék-motor, útválasztás), **ne töröld**. A Netlify már nem publikál; az előfizetés
  lemondható (a felhasználó dönt, és ő mondja le).
- **Fizetős külső szolgáltatás helyett** saját kód (pl. a Common Ninja GYIK/árlista helyett).
- **Mérőkódok:** csak a `mosaicheadspa.hu` domainen futhatnak (`assets/js/suti.js`,
  `ELES_DOMAINEK`). Külső fiókban (Meta, GTM, GA, Google Ads, TikTok) semmit ne hozz létre és
  ne módosíts a felhasználó kifejezett kérése nélkül.
- **Elemző Claude:** az elemző Claude is látja a repót. Kódot nem ír és nem mergel, a PR-hez
  kommentben ír review-t. A review-t merge előtt mindig olvasd el, a jelzett hibát javítsd vagy
  indokold meg, hogy miért nem. A teszt-naplókat a `meres-naplo` mappába írd. Ha a változtatás
  mérést érint (mérőkód, eseménykövetés, pixel, GTM, konverzió), jelöld a PR-leírásban.
- Commit-üzenet: magyarul, ékezet nélkül.
