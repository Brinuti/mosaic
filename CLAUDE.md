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
- **Takarékosan a Netlify-kreditekkel** (Pro csomag: 3000 kredit/hó; ha elfogy, az ÉLES oldal
  leáll – 2026-10-03-án megtörtént):
  - minden éles deploy 15 kredit → a `main`-re **legfeljebb napi 1 merge**, a munkát egy PR-be
    gyűjtsd; apró javításért ne mergelj külön;
  - a `netlify.toml` `ignore` parancsa (`tools/netlify-kihagy.mjs`) kihagyja a buildet, ha csak
    oldalba nem kerülő fájl változott (dokumentáció, mentések, segédeszközök); ha új, az oldalba
    kerülő fájlt vagy mappát vezetsz be, vedd fel az `OLDALBA_KERUL` listába;
  - az éles oldalt ne terheld feleslegesen (Playwright-tesztek a PR-előnézeten vagy helyben fussanak).
  A PR-t te mergeled (`merge_pull_request`, teljes 40 karakteres SHA).
- **Tárhely:** Netlify Pro (20 USD/hó, 2026-10-03 óta). A terv: költözés a Cloudflare Pages-re
  (ingyenes, korlátlan forgalom) – a kód kész, a lépések: [CLOUDFLARE.md](CLOUDFLARE.md). A repó
  mindkét tárhelyen működik: a `functions/` a Cloudflare-é, a `netlify/` a Netlifyé, a
  levelek szövege közös (`netlify/lib/levelek.js`). **A költözés után szólj a felhasználónak, hogy mondja le a
  Netlify-előfizetést.**
- **Fizetős külső szolgáltatás helyett** saját kód (pl. a Common Ninja GYIK/árlista helyett).
- **Mérőkódok:** csak a `mosaicheadspa.hu` domainen futhatnak (`assets/js/suti.js`,
  `ELES_DOMAINEK`). Külső fiókban (Meta, GTM, GA, Google Ads, TikTok) semmit ne hozz létre és
  ne módosíts a felhasználó kifejezett kérése nélkül.
- Commit-üzenet: magyarul, ékezet nélkül.
