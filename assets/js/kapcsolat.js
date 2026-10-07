// A /kapcsolat oldal uzenetkuldo urlapja: ellenorzes, kuldes a POST "/" (form-name=kapcsolat) utvonalra - ugyanaz a mechanizmus, mint a tobbi urlapnal
// (functions/[[path]].js -> netlify/lib/levelek.js: a szalon e-mailben megkapja, a valasz-cim a latogato e-mail cime).
(function () {
  'use strict';
  var urlap = document.getElementById('kapcsolat-urlap');
  if (!urlap) return;
  var gomb = document.getElementById('kapcsolat-kuldes');
  var hiba = document.getElementById('kapcsolat-hiba');
  var kesz = document.getElementById('kapcsolat-kesz');
  var betoltve = Date.now();
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function jelol(elem, rossz) {
    var szulo = elem.closest('.mezo') || elem.closest('.hozzajarul');
    if (szulo) szulo.classList.toggle('hibas', rossz);
  }
  function ellenoriz() {
    var f = urlap.elements, elso = null;
    function rossz(elem, felt) { jelol(elem, felt); if (felt && !elso) elso = elem; return felt; }
    rossz(f.nev, !f.nev.value.trim());
    rossz(f.email, !EMAIL.test(f.email.value.trim()));
    rossz(f.uzenet, f.uzenet.value.trim().length < 3);
    rossz(f.hozzajarulas, !f.hozzajarulas.checked);
    return elso;
  }
  [].forEach.call(urlap.querySelectorAll('input, textarea, select'), function (e) {
    e.addEventListener('input', function () { if (e.closest('.hibas')) ellenoriz(); });
    e.addEventListener('change', function () { if (e.closest('.hibas')) ellenoriz(); });
  });

  urlap.addEventListener('submit', function (esemeny) {
    esemeny.preventDefault();
    hiba.classList.remove('hiba'); hiba.textContent = '';
    var elso = ellenoriz();
    if (elso) { try { elso.focus(); } catch (e) { /* nincs fokusz */ } return; }
    var f = urlap.elements;
    var adat = new URLSearchParams();
    adat.set('form-name', 'kapcsolat');
    adat.set('bot-field', f['bot-field'].value);
    adat.set('nev', f.nev.value.trim());
    adat.set('email', f.email.value.trim());
    adat.set('telefon', f.telefon.value.trim());
    adat.set('tema', f.tema.value);
    adat.set('uzenet', f.uzenet.value.trim());
    adat.set('hozzajarulas', 'igen');
    adat.set('oldal', 'kapcsolat');
    adat.set('ido_mp', String(Math.round((Date.now() - betoltve) / 1000)));
    gomb.disabled = true;
    var szoveg = gomb.innerHTML;
    gomb.textContent = 'Küldés…';
    fetch('/', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: adat.toString() })
      .then(function (r) {
        if (!r.ok) throw new Error('status ' + r.status);
        urlap.hidden = true;
        kesz.classList.add('latszik');
        try { kesz.focus({ preventScroll: false }); } catch (e) { /* nincs fokusz */ }
      })
      .catch(function () {
        gomb.disabled = false;
        gomb.innerHTML = szoveg;
        hiba.classList.add('hiba');
        hiba.textContent = 'Az üzenetet most nem sikerült elküldeni. Kérjük, próbáld újra, vagy írj nekünk a mosaicheadspa@gmail.com címre, esetleg hívj minket a 06 20 247 4444-es számon.';
      });
  });
})();
