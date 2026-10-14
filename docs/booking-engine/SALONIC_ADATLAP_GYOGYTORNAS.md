# Salonic adatlap (a foglalo utolso oldala): gyogytornas elrendezes - 2026-10-14

**Kerese:** Feri (2026-10-14): az uj foglalomotor utolso oldala (a Salonic adatlap, ahol a vendeg a nevet / telefonszamot adja meg) mind az 5 szalonban ugy nezzen ki,
mint a gyogytornas foglaloban; a szineken, betutipuson nem valtoztatunk, csak az elrendezes / szovegek.

**Mi valtozott:** `salonic/mosaic.css` (oxigen, fodraszat, lezer, Head Spa) es `salonic/pmu.css` (sminktetovalas) vegere kerult egy blokk
(`/* ===== Gyogytornas adatlap ...`), amely a `gyogytorna/public/salonic/gy.css` szabalyait koveti MOSAIC szinekkel / betukkel / gombokkal:

* a Salonic sajat sutisavja (`.cc-window`) nem latszik az adatlapon (a motor keretet sem takarja);
* a "A *-gal jelolt mezok kitoltese kotelezo!" mondat es a "A foglalasodat lemondani ...-ig van lehetosegod" sor + a vonal rejtett (a hatarido a visszaigazolo e-mailben benne van; a * jeloles a mezok mellett marad);
* a kupon-sor: a "Kod ellenorzese" gomb a beviteli mezo fuggoleges kozepen;
* a hozzajarulas: a jelolonegyzet a mezok bal szelen, rovid szoveg: "Megismertem es elfogadom az adatvedelmi tajekoztatot es a foglalasi szabalyzatot. *" (a "...es kifejezetten hozzajarulasomat adom, hogy a megadott adataimat ... kezelje, munkatarsai kapcsolatba lepjenek velem ..." resz a DOM-ban megvan, csak nem latszik - ugyanigy, mint a gyogytornas es az MP foglaloban);
* szellosebb mezok / margok; a reCAPTCHA-sor rovidebb ("reCAPTCHA vedi; a Google ..."); a reCAPTCHA-tajekoztatot a Google feltetelei miatt nem rejtjuk el.

**Ami NEM valtozott:** szinek, betutipus, gombok, az "A foglalasod" oldalak (reszletek / modositas / lemondas / sikeroldalak: az uj blokk a `:not(:where(#page-booking-...-body))` szuressel kizarja oket; egyetlen kivetel a Salonic sutisavja: az ezeken az oldalakon sem latszik, lasd lent), a Salonic fejlece / lablece (a motor `FRAME_STYLED` geometriaja: 78 px levagas - ezert a fejlecet NEM rejtjuk, mint a gyogytornas CSS), a foglalomotor kodja (`assets/js/booking-engine/` valtozatlan).

**Hatokor / nyelv:** csak az adatlap (`body#page-booking-guestData-body`). A Head Spa Salonic-fiokja angol ("I accept the Terms Of Privacy, the Booking policy, and I consent ..."): ott angol rovid szoveg ("I accept the Terms Of Privacy and the Booking policy. *") es angol reCAPTCHA-sor jelenik meg, magyar szoveg nem.

**Asztali gepen** a motor 640 px-es rétegében a Salonic keret 526 px szeles, azaz a 600 px alatti (kompakt) szabalyok ervenyesek (ugyanaz a kinezet, mint mobilon); a gyogytornas ~640 px-es keretben a >= 600 px-es szabalyok ervenyesek. A >= 600 px-es szabalyok (38 / 44 px-es mezok, 10 px kozok) kozvetlen Salonic-latogatasnal (nem keretben) mukodnek; 640 px-re szeleszitett keretben a szamitott meretek megegyeznek a gyogytornassal (mezo, cimke, gomb, kozok).

**Dontesi pont (Feri):** a Salonic sutisavja eddig szandekosan latszott ("eltuntetni nem szabad", lasd SALONIC_SUTISAV.md); a gyogytornas / MP foglalo mintajara az adatlapon mostantol nem latszik (Feri kerese: "pontosan ugy nezzen ki, mint a gyogytornas"). A kozvetlenul a Salonicon foglalo latogato igy az adatlapon nem lat Salonic-sutisavot. **Kiegeszites (2026-10-14, Feri kerese):** az "A foglalasod" oldalakon (reszletek / idopont modositasa / sikeroldalak - az SMS-ben es az e-mailben kuldott modositas-link ide visz) a sutisav sem latszik; a sutisavot rejto szabaly mar `body[class*="customer-mosaic"] .cc-window, ... .cc-revoke` (szures nelkul; pmu.css: `body.customer-mosaic-pmu`). A tobbi, nem felsorolt Salonic-oldalon is rejtett, igy a korabbi "kompakt sav" szabalyok (`Sutisav (cookieconsent) kompakt`) mar nem lathato savra vonatkoznak. Visszaallitas: a blokk torlese (`/* ===== Gyogytornas adatlap` utani resz) vagy a PR revertje.

**Hogyan eles:** a `main` elesitesevel (Cloudflare Pages): a Salonic-fiokok az "Egyedi CSS URL" beallitasbol toltik (`https://www.mosaicheadspa.hu/salonic/mosaic.css`, PMU: `.../pmu.css`); a Salonic-oldali beallitashoz NEM nyultunk. A CSS gyorsitotara rovid (lasd `tools/netlify-build.mjs`).

**Teszt:** `PLAYWRIGHT_UTVONAL=<playwright-core szulomappaja> node tools/salonic-css-hatokor-teszt.mjs` (20/20): a blokk csak az adatlapon ervenyes, az "A foglalasod" oldalakon nem (a sutisav rejtese kivetelevel: az ott is rejtett); a HeadSpa-fiok angol szoveget kap. Kezi vizsgalat: a valodi Salonic adatlapok (`/foglalo-motor?business=oxygen|hair|headspa|laser|pmu`) a helyi CSS-sel (Playwright route: `/salonic/mosaic.css` -> helyi fajl; csak GET, foglalas nem megy be), mobil 390 es asztali 1280 px; szamitott meretek (mezo-, cimke-, gomb-magassag, kozok, betumeret) osszevetve a gyogytornaval: mobilon azonosak.
