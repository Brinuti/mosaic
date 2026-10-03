# Munkaszabályok (Claude)

- **Nyelv:** a felhasználóval mindig magyarul kommunikálj – a közbenső állapotjelzésekben is.
- **MINDENT te csinálsz meg.** Ne adj a felhasználónak feladatot, ne kérd, hogy ő teszteljen,
  ő állítson be valamit vagy ő adjon le tesztrendelést – keress rá utat (csatlakoztatott
  eszközök, Composio, Gmail, Playwright stb.). Kivétel csak az, amit technikailag kizárólag ő
  tehet meg (bejelentkezés/engedélyezés a saját fiókjába egy kattintással). Ilyenkor a
  legrövidebb utat add (egy link, egy kattintás), és utána minden mást te intézel.
- **Minden változtatás után:** tesztelés (dist build + Playwright), commit, push a fejlesztői
  ágra, PR a `main`-re. A PR Netlify-előnézete (deploy-preview-N--mosaicheadspa.netlify.app)
  ingyenes – ott tesztelj. A Netlify a `main`-t publikálja (https://www.mosaicheadspa.hu/,
  élesben 2026-10-02 óta).
- **Tárhely: Cloudflare Pages** (ingyenes, korlátlan forgalom), élesben 2026-10-03 óta: a `main`
  minden mergelése magától kimegy a https://www.mosaicheadspa.hu/ címre (projekt: `mosaic`,
  próbacím: mosaic-d77.pages.dev). A DNS is a Cloudflare-en van (a domain a Websupportnál
  regisztrált). Részletek: [CLOUDFLARE.md](CLOUDFLARE.md). A `functions/` a Cloudflare-é; a
  `netlify/` a régi Netlify-tárhelyé (tartalék, amíg le nem mondjuk); a levelek szövege közös
  (`netlify/lib/levelek.js`). A nem titkos Cloudflare-változók a `wrangler.toml`-ban vannak
  (ha a felületen adod meg őket, a Cloudflare törli őket), titkos csak az `SMTP_PASS`.
- **Netlify:** amíg az előfizetés él, a `main`-re mergelés ott is buildet indít (15 kredit);
  ezért továbbra is **legfeljebb napi 1 merge**, a munkát egy PR-be gyűjtsd. A `netlify.toml`
  `ignore` parancsa (`tools/netlify-kihagy.mjs`) kihagyja a buildet, ha csak oldalba nem kerülő
  fájl változott. **Ha a Cloudflare pár napig hibátlanul fut, szólj a felhasználónak, hogy
  mondja le a Netlify-előfizetést** (előtte a `mosaic-pmu-sms` Netlify-projektet is nézd át).
  A PR-t te mergeled (`merge_pull_request`, teljes 40 karakteres SHA).
- **Fizetős külső szolgáltatás helyett** saját kód (pl. a Common Ninja GYIK/árlista helyett).
- **Mérőkódok:** csak a `mosaicheadspa.hu` domainen futhatnak (`assets/js/suti.js`,
  `ELES_DOMAINEK`). Külső fiókban (Meta, GTM, GA, Google Ads, TikTok) semmit ne hozz létre és
  ne módosíts a felhasználó kifejezett kérése nélkül.
- Commit-üzenet: magyarul, ékezet nélkül.
