# Munkaszabályok (Claude)

- **Nyelv:** a felhasználóval mindig magyarul kommunikálj – a közbenső állapotjelzésekben is.
- **MINDENT te csinálsz meg.** Ne adj a felhasználónak feladatot, ne kérd, hogy ő teszteljen,
  ő állítson be valamit vagy ő adjon le tesztrendelést – keress rá utat (csatlakoztatott
  eszközök, Composio, Gmail, Playwright stb.). Kivétel csak az, amit technikailag kizárólag ő
  tehet meg (bejelentkezés/engedélyezés a saját fiókjába egy kattintással). Ilyenkor a
  legrövidebb utat add (egy link, egy kattintás), és utána minden mást te intézel.
- **Minden változtatás után:** tesztelés (dist build + Playwright), commit, push a fejlesztői
  ágra, PR a `main`-re. A PR Netlify-előnézete (deploy-preview-N--mosaicheadspa.netlify.app)
  ingyenes – ott tesztelj. A `main`-re **kötegekben** mergelj (napi 1–3 alkalommal), mert minden
  éles Netlify-deploy 15 kreditbe kerül (Personal csomag: 1000 kredit/hó). A PR-t te mergeled
  (`merge_pull_request`, teljes 40 karakteres SHA). A Netlify a `main`-t publikálja:
  https://mosaicheadspa.netlify.app/
- **Tárhely:** most Netlify Personal (9 USD/hó, 2026-09-30-án vásárolva). Élesítéskor a terv:
  költözés a Cloudflare Pages-re (ingyenes, korlátlan forgalom). **A költözés után szólj a
  felhasználónak, hogy mondja le a Netlify-előfizetést.**
- **Fizetős külső szolgáltatás helyett** saját kód (pl. a Common Ninja GYIK/árlista helyett).
- **Mérőkódok:** csak a `mosaicheadspa.hu` domainen futhatnak (`assets/js/suti.js`,
  `ELES_DOMAINEK`). Külső fiókban (Meta, GTM, GA, Google Ads, TikTok) semmit ne hozz létre és
  ne módosíts a felhasználó kifejezett kérése nélkül.
- Commit-üzenet: magyarul, ékezet nélkül.
