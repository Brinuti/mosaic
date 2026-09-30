# Munkaszabályok (Claude)

- **Nyelv:** a felhasználóval mindig magyarul kommunikálj – a közbenső állapotjelzésekben is.
- **Mindent te csinálsz, amit lehet.** A felhasználótól csak azt kérd, amihez tényleg ő kell
  (jelszó, fiókhozzáférés, fizetés, döntés). Ilyenkor lépésről lépésre írd le, mit kell tennie.
- **Minden változtatás után:** tesztelés (dist build + Playwright), commit, push a fejlesztői
  ágra, PR a `main`-re, és a PR-t te mergeled (`merge_pull_request`, teljes 40 karakteres SHA).
  A Netlify a `main`-t publikálja: https://mosaicheadspa.netlify.app/
- **Fizetős külső szolgáltatás helyett** saját kód (pl. a Common Ninja GYIK/árlista helyett).
- **Mérőkódok:** csak a `mosaicheadspa.hu` domainen futhatnak (`assets/js/suti.js`,
  `ELES_DOMAINEK`). Külső fiókban (Meta, GTM, GA, Google Ads, TikTok) semmit ne hozz létre és
  ne módosíts a felhasználó kifejezett kérése nélkül.
- Commit-üzenet: magyarul, ékezet nélkül.
