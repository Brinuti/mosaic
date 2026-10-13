# Kapuzott WordPress-snippet (valodi, eles vegponttol vegpontig proba) - JOVAHAGYASRA

**Allapot: NINCS telepitve.** Telepites csak Feri + a meresi felelos (ChatGPT / meresi Claude) jovahagyasa utan. Az eles oldal viselkedese a latogatoknak NEM valtozik.

## Mit csinal
Egy kicsi `<head>`-szkript (Code Snippets, "csak elol"), ami a `launcher.js`-t es a `suti.js`-t CSAK akkor tolti be, ha **mindharom** igaz valamelyike teljesul:
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
```php
add_action('wp_head', function () {
  if (is_admin()) return;
  ?>
<script>
(function () {
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('motor') === '1' || q.get('motor') === '0') sessionStorage.setItem('gy_motor', q.get('motor'));
    var kapu = sessionStorage.getItem('gy_motor') === '1';
    var keret = window.top !== window && window.name === 'gy-adatlap';
    var koszono = /^\/(allapot-ok|foglalas-ok)\/?$/i.test(location.pathname);
    var token = !!sessionStorage.getItem('gy_tk');
    if (!(kapu || keret || (koszono && token))) return;
    var be = function (src) { var s = document.createElement('script'); s.src = src; s.async = false; document.head.appendChild(s); };
    if (!keret) be('/gy-foglalas/assets/js/suti.js');
    be('/gy-foglalas/assets/js/launcher.js');
  } catch (e) { /* semmi nem toltodik */ }
})();
</script>
  <?php
}, 1);
```
(A `launcher.js` `defer` nelkul, dinamikusan toltve is jol mukodik: `document.currentScript` a dinamikus betoltesnel is a script elem.)

## Ellenorzes telepites utan (a latogatok szemszogebol)
1. Egy `?motor=1` nelkuli oldal HTML-je / halozata: nincs `gy-foglalas` kerelem.
2. `/allapot-ok/` token nelkul: nincs `gy-foglalas` kerelem, nincs uj dataLayer-esemeny.
3. `?motor=1`: a sutisav megjelenik, a Salonic-link a motort nyitja.
