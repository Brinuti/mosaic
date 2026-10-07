# Gyógytornászom.hu – elvégzett munkák összesítője (átadó dokumentum)

Készült: 2026-10-07, egy hosszú cloud-fejlesztői munkamenet alapján.
Oldal: https://www.gyogytornaszom.hu (WordPress). Tulajdonos: Deák Ferenc (ferraj@gmail.com).
3 rendelő: Nyugati (Bajcsy-Zsilinszky út 72, Salonic placeId 2581), Oktogon (Paulay Ede u. 47, 8439), Batthyány (Vitéz u. 9, 418).
Központi telefon: 06-20-323-6373 (H–P 8–19:30, Szo 8–14). Kommunikáció a felhasználóval: magyarul.

> Titok nincs ebben a fájlban. A WordPress alkalmazásjelszót (felhasználó: `feri`) a felhasználó adja meg a beszélgetésben, repóba soha nem kerülhet.

---

## 1. Hogyan férek hozzá (módszer)

- A felhőkörnyezetből a gyogytornaszom.hu közvetlenül nem érhető el. Minden WP REST kérés a **Composio `COMPOSIO_REMOTE_BASH_TOOL`** sandboxból megy (python `requests`, Basic auth `feri:<alkalmazásjelszó>`). A sandbox néha lefagy / elveszti a `/tmp`-t: új `session_id` (SEARCH_TOOLS `generate_id`) kell, a fájlok elvesznek. Hosszú futásnál `nohup` + külön poll (egy parancs max. ~60 mp).
- Az oldal 429-et ad, ha gyorsan kérdezik: kérések között 1–2 mp, újrapróbálás.
- **Ideiglenes PHP-kód** az „Code Snippets" bővítménnyel: `POST /wp/v2/plugins {slug:"code-snippets",status:"active"}`, snippet: `POST /code-snippets/v1/snippets {name,code,scope:"global",active:true}`; ha kész: snippet törlése (`DELETE`), bővítmény inaktiválása és törlése. **Kivétel: a „gyt-cikk-cta-shortcode" snippet (id 12) és a bővítmény tartósan bent maradt** (lásd 6.).
- **Salonic** (foglalórendszer): publikus oldal gyogytornaszomhu.salonic.hu, admin app.salonic.hu. Szerkesztés a Composio **böngésző-ügynökkel** (`BROWSER_TOOL_CREATE_TASK` / `WATCH_TASK` / `GET_SESSION` / `STOP_TASK`), a felhasználó belépett az élő nézeten át. Tanulságok: egy feladat max. 3–4 profil (kb. 26 lépés/feladat); ne használjon `evaluate`-ot a mező olvasására (elakad); a STOP az egész böngészősessiont kilövi (újra be kell lépni); a „Mentés" gombot minden oldalon újra kell keresni; a mező beolvasása lassú betöltés miatt gyakran „üresnek" látszik.
- **Google Analytics:** Composio `google_analytics` kapcsolat (fiók: „Headspa Mosaic"), a felhasználó megadta a hozzáférést; property: `properties/334299750` („www.gyogytornaszom.hu – GA4"), `GOOGLE_ANALYTICS_RUN_REPORT`.
- Weblap-mérés: Playwright a Composio sandboxban (lassan tölt; háttérben futtatni).

## 2. A WordPress felépítése (amit tudni kell)

- Egyedi post type: **`member`** (gyógytornász), **`office`** (rendelő: Nyugati 69, Batthyány 29, Oktogon 26812), taxonómiák: `besorolas` (hierarchikus, a főkategóriát SOHA nem jelöljük, csak az alkategóriát; az Excelben csak a ZÖLD cella számít), `kezeles`, `member_lang` (HU 602, EN 603).
- Member meta: `experience`, `short_desc`, `first_consultation_price`, `highlighted_kezeles`, `member_lang_order` (REST-en írható); `external_link` (Salonic link), Yoast kulcsok (`_yoast_wpseo_*`) csak ideiglenes snippettel (`register_post_meta … show_in_rest`).
- Rendelő ↔ gyógytornász kapcsolat: **`qbg_related_posts` tábla** (`QUICKBERG_Related_Posts::set_relation`), shortcode `[qbs-members-by-office id=".."]`. Új gyógytornásznál ezt is be kell állítani.
- Blogcikkek/oldalak **újrahasznosítható blokkokból** (`/wp/v2/blocks`) vannak összerakva: a közös blokk módosítása minden hivatkozó oldalon egyszerre érvényesül (árak, telefon), de a hivatkozó oldalak **cache-e nem ürül** magától: az oldal újramentése (POST ugyanazzal a tartalommal) üríti (W3 Total Cache).
- Gutenberg raw markup: regexszel szerkeszthető; `re.sub` lambdában a visszahivatkozásokhoz `m.expand()` kell (egyszer elromlott).
- Redirection bővítmény telepítve, **marad** (301-ek).
- Részletes lépés-leírás új gyógytornász felviteléhez: `docs/gyogytornaszom-gyogytornasz-felvitel.md` (a repóban, a `claude/stoic-faraday-nfkytq` ágon).

## 3. Árak és alapadatok (2026-10-01-től)

Állapotfelmérés 23.500 Ft (akciós 19.000 Ft, a hirdetett akciós listán lévő gyógytornászoknál), gyógytorna alkalom 19.000, állkapocs 13.500, bérlet 5×: 18.000/alk (90.000), 10×: 17.100/alk (171.000). Az állapotfelmérés időtartama a weboldalon **60 perc**; a **Salonicban 50 perc – ahhoz tilos nyúlni** (szünetek miatt), az online állapotfelmérés is marad 50. `first_consultation_price`: akciós listán 19.000, a többieknél 23.500.

## 4. Elvégzett munkák időrendben

1. **Hibakeresés:** hiányzó blogképek, SEO-hibák, törött linkek javítása; 301-es átirányítások (Redirection bővítmény); a páciens oldalakon minden kép ellenőrizve. A `noindex` kivételével minden javítás jóváhagyva.
2. **Új gyógytornász: Eszenyi Bianka** (member 31609): fotók (800×800 hős + fekvő), Salonic-link, docx-bemutatkozó, Excel-besorolás (csak zöld cellák), másolt member-sablon, meta/Yoast, rendelőhöz rendelés. A felhasználó szabálya: *tapasztalat = a diplomázás óta eltelt évek* (Bianka évszáma hiányzik, a mező üres), nyelvek mehetnek EN+HU.
3. **Akciós állapotfelmérés oldal** (page 27152) frissítése az októberi listával (névsor, fotók, Salonic-linkek, Edina kivéve).
4. **Telefonszám-egységesítés:** minden gyógytornász-adatlapon, blokkban és cikkben a központi szám, `tel:` linkkel; régi 252/282/292 végű számok megszűntek.
5. **Árak/időtartamok átvezetése** az `Árlista` blokkban (22578) és a szétszórt rövid árakban (blokkok 24857, 27224, 28077, 28873, 28877, 29037, oldalak: /online-gyogytorna/, /idopontfoglalas/, árlista, cikkek). Tanulság: az árszövegek HTML-címkékkel megtörtek, ezért számokra/kulcsokra szabályozott regex kellett; bérlettáblázatok `<table[^>]*>`.
6. **Gyógytornász-javítások:** Nóra gombja „Adél időpontjai"-t írt (javítva), elgépelés + váll törölve; „pattanó ujj" kivéve Rimán Ferinél; Nóra és Adél besorolása/kezelései átnézve (Nóra a lehető legtöbb Excel szerint helyes besorolást kapta); minden gyógytornász a megfelelő rendelőhöz rendelve.
7. **Kártyarács:** a `/gyogytornaszok/` és a rendelőoldalak float-os rácsa lyukas volt → flex-wrap CSS (`<style id="gyt-kartya-racs">`); a rendelőoldalakon csökkentett változat (`.office-members .row{display:flex;flex-wrap:wrap}.office-members .row>.col{float:none;box-sizing:border-box}`). A teljes flex egyszer összenyomta a kártyákat (a felhasználó jelezte) → visszavonva és javítva.
8. **Kereső (page 22537):** `#gmf-members-container`, szűrők (`#gmf-body-part`, `#gmf-complaint`, `#gmf-office`), `<style id="gyt-kartya-racs">`+`<script id="gyt-talalat-js">`; szűrés után a rejtett kártyák üres `.col`-jait `:has()` szabály tünteti el; találat-doboz, nagyobb betűk.
9. **UX/konverziós átvizsgálás** (40–50 éves női látogató szemével): kereső, foglaló oldal (22612, `gyt-foglalo`), blog-CTA-k, `tel:` linkek, főoldal hero olvashatóság (page 11, `gyt-hero-olvashato`). A felhasználói visszajelzések után: SZÉP kártya egy sorba, 50→60 perc, panaszfüggő időtartam, „17.500 nincs sehol" → árlistához igazítva, rendelők alatt a kártyák láthatóvá téve.
10. **Szakterület-sor (short_desc előtag)** mind a 30 gyógytornásznál: „Szakterület: a; b; c. <személyes mondat>". Kézzel összeállítva a saját „Szakterületeim" fülükből (az automatikus kivonat csonka volt, a besorolás-alapú számolás félrevezető – Patrik/Éva/Dóri besorolása azonos, másolat). A kártyán a tapasztalat, kiemelt kezelések és nyelv már külön látszik, ezért ezeket a szövegbe nem duplázom.
11. **Salonic bemutatkozók (Bemutatkozás mező) mind a 30 profilban** – lásd 5. táblázat. Formátum: `"<N> év tapasztalat. Szakterület: …; …; …. <személyes mondat>"` (Biankánál tapasztalat-sor nélkül). Csak a „Bemutatkozás" mezőt írtam; időtartam, szolgáltatás, ár, nyitvatartás érintetlen.
12. **Testtáj-fotók a gyógytornász-oldalakon:** a felhasználó ötlete volt (a főoldali „Hol vannak fájdalmai?" galériából 5–6 kép/gyógytornász). **Nem lett kiírva** – a besorolás megbízhatatlan, majd a felhasználó: „képeket hagyjuk ki".
13. **Google Analytics elemzés** (90 nap) – lásd 7.
14. **Menü-törés javítása kisebb laptopokon:** a menü 1160 px-től egysoros, de 1160–kb. 1300 px között nem fér el a logó mellett → második sorba tört, a fix 71 px-es fejléc alatt a hero kék dobozára futott. Javítás: a téma Kiegészítő CSS-ébe (`wp_update_custom_css_post`, egyszeri snippettel) `/* gyt-menu-fix */` szabály: 1160–1340 px között kisebb köz és 14 px betű. Playwrighttal mérve 1160/1213/1280 px-en mind a 9 menüpont egy sorban. Gyorsítótár: főoldal, /gyogytornaszok/, 3 rendelő, árlap, online, páciens, elérhetőségek, időpontfoglalás frissítve; a többi oldalon lejáratkor.
15. **Blog – foglalási felületek (CTA):** a 347 cikkből 326-ban már ≥9, 9-ben 8, 11-ben <3 volt. A 11-be (esettanulmányok, „megéri a gyógytorna", városnézés, ortopédia, reumatológus, csontritkulás) bekerült 3×: alcím+árak (28873), „BEJELENTKEZEM!" gomb (28880), gomb alatti szöveg (28877) – a cikk elején, közepén, végén; mentés: `/tmp/cta_backup.json` (a sandboxban, elveszhetett).
16. **Testtájra szabott szakértő-CTA (dinamikus shortcode)** – lásd 6.

## 5. Gyógytornász-azonosítók (WP member ↔ Salonic)

| Név | WP member id | Salonic employee id | Megjegyzés |
|---|---|---|---|
| Bianka (Eszenyi) | 31609 | 33200 | tapasztalat üres |
| Nóra (Németh) | 31584 | 33185 | |
| Adél (Veres) | 31575 | 33034 | nyelv: Salonicban üres, weben EN+HU |
| Niki | 31555 | 32167 (Nyíri Nikolett) | párosítás feltételezett |
| Szandi (Tomor Alexandra) | 31458 | 31525 | szövegben „2011 óta", tapasztalat „4 év" – ellentmondás |
| Barbi (Koroknai) | 31468 | 31101 | |
| Dorina (Józsa) | 30466 | 29423 | |
| Kitti (Bellovits) | 30542 | 29597 | |
| Aba (Bálint) | 30467 | 29414 | |
| Boróka (Farkas Boróka Eszter) | 28199 | 27617 | |
| Orsi (Kollár) | 28189 | 27473 | |
| Ildikó (Kiss) | 28020 | 26085 | |
| Nikolett (Könyves-Beták) | 28011 | 26087 | |
| Feri = Kopjás Ferenc | 27997 | 18787 | |
| Dani (Petró) | 27762 | 24615 | |
| Rita (Ziglerné Szőke) | 27422 | 2631 | |
| Zsuzsánna (Fehér) | 27185 | 20000 | |
| Edina (Tőkés) – gyógymasszőr | 27169 | 19999 | |
| Zsófia (Bényei) | 27005 | 19428 | |
| Kinga (Nagy) | 26992 | 19423 | |
| Ferenc – gyógymasszőr = Rimán Ferenc | 26764 | 26016 | |
| Zsuzsanna = Mosolygó Zsuzsi | 26763 | 18783 | párosítás feltételezett (név+10 év alapján) |
| Ilka (Major-Farkas) | 26762 | 18784 | |
| Míra (Sulyok) | 26353 | 15651 | |
| Katus (Czipó Katalin) | 25728 | 13844 | |
| Dominika (Sali, „Domi") | 24421 | 10686 | |
| Eszter (Farkas, „Eszti") | 22725 | 9214 | |
| Éva (Pfundt, „Évi") | 21623 | 7097 | |
| Patrik (Fárbás) | 21617 | 7248 | |
| Dóri (Szivós Dóra) | 83 | 7730 | |

(A Salonic-listában további, a weben nem szereplő munkatársak is vannak: Katinka, Boglárka, Luca, Aliz, Fanni, Anna, Betti, valamint „Rendelő – …" és közös profilok.)

## 6. Dinamikus blog-CTA (tartósan bent marad)

- **Snippet:** „gyt-cikk-cta-shortcode" (Code Snippets, id 12, aktív), shortcode `[gyt_cikk_cta]`; forrás a repóban nincs, a kód a WP-ben él (lekérhető: `GET /code-snippets/v1/snippets/12`).
- **Működés:** a cikk **címéből** kiolvassa a testtájat (kulcsszótár, szó-eleji egyezés: váll, térd, boka/láb, csípő, derék, nyak, gerinc/hát, kéz/csukló/hüvelyk/ujj, könyök, fej/fül/állkapocs, has/szülés/gát, mellkas/borda, porckopás), majd a `member` posztokból a **`short_desc` „Szakterület:" részére** (×5) és a tartalom szövegére pontoz; gyógymasszőrök kihagyva. Legjobb 3 gyógytornászt mutatja (fotó, tapasztalat, szakterület, „Időpontot foglalok nála" → `external_link`). Ha nem azonosítható testtáj vagy <2 találat → üres (pl. általános „ízületi fájdalom" cikk). Eredmény 12 órára transient-ben (kulcs `gyt_cta_<postID>_v3`).
- **Beillesztés:** a közös „GYT - Panasz - megoldás alatti CTA" blokk (29232) elejére (`<!-- wp:shortcode -->[gyt_cikk_cta]<!-- /wp:shortcode -->`, mentés: `/tmp/block29232_backup.txt`), ez 323 cikkben érvényes; további 12 cikkbe, ahol nincs 29232, az első promóció (24857) után illesztve.
- **Ellenőrzött példák:** lábközépcsont → Katus, Míra, Feri; bordaív → Ilka, Ildikó, Dóri; combcsont → Bianka, Aba, Zsófia; rekeszizom → Nóra, Kitti, Zsófia; keresztcsont → Éva, Szandi, Bianka; pattanó ujj (teszt) → Adél, Feri, Rita.
- **Utolsó állapot:** a gyorsítótár ürítéséhez mind a 347 cikket újramentő háttérfolyamat (`resave.py`) indult; a végét nem ellenőriztem. A pattanó ujj cikk (24473) nem tartalmaz 29232-t, ott a 12-es csoportban kellett volna kapnia a CTA-t – **a megjelenést ellenőrizni kell**.

## 7. Analytics-megállapítások (utolsó 90 nap)

- 84 196 munkamenet (weboldal 77 729; a Salonic ugyanabban a property-ben 11 341 munkamenet, 105 818 megtekintés). Csatornák: organikus 50 672, fizetett keresés 17 515, direkt 9 658, organikus social 3 379, AI-asszisztens 228. Eszköz: mobil 73%.
- **Belépő oldalak:** főoldal 6 640 (752 szándék), `/online-gyogytorna` 1 255 (80), Batthyány rendelő 256 (52); blogcikkek tömegesen, ~0 szándékkal (az ízületi cikk 2 319 belépés/0; pattanó ujj 1 691/40).
- **Foglalási folyamat (egyedi felhasználó):** specializáció 2 395 → szolgáltatás 2 594 → gyógytornász 2 021 → időpont 2 893 (felhasználónként ~7 megtekintés, ~106 mp) → adatok 1 671 → sikeres foglalás 820 felhasználó / 1 235 munkamenet. Az adatlapig eljutók kb. fele nem fejezi be. Mobil vs. asztali a folyamaton belül **azonos** (időpont→adatlap 57,5% vs 58,2%): a mobil alacsonyabb foglalási aránya szándék-különbség, nem a folyamat hibája.
- Belső navigáció: főoldalról → gyógytornászok 588, Nyugati 568, árak 449, online 448; rendelőoldalról → gyógytornász-adatlap → Salonic; árlapról → Elérhetőségek (104); `/online-gyogytorna` → akciós oldal (1 166) – ezt a felhasználó szándékosan hagyja.
- **Mérési hibák (a felhasználó: „most nem foglalkozunk vele"):** a kulcsesemények mind a `/allapot-ok` oldalról jönnek, ugyanazt a kattintást kétszer számolva (`allapot_ok` + `gyt_uj_beteg_foglalas` = 1 546 kattintás → 3 092 „kulcsesemény"); `successful_customer` kétszer fut; a property-be bekerül `localhost`, `w2w.…`, `gytm.hu`; `(not set)` belépő 1 995 (zaj); `/selectDate` belépőként is látszik (mérés-megszakadás a Salonic-átlépésnél).
- Felhasználói korrekciók: a főoldal/rendelőoldal magas konverziója nem a tartalom érdeme (aki ott van, foglalni akar); a legerősebb belső link az `/online-gyogytorna`-ra maradjon.

## 8. Nyitott tételek / javaslatok

1. **Legközelebbi szabad időpont a kártyákon/rendelőoldalon** (a felhasználó „mehet"-et mondott): kell az időpont-adat. A Salonic nyilvános oldala a sandboxból üres választ adott; böngészőből kell megvizsgálni, honnan tölti az időpontokat (XHR), vagy Salonic API-kulcs kell; tartalék: a gomb közvetlenül a gyógytornász időpont-választójára mutasson. Kockázat: elavult adat, sok „nincs időpont" elriaszthat. Mérés: időpont-megtekintés/fő és időpont→adatlap arány.
2. **Blog-CTA hatásmérés** néhány hét múlva: blog → `/online-gyogytorna` és Salonic átlépés aránya (jelenleg ~2%, az ízületi cikknél 87/4 641).
3. **Adél:** saját Excel-oszlopa azonos Nóráéval; nyelv (angol?) egyeztetendő. **Bianka:** tapasztalat-évek hiányoznak. **Szandi:** „2011 óta" vs „4 év". **Niki / Zsuzsanna párosítás** Salonic-profilokkal ellenőrizendő.
4. **Téma-szintű (fejlesztő) teendők:** `maximum-scale=1` (zoom tiltva), a Salonic új lapon nyílik, kb. 2 MB-os kereső-HTML, a hero kép lenyomja a H1-et mobilon, kisebb laptopon a hero kék doboz szövege további finomítást kérhet.
5. **Kikapcsolható:** a CTA-shortcode snippet (Code Snippets bővítmény) – kikapcsolásakor a CTA eltűnik, a cikkek épek maradnak.
6. **Hosting-terv (Mosaic-projekt CLAUDE.md):** a Mosaic oldal Netlify→Cloudflare Pages költözése után szólni, hogy a felhasználó mondja le a Netlify-előfizetést (nem a gyogytornaszom.hu része).

## 9. Biztonsági mentések / amit a sandbox elvesztett

A munkához készült mentések (`/tmp/*_backup.json`, `member_meta_backup.json`, `cta_backup.json`, `block29232_backup.txt`) a Composio sandboxban voltak; a sandbox cseréjekor elvesznek. A WordPress **változatai (revíziók)** viszont megvannak, onnan visszaállítható minden oldal/cikk/blokk. A reusable blokkok (22578, 24857, 27224, 28077, 28873, 28877, 28880, 29037, 29227, 29234, 29232, …) és a kereső (22537) szintén revízióban.
