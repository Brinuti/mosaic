# Kapuzott WordPress-snippet (valodi, eles vegponttol vegpontig proba) - JOVAHAGYASRA

**Allapot: ELESBEN (Feri dontese 2026-10-14: "mehet elesbe, suti savot ne rakjunk ki egyaltalan"). A lenti kapuzott valtozat HELYETT az egyszeru betolto fut; a suti.js (sutisav) NEM toltodik.** Telepites csak Feri + a meresi felelos (ChatGPT / meresi Claude) jovahagyasa utan. Az eles oldal viselkedese a latogatoknak NEM valtozik.

## Mit csinal
Egy kicsi `<head>`-szkript (Code Snippets, "csak elol"), ami a `launcher.js`-t es a `suti.js`-t CSAK akkor tolti be, ha **a fulben `gy_motor=1` (csak a `?motor=1` allitja be)**, es ezen belul:
1. az URL-ben `?motor=1` van (vagy ezt korabban ebben a fulben beallitottuk: `sessionStorage.gy_motor === '1'`) - a tesztelo kapcsolja be magnak;
2. a lap a motor Salonic-adatlap kereteben fut (`window.name === 'gy-adatlap'`) - csak a motor nyitja;
3. koszonooldal (`/allapot-ok/`, `/foglalas-ok/`) ES a fulben van a motor egyszeri tokenje (`sessionStorage.gy_tk`) - csak a motorral foglalo tesztelo.
Minden mas latogato: **semmi nem toltodik, semmi nem fut, a DOM nem valtozik.** A motor `arany` kapcsoloja 0 marad.

## Mit NEM erint
- A GTM-WCPQM7N, a GA4, a Google Ads-cimkek, az `/allapot-ok` es `/foglalas-ok` oldalak jelenlegi meresei: semmi uj kod nem fut a valodi latogatokon, igy a konverziok, a mintak, a bevetel nem valtozik.
- A latogatok nem latjak a sutisavot (az csak a tesztelonek jelenik meg, amig a motor eles bekapcsolasat Feri nem hagyja jova).
- Az elo foglalasi folyamat (Salonic-link) valtozatlan marad a latogatoknak.

## Kockazatok es visszaallitas
- Hibakockazat: a szkript try/catch-ben fut, ~15 sor, hiba eseten nem tolt semmit. A betoltendo fajlok a Cloudflare Pages-rol jonnek (`/gy-foglalas/...`); ha ez nem elerheto, csak a tesztelo jar rosszul.
- Visszaallitas: a snippet kikapcsolasa / torlese (1 kattintas, Code Snippets). Kovetkezmeny nelkul.
- Tesztelo-oldali mellekhatas: a probat vegzo bongeszoben a Salonic-oldal sajat merokodjai (GTM) a keretben futnak, mint egy valodi foglalasnal; a proba foglalas teszt-vendeggel, nem csucsidoben, azonnali lemondassal tortenik (Feri jovahagyasa megvan).

## A kod (PHP, Code Snippets, "Run snippet everywhere" / csak frontend)
Szigoritva a ChatGPT-review (2. kor) utan: `?motor=0` TELJES kikapcsolas (kulcsok torlese, semmi nem toltodik); a tokenes koszonooldal es a keret CSAK akkor fut, ha a fulben `gy_motor === '1'` is van (a keret a szulovel azonos origin, igy a sessionStorage kozos).
```php
add_action('wp_head', function () {
  if (is_admin()) return;
  ?>
<script>
(function () {
  try {
    var q = new URLSearchParams(location.search);
    var m = q.get('motor');
    if (m === '0') {
      ['gy_motor', 'gy_tk', 'gy_b'].forEach(function (k) { try { sessionStorage.removeItem(k); } catch (e) {} try { localStorage.removeItem(k); } catch (e) {} });
      return;
    }
    if (m === '1') sessionStorage.setItem('gy_motor', '1');
    var kapu = sessionStorage.getItem('gy_motor') === '1';
    if (!kapu) return;
    var keret = window.top !== window && window.name === 'gy-adatlap';
    if (!keret && window.top !== window) return;
    var be = function (src) { var s = document.createElement('script'); s.src = src; s.async = false; document.head.appendChild(s); };
    if (!keret) be('/gy-foglalas/assets/js/suti.js');
    be('/gy-foglalas/assets/js/launcher.js');
  } catch (e) { /* semmi nem toltodik */ }
})();
</script>
  <?php
}, 1);
```
Megjegyzes: a kapu egyetlen feltetele a fulben a `gy_motor === '1'`, amit csak a `?motor=1` allit be. A token (`gy_tk`) onmagaban nem nyit semmit.

## Review (ChatGPT / OpenAI API, 2026-10-13, 2. kor)
DONTES: JOVAHAGYVA MODOSITASSAL - a snippet telepitese igen (a fenti kapuzassal, valtozatlan eles GTM-mel); a `foglalas_kesz` eles triggerenek publikalasa nem resze a jovahagyasnak. A tesztfoglalas feltetelesen: csak akkor, ha a meresi Claude elozetesen igazolja, hogy a teszt kizarhato az eles konverziokuldesbol (a gclid hianya onmagaban nem eleg).

(A `launcher.js` `defer` nelkul, dinamikusan toltve is jol mukodik: `document.currentScript` a dinamikus betoltesnel is a script elem.)

## Ellenorzes telepites utan (a latogatok szemszogebol)
1. Egy `?motor=1` nelkuli oldal HTML-je / halozata: nincs `gy-foglalas` kerelem.
2. `/allapot-ok/` token nelkul: nincs `gy-foglalas` kerelem, nincs uj dataLayer-esemeny.
3. `?motor=1`: a sutisav megjelenik, a Salonic-link a motort nyitja.

## Elesitett valtozat (2026-10-14, Feri dontese: nincs sutisav; Code Snippets #58)
A kapuzott valtozat helyett az egyszeru betolto fut. Ket dolgot csinal: (1) a motor Salonic-adatlapjat tartalmazo keretben (`window.name === 'gy-adatlap'`) a GTM betoltese BLOKKOLVA (a koszonooldal a keretben ne szamoljon masodik konverziot: a meresi Claude feltetele); (2) betolti a `launcher.js`-t; (3) a `suti.js`-t SAV_KI modban (nincs sav, a lableci "Suti beallitasok" link megmarad: docs/SUTISAV.md). A forgalom-szabalyzas a `motor-kapcsolo.json`-ban van (kezdetben 10%), a `?motor=1` / `?motor=0` proba-felulbiralas a launcherben marad. A szerver sutisav nelkul "nincs hozzajarulas"-t lat, az attribucio `GY_ATTR_NELKUL`=1 szerint megy.
```php
add_action('wp_head', function () {
  if (is_admin()) return;
  ?>
<script>(function(){try{if(window.top!==window&&window.name==='gy-adatlap'){var ip=Node.prototype.insertBefore,ap=Node.prototype.appendChild,bl=function(n){return n&&n.tagName==='SCRIPT'&&/googletagmanager\.com\/(gtm|gtag)/i.test(n.src||'');};Node.prototype.insertBefore=function(n,r){return bl(n)?n:ip.call(this,n,r);};Node.prototype.appendChild=function(n){return bl(n)?n:ap.call(this,n);};}}catch(e){}try{var s=document.createElement('script');s.src='/gy-foglalas/assets/js/launcher.js';s.async=false;document.head.appendChild(s);if(window.top===window){var c=document.createElement('script');c.src='/gy-foglalas/assets/js/suti.js';c.async=false;document.head.appendChild(c);}}catch(e){}})();</script>
  <?php
}, 0);
```
Ellenorzes (2026-10-14, eles oldal, Playwright, a Google-kerelmek a halozaton megakadalyozva, csak megszamolva): fo ablakban a `/allapot-ok/` GTM-et probal betolteni (1), a `gy-adatlap` keretben 0 GTM/Google kerelem, a launcher a keretben is betoltodik.
Visszaallitas: a snippet kikapcsolasa es/vagy `motor-kapcsolo.json` arany=0. Az oldal gyorsitotarat (W3TC) es a Cloudflare-t a snippet valtoztatasa utan uriteni kell.

## Aktualis eles valtozat (2026-10-14, Code Snippets #58) - koztes foglalo oldal
Kiegeszites: a `/online-gyogytorna/` cimen a tartalom a motor megnyilasaig rejtett (`html.gy-fh`), hogy ne villanjon fel; robotnak / sebessegmerőnek nem rejti. A launcher nyitja a motort magatol, bezarva a `gy-fh` osztaly lekerul. Minden ra mutato link is a motort nyitja (a `#horgony` linkek nem).
```php
add_action('wp_head', function () {
  if (is_admin()) return;
  ?>
<style>#cookie-alert{display:none!important}html.gy-fh body{visibility:hidden!important}html.gy-fh [data-gy-motor]{visibility:visible!important}</style>
<script>(function(){try{localStorage.setItem('cookieAccepted','true');}catch(e){}try{if(/^\/online-gyogytorna\/?$/i.test(location.pathname)&&!/bot|crawl|spider|slurp|lighthouse|pagespeed|inspectiontool|gtmetrix|pingdom/i.test(navigator.userAgent)&&sessionStorage.getItem('gy_motor')!=='0'&&!/[?&]motor=0/.test(location.search)){document.documentElement.classList.add('gy-fh');setTimeout(function(){document.documentElement.classList.remove('gy-fh');},6000);}}catch(e){}try{if(window.top!==window&&window.name==='gy-adatlap'){var ip=Node.prototype.insertBefore,ap=Node.prototype.appendChild,bl=function(n){return n&&n.tagName==='SCRIPT'&&/googletagmanager\.com\/(gtm|gtag)/i.test(n.src||'');};Node.prototype.insertBefore=function(n,r){return bl(n)?n:ip.call(this,n,r);};Node.prototype.appendChild=function(n){return bl(n)?n:ap.call(this,n);};}}catch(e){}try{var s=document.createElement('script');s.src='/gy-foglalas/assets/js/launcher.js';s.async=false;document.head.appendChild(s);if(window.top===window){var c=document.createElement('script');c.src='/gy-foglalas/assets/js/suti.js';c.async=false;document.head.appendChild(c);}}catch(e){}})();</script>
  <?php
}, 0);

```
