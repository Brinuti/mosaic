/* A modellkereso napok foglaloja (/modellnap): szabad helyek (GET /api/modell/szabad), foglalas (POST /api/modell/foglal), varolista (POST /api/modell/varolista).
   Nincs kulso fuggoseg, nincs meres / esemeny-kuldes (a meresi bekotes kulon, a tulajdonos jovahagyasaval jon). A latogato adatai csak a DOM-ba kerulnek textContent-tel. */
(function () {
  'use strict';
  var gyoker = document.querySelector('[data-modell]');
  if (!gyoker) return;

  var NAP_NEV = { '2026-11-25': 'Szerda, nov. 25.', '2026-11-30': 'Hétfő, nov. 30.' };
  var TIPUS_NEV = { szemoldok: 'Szemöldök', orr: 'Orr', ajak: 'Ajak', koldok: 'Köldök', rook: 'Rook' };
  var HIBAK = {
    foglalt: 'Ezt az időpontot közben valaki lefoglalta. Válassz egy másikat.',
    mar_van: 'Erre az e-mail-címre vagy telefonszámra már van foglalás. Ha módosítani szeretnél, nyisd meg a visszaigazoló levélben kapott linket.',
    tul_sok: 'Erről a készülékről ma már több foglalás érkezett. Kérjük, próbáld holnap, vagy hívj minket: +36 1 901 7444.',
    hibas_adat: 'Kérjük, ellenőrizd az adatokat (név, telefonszám, e-mail-cím).',
    hianyzo_hozzajarulas: 'A foglaláshoz be kell pipálnod a nyilatkozatokat.',
    hianyzo_tartalek_tudomas: 'A tartalék helyhez be kell pipálnod a tudomásulvételt.',
    nincs_elsodleges: 'Ez a tartalék hely most nem foglalható. Válassz másik időpontot.',
    ervenytelen_sav: 'Ez az időpont nem érvényes. Válassz másikat.',
    zarva: 'A foglalás még nem nyílt meg.',
    belso_hiba: 'Hiba történt. Próbáld újra, vagy hívj minket: +36 1 901 7444.',
  };

  var q = function (s, r) { return (r || gyoker).querySelector(s); };
  var qa = function (s, r) { return Array.prototype.slice.call((r || gyoker).querySelectorAll(s)); };
  var urlap = q('[data-mn-urlap]');
  var betoltes = q('[data-mn-betoltes]');
  var betoltesHiba = q('[data-mn-betoltes-hiba]');
  var zarva = q('[data-mn-zarva]');
  var lepes2 = q('[data-mn-lepes2]');
  var lepes3 = q('[data-mn-lepes3]');
  var idokEl = q('[data-mn-idok]');
  var erkezesEl = q('[data-mn-erkezes]');
  var beltEl = q('[data-mn-betelt]');
  var beltSzoveg = q('[data-mn-betelt-szoveg]');
  var varolistaGomb = q('[data-mn-varolista-gomb]');
  var tartalekPipa = q('[data-mn-tartalek-pipa]');
  var hibaEl = q('[data-mn-hiba]');
  var kuldGomb = q('[data-mn-kuldes]');
  var keszEl = q('[data-mn-kesz]');
  var heroSzabad = document.querySelector('[data-mn-szabad]');
  var oraGombok = Array.prototype.slice.call(document.querySelectorAll('.mn-ora'));
  var ragados = document.querySelector('[data-mn-ragados]');

  var adat = null;                 // a /api/modell/szabad valasza
  var ki = { tipus: '', nap: '', ido: '', szerep: '', mod: 'foglal' };

  function el(tag, osztaly, szoveg) {
    var e = document.createElement(tag);
    if (osztaly) e.className = osztaly;
    if (szoveg != null) e.textContent = szoveg;
    return e;
  }
  function nap(datum) { return adat && adat.napok.filter(function (n) { return n.datum === datum; })[0] || null; }
  function szabadSavok(datum, tipus) {
    var n = nap(datum);
    return n && n.tipusok[tipus] ? n.tipusok[tipus].filter(function (s) { return s.szabad; }) : [];
  }
  function szabadDb(tipus, datum) {
    var db = 0;
    adat.napok.forEach(function (n) { if (!datum || n.datum === datum) db += (n.tipusok[tipus] || []).filter(function (s) { return s.szabad; }).length; });
    return db;
  }
  function hibaMutat(uzenet) { hibaEl.textContent = uzenet; hibaEl.hidden = !uzenet; }

  // ---- megjelenites ----------------------------------------------------------------------------------------------------------------------------------
  function felirat() {
    // fo: a valos (elsodleges) helyek; a tartalek helyek kulon jelzese
    if (heroSzabad) {
      if (!adat.nyitva) { heroSzabad.textContent = 'A foglalás hamarosan indul.'; }
      else if (adat.szabadFo > 0) { heroSzabad.textContent = ''; heroSzabad.appendChild(document.createTextNode('Még ')); heroSzabad.appendChild(el('b', '', adat.szabadFo + ' szabad hely')); heroSzabad.appendChild(document.createTextNode('.')); }
      else if (adat.szabadTartalek > 0) { heroSzabad.textContent = 'Az első helyek betelt, tartalék helyre még lehet jelentkezni.'; }
      else { heroSzabad.textContent = 'Minden hely betelt, de feliratkozhatsz a várólistára.'; }
    }
    // az idopont-tablazat: a foglalt idopontok athuzva; zarva (nincs nyitott foglalas) nem kattinthato
    oraGombok.forEach(function (g) {
      var sav = (nap(g.getAttribute('data-nap')) || { tipusok: {} }).tipusok[g.getAttribute('data-tipus')] || [];
      var s = sav.filter(function (x) { return x.szerep === 'elsodleges' && x.ido === g.getAttribute('data-ido'); })[0];
      var foglalt = !!(s && !s.szabad);
      g.classList.toggle('foglalt', foglalt);
      g.disabled = foglalt || !adat.nyitva;
      g.title = foglalt ? 'Ez az időpont már foglalt' : '';
    });
    qa('[data-mn-tipus-szabad]').forEach(function (s) {
      var t = s.getAttribute('data-mn-tipus-szabad'), db = szabadDb(t), l = s.closest('label');
      s.textContent = db > 0 ? db + ' szabad' : 'betelt · várólista';
      l.classList.toggle('betelt', db === 0);
    });
    qa('[data-mn-nap-szabad]').forEach(function (s) {
      var d = s.getAttribute('data-mn-nap-szabad'), l = s.closest('label');
      if (!ki.tipus) { s.textContent = ''; l.classList.remove('betelt'); return; }
      var db = szabadDb(ki.tipus, d);
      s.textContent = db > 0 ? db + ' szabad' : 'betelt';
      l.classList.toggle('betelt', db === 0);
    });
  }

  function idoRajzol() {
    idokEl.textContent = '';
    erkezesEl.hidden = true; beltEl.hidden = true;
    ki.ido = ''; ki.szerep = ''; ki.mod = 'foglal';
    tartalekPipa.hidden = true;
    hibaMutat('');
    if (!ki.tipus || !ki.nap) { lepes3.disabled = true; kuldFelirat(); return; }
    var szabad = szabadSavok(ki.nap, ki.tipus);
    if (!szabad.length) {
      var masik = adat.napok.filter(function (n) { return n.datum !== ki.nap && szabadDb(ki.tipus, n.datum) > 0; })[0];
      beltSzoveg.textContent = 'Erre a napra (' + NAP_NEV[ki.nap] + ') ennél a piercingnél (' + TIPUS_NEV[ki.tipus] + ') minden hely betelt.' + (masik ? ' Másik napon (' + NAP_NEV[masik.datum] + ') még van szabad hely: válaszd azt, vagy iratkozz fel a várólistára erre a napra.' : ' Feliratkozhatsz a várólistára: ha valaki lemond, e-mailben értesítünk, és 30 percig tartjuk neked a helyet.');
      beltEl.hidden = false;
      lepes3.disabled = true; kuldFelirat();
      return;
    }
    szabad.forEach(function (s) {
      var l = el('label', 'mn-ido' + (s.szerep === 'tartalek' ? ' tartalek' : ''));
      var r = el('input'); r.type = 'radio'; r.name = 'ido'; r.value = s.ido; r.setAttribute('data-szerep', s.szerep); r.setAttribute('data-erkezes', s.erkezes);
      l.appendChild(r); l.appendChild(el('b', '', s.ido));
      l.appendChild(el('small', '', s.szerep === 'tartalek' ? 'tartalék hely' : 'érkezés ' + s.erkezes));
      idokEl.appendChild(l);
    });
    lepes3.disabled = true; kuldFelirat();
  }

  function kuldFelirat() {
    kuldGomb.firstChild.nodeValue = ki.mod === 'varolista' ? 'Feliratkozom a várólistára' : 'Lefoglalom az ingyenes időpontot';
  }

  function idoValaszt(r) {
    ki.ido = r.value; ki.szerep = r.getAttribute('data-szerep'); ki.mod = 'foglal';
    erkezesEl.textContent = '';
    erkezesEl.appendChild(document.createTextNode('Érkezés: '));
    erkezesEl.appendChild(el('b', '', r.getAttribute('data-erkezes')));
    erkezesEl.appendChild(document.createTextNode(' (a szúrás kb. ' + r.value + '-kor). Helyszín: 1137 Budapest, Újpesti rakpart 7., 5. em. 25.'));
    erkezesEl.hidden = false;
    tartalekPipa.hidden = ki.szerep !== 'tartalek';
    if (ki.szerep !== 'tartalek') { var p = tartalekPipa.querySelector('input'); if (p) p.checked = false; }
    lepes3.disabled = false; kuldFelirat(); hibaMutat('');
  }

  // ---- esemenyek --------------------------------------------------------------------------------------------------------------------------------------
  qa('input[name="tipus"]').forEach(function (r) {
    r.addEventListener('change', function () {
      ki.tipus = r.value;
      lepes2.disabled = false;
      var jelolt = qa('input[name="nap"]').filter(function (n) { return n.checked; })[0];
      if (!jelolt) {   // ha csak az egyik napon van szabad hely, azt elore kivalasztjuk
        var szabadNapok = adat.napok.filter(function (n) { return szabadDb(ki.tipus, n.datum) > 0; });
        if (szabadNapok.length === 1) { var n = q('input[name="nap"][value="' + szabadNapok[0].datum + '"]'); if (n) { n.checked = true; ki.nap = n.value; } }
      }
      felirat(); idoRajzol();
    });
  });
  qa('input[name="nap"]').forEach(function (r) {
    r.addEventListener('change', function () { ki.nap = r.value; felirat(); idoRajzol(); });
  });
  idokEl.addEventListener('change', function (e) { if (e.target && e.target.name === 'ido') idoValaszt(e.target); });
  varolistaGomb.addEventListener('click', function () {
    ki.mod = 'varolista'; ki.ido = ''; ki.szerep = '';
    tartalekPipa.hidden = true; lepes3.disabled = false; kuldFelirat(); hibaMutat('');
    lepes3.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // a tablazat idopontjara kattintva a foglaloban mar ki van valasztva a piercing, a nap es az idopont
  oraGombok.forEach(function (g) {
    g.addEventListener('click', function () {
      if (!adat || g.disabled) return;
      var t = q('input[name="tipus"][value="' + g.getAttribute('data-tipus') + '"]');
      var n = q('input[name="nap"][value="' + g.getAttribute('data-nap') + '"]');
      if (!t || !n) return;
      t.checked = true; t.dispatchEvent(new Event('change', { bubbles: true }));
      n.checked = true; n.dispatchEvent(new Event('change', { bubbles: true }));
      var r = qa('input[name="ido"]').filter(function (x) { return x.value === g.getAttribute('data-ido'); })[0];
      if (r) { r.checked = true; idoValaszt(r); }
      gyoker.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  function ertek(nev) { var i = urlap.elements[nev]; return i ? String(i.value || '').trim() : ''; }
  function pipa(nev) { var i = urlap.elements[nev]; return !!(i && i.checked); }
  function jeloles(nev, rossz) { var i = urlap.elements[nev]; if (i && i.setAttribute) { if (rossz) i.setAttribute('aria-invalid', 'true'); else i.removeAttribute('aria-invalid'); } }

  urlap.addEventListener('submit', function (e) {
    e.preventDefault();
    hibaMutat('');
    ['vezeteknev', 'keresztnev', 'telefon', 'email'].forEach(function (n) { jeloles(n, false); });
    if (!ki.tipus) return hibaMutat('Válaszd ki a piercinget.');
    if (!ki.nap) return hibaMutat('Válassz napot.');
    if (ki.mod === 'foglal' && !ki.ido) return hibaMutat('Válassz időpontot.');
    var hiany = [];
    if (ertek('vezeteknev').length < 2) hiany.push('vezeteknev');
    if (ertek('keresztnev').length < 2) hiany.push('keresztnev');
    if (ertek('telefon').replace(/\D/g, '').length < 8) hiany.push('telefon');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(ertek('email'))) hiany.push('email');
    if (hiany.length) { hiany.forEach(function (n) { jeloles(n, true); }); urlap.elements[hiany[0]].focus(); return hibaMutat('Kérjük, add meg helyesen a megjelölt adatokat.'); }
    if (!pipa('elmult18') || !pipa('tudomas') || !pipa('adat')) return hibaMutat('A foglaláshoz be kell pipálnod a nyilatkozatokat.');
    if (ki.mod === 'foglal' && ki.szerep === 'tartalek' && !pipa('tartalek')) return hibaMutat('A tartalék helyhez be kell pipálnod a tudomásulvételt.');

    var torzs = { tipus: ki.tipus, nap: ki.nap, vezeteknev: ertek('vezeteknev'), keresztnev: ertek('keresztnev'), telefon: ertek('telefon'), email: ertek('email'),
      elfogad: pipa('tudomas') && pipa('adat'), elmult18: pipa('elmult18'), csapda: ertek('csapda'), forras: 'modellnap' };
    var vegpont = '/api/modell/foglal';
    if (ki.mod === 'varolista') vegpont = '/api/modell/varolista';
    else { torzs.ido = ki.ido; torzs.tartalek = ki.szerep === 'tartalek' && pipa('tartalek'); }
    kuldGomb.disabled = true;
    fetch(vegpont, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(torzs) })
      .then(function (v) { return v.json().then(function (j) { return { status: v.status, j: j }; }); })
      .then(function (v) {
        kuldGomb.disabled = false;
        if (v.j && v.j.ok) return kesz(v.j, torzs);
        hibaMutat(HIBAK[v.j && v.j.hiba] || HIBAK.belso_hiba);
        if (v.j && (v.j.hiba === 'foglalt' || v.j.hiba === 'nincs_elsodleges')) toltes(true);
      })
      .catch(function () { kuldGomb.disabled = false; hibaMutat('Nincs kapcsolat. Próbáld újra, vagy hívj minket: +36 1 901 7444.'); });
  });

  function kesz(j, torzs) {
    var elonezet = adat && adat.kornyezet === 'elonezet';
    var cim = q('[data-mn-kesz-cim]'), szoveg = q('[data-mn-kesz-szoveg]'), lista = q('[data-mn-kesz-adat]'), link = q('[data-mn-kesz-link]');
    var varolista = ki.mod === 'varolista';
    cim.textContent = varolista ? 'Feliratkoztál a várólistára, ' + torzs.keresztnev + '!' : 'Megvan a helyed, ' + torzs.keresztnev + '!';
    szoveg.textContent = elonezet ? 'Előnézeti próba: a foglalás rögzült, de e-mail nem megy ki.'
      : varolista ? 'Ha felszabadul egy hely, e-mailben értesítünk a(z) ' + torzs.email + ' címen, és 30 percig tartjuk neked.'
      : 'Küldtünk egy visszaigazoló e-mailt a(z) ' + torzs.email + ' címre. A nap előtt egy kattintással kérjük megerősíteni, hogy jössz.';
    lista.textContent = '';
    function sor(k, v) { var d = el('div'); d.appendChild(el('dt', '', k)); d.appendChild(el('dd', '', v)); lista.appendChild(d); }
    sor('Piercing', TIPUS_NEV[torzs.tipus]);
    sor('Nap', NAP_NEV[torzs.nap] || torzs.nap);
    if (!varolista) {
      var a = qa('input[name="ido"]').filter(function (r) { return r.value === torzs.ido; })[0];
      sor('Érkezés', (a && a.getAttribute('data-erkezes')) || '');
      sor('A szúrás időpontja', 'kb. ' + torzs.ido);
      sor('Ár', '0 Ft – az ékszert megtartod');
    }
    link.hidden = varolista || !j.link;
    if (j.link) link.setAttribute('href', j.link);
    urlap.hidden = true;
    if (ragados) ragados.hidden = true;
    ragadosKesz = true;
    keszEl.hidden = false;
    keszEl.focus();
    keszEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ---- betoltes ---------------------------------------------------------------------------------------------------------------------------------------
  function toltes(csendes) {
    return fetch('/api/modell/szabad', { cache: 'no-store' })
      .then(function (v) { return v.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw new Error('hibas valasz');
        adat = j;
        betoltes.hidden = true; betoltesHiba.hidden = true;
        zarva.hidden = !!j.nyitva;
        urlap.hidden = !j.nyitva;
        if (j.kornyezet === 'elonezet' && !q('.mn-elonezet')) {
          var jel = el('p', 'mn-megjegyzes mn-elonezet', 'Előnézeti próba: a foglalások kipróbálhatók, de e-mail nem megy ki, és az éles helyeket nem foglalják le.');
          gyoker.querySelector('.mn-doboz').insertBefore(jel, gyoker.querySelector('.mn-doboz').firstChild);
        }
        felirat();
        if (csendes) { var megvan = szabadSavok(ki.nap, ki.tipus).some(function (s) { return s.ido === ki.ido; }); var regiIdo = ki.ido; idoRajzol(); if (megvan && regiIdo) { var r = qa('input[name="ido"]').filter(function (x) { return x.value === regiIdo; })[0]; if (r) { r.checked = true; idoValaszt(r); } } }
        ragadosKezel();
      })
      .catch(function () { betoltes.hidden = true; if (!csendes) betoltesHiba.hidden = false; if (heroSzabad) heroSzabad.textContent = ''; });
  }

  // ---- ragados gomb (mobil): amig a hos es a foglalo nem latszik ---------------------------------------------------------------------------------
  var ragadosKesz = false;
  function ragadosKezel() {
    if (ragadosKesz) return;
    ragadosKesz = true;
    if (!ragados || !('IntersectionObserver' in window) || !adat || !adat.nyitva) return;
    var hosLatszik = true, foglaloLatszik = false;
    var frissit = function () { ragados.hidden = hosLatszik || foglaloLatszik; };
    var hos = document.querySelector('.mn-hos'), foglalo = document.getElementById('foglalas');
    if (hos) new IntersectionObserver(function (e) { hosLatszik = e[0].isIntersecting; frissit(); }, { threshold: 0 }).observe(hos);
    if (foglalo) new IntersectionObserver(function (e) { foglaloLatszik = e[0].isIntersecting; frissit(); }, { threshold: 0 }).observe(foglalo);
  }

  toltes(false);
})();
