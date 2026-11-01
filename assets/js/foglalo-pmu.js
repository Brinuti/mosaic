// Sminktetovalas foglalo (proba): /foglalo-pmu - a "PMU foglalasi flow - vegleges R2" terv szerint
//
// Fo ag (elso alkalom):  0 nyito -> 1 kezeles -> 2 gyors kerdes (volt-e mar sminktetovalasa; 2026-11-01 ota az idopont ELOTT) -> 3 naptar (csak a szabad napok, a napon belul az idopontok)
//                        -> 4 adatok (a Salonic beagyazott adatlapja) -> 5 koszonooldal; regi tetovalasnal: foto -> naptar (nov. 9-tol) -> elerhetoseg + foto-level -> adatok -> /pmu-foto-ok (nem konverzio)
// Minden kepernyo egy mobilkepernyore fer, gorgetes nelkul.
// B ag: regi PMU - fotokotelezo: (fotos foglalas: foto -> idopont -> elerhetoseg -> Salonic) / (telefonos visszahivas agon: foto -> elerhetoseg -> visszaigazolas) (urlap, e-mail)
// C ag: bizonytalan - 10 perces visszahivas: info -> mikor hivjunk -> elerhetoseg -> visszaigazolas
// D ag: "nem vagyok biztos benne" - fotoellenorzes (mint B, mas szoveggel)
//
// Adatok: a kezelesek a Salonic kezelo-oldalarol, a szabad idopontok a nyilvanos naptar-API-bol
// jonnek (mindketto engedi a mas domainrol valo lekerest). A foglalast a Salonic adatlapja
// rogziti (lathatatlan reCAPTCHA-val, ezert azt nem a mi urlapunk kuldi). Sikeres foglalas utan
// a Salonic a /pmu-ok oldalra iranyit: ott lefut a megszokott meres, majd a klon.js visszahoz a
// proba koszonooldalara (#koszonjuk) - az adatokat a sessionStorage orzi.
(() => {
  'use strict';

  // ?beagyazva=1: a /sminktetovalas-budapest landing foglalo-reszeben, kereten belul fut (lasd lent: beagyazas).
  const BEAGYAZVA = new URLSearchParams(location.search).has('beagyazva');
  // ?reteg=1: a foglalo-reteg (assets/js/booking-engine) kereteben fut: a lepeseit a reteg viszi a sajat elozmenyeibe (nincs kozos bongeszo-elozmeny a keretbol:
  // a reteg visszalepes-szamlalasa pontos, a bongeszo vissza gombja lepesenkent visszalep), es bezaras / ujranyitas utan ott folytatja, ahol tartott
  const RETEG = BEAGYAZVA && new URLSearchParams(location.search).has('reteg');
  // FOTOS ELOSZURES (Feri, 2026-11-01): a foglalo MINDEN szolgaltatasnal ELOSZOR megkerdezi, volt-e mar sminktetovalasa (a kezeles kivalasztasa utan, az idopont ELOTT).
  //  - "Nem, ez lesz az elso": valaszthat idopontot es foglalhat, mint eddig.
  //  - "Igen, van": KOTELEZO fotot feltolteni, es csak utana kap idopontot; a fotos vendegnek minden szolgaltatasra csak 2026-11-09-tol (Europe/Budapest 00:00) kinalunk idopontot.
  //  A fotot es az elerhetoseget az idopont-valasztas UTAN kuldjuk a meglevo pmu-proba-foto level utjan (tablazat + Drive + SMS; a levelben a kezeles es az idopont is szerepel,
  //  "FOGLALASSAL" jelolessel), majd a vendeg a Salonic adatlapjan veglegesiti a foglalast. MERES: a fotos foglalas NEM konverzio (lasd fotosKoszono / pmuLepes / docs/ELTAVOLITAS_LANDING.md):
  //  a siker utan a /pmu-foto-ok oldalra kerul (nem a /pmu-ok-ra), a lepes-meres nem kuld submit / success-t, a dataLayer-lepesek `foto_ut: 1` jelolest kapnak, a pmu_foto_lead `foglalassal: 1`.
  //  A telefonos visszahivas (C ag) valtozatlan: ott a fotos ag tovabbra is csak fotot kuld (nincs foglalas, nincs idopont).
  const FOTOS_LEGKORABBI = Date.UTC(2026, 10, 8, 23, 0, 0) / 1000; // 2026-11-09 00:00 Europe/Budapest (CET = UTC+1)

  // A sajat kereteben nyiltunk meg (a Salonic visszairanyitott): nem rajzolunk, szolunk a szulonek.
  try {
    if (!BEAGYAZVA && window.top !== window.self && window.parent.location.hostname === location.hostname) {
      document.documentElement.style.visibility = 'hidden';
      if (typeof window.parent.mhKeretbenOldal === 'function') window.parent.mhKeretbenOldal(location.href);
      return;
    }
  } catch (e) { /* idegen oldal kereteben */ }

  // 7 napos utolso fizetett kattintas (docs/booking-engine/FORRAS_LPT.md): a szerver altal irt HttpOnly sutibol visszanyerheto kattintasazonositok lekerese a foglalo indulasakor (egyszer, azonos eredet; a szulo
  // window.mhAttribucio-ja inditja, hozzajarulas nelkul nem keri le); a siker utani atiranyitas a mar megjott eredmenyt hasznalja, nem var ra. A koszonooldalon (/pmu-ok, /pmu-vh) nem kell.
  try { if (!/^\/pmu-(ok|vh)\/?$/.test(location.pathname)) { const fo0 = BEAGYAZVA ? window.top : window; if (fo0.mhAttribucio && typeof fo0.mhAttribucio.lptKlikk === 'function') fo0.mhAttribucio.lptKlikk(); } } catch (e) { /* nem kritikus */ }

  const SZALON = {
    cim: 'https://mosaic-pmu.salonic.hu',
    placeId: 14585,
    kezelo: 32428, // Toreki Melitta
    naptar: '76a8541e-bb52-22ab-f8c0-531b86f55abb', // a Salonic naptar-azonositoja
    hely: 'MOSAIC, 1023 Budapest, Bécsi út 2.',
    cimSor: '1023 Budapest, Bécsi út 2. (Kolosy térnél)',
    terkep: 'MOSAIC, 1023 Budapest, Bécsi út 2',
  };
  const API = 'https://api.salonic.hu/calendar/getAvailableTimes';
  const ZONA = 'Europe/Budapest';
  const ELORE_NAP = 92;
  const KEP = '/assets/img/m/';
  const TAROLO = 'mh_pmu_foglalas';
  const TAROLO_C = 'mh_pmu_visszahivas';
  // ?terulet=ajak (a /szajtetovalas-budapest landingrol): a kezeleslista csak az ajak-kezeleseket + a konzultaciot mutatja, a feliratok a szajra szolnak.
  // Jelzes nelkul minden a regi (minden kezeles, sminktetovalas-feliratok).
  const TERULETEK = {
    ajak: {
      re: /ajak/i, cim: 'Szájtetoválás', van: 'Van szájtetoválásod, és javíttatnád?', kerdes: 'Volt már szájtetoválásod?',
      igen: 'Igen, már van szájtetoválásom – ezt szeretném javíttatni', szo: 'szájtetoválás', fotoKezeles: 'Ajaktetoválás – régi tetoválás (fotó alapján)',
    },
  };
  const TERULET = TERULETEK[new URLSearchParams(location.search).get('terulet')] || null;
  // az ertesitesben szereplo "Beküldve innen": a beagyazo landing (csak ismert ertek, mas nem fogadhato el)
  const FORRAS_OLDAL = !BEAGYAZVA ? 'foglalo-pmu' : new URLSearchParams(location.search).get('forras') === 'szajtetovalas-budapest' ? 'szajtetovalas-budapest' : 'sminktetovalas-budapest';

  // kezelesfotok a sminktetovalas oldal sajat kepeibol (kulcsszo -> kep)
  const FOTOK = [
    [/szem[oö]ld[oö]k.*hibrid/i, 'c2eb0f_5b48311124f64d42a66b29ce2c4bef95.jpg'],
    [/szem[oö]ld[oö]k/i, 'c2eb0f_e6bcf204c9164857a3c5ae2ed41b71c7.jpg'],
    [/ajak.*r[uú]zs/i, 'c2eb0f_14edf618439f44d88072604878d0cbd6.jpg'],
    [/ajak/i, 'c2eb0f_014b63526bc644c7a234475fb367a963.jpg'],
    [/szemh[eé]j/i, 'c2eb0f_89cc6bf1793c48f193ce38d64d87e940.jpg'],
    [/szempilla/i, 'c2eb0f_414f6e9eff9f4b77975073587d6d5624.jpg'],
    [/konzult/i, 'c2eb0f_c9d6d48560364c5685123a9408f1b4f9.jpg'],
    [/korrekci/i, 'c2eb0f_663d6199748c4770be062d8c47dc0276.jpg'],
  ];
  const EGYEB = /konzult/i; // nem "elso alkalmas" kezeles: a lista aljan, kerdes nelkul
  const NEM_FOGLALHATO = /korrekci/i; // korrekciora nem lehet idopontot foglalni: elobb fotot kerunk
  // rovid magyarazat az (i) gombhoz (kulcsszo -> szoveg)
  const LEIRAS = [
    [/szem[oö]ld[oö]k.*hibrid/i, 'A szálrajzolást és a púderes árnyalást ötvözi: élethű szőrszálak, mégis teltebb, tartósabb forma.'],
    [/szem[oö]ld[oö]k.*powder/i, 'Puha, púderes árnyalás szálrajzolás nélkül – mintha szemöldökpúderrel töltenéd ki, finoman sminkelt hatás.'],
    [/ajak.*aquarell/i, 'Áttetsző, természetes színfrissítés kontúr nélkül – mintha színezett ajakbalzsamot viselnél.'],
    [/ajak.*r[uú]zs/i, 'Telítettebb, egyenletes szín és határozottabb kontúr – rúzsos hatás egész nap, smink nélkül.'],
    [/szemh[eé]j/i, 'Finoman elmosott, füstös tushúzás a pillák mentén: kiemeli a szemet, nem kell reggelente megrajzolni.'],
    [/szempilla/i, 'Pigmentálás a pillák tövében: sűrűbbnek, dúsabbnak látszó pillasor, smink nélkül is.'],
    [/konzult/i, 'Személyes, kötetlen találkozó velem a szalonban: átbeszéljük, milyen hatást szeretnél, megtervezem és berajzolom a formát, és megmutatom, melyik technika illik hozzád. Kötelezettség nélkül.'],
  ];

  // --- segedek ---------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const elem = (tag, attr = {}, ...gyerek) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr)) {
      if (k === 'szoveg') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    }
    for (const g of gyerek) if (g != null) e.append(g);
    return e;
  };
  const IKON = {
    naptar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    jobbra: '<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5l7 7-7 7"/></svg>',
    figyel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l9 16H3z"/><path d="M12 10v4M12 16.5v.5"/></svg>',
    telefon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z"/></svg>',
  };
  const ikon = (nev) => elem('span', { html: IKON[nev], style: 'display:contents' });
  // a koszono kepernyokon a kezelo (kep + nev): a kartya / terkep es a szoveg kozott
  const MELITTA_KEP = '/assets/img/m/c2eb0f_a4af4c18f0f64aff93f4c57ed0fb326ef000.jpg';
  const melittaSor = (szoveg) => elem('div', { class: 'melitta kezelo-sor' }, elem('img', { src: MELITTA_KEP, alt: 'Töreki Melitta' }), elem('div', {}, elem('b', { szoveg: 'Töreki Melitta' }), elem('span', { szoveg })));
  // a kartyan belul, a szoveg es a terkep / a jobb szel kozott: kep + nev + roviden, mi fog tortenni
  const melittaOszlop = (szoveg) => elem('span', { class: 'kezelo-oszlop' }, elem('img', { src: MELITTA_KEP, alt: 'Töreki Melitta' }), elem('b', { szoveg: 'Töreki Melitta' }), elem('small', { szoveg }));
  const ft = (n) => new Intl.NumberFormat('hu-HU').format(n) + ' Ft';
  const fmt = (ts, o) => new Intl.DateTimeFormat('hu-HU', { timeZone: ZONA, ...o }).format(new Date(ts * 1000));
  const napKulcs = (ts) => fmt(ts, { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\s/g, '');
  const ora = (ts) => fmt(ts, { hour: '2-digit', minute: '2-digit' });
  // "Vasárnap, okt. 4." (mint a tervben)
  const napNev = (ts) => { const h = fmt(ts, { weekday: 'long' }); return h.charAt(0).toUpperCase() + h.slice(1) + ', ' + fmt(ts, { month: 'short', day: 'numeric' }); };
  const teljes = (ts) => napNev(ts) + ' · ' + ora(ts);
  // a sminktetovalas (90-120 perces Salonic-sav) a tervezessel es elorajzolassal egyutt kb. 2-2,5 ora - mindenhol igy kommunikaljuk
  const idotartam = (p) => { if (p >= 90) return 'kb. 2–2,5 óra'; if (p < 60) return 'kb. ' + p + ' perc'; const o = p / 60; return 'kb. ' + (Number.isInteger(o) ? o : o.toFixed(1).replace('.', ',')) + ' óra'; };
  const szoveg = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
  const tarol = (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privat mod */ } };
  const olvas = (k) => { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } };

  // --- lepes-meres (Feri, 2026-10-11): a PMU-foglalo is kuldi a lepeseit ugyanabba a nevtelen szamlaloba es (hozzajarulassal) GA4-be, mint a
  // foglalo-motor (assets/js/booking-engine/lepes-meres.js; uzletag: pmu). Suti / azonosito / szemelyes adat nelkul. A megnyitast (open, business)
  // a motor retege szamolja; itt a szolgaltatastol a sikerig. Robot (webdriver) es probajeles bongeszo (?proba=1 -> localStorage mhProba) nem szamolodik.
  const pmuLepes = (() => {
    const VEGPONT = '/api/foglalo-szamlalo';
    const NEV = { service: 'booking_service', slots_loaded: 'booking_slots_loaded', slot: 'booking_slot', form_start: 'booking_form_start', submit: 'booking_submit', success: 'booking_success', error: 'booking_error' };
    let proba = false;
    try {
      const q = new URLSearchParams(location.search).get('proba');
      if (q === '1') localStorage.setItem('mhProba', '1'); else if (q === '0') localStorage.removeItem('mhProba');
      proba = localStorage.getItem('mhProba') === '1';
    } catch (e) { /* tiltott tarolo: nem proba */ }
    const robot = () => { try { return !!navigator.webdriver && !window.__MH_SZAMLALO_PROBA; } catch (e) { return false; } };
    const volt = new Set();
    return (lepes, egyszerKulcs, o = {}) => {
      try {
        if (proba || !NEV[lepes]) return;
        // fotos foglalas: nincs submit / sikerjelzes (nem konverzio); a lepesek tobbi esemenye `foto_ut: 1` jelolest kap (a mero-oldal szurheti)
        const fotos = fotosUt();
        if (fotos && (lepes === 'success' || lepes === 'submit')) return;
        if (egyszerKulcs !== undefined) { const k = lepes + ':' + egyszerKulcs; if (volt.has(k)) return; volt.add(k); }
        const sid = o.serviceId !== undefined && /^[A-Za-z0-9_-]{1,40}$/.test(String(o.serviceId)) ? String(o.serviceId) : 'none';
        try {
          const s = window.mhSuti;
          if (s && typeof s.engedely === 'function' && s.engedely('ana')) (window.dataLayer = window.dataLayer || []).push({ event: NEV[lepes], business: 'pmu', service_id: sid, source_page: '/foglalo-pmu', foto_ut: fotos ? 1 : undefined, load_ms: lepes === 'slots_loaded' ? o.loadMs : undefined, step: undefined, error_type: lepes === 'error' ? (o.tipus || 'client_error') : undefined });
        } catch (e) { /* nem kritikus */ }
        if (robot() || fotos) return; // a belso, nevtelen szamlalo a fotos utat nem szamolja (nem foglalas-konverzio)
        const adat = { lepes, uzletag: 'pmu' };
        if (lepes === 'slots_loaded') adat.load_ms = Math.max(0, Math.min(60000, Math.round(Number(o.loadMs) || 0)));
        if (lepes === 'error') adat.tipus = o.tipus === 'verify_failed' ? 'verify_failed' : 'client_error';
        const torzs = JSON.stringify(adat);
        if (navigator.sendBeacon && navigator.sendBeacon(VEGPONT, new Blob([torzs], { type: 'text/plain' }))) return;
        fetch(VEGPONT, { method: 'POST', body: torzs, keepalive: true, credentials: 'omit', headers: { 'content-type': 'text/plain' } }).catch(() => {});
      } catch (e) { /* a meres hibaja nem akadalyozhatja a foglalast */ }
    };
  })();

  // --- PM-3 (meresi oldal jovahagyas, #167 6309629120, 2026-10-21): masodlagos lead-esemenyek a dataLayerbe (pmu_foto_lead, pmu_visszahivas_lead).
  // CSAK dataLayer: magatol semmit nem kuld; a GTM / platform-lekepezes kulon DECISION (kulso fiok). Hozzajarulas ('ana') nelkul, probajeles bongeszoben es ismeretlen tipusnal nincs esemeny.
  // A hivo a SIKERES bekuld() UTAN hivja, beadasonkent egyszer (uj event_id beadasonkent; azonos azonositoval masodszor nem pushol). A visszahivas elsodleges lead-hordozoja marad a /pmu-vh koszonooldal.
  // Nincs nev / e-mail / telefon / foto / kezeles- vagy idopont-szoveg / URL: csak zart ertekek es veletlen azonosito.
  // PM3-BEGIN
  const pmuLead = (() => {
    const NAPSZAK = { 'Délelőtt (9–12)': 'delelott', 'Kora délután (12–15)': 'kora_delutan', 'Délután (15–18)': 'delutan', 'Bármikor': 'barmikor' };
    const volt = new Set();
    const ujAzonosito = () => {
      try { const b = new Uint8Array(8); crypto.getRandomValues(b); return 'pl_' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(''); } catch (e) { return 'pl_' + Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36); }
    };
    const fn = (tipus, o = {}) => {
      try {
        if (tipus !== 'foto' && tipus !== 'visszahivas') return;
        let proba = false;
        try { proba = localStorage.getItem('mhProba') === '1'; } catch (e) { /* tiltott tarolo: nem proba */ }
        if (proba) return;
        const s = window.mhSuti;
        if (!(s && typeof s.engedely === 'function' && s.engedely('ana'))) return;
        const id = typeof o.id === 'string' && /^pl_[a-z0-9]{8,24}$/.test(o.id) ? o.id : ujAzonosito();
        if (volt.has(tipus + ':' + id)) return;
        volt.add(tipus + ':' + id);
        const adat = { event: tipus === 'foto' ? 'pmu_foto_lead' : 'pmu_visszahivas_lead', business: 'pmu', lead_type: tipus, source_page: '/foglalo-pmu', event_id: id };
        if (tipus === 'foto') {
          adat.ag = o.ag === 'D' ? 'D' : 'B';
          adat.foto_db = Math.max(1, Math.min(5, Math.round(Number(o.fotoDb) || 1)));
          adat.idopont_kert = o.idopontKert ? 1 : 0;
          adat.foglalassal = o.foglalassal ? 1 : 0; // 1: a vendeg ezutan a naptarban foglal is (fotos foglalas; NEM konverzio)
        } else adat.mikor_napszak = Object.prototype.hasOwnProperty.call(NAPSZAK, o.napszak) ? NAPSZAK[o.napszak] : 'barmikor';
        (window.dataLayer = window.dataLayer || []).push(adat);
      } catch (e) { /* a meres hibaja nem akadalyozhatja a kuldest */ }
    };
    fn.ujAzonosito = ujAzonosito;
    return fn;
  })();
  // PM3-END

  function leker(url, o = {}) {
    const ab = new AbortController();
    const ido = setTimeout(() => ab.abort(), 15000);
    return fetch(url, { credentials: 'omit', signal: ab.signal, ...o }).finally(() => clearTimeout(ido));
  }

  const allapot = {
    kezelesek: [], kezeles: null, kezdesek: [], kezdesekKezeles: null,
    slot: null, elozmeny: null, ag: 'B', fotok: [], fotoKezeles: null,
    cKert: false, cSav: null, honap: null, naptarNap: null, kerdesValasz: null, kerdesCel: null, fotoKuldve: false, kezdesekFotos: false,
  };
  // fotos ut: a foglalo fo agaban (nem a telefonos visszahivasnal) a vendegnek van / nem biztos benne, hogy van regi sminktetovalasa
  // (a mar elkuldott foto utan a munkamenet fotos MARAD: a valasz atvaltasa / kezelesvaltas nem nyit konverzios utat)
  const fotosUt = () => allapot.kerdesCel !== 'c-ido' && (allapot.fotoKuldve || (!!allapot.kerdesValasz && allapot.kerdesValasz !== 'elso'));
  // a nov. 9-i kezdet utan a "legkorabbi idopont: november 9." szovegek nem jelennek meg
  const megNov9 = () => Date.now() / 1000 < FOTOS_LEGKORABBI;
  // a kinalt kezdesek fotos vendegnek MINDIG >= nov. 9. (kesve erkezo / elavult valasz ellen is: a megjelenitesnel is szurunk)
  const kezdesekLatszik = () => (fotosUt() ? allapot.kezdesek.filter((ts) => ts >= FOTOS_LEGKORABBI) : allapot.kezdesek);
  // a foto feltoltese + elkuldese meg hianyzik (a vendeg ezutan kaphat idopontot / mehet az adatlapra)
  const fotoKell = () => fotosUt() && !allapot.fotoKuldve;
  // a foto elkuldeset a bongeszo-munkamenetben (sessionStorage) is megjegyezzuk: ujratoltes, uj keret (masik arkartya a landingen), uj nezet utan is fotos marad a vendeg
  const FOTOS_JEL = 'mh_pmu_fotos';
  const fotoElkuldve = () => { allapot.fotoKuldve = true; tarol(FOTOS_JEL, 1); };
  if (olvas(FOTOS_JEL) === 1) allapot.fotoKuldve = true;
  // a foglalo FO-AGI nezeteiben (idopont, adatlap) a telefonos visszahivas ag allapota (kerdesCel = 'c-ido') nem maradhat: a bongeszo / reteg vissza-gombja a telefonos agbol visszahozhatja az idopont-nezetet,
  // ilyenkor a fotos allapotnak is vissza kell allnia (kulonben a fotos vendeg nov. 9. elotti idopontot es konverzios utat kapna)
  const foAgra = () => { if (allapot.kerdesCel === 'c-ido') { allapot.kerdesCel = 'ido'; lepesjelzo(aktualis); } };   // (a lepesjelzo is ujrarajzolodik: a nezet mar a telefonos allapottal rajzolodott)
  if (TERULET) {
    $('logo').textContent = TERULET.cim + ' időpontfoglalás';
    document.querySelector('.belepo b').textContent = TERULET.van;
    document.querySelector('input[name=elozmeny][value=van] + span').textContent = TERULET.igen;
    allapot.fotoKezeles = TERULET.fotoKezeles;
  }
  // a kerdes ket valaszanak alapszovege (a terulet-valtozattal egyutt); az eltavolito szolgaltatasnal (491949) mas a megfogalmazas
  const KERDES_ALAP = { elso: document.querySelector('input[name=elozmeny][value=elso] + span').textContent, van: document.querySelector('input[name=elozmeny][value=van] + span').textContent };
  const eltavolitasE = () => !!allapot.kezeles && /elt[aá]vol[ií]t/i.test(allapot.kezeles.nev || '');

  // --- nezetek es vissza-gomb (a bongeszo vissza-gombja is mukodik, az adatok megmaradnak) ---
  const NEZETEK = [...document.querySelectorAll('[data-nezet]')].map((s) => s.dataset.nezet);
  let aktualis = 'kezdo';
  // lepesjelzo a fejlecben (a logo helyett) minden lepesnel; a nyito- es koszonooldalakon a logo
  const LEPES = {
    szolg: ['fo', 0], kerdes: ['fo', 1], ido: ['fo', 2], adatok: ['fo', 3],
    foto: ['foto', 0], 'foto-adatok': ['foto', 1],
    'c-info': ['c', 0], 'c-ido': ['c', 2], 'c-adatok': ['c', 3],
  };
  // a lepesjelzo lepeseihez tartozo nezetek (a kesz lepesre kattintva ide ugrik)
  const LEPES_NEZET = { fo: ['szolg', 'kerdes', 'ido', 'adatok'], fofoto: ['szolg', 'foto', 'ido', null], foto: ['foto', 'foto-adatok', null], c: ['c-info', 'kerdes', 'c-ido', 'c-adatok'] };
  function lepesjelzo(nev) {
    // a kerdes a telefonos agban is szerepel (ott a 2. lepes)
    let l = nev === 'kerdes' && allapot.kerdesCel === 'c-ido' ? ['c', 1] : LEPES[nev];
    // fotos ut (foglalassal): Kezeles / Foto / Idopont / Adatok - a "Foto" lepes a kerdest + a feltoltest, az "Adatok" az elerhetoseget + a Salonic-adatlapot fedi
    if (fotosUt() && l && l[0] === 'fo') l = ['fofoto', l[1]];
    else if (fotosUt() && (nev === 'foto' || nev === 'foto-adatok')) l = ['fofoto', nev === 'foto' ? 1 : 3];
    $('lepesjelzo').hidden = !l;
    $('logo').hidden = !!l;
    if (!l) return;
    const sorok = {
      fo: ['Kezelés', 'Kérdés', 'Időpont', 'Adatok'],
      fofoto: ['Kezelés', 'Fotó', 'Időpont', 'Adatok'],
      foto: ['Fotó', 'Elérhetőség', 'Kész'],
      c: ['Telefon', 'Kérdés', 'Időpont', 'Elérhetőség'],
    }[l[0]];
    const hol = l[1];
    const nezetek = LEPES_NEZET[l[0]];
    $('lepesjelzo').replaceChildren(...sorok.map((t, i) => {
      const li = elem('li', { class: i < hol ? 'kesz' : i === hol ? 'most' : '', 'aria-current': i === hol ? 'step' : false });
      const bel = [elem('i', { szoveg: i < hol ? '✓' : String(i + 1) }), elem('span', { szoveg: t })];
      // a mar elkuldott fotohoz nem lepunk vissza (nem kuldjuk ujra): a "Foto" lepes ilyenkor a kerdesre visz
      const cel = l[0] === 'fofoto' && nezetek[i] === 'foto' && allapot.fotoKuldve ? 'kerdes' : nezetek[i];
      if (i < hol && cel) li.append(elem('button', { type: 'button', class: 'lepes-gomb', 'aria-label': t + ': vissza erre a lépésre', onclick: () => ugrik(cel) }, ...bel));
      else li.append(...bel);
      return li;
    }));
  }
  // a fejlec vissza gombja mindig az elozo lepesre visz (nem a bongeszo elozmenyeiben lep vissza)
  const ELOZO = {
    szolg: () => 'kezdo',
    kerdes: () => (allapot.kerdesCel === 'c-ido' ? 'c-info' : 'szolg'),
    ido: () => (fotoKell() ? 'foto' : 'kerdes'),
    adatok: () => (fotoKell() ? 'foto-adatok' : 'ido'),
    foto: () => (allapot.kerdesValasz ? 'kerdes' : 'kezdo'),
    'foto-adatok': () => (fotosUt() ? 'ido' : 'foto'),
    'c-info': () => 'kezdo', 'c-ido': () => 'kerdes', 'c-adatok': () => 'c-ido',
  };
  // ha elhagyjuk a kepernyot (masik lepes, vissza, masik ful/oldal), a futo video megall
  const videokLeallit = () => { for (const v of document.querySelectorAll('video')) if (!v.paused) v.pause(); };
  addEventListener('pagehide', videokLeallit);
  document.addEventListener('visibilitychange', () => { if (document.hidden) videokLeallit(); });
  // A retegben a keret nezeteinek sora (a reteg elozmenyeit tukrozi); mentes: bezaras / ujranyitas utan innen folytatja
  const utvonal = ['kezdo'];
  const MENT = 'mh_pmu_allapot', MENT_MS = 30 * 60 * 1000;
  function ment() {
    if (!RETEG) return;
    try {
      if (utvonal.length < 2 || /^(koszonjuk|foto-kesz|c-kesz)/.test(aktualis)) { sessionStorage.removeItem(MENT); return; }
      sessionStorage.setItem(MENT, JSON.stringify({ t: Date.now(), utvonal, kezelesId: allapot.kezeles ? allapot.kezeles.id : null, ag: allapot.ag, kerdesCel: allapot.kerdesCel,
        kerdesValasz: allapot.kerdesValasz, elozmeny: allapot.elozmeny, fotoKuldve: allapot.fotoKuldve, cKert: allapot.cKert, cSav: allapot.cSav, naptarNap: allapot.naptarNap, honap: allapot.honap, slot: allapot.slot }));
    } catch (e) { /* privat mod */ }
  }
  function mutat(nev, uj = false) {
    if (nev !== aktualis) videokLeallit();
    aktualis = nev;
    for (const s of document.querySelectorAll('[data-nezet]')) s.hidden = s.dataset.nezet !== nev;
    $('vissza').style.visibility = nev === 'kezdo' || /kesz$|koszonjuk/.test(nev) ? 'hidden' : 'visible';
    // koszonooldalakon: a telefon balra kerul, jobbra fent "x" (bezaras)
    document.body.classList.toggle('kesz-nezet', /kesz$|koszonjuk/.test(nev));
    lepesjelzo(nev);
    scrollTo(0, 0);
    if (BEAGYAZVA) jelez({ nezet: nev, uj, idx: utvonal.length - 1 });
    ment();
  }
  // a bongeszo-elozmenybol (popstate / reteg-uzenet) inditott nezetbelepes kozbeni atiranyitasok CSEREK, nem uj bejegyzesek: igy a vissza-gomb nem akad be egy erzekelhetetlenul atiranyitott bejegyzesnel
  let tortenetbol = false;
  function ugrik(nev) {
    if (nev === aktualis) return;
    if (tortenetbol) { csere(nev); return; }
    if (RETEG) { utvonal.push(nev); mutat(nev, true); BELEPES[nev] && BELEPES[nev](); return; } // a reteg rak ra elozmeny-bejegyzest
    history.pushState({ nezet: nev }, '', '#' + nev);
    mutat(nev);
    BELEPES[nev] && BELEPES[nev]();
  }
  // a reteg elozmenyeiben a bongeszo vissza / elore gombjara: a reteg szol, melyik nezet (es hanyadik lepes) jon
  if (RETEG) addEventListener('message', (e) => {
    if (e.source !== window.parent || e.origin !== location.origin || !e.data || !e.data.mhPmuNezet) return;
    const nev = NEZETEK.includes(e.data.mhPmuNezet) ? e.data.mhPmuNezet : 'kezdo';
    utvonal.length = (e.data.idx || 0) + 1; utvonal[utvonal.length - 1] = nev;
    mutat(nev);
    tortenetbol = true;
    try {
      if (BELEPES[nev] && !/^(adatok|koszonjuk)$|kesz$/.test(nev)) BELEPES[nev]();
      else if (nev === 'adatok') adatlapEllenor();   // a bongeszo-elozmenyben maradt regi (nem fotos / ures) adatlap nem hasznalhato
    } finally { tortenetbol = false; }
  });
  addEventListener('popstate', (e) => {
    if (RETEG) return; // a retegben a lepeseket a reteg elozmenyei vezerlik
    const nev = (e.state && e.state.nezet) || 'kezdo';
    mutat(NEZETEK.includes(nev) ? nev : 'kezdo');
    // a listak ujrarajzolasa (az adatok megmaradnak); az adatlapot nem toltjuk ujra
    tortenetbol = true;
    try {
      if (BELEPES[nev] && !/^(adatok|koszonjuk)$|kesz$/.test(nev)) BELEPES[nev]();
      else if (nev === 'adatok') adatlapEllenor();   // a bongeszo-elozmenyben maradt regi (nem fotos / ures) adatlap nem hasznalhato
    } finally { tortenetbol = false; }
  });
  $('vissza').addEventListener('click', () => ugrik(ELOZO[aktualis] ? ELOZO[aktualis]() : 'kezdo'));
  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-ugrik]');
    if (!g) return;
    if (g.dataset.ag) { allapot.ag = g.dataset.ag; if (aktualis === 'kezdo') allapot.slot = null; }
    ugrik(g.dataset.ugrik);
  });
  const BELEPES = {};
  // fotos vendegnek az adatlap-keretnek fotos keretnek kell lennie (BELEPES.adatok jeloli: data-fotos=1) es a foto el kell hogy legyen kuldve; kulonben ujra kell epiteni
  // az adatlap-nezetre visszalepve: a telefonos ag allapota nem maradhat (foAgra), fotos vendegnek a keretnek fotos keretnek kell lennie, es mindig kell keret (src)
  function adatlapEllenor() {
    foAgra();
    if (!(fotosAdatlapHiba() || !$('salonic').hasAttribute('src'))) return;
    if (fotosUt() && allapot.slot && allapot.slot < FOTOS_LEGKORABBI) allapot.slot = null;
    csere(!allapot.slot ? (fotoKell() && !allapot.fotok.length ? 'foto' : 'ido') : fotoKell() ? 'foto-adatok' : 'adatok');
  }
  const fotosAdatlapHiba = () => { if (!fotosUt()) return false; const k = $('salonic'); return fotoKell() || !k || k.dataset.fotos !== '1'; };
  // az aktualis nezet CSERELESE (nem uj elozmeny-bejegyzes): a bongeszo vissza gombja ne ugorjon vissza a mar elkuldott fotos nezetre
  function csere(nev) {
    if (RETEG) { utvonal[utvonal.length - 1] = nev; mutat(nev, false); } else { history.replaceState({ nezet: nev }, '', '#' + nev); mutat(nev); }
    BELEPES[nev] && BELEPES[nev]();
  }

  function hibaDoboz(hova, szoveg) {
    hova.replaceChildren(szoveg ? elem('div', { class: 'hiba-doboz', role: 'alert' }, ikon('figyel'), elem('span', { szoveg })) : '');
  }

  // --- Salonic-adatok ----------------------------------------------------------
  async function kezelesekBetolt() {
    if (allapot.kezelesek.length) return;
    const v = await leker(SZALON.cim + '/employees/' + SZALON.kezelo + '/?placeId=' + SZALON.placeId);
    const d = new DOMParser().parseFromString(await v.text(), 'text/html');
    const lista = [];
    for (const i of d.querySelectorAll('input[data-id][data-duration]')) {
      if (lista.some((k) => k.id === i.dataset.id) || NEM_FOGLALHATO.test(i.dataset.name || '')) continue;
      const nyers = (i.dataset.name || '').trim();
      // "Ajaktetovalas - Aquarell - 124.900 Ft helyett most" -> cim, valtozat, eredeti ar
      const m = nyers.match(/^(.*?)\s*-\s*([\d. ]+)\s*Ft helyett most\s*$/i);
      const nev = /konzult/i.test(nyers) ? 'Személyes konzultáció' : m ? m[1] : nyers;
      const [cim, ...tobbi] = nev.split(/\s+-\s+/);
      const foto = (FOTOK.find(([re]) => re.test(nev)) || [, 'c2eb0f_567cfb0230ba49c089087cf55d6ead4e.jpg'])[1];
      lista.push({
        id: i.dataset.id, nev, cim: cim.replace(/^Szemöldök tetoválás$/i, 'Szemöldöktetoválás').replace(/^Szemhéj tetoválás$/i, 'Szemhéjtetoválás'),
        valtozat: tobbi.join(' – '), ar: +i.dataset.price || 0, eredeti: m ? +m[2].replace(/\D/g, '') : 0,
        perc: +i.dataset.duration || 0, foto: KEP + foto, egyeb: EGYEB.test(nev),
      });
    }
    if (!lista.length) throw new Error('nincs kezeles');
    allapot.kezelesek = lista;
  }
  const arSzoveg = (k) => (k.ar ? ft(k.ar) : /ingyenes|konzult/i.test(k.nev) ? 'Ingyenes' : 'Egyedi ár');

  // Szolgaltatas-specifikus legkorabbi idopont (Feri, 2026-11-01): a "Tetovalas eltavolitas" (Salonic 491949) csak a 2026-11-09-i hettol foglalhato; minden mas szolgaltatas valtozatlan.
  // 2026-11-09 00:00 Europe/Budapest (a teli idoszamitas 10-25 ota: CET = UTC+1) = 2026-11-08T23:00Z.
  const LEGKORABBI = { '491949': Date.UTC(2026, 10, 8, 23, 0, 0) / 1000 };
  async function szabadKezdesek(kezelesId, tol, napok, fotos = false) {
    const p = new URLSearchParams({
      startDate: tol, offset: 0, days: napok, placeId: SZALON.placeId, serviceId: kezelesId, employeeId: -1,
      calendarId: SZALON.naptar, pref: '', apiVersion: 1, language: 'hu', excludeNonAcceptingEmployees: 0,
    });
    const j = await (await leker(API + '?' + p)).json();
    if (j.status !== 'success') throw new Error('API: ' + j.status);
    const most = Date.now() / 1000 + 30 * 60; // a fel oran belul kezdodoket mar nem kinaljuk
    const ki = new Set();
    const korai = Math.max(LEGKORABBI[String(kezelesId)] || 0, fotos ? FOTOS_LEGKORABBI : 0); // fotos vendeg: minden szolgaltatasra csak 2026-11-09-tol
    for (const kezelok of Object.values(j.data.blocks || {})) {
      for (const k of Object.values(kezelok)) for (const s of Object.values(k.slots || {})) if (s.timestamp > most && s.timestamp >= korai) ki.add(s.timestamp);
    }
    return [...ki].sort((a, b) => a - b);
  }
  async function kezdesekBetolt(friss) {
    const k = allapot.kezeles;
    const fotos = fotosUt();
    if (!friss && allapot.kezdesekKezeles === k.id && allapot.kezdesekFotos === fotos) return;
    const t0 = Date.now();
    allapot.kezdesek = await szabadKezdesek(k.id, Math.floor(Date.now() / 1000) - 3 * 3600, ELORE_NAP, fotos);
    allapot.kezdesekKezeles = k.id;
    allapot.kezdesekFotos = fotos;
    pmuLepes('slots_loaded', k.id, { serviceId: k.id, loadMs: Date.now() - t0 });
  }

  // --- 1. kezelesvalasztas -------------------------------------------------------
  // nyitott info-buborek: egyszerre csak egy; kattintasra / erintesre, asztalin raallasra is
  function infoBezar() {
    for (const b of document.querySelectorAll('.info-buborek')) b.remove();
    for (const g of document.querySelectorAll('.info-gomb[aria-expanded="true"]')) g.setAttribute('aria-expanded', 'false');
  }
  document.addEventListener('click', (e) => { if (!e.target.closest('.info-gomb')) infoBezar(); });
  function kezelesKartya(k, kattint) {
    const leiras = (LEIRAS.find(([re]) => re.test(k.nev)) || [])[1];
    const kartya = kezelesGomb(k, kattint);
    if (!leiras) return kartya;
    const sor = elem('div', { class: 'kezeles-sor' }, kartya);
    const nyit = () => {
      infoBezar();
      info.setAttribute('aria-expanded', 'true');
      sor.append(elem('div', { class: 'info-buborek', role: 'tooltip', szoveg: leiras }));
    };
    const info = elem('button', { type: 'button', class: 'info-gomb', 'aria-label': 'Mi ez? – ' + k.nev, 'aria-expanded': 'false',
      onclick: (e) => { e.stopPropagation(); info.getAttribute('aria-expanded') === 'true' ? infoBezar() : nyit(); } });
    if (matchMedia('(hover: hover)').matches) { info.addEventListener('mouseenter', nyit); sor.addEventListener('mouseleave', infoBezar); }
    sor.append(info);
    return sor;
  }
  function kezelesGomb(k, kattint) {
    return elem('button', { type: 'button', class: 'kezeles', onclick: kattint },
      elem('img', { src: k.foto, alt: '' }),
      elem('span', {},
        elem('span', { class: 'nev', szoveg: k.egyeb ? k.nev : k.cim }),
        elem('span', { class: 'valtozat', szoveg: [k.egyeb ? 'A szalonban' : k.valtozat, idotartam(k.perc).replace(/^kb\. /, '')].filter(Boolean).join(' · ') })),
      elem('span', { class: 'jobb' },
        elem('span', { class: 'ar', szoveg: arSzoveg(k) }),
        null));
  }
  BELEPES.szolg = async () => {
    try {
      await kezelesekBetolt();
      // az ingyenes konzultacio a lista aljan
      const lista = TERULET ? allapot.kezelesek.filter((k) => k.egyeb || TERULET.re.test(k.nev)) : allapot.kezelesek;
      const sorrend = [...lista.filter((k) => !k.egyeb), ...lista.filter((k) => k.egyeb)];
      $('kezelesek').replaceChildren(...sorrend.map((k) => kezelesKartya(k, () => kezelesValaszt(k))));
    } catch (e) {
      console.error(e);
      hibaDoboz($('kezelesek'), 'Most nem sikerült betölteni a kezeléseket. Kérlek, próbáld újra pár perc múlva, vagy hívj minket: 06 20 247 4444.');
    }
  };
  function kezelesValaszt(k) {
    // a kerdes (volt-e mar sminktetovalasa) a kezeleshez / teruelethez kotott: masik kezelesnel ujra feltesszuk
    if (!allapot.kezeles || allapot.kezeles.id !== k.id) Object.assign(allapot, { honap: null, naptarNap: null, kerdesValasz: null, elozmeny: null });
    allapot.kezeles = k;
    allapot.slot = null;
    allapot.kerdesCel = 'ido';
    pmuLepes('service', undefined, { serviceId: k.id });
    ugrik(allapot.kerdesValasz ? (fotoKell() ? 'foto' : 'ido') : 'kerdes');
  }

  // --- 2. legkozelebbi szabad idopontok ------------------------------------------
  function kezelesFejlec() {
    const k = allapot.kezeles;
    return elem('div', { class: 'valasztott' },
      elem('img', { src: k.foto, alt: '' }),
      elem('span', {},
        elem('span', { class: 'nev', szoveg: k.egyeb ? k.nev : k.cim + (k.valtozat ? ' – ' + k.valtozat : '') }),
        elem('span', { class: 'info', szoveg: arSzoveg(k) + ' · ' + idotartam(k.perc) })),
      elem('button', { type: 'button', class: 'modosit', szoveg: 'Módosítás', onclick: () => ugrik('szolg') }));
  }
  BELEPES.ido = async (uzenet) => {
    foAgra();
    if (!allapot.kezeles) { ugrik('szolg'); return; }
    if (!allapot.kerdesValasz) { ugrik('kerdes'); return; }   // idopontot csak a kerdes (es regi sminktetovalasnal a foto) utan kinalunk
    if (fotoKell() && !allapot.fotok.length) { ugrik('foto'); return; }
    const friss = typeof uzenet === 'string';
    $('ido-kezeles').replaceChildren(kezelesFejlec(), ...(fotosUt() && megNov9() ? [elem('p', { class: 'halk kicsi', style: 'margin:8px 0 0', szoveg: 'A legkorábbi időpont: november 9.' })] : []));
    hibaDoboz($('ido-uzenet'), friss ? uzenet : '');
    $('nap-idok').replaceChildren();
    $('naptar').replaceChildren(elem('div', { class: 'betolt', style: 'grid-column:1/-1', szoveg: 'Szabad napok betöltése…' }));
    try { await kezdesekBetolt(friss); } catch (e) {
      console.error(e);
      hibaDoboz($('naptar'), 'Most nem sikerült lekérni a szabad időpontokat. Kérlek, próbáld újra, vagy hívj minket: 06 20 247 4444.');
      return;
    }
    // elore kijeloljuk az elso szabad napot, igy az idopontok rogton latszanak
    const napok = new Set(kezdesekLatszik().map(napKulcs));
    // ?nap=YYYY-MM-DD (a landingen kivalasztott nap): ha erre a kezelesre is van aznap szabad idopont, azt mutatjuk
    const kertNap = new URLSearchParams(location.search).get('nap');
    if (kertNap && !allapot.kertNapKesz) {
      allapot.kertNapKesz = true;
      const [ev, ho, nap] = kertNap.split('-').map(Number);
      const k = ev ? napKulcs(Date.UTC(ev, ho - 1, nap, 10) / 1000) : null;
      if (k && napok.has(k)) { allapot.naptarNap = k; allapot.honap = honapKulcs(Date.UTC(ev, ho - 1, nap, 10) / 1000); }
    }
    if (!napok.has(allapot.naptarNap)) { allapot.naptarNap = kezdesekLatszik().length ? napKulcs(kezdesekLatszik()[0]) : null; allapot.honap = null; }
    if (!allapot.honap && kezdesekLatszik().length) allapot.honap = honapKulcs(kezdesekLatszik()[0]);
    rajzolNaptar();
  };
  function slotValaszt(ts) {
    foAgra();
    if (fotosUt() && ts < FOTOS_LEGKORABBI) return; // fotos vendegnek nov. 9. elotti idopont nem valaszthato (biztonsagi hatar)
    allapot.slot = ts;
    pmuLepes('slot', undefined, { serviceId: allapot.kezeles && allapot.kezeles.id });
    // fotos vendegnel az idopont utan az elerhetoseg + a foto elkuldese jon, majd a Salonic adatlap; egyebkent egyenesen az adatlap
    ugrik(fotoKell() ? 'foto-adatok' : 'adatok');
  }

  // --- A. teljes naptar (csak a szabad napok) --------------------------------------
  const honapKulcs = (ts) => fmt(ts, { year: 'numeric', month: '2-digit' }).replace(/\s/g, '');
  function honapok() {
    const ma = Math.floor(Date.now() / 1000);
    const ki = [];
    for (let t = ma; t <= ma + ELORE_NAP * 86400; t += 86400) { const k = honapKulcs(t); if (!ki.includes(k)) ki.push(k); }
    return ki;
  }
  function rajzolNaptar() {
    const hk = honapok();
    if (!hk.includes(allapot.honap)) allapot.honap = hk[0];
    const i = hk.indexOf(allapot.honap);
    $('elozo-honap').disabled = i <= 0;
    $('kovetkezo-honap').disabled = i >= hk.length - 1;
    const [ev, ho] = allapot.honap.split('.').filter(Boolean).map(Number);
    const elso = Date.UTC(ev, ho - 1, 1, 10) / 1000;
    const cim = fmt(elso, { year: 'numeric', month: 'long' });
    $('honap-cim').textContent = cim;
    const szabad = new Set(kezdesekLatszik().map(napKulcs));
    const hetnap = (new Date(elso * 1000).getUTCDay() + 6) % 7;
    const napSzam = new Date(Date.UTC(ev, ho, 0)).getUTCDate();
    const cellak = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'].map((n) => elem('div', { class: 'hetnap', szoveg: n }));
    for (let x = 0; x < hetnap; x++) cellak.push(elem('div', { class: 'nnap ures' }));
    for (let n = 1; n <= napSzam; n++) {
      const k = napKulcs(elso + (n - 1) * 86400);
      const van = szabad.has(k);
      cellak.push(elem('button', { type: 'button', class: 'nnap' + (van ? ' szabad' : ''), disabled: !van, 'aria-pressed': String(k === allapot.naptarNap),
        'aria-label': n + '. ' + (van ? 'szabad időpont van' : 'nem elérhető'), szoveg: String(n), onclick: () => { allapot.naptarNap = k; rajzolNaptar(); } }));
    }
    $('naptar').replaceChildren(...cellak);
    ment(); // a nezett nap / honap is megmarad
    // a valasztott nap idopontjai
    // MINDEN Salonic-kinalt kezdest mutatunk (a negyedoras :15 / :45 is): amit a Salonic kinal, pontosan azt latja a vendeg (Feri, 2026-10-29; a Mosaic motorban mar igy van, #520).
    // Korabban a negyedet csak akkor mutattuk, ha mellette nem volt egesz / fel ora: ez a Salonic idopontjainak kb. 48 %-at elrejtette (2026-10-28 meres, docs/booking-engine/SALONIC_SAVOK.md 6.1).
    const idok = kezdesekLatszik().filter((ts) => napKulcs(ts) === allapot.naptarNap);
    // egy erintes az idoponton = tovabb (nincs kulon "ezt valasztom" gomb)
    $('nap-idok').replaceChildren(...(idok.length ? [elem('div', { class: 'nap-cim', szoveg: napNev(idok[0]) }), elem('div', { class: 'idolista' }, ...idok.map((ts) =>
      elem('button', { type: 'button', class: 'idogomb', 'aria-pressed': String(ts === allapot.slot), szoveg: ora(ts), onclick: () => slotValaszt(ts) })))]
      : !szabad.size ? [elem('div', { class: 'doboz-info' }, ikon('naptar'), elem('span', { szoveg: 'Erre a kezelésre jelenleg nincs szabad időpont. Kérj telefonos konzultációt, és közösen találunk egyet!' })),
        elem('div', { style: 'height:12px' }), elem('button', { type: 'button', class: 'gomb', 'data-ugrik': 'c-info' }, 'Telefonos konzultációt kérek ', elem('span', { class: 'nyil', szoveg: '→' }))]
      : [elem('p', { class: 'halk kicsi', szoveg: 'Válassz egy zölddel jelölt napot.' })]));
  }
  $('elozo-honap').addEventListener('click', () => { const hk = honapok(); allapot.honap = hk[Math.max(0, hk.indexOf(allapot.honap) - 1)]; rajzolNaptar(); });
  $('kovetkezo-honap').addEventListener('click', () => { const hk = honapok(); allapot.honap = hk[Math.min(hk.length - 1, hk.indexOf(allapot.honap) + 1)]; rajzolNaptar(); });

  // --- 3. gyors kerdes -------------------------------------------------------------
  function miniOsszegzes(modosit = 'ido') {
    const k = allapot.kezeles;
    return elem('div', { class: 'mini-osszegzes' }, ikon('naptar'),
      elem('span', {}, elem('b', { szoveg: teljes(allapot.slot) }), elem('br'), k.egyeb ? k.nev : k.cim + (k.valtozat ? ' – ' + k.valtozat : ''), elem('br'), elem('span', { class: 'halk', szoveg: arSzoveg(k) + ' · ' + idotartam(k.perc) })),
      elem('button', { type: 'button', class: 'modosit link', style: 'color:var(--hiba);font-weight:400;font-size:13px', szoveg: 'Módosítás', onclick: () => ugrik(modosit) }));
  }
  BELEPES.kerdes = () => {
    const telefon = allapot.kerdesCel === 'c-ido';
    if (!telefon && !allapot.kezeles) { ugrik('szolg'); return; }
    $('kerdes-osszegzes').replaceChildren(telefon ? '' : kezelesFejlec());
    const elt = !telefon && eltavolitasE();
    $('kerdes-cim').textContent = elt ? 'Van sminktetoválásod, amelyet eltávolíttatnál?' : TERULET ? TERULET.kerdes : telefon || (allapot.kezeles && allapot.kezeles.egyeb) ? 'Volt már sminktetoválásod?' : 'Volt már sminktetoválásod ezen a területen?';
    document.querySelector('input[name=elozmeny][value=elso] + span').textContent = elt ? 'Nem, még nincs sminktetoválásom' : KERDES_ALAP.elso;
    document.querySelector('input[name=elozmeny][value=van] + span').textContent = elt ? 'Igen, van – fotót töltök fel róla' : KERDES_ALAP.van;
    for (const r of document.querySelectorAll('input[name=elozmeny]')) r.checked = r.value === allapot.elozmeny;
    $('kerdes-tovabb').disabled = !allapot.elozmeny;
  };
  for (const r of document.querySelectorAll('input[name=elozmeny]')) r.addEventListener('change', () => { allapot.elozmeny = r.value; $('kerdes-tovabb').disabled = false; });
  $('kerdes-tovabb').addEventListener('click', () => {
    allapot.kerdesValasz = allapot.elozmeny;
    if (fotosUt()) {   // fotos lett: a korabbi (nem fotos) idopont, Salonic-keret es kontextus nem maradhat
      if (allapot.slot && allapot.slot < FOTOS_LEGKORABBI) allapot.slot = null;
      const regiKeret = $('salonic');
      if (regiKeret && regiKeret.dataset.fotos !== '1') regiKeret.replaceWith(elem('iframe', { id: 'salonic', title: 'Foglalás véglegesítése' }));
      try { sessionStorage.removeItem('mhBookingCtx'); } catch (e) { /* privat mod */ }
    }
    if (allapot.elozmeny === 'elso') ugrik(allapot.kerdesCel || 'ido');
    else {
      allapot.ag = allapot.elozmeny === 'van' ? 'B' : 'D';
      // fotos ut: a foto kotelezo, utana idopont (a mar elkuldott foto ujra nem kell); telefonos visszahivas: a regi fotos ag
      ugrik(allapot.kerdesCel === 'c-ido' || fotoKell() ? 'foto' : 'ido');
    }
  });

  // --- 4. adatok: a Salonic adatlapja beagyazva ---------------------------------------
  BELEPES.adatok = () => {
    foAgra();
    if (fotosUt() && allapot.slot && allapot.slot < FOTOS_LEGKORABBI) allapot.slot = null;   // regi (nov. 9. elotti, nem fotos) idopont fotos vendegnek nem marad
    if (!allapot.slot) { ugrik('ido'); return; }
    if (!allapot.kerdesValasz) { ugrik('kerdes'); return; }
    if (fotoKell()) { ugrik('foto-adatok'); return; }   // fotos vendeg: elobb a foto + az elerhetoseg (levelben Melittanak), csak utana a Salonic-adatlap
    $('adatok-osszegzes').replaceChildren(miniOsszegzes());
    const k = allapot.kezeles;
    // sajat foglalas-azonosito (booking_id, QA-1/QA-2): ugyanaz az alak, mint assets/js/booking-engine/booking-id.js (mb_ + base36 ido + 14 veletlen karakter); a Salonic a "back" parameterben visszaadja
    const ujFoglalasAzon = () => { const b = new Uint8Array(14); if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b); else for (let i = 0; i < 14; i++) b[i] = Math.floor(Math.random() * 256); const A = '0123456789abcdefghijklmnopqrstuvwxyz'; return 'mb_' + Date.now().toString(36).padStart(9, '0').slice(-9) + Array.from(b, (x) => A[x % 36]).join(''); };
    const bid = ujFoglalasAzon();
    // FOTOS UT: nincs mb_ azonosito a Salonic-cimben (a visszairanyitott /pmu-ok bookingUrl-jeben nincs "back") es nincs illeszkedo mhBookingCtx: a keretben betoltodo /pmu-ok kulcs-iroja
    // (assets/js/foglalas-kulcs.js, nem ellenorzi, hogy keretben fut-e) igy nem tud kulcsot irni -> nincs motoros mb_ parositas, a foglalas nem nyer motoros azonositot
    const fotosFogl = fotosUt();
    if (fotosFogl) { try { sessionStorage.removeItem('mhBookingCtx'); } catch (e) { /* privat mod */ } }
    else try { sessionStorage.setItem('mhBookingCtx', JSON.stringify({ id: bid, created: Date.now(), seen: Date.now(), business: 'pmu', source_page: 'foglalo-pmu', service_id: String(k.id), slot_unix: +allapot.slot, staff_id: '-1', carrier: 'back', sent_at: Date.now(), returned: null, completed_at: null })); } catch (e) { /* privat mod: a "back" parameter akkor is viszi az azonositot */ }
    const url = SZALON.cim + '/guestData/?' + new URLSearchParams({ placeId: SZALON.placeId, serviceId: k.id, employeeId: -1, startDate: allapot.slot, back: bid });
    // a koszonooldalnak (a /pmu-ok meres utan ide jovunk vissza)
    tarol(TAROLO, { ts: allapot.slot, perc: k.perc, nev: k.egyeb ? k.nev : k.cim + (k.valtozat ? ' – ' + k.valtozat : ''), ar: arSzoveg(k), foto: k.foto, tipus: /konzult/i.test(k.nev) ? 'konz' : 'kezeles', fotos: fotosUt() });
    const keretUrl = fotosFogl ? url.replace(/&back=[^&]*/, '') : url;   // a fotos vendeg Salonic-cime "back" nelkul
    $('salonic-link').href = keretUrl;
    pmuLepes('form_start', k.id + ':' + allapot.slot, { serviceId: k.id });
    // mindig uj keret: igy a betoltes nem kerul a bongeszo elozmenyei koze, es a vissza gomb
    // nem a Salonic belso oldalaira lep vissza
    const regi = $('salonic');
    const keret = elem('iframe', { id: 'salonic', title: 'Foglalás véglegesítése', src: keretUrl, style: 'visibility:hidden', 'data-fotos': fotosFogl ? '1' : '0' });
    // a "Nem jelenik meg az urlap?" tartalek-link csak akkor latszik, ha 8 mp alatt sem toltott be
    const tartalek = $('salonic-link').closest('p');
    tartalek.hidden = true;
    // fotos vendegnek nincs "nyisd meg a teljes ablakban" tartalek-link: a Salonic ott a /pmu-ok-ra iranyitana (konverzios oldal); neki telefonszam
    $('salonic-nyisd').hidden = fotosUt();
    $('salonic-hivj').hidden = !fotosUt();
    const lassu = setTimeout(() => { tartalek.hidden = false; }, 8000);
    keret.onload = () => { clearTimeout(lassu); $('salonic-betolt').hidden = true; keret.style.visibility = ''; };
    $('salonic-betolt').hidden = false;
    regi.replaceWith(keret);
  };
  // A keretben a mi egyik oldalunk toltodott be (suti.js / ez a fajl jelzi):
  //  - sikeres foglalas: a /pmu-ok oldalra iranyitott - a teljes ablakban nyitjuk meg (meres!),
  //    a mh_proba jelre a klon.js a meres utan visszahoz a koszonooldalra;
  //  - ha az idopont kozben elkelt, a Salonic "vissza" iranyit (a fooldalra vagy ide).
  // R3 (DECISION #196/1): a siker utani teljes-ablakos atiranyitas (/pmu-ok) URL-je is hordozza a Google-azonositokat (gclid / gbraid / wbraid), mint a fo foglalo koszonooldal-atadasa
  // (withAttribution). MINDEN forras a marketing-hozzajarulasi kapun megy: a szulo (landing / reteg gazdaoldala, azonos eredet) window.mhAttribucio.googleAzonositok()-a adja (az aktualis
  // URL azonositoi, a hozzajarulassal mentett mh_attr, a Google-cimke sutije); hozzajarulas nelkul / kifejezett elutasitas utan / suti.js nelkul ures - ilyenkor a /pmu-ok URL-je azonosito
  // nelkul marad, mint a main-en. A szulo URL-jet SOSEM olvassuk kozvetlenul. Csak a HIANYZO kulcsokat fuzi hozza; ervenytelen / idegen eredetu szulo eseten az URL valtozatlan.
  // 7 napos utolso fizetett kattintas (2026-10-19, docs/booking-engine/FORRAS_LPT.md): az R3 mind az 5 kattintasazonositora altalanositva (gclid / gbraid / wbraid / fbclid / ttclid). A forras a szulo
  // window.mhAttribucio.klikkReszletes()-e: a bongeszobol jovo azonosito (Google: URL / mh_attr / _gcl_aw; Meta / TikTok: URL / mh_attr / _fbc) elsobbseget elvez, a szerver altal irt HttpOnly "mh_lpt" sutibol
  // visszanyert azonosito (lptKlikk) csak az a platform potlodik, amelyikhez a bongeszobol nem jott. Ugyanaz a hozzajarulasi kapu (engedely nelkul / elutasitas utan ures). A sutibol potolt kulcsok tipusait jelzi
  // (lptJelol), a koszonooldali jelzes viszi (meres_forras.klikk_potolt). Csak a HIANYZO kulcsokat fuzi hozza, mintaellenorzessel.
  const KLIKK_MINTA = { gclid: /^[A-Za-z0-9_-]{10,200}$/, gbraid: /^[A-Za-z0-9_-]{10,200}$/, wbraid: /^[A-Za-z0-9_-]{10,200}$/, fbclid: /^[A-Za-z0-9_-]{8,200}$/, ttclid: /^[A-Za-z0-9_.-]{8,200}$/ };
  function googleAzonositokHozzaad(u) {
    try {
      const fo = BEAGYAZVA ? window.top : window;
      const ma = fo.mhAttribucio;
      let ids = {}, lpt = [];
      if (ma && typeof ma.klikkReszletes === 'function') { const r = ma.klikkReszletes() || {}; ids = r.ids || {}; lpt = Array.isArray(r.lpt) ? r.lpt : []; }
      else if (ma && typeof ma.googleAzonositok === 'function') ids = ma.googleAzonositok(); // regebbi szulo-szkript: csak a Google
      const potolt = [];
      let googleVan = ['gclid', 'gbraid', 'wbraid'].some((k) => u.searchParams.get(k));
      for (const k of ['gclid', 'gbraid', 'wbraid', 'fbclid', 'ttclid']) {
        if (u.searchParams.get(k)) continue;
        const v = ids[k];
        const google = k === 'gclid' || k === 'gbraid' || k === 'wbraid';
        if (google && googleVan && lpt.includes(k)) continue; // a sutibol potolt Google-azonosito nem kerul egy mar meglevo (URL-beli) Google-azonosito melle
        if (v && KLIKK_MINTA[k].test(v)) { u.searchParams.set(k, v); if (google) googleVan = true; if (lpt.includes(k)) potolt.push(k); }
      }
      if (ma && typeof ma.lptJelol === 'function') ma.lptJelol(potolt);
    } catch (e) { /* idegen eredetu szulo: az URL azonositok nelkul marad */ }
  }
  window.mhKeretbenOldal = (href) => {
    const u = new URL(href);
    const ut = u.pathname.replace(/\/+$/, '');
    if (ut !== '' && ut !== '/foglalo-pmu') {
      u.searchParams.set('mh_proba', 'pmu');
      googleAzonositokHozzaad(u);
      (BEAGYAZVA ? window.top : window).location.assign(u.href);
      return;
    }
    $('salonic').removeAttribute('src');
    allapot.slot = null;
    history.replaceState({ nezet: 'ido' }, '', '#ido');
    mutat('ido');
    BELEPES.ido('Ez az időpont közben elfogyott. Válassz egy másikat!');
  };
  // A fotos foglalas koszonooldala (Feri, 2026-11-01: aki fotoval foglal, azt NEM merjuk konverziokent - hiaba foglal): /pmu-foto-ok. Ezen NINCS konverzios URL-szabaly
  // (a Meta / Ads / TikTok / GA4 szabalyai a /pmu-ok-ra szolnak), nincs pixel (a suti.js PIXEL_OLDALAK-ban nincs), nem kerul ra kulcs-iro (a build FOGLALAS_KOSZONO-jaban nincs),
  // a kattintas-azonositok (gclid / fbclid / ttclid) nem kerulnek az URL-be (az URL parameter nelkuli), es a lepes-meres sem kuld sikert. A Salonic-cim fotos uton "back" nelkul megy (BELEPES.adatok), igy a keretben betoltodo /pmu-ok kulcs-iroja sem rogzit kulcsot.
  // FIGYELEM: ez csak a BONGESZOS utat zarja ki; a Salonic szalon-ertesitobol dolgozo szerveroldali utat (salonic_direct) a meresi oldalnak kell kezelnie (docs/ELTAVOLITAS_LANDING.md).
  function fotosKoszono() {
    (BEAGYAZVA ? window.top : window).location.assign(new URL('/pmu-foto-ok', location.origin).href);
  }
  // A fenti (R3, a tesztekkel vedett) atiranyitas valtozatlan; a fotos vendegnel ELE kerul egy burkolo: a siker-atiranyitas nem a /pmu-ok-ra (konverzios oldal), hanem a /pmu-foto-ok-ra visz.
  const keretbenOldalEredeti = window.mhKeretbenOldal;
  window.mhKeretbenOldal = (href) => {
    if (fotosUt()) {
      try {
        const u = new URL(href);
        const ut = u.pathname.replace(/\/+$/, '');
        if (ut !== '' && ut !== '/foglalo-pmu') { fotosKoszono(); return; }
      } catch (e) { /* hibas URL: az eredeti kezeli */ }
    }
    keretbenOldalEredeti(href);
  };

  // --- 5. koszonooldalak (az elkotelezodes szerint kulon) --------------------------------------
  //  - fizetos kezeles:     #koszonjuk
  //  - ingyenes konzultacio: #koszonjuk-konzultacio (szemelyes, a szalonban)
  //  - 10 perces visszahivas: c-kesz (#visszahivas-kesz), lasd lent
  // Mintanezet foglalas nelkul: ?minta=kezeles|konz|visszahivas
  const MINTA = new URLSearchParams(location.search).get('minta');
  const KOSZ_OLDAL = (location.pathname.match(/^\/pmu-(ok|vh|foto-ok)\/?$/) || [])[1];
  // bezaras (x): beagyazva a foglalo elejere ugrik, kulon oldalon vissza a sminktetovalas oldalra
  $('bezar').addEventListener('click', () => {
    if (BEAGYAZVA) { history.replaceState({ nezet: 'kezdo' }, '', location.pathname + location.search.replace(/[?&]lepes=[^&]*/, '')); mutat('kezdo'); return; }
    try { window.top.location.assign('/sminktetovalas-budapest'); } catch (e) { location.assign('/sminktetovalas-budapest'); }
  });
  const KOSZ = {
    kezeles: { cim: 'Sikeres foglalás!', hash: '#koszonjuk', lepesek: ['Visszaigazolást küldök e-mailben.', 'A kezelés előtt emlékeztetőt kapsz.', 'Az időpontot a visszaigazoló e-mailben lévő linkkel tudod módosítani vagy lemondani.'] },
    // fotos foglalas (/pmu-foto-ok): ugyanaz a "Sikeres foglalas!", a fotora vonatkozo lepessel
    fotos: { cim: 'Sikeres foglalás!', hash: '#koszonjuk', lepesek: ['Visszaigazolást küldök e-mailben.', 'Megnézem a fotódat, és szükség esetén felhívlak, hogy elmondjam, milyen eredmény várható.', 'Az időpontot a visszaigazoló e-mailben lévő linkkel tudod módosítani vagy lemondani.'] },
    konz: { cim: 'Személyes konzultációd lefoglalva!', hash: '#koszonjuk-konzultacio', lepesek: ['Visszaigazolást küldök e-mailben.', 'Asszisztensem felhív, hogy egyeztessétek a részleteket.', 'A konzultáción minden kérdésedre választ kapsz.'] },
  };
  BELEPES.koszonjuk = () => {
    const mintaNap = Math.floor(Date.now() / 86400000 + 7) * 86400 + 8 * 3600;
    const minta = MINTA === 'konz' ? { ts: mintaNap, perc: 30, nev: 'Ingyenes konzultáció', ar: 'Ingyenes', tipus: 'konz' }
      : MINTA ? { ts: mintaNap, perc: 90, nev: 'Szemöldöktetoválás – Hibrid', ar: '79 000 Ft', tipus: 'kezeles' } : null;
    const f = minta || olvas(TAROLO);
    if (!f && KOSZ_OLDAL !== 'ok' && KOSZ_OLDAL !== 'foto-ok') { mutat('kezdo'); return; }
    const v = KOSZ_OLDAL === 'foto-ok' ? { ...KOSZ.fotos, cim: f && f.tipus === 'konz' ? KOSZ.konz.cim : KOSZ.fotos.cim } : KOSZ[f ? f.tipus : 'kezeles'] || KOSZ.kezeles;
    $('kosz-cim').textContent = v.cim;
    $('kosz-lepesek').replaceChildren(...v.lepesek.map((t) => elem('li', { szoveg: t })));
    // a /pmu-ok koszonooldalon a cim valtozatlan marad (a meres es a hirdetesi konverziok ezt figyelik)
    if (!KOSZ_OLDAL && location.hash !== v.hash) history.replaceState({ nezet: 'koszonjuk' }, '', location.pathname + location.search + v.hash);
    for (const x of document.querySelectorAll('.megerosit, [data-nezet=koszonjuk] .gombsor')) x.hidden = !f;
    if (!f) { $('koszono-osszegzes').replaceChildren(); return; }
    const terkep = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(SZALON.terkep);
    $('koszono-osszegzes').replaceChildren(elem('div', { class: 'kosz-kartya van-kezelo' },
      elem('span', { class: 'adat' }, elem('b', { szoveg: teljes(f.ts) }), elem('b', { szoveg: f.nev }), f.ar + ' · ' + idotartam(f.perc),
        elem('span', { class: 'cim', szoveg: SZALON.cimSor })),
      melittaOszlop('vár téged'),
      elem('a', { class: 'terkep', href: terkep, target: '_blank', rel: 'noopener', 'aria-label': 'Megnyitás térképen' },
        elem('iframe', { src: 'https://www.google.com/maps?q=' + encodeURIComponent(SZALON.terkep) + '&z=15&output=embed', loading: 'lazy', tabindex: '-1', title: 'Térkép' }))));
    $('naptarhoz').onclick = () => {
      const t = (ts) => new Date(ts * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MOSAIC//Foglalas//HU', 'BEGIN:VEVENT',
        'UID:pmu-' + f.ts + '@mosaicheadspa.hu', 'DTSTAMP:' + t(Date.now() / 1000), 'DTSTART:' + t(f.ts), 'DTEND:' + t(f.ts + f.perc * 60),
        'SUMMARY:' + ('Sminktetoválás – ' + f.nev).replace(/[,;]/g, '\\$&'), 'LOCATION:' + SZALON.hely.replace(/[,;]/g, '\\$&'),
        'DESCRIPTION:MOSAIC sminktetoválás – Töreki Melitta. Tel.: 06 20 247 4444',
        'BEGIN:VALARM', 'TRIGGER:-PT24H', 'ACTION:DISPLAY', 'DESCRIPTION:Holnap sminktetoválás a MOSAIC-ban', 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      const a = elem('a', { href: URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })), download: 'mosaic-sminktetovalas.ics' });
      document.body.append(a); a.click(); a.remove();
    };
    // "Ott leszek": a szalon e-mailt kap rola (a Salonicba kivulrol nem tudunk irni), a gomb zoldre valt
    $('ott-leszek').onclick = (e) => {
      const g = e.currentTarget;
      g.textContent = 'Köszönöm, várlak! ✓'; g.disabled = true; g.classList.add('kesz');
      // kezdet (unix) + g (a Salonic vendegazonositoja a /pmu-ok cimben): ebbol jeloli meg a szerver a Salonic-naptarat (belso megjegyzes)
      const adat = new URLSearchParams({ 'form-name': 'pmu-megerosites', idopont: teljes(f.ts), kezeles: f.nev, ar: f.ar || '', oldal: location.pathname.slice(1) || 'foglalo-pmu', kezdet: String(f.ts), g: new URLSearchParams(location.search).get('g') || '' });
      leker('/', { method: 'POST', credentials: 'same-origin', body: adat }).catch((err) => console.error(err));
    };
  };

  // --- B / D. foto ----------------------------------------------------------------------
  const MAX_FOTO = 5;
  BELEPES.foto = () => {
    const d = allapot.ag === 'D';
    const fogl = fotosUt();
    const sz = (t) => (TERULET ? t.replace(/sminktetoválás/g, TERULET.szo) : t); // ?terulet=ajak: "szajtetovalas"
    $('foto-cim').textContent = d ? 'Nem vagy biztos benne? Küldj fotót, és segítek.' : sz(matchMedia('(hover: none) and (pointer: coarse)').matches ? 'Fotózd le a jelenlegi sminktetoválásodat' : 'Tölts fel fotót a jelenlegi sminktetoválásodról');
    $('foto-szoveg').replaceChildren(d ? 'Ránézek, és megírom, hogy első kezelés vagy korrekció szükséges-e.'
      : elem('b', { szoveg: fogl ? 'A fotó kötelező: ez alapján tudom előre, mit lehet és érdemes tenni. Feltöltés után választhatsz időpontot' + (megNov9() ? ' (fotóval jelentkezőknek november 9-től)' : '') + '.' : 'Fotó nélkül nem tudok segíteni: a fotó kötelező. Csak a fotó alapján tudom megmondani, mit lehet és érdemes tenni.' }));
    $('foto-osszegzes').replaceChildren(fogl ? (allapot.kezeles ? kezelesFejlec() : '') : allapot.slot && allapot.kezeles
      ? elem('div', { class: 'osszegzes-kartya' }, elem('div', { class: 'fejsor', szoveg: 'Választott (preferált) időpont' }), elem('div', { class: 'sor' }, ikon('naptar'),
        elem('span', {}, elem('b', { szoveg: teljes(allapot.slot) }), elem('span', { szoveg: allapot.kezeles.cim + (allapot.kezeles.valtozat ? ' – ' + allapot.kezeles.valtozat : '') }))))
      : '');
    $('foto-tovabb').replaceChildren(fogl ? 'Tovább az időpontokhoz ' : 'Tovább ', elem('span', { class: 'nyil', szoveg: '→' }));
    rajzolFotok();
    if (fogl && allapot.fotoKuldve) $('foto-szoveg').replaceChildren(elem('b', { szoveg: 'A fotódat már elküldted, Melitta látja. Folytathatod az időpontokkal.' }));
  };
  function rajzolFotok() {
    $('foto-racs').replaceChildren(...allapot.fotok.map((f, i) => elem('div', {}, elem('img', { src: f.url, alt: 'Feltöltött fotó ' + (i + 1) }),
      elem('button', { type: 'button', 'aria-label': 'Fotó törlése', szoveg: '×', onclick: () => { URL.revokeObjectURL(f.url); allapot.fotok.splice(i, 1); rajzolFotok(); } }))));
    const elkuldve = fotosUt() && allapot.fotoKuldve;   // a foto mar elment: nincs mit feltolteni, mehet tovabb
    $('foto-tovabb').disabled = !allapot.fotok.length && !elkuldve;
    document.querySelector('.foto-zona').hidden = allapot.fotok.length >= MAX_FOTO || elkuldve;
    document.querySelector('.foto-mobil').hidden = allapot.fotok.length >= MAX_FOTO || elkuldve;
  }
  // a telefonos fotok tobb MB-osak: 1600 px-re kicsinyitjuk (a Netlify-urlap merethatara miatt is)
  async function kicsinyit(fajl) {
    const kep = await createImageBitmap(fajl);
    const arany = Math.min(1, 1600 / Math.max(kep.width, kep.height));
    const v = elem('canvas', { width: Math.round(kep.width * arany), height: Math.round(kep.height * arany) });
    v.getContext('2d').drawImage(kep, 0, 0, v.width, v.height);
    return new Promise((ok, hiba) => v.toBlob((b) => (b ? ok(b) : hiba(new Error('toBlob'))), 'image/jpeg', 0.82));
  }
  async function fotoValasztva(e) {
    hibaDoboz($('foto-hiba'), '');
    const fajlok = [...e.target.files].slice(0, MAX_FOTO - allapot.fotok.length);
    let rossz = 0;
    for (const f of fajlok) {
      try {
        if (!/^image\//.test(f.type) && !/\.(jpe?g|png|heic|heif|webp)$/i.test(f.name)) throw new Error('nem kep');
        const b = await kicsinyit(f);
        allapot.fotok.push({ blob: b, url: URL.createObjectURL(b) });
      } catch (err) { rossz++; }
    }
    if (rossz) hibaDoboz($('foto-hiba'), 'A kép feltöltése nem sikerült' + (fajlok.length > 1 ? ' (' + rossz + ' képnél)' : '') + '. Kérlek, próbálj másik képet (JPG vagy PNG).');
    if (e.target.files.length > fajlok.length) hibaDoboz($('foto-hiba'), 'Legfeljebb ' + MAX_FOTO + ' képet küldhetsz.');
    e.target.value = '';
    rajzolFotok();
  }
  // asztalon feltoltes, mobilon a kamera-gomb (capture) es a galeria-link ugyanigy mukodik
  $('foto-input').addEventListener('change', fotoValasztva);
  $('foto-kamera-input').addEventListener('change', fotoValasztva);
  $('foto-tovabb').addEventListener('click', () => ugrik(fotosUt() ? 'ido' : 'foto-adatok'));  // fotos ut: a foto utan idopont, az elerhetoseg csak az idopont utan jon

  // mezonkenti (inline) ellenorzes
  const SZABALY = {
    nev: (v) => v.trim().length >= 2,
    telefon: (v) => { const d = v.replace(/\D/g, ''); return d.length >= 9 && d.length <= 13; },
    email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  };
  function mezoEllenoriz(m, mutatHibat) {
    const v = m.querySelector('input').value;
    const ures = !v.trim();
    const jo = ures && m.hasAttribute('data-nemkotelezo') ? true : SZABALY[m.dataset.mezo](v);
    m.classList.toggle('jo', jo && !ures);
    m.classList.toggle('rossz', !jo && (mutatHibat || m.dataset.erintett === '1'));
    return jo;
  }
  for (const m of document.querySelectorAll('[data-mezo]')) {
    const i = m.querySelector('input');
    i.addEventListener('blur', () => { if (i.value.trim()) m.dataset.erintett = '1'; mezoEllenoriz(m); });
    i.addEventListener('input', () => mezoEllenoriz(m));
  }
  function urlapEllenoriz(nezet) {
    let elso = null;
    for (const m of document.querySelectorAll('[data-nezet="' + nezet + '"] [data-mezo]')) if (!mezoEllenoriz(m, true) && !elso) elso = m;
    if (elso) elso.querySelector('input').focus();
    return !elso;
  }
  const ertek = (nezet, mezo) => document.querySelector('[data-nezet="' + nezet + '"] [data-mezo="' + mezo + '"] input').value.trim();

  async function bekuld(adat, gomb, hibaHely) {
    gomb.setAttribute('aria-disabled', 'true');
    const regi = gomb.innerHTML;
    gomb.textContent = 'Küldés…';
    try {
      const v = await leker('/', { method: 'POST', credentials: 'same-origin', body: adat });
      if (!v.ok) throw new Error('HTTP ' + v.status);
      return true;
    } catch (e) {
      console.error(e);
      hibaDoboz(hibaHely, 'Hiba történt a küldés közben. Kérlek, próbáld újra, vagy hívj minket: 06 20 247 4444.');
      return false;
    } finally { gomb.removeAttribute('aria-disabled'); gomb.innerHTML = regi; }
  }
  BELEPES['foto-adatok'] = () => {
    const fogl = fotosUt();
    if (fogl && allapot.slot && allapot.slot < FOTOS_LEGKORABBI) allapot.slot = null;
    if (fogl && !allapot.slot) { ugrik('ido'); return; }
    if (fogl && allapot.fotoKuldve) { csere('adatok'); return; }
    $('foto-adatok-szoveg').textContent = fogl ? 'A fotó alapján felveszem veled a kapcsolatot. A foglalást a következő lépésben véglegesíted.' : 'A fotó alapján felveszem veled a kapcsolatot.';
    $('foto-kuld').replaceChildren(fogl ? 'Fotó elküldése és tovább ' : 'Fotó elküldése ', elem('span', { class: 'nyil', szoveg: '→' }));
  };
  $('foto-kuld').addEventListener('click', async (e) => {
    const gomb = e.currentTarget;
    if (gomb.getAttribute('aria-disabled') === 'true') return;
    hibaDoboz($('foto-kuld-hiba'), '');
    if (!urlapEllenoriz('foto-adatok')) return;
    if (!$('foto-hozzajarul').checked) { hibaDoboz($('foto-kuld-hiba'), 'Kérlek, fogadd el az adatkezelést, hogy a fotóidat megnézhessem.'); return; }
    const k = allapot.kezeles;
    const leadId = pmuLead.ujAzonosito();
    const fogl = fotosUt();   // fotos foglalas: a vendeg a levelezes utan a Salonic adatlapjan foglal is (NEM konverzio)
    const adat = new FormData();
    adat.set('form-name', 'pmu-proba-foto');
    adat.set('ag', (allapot.ag === 'D' ? 'D – nem biztos, volt-e PMU' : 'B – régi PMU van') + (fogl ? ' · FOGLALÁSSAL (fotós előszűrés, időpont nov. 9-től)' : ''));
    adat.set('nev', ertek('foto-adatok', 'nev'));
    adat.set('telefon', ertek('foto-adatok', 'telefon'));
    adat.set('email', ertek('foto-adatok', 'email'));
    adat.set('kezeles', allapot.slot && k ? k.nev + (fogl ? ' · FOGLALÁSSAL' : '') : allapot.fotoKezeles || '');
    adat.set('idopont', allapot.slot ? fmt(allapot.slot, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) + ' ' + ora(allapot.slot) + (fogl ? ' (a vendég ezt most foglalja a Salonicban: a végleges foglalás ott látszik)' : ' (preferált, nem végleges)') : '');
    adat.set('oldal', FORRAS_OLDAL);
    allapot.fotok.forEach((f, i) => adat.set('foto' + (i + 1), f.blob, 'foto' + (i + 1) + '.jpg'));
    if (!(await bekuld(adat, gomb, $('foto-kuld-hiba')))) return;
    pmuLead('foto', { id: leadId, ag: allapot.ag, fotoDb: allapot.fotok.length, idopontKert: !!allapot.slot, foglalassal: fogl });
    fotoElkuldve();
    if (fogl) { allapot.fotok = []; csere('adatok'); return; }   // a foglalas folytatodik: Salonic-adatlap
    $('foto-kesz-osszegzes').replaceChildren(allapot.slot && k
      ? elem('div', { class: 'osszegzes-kartya' }, elem('div', { class: 'fejsor', szoveg: 'Preferált időpont (nem végleges)' }), elem('div', { class: 'sor van-kezelo' }, ikon('naptar'),
        elem('span', {}, elem('b', { szoveg: teljes(allapot.slot) }), elem('span', { szoveg: k.cim + (k.valtozat ? ' – ' + k.valtozat : '') })), melittaOszlop('jelentkezik')))
      : melittaSor('megnézi a fotódat, és hamarosan jelentkezik'));
    allapot.fotok = [];
    ugrik('foto-kesz');
  });

  // --- C. visszahivas ---------------------------------------------------------------------
  const SAVOK = ['Délelőtt (9–12)', 'Kora délután (12–15)', 'Délután (15–18)', 'Bármikor'];
  // csak a napszakot kerdezzuk, es az sem kotelezo (itt nem lassitunk): valasztas nelkul "Bármikor"
  BELEPES['c-ido'] = () => {
    const rajzol = () => {
      $('c-savok').replaceChildren(...SAVOK.map((n) => elem('button', { type: 'button', class: 'chip', 'aria-pressed': String(allapot.cSav === n), szoveg: n, onclick: () => { allapot.cSav = allapot.cSav === n ? null : n; rajzol(); ment(); } })));
    };
    rajzol();
  };
  const cMikor = () => allapot.cSav || 'Bármikor';
  const cOsszegzes = (cim, kezelo = false) => elem('div', { class: 'osszegzes-kartya' }, elem('div', { class: 'fejsor', szoveg: cim }), elem('div', { class: 'sor' + (kezelo ? ' van-kezelo' : '') }, ikon('telefon'),
    elem('span', {}, elem('b', { szoveg: cMikor() }), elem('span', { szoveg: 'Telefonos konzultáció · kb. 10 perc, ingyenes' })), kezelo ? melittaOszlop('felhív') : null));
  $('c-ido-tovabb').addEventListener('click', () => { allapot.cKert = true; ugrik('c-adatok'); });
  // a telefonos konzultacio elott is megkerdezzuk, van-e mar sminktetovalasa
  $('c-info-tovabb').addEventListener('click', () => { allapot.kerdesCel = 'c-ido'; ugrik('kerdes'); });
  const cIdoBelep = BELEPES['c-ido'];
  BELEPES['c-ido'] = () => { if (allapot.kerdesValasz !== 'elso') { allapot.kerdesCel = 'c-ido'; ugrik('kerdes'); return; } cIdoBelep(); };
  BELEPES['c-adatok'] = () => { if (!allapot.cKert) { ugrik('c-ido'); return; } $('c-osszegzes').replaceChildren(cOsszegzes('Mikor hívjalak?')); };
  $('c-kuld').addEventListener('click', async (e) => {
    const gomb = e.currentTarget;
    if (gomb.getAttribute('aria-disabled') === 'true') return;
    hibaDoboz($('c-kuld-hiba'), '');
    if (!urlapEllenoriz('c-adatok')) return;
    const leadId = pmuLead.ujAzonosito();
    const adat = new URLSearchParams({
      'form-name': 'pmu-proba-visszahivas', nev: ertek('c-adatok', 'nev'), telefon: ertek('c-adatok', 'telefon'),
      mikor_nap: '', mikor_napszak: cMikor(), oldal: FORRAS_OLDAL,
    });
    if (!(await bekuld(adat, gomb, $('c-kuld-hiba')))) return;
    pmuLead('visszahivas', { id: leadId, napszak: cMikor() });
    // a telefonos konzultacio ugyanaz a konverzio, mint a weboldal regi visszahivas-urlapja es a
    // Facebook-leadek: a /pmu-vh koszonooldalon lefut a megszokott meres, majd a klon.js visszahoz ide
    tarol(TAROLO_C, { cSav: cMikor() });
    try { window.top.location.assign('/pmu-vh'); } catch (e2) { location.assign('/pmu-vh'); }
  });
  BELEPES['c-kesz'] = () => {
    if (MINTA === 'visszahivas') Object.assign(allapot, { cKert: true, cSav: allapot.cSav || 'Délelőtt (9–12)' });
    const c = olvas(TAROLO_C);
    if (c && !allapot.cKert) Object.assign(allapot, { cKert: true, cSav: c.cSav === 'Bármikor' ? null : c.cSav });
    if (!allapot.cKert && KOSZ_OLDAL === 'vh') allapot.cKert = true;
    if (!allapot.cKert) { mutat('kezdo'); return; }
    $('c-kesz-osszegzes').replaceChildren(cOsszegzes('Ekkor hívlak', true));
    if (!KOSZ_OLDAL) history.replaceState({ nezet: 'c-kesz' }, '', location.pathname + location.search + '#visszahivas-kesz');
  };

  // --- video ------------------------------------------------------------------------------
  // a 10 perces konzultacio videoja kis, levagott elonezet - lejatszaskor teljes
  document.querySelector('[data-nezet=c-info] video').addEventListener('play', (e) => e.target.parentNode.classList.add('megy'));
  for (const g of document.querySelectorAll('[data-video]')) {
    g.addEventListener('click', () => {
      const v = elem('video', { src: '/assets/video/c2eb0f_a4af4c18f0f64aff93f4c57ed0fb326e.mp4', controls: true, playsinline: true, autoplay: true });
      (g.closest('.utana') || g).replaceWith(elem('div', { class: 'video-doboz' }, v));
    });
  }

  // --- beagyazas (?beagyazva=1) -------------------------------------------------------------
  // A szulo (landing) a keret magassagat a tartalomhoz igazitja, nezetvaltaskor a keret tetejere
  // gorget; a linkek (pl. "Vissza a sminktetovalashoz") a teljes ablakban nyilnak meg.
  function jelez(adat) { try { window.parent.postMessage(Object.assign({ mhFoglalo: true }, adat), location.origin); } catch (e) { /* nincs szulo */ } }
  if (BEAGYAZVA) {
    document.documentElement.classList.add('beagyazva');
    const meret = () => jelez({ magassag: Math.ceil(document.body.getBoundingClientRect().height) });
    new ResizeObserver(meret).observe(document.body);
    addEventListener('load', meret);
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (a && !a.target && !a.getAttribute('href').startsWith('#')) a.target = '_top';
    }, true);
  }

  // --- indulas ------------------------------------------------------------------------------
  // ?kezeles=<Salonic-azonosito vagy kulcsszo> (kezeles-specifikus landingrol): az 1. lepes kimarad
  (async () => {
    const kert = new URLSearchParams(location.search).get('kezeles');
    // a koszonooldalak sajat cimukon: /pmu-ok (Salonic-foglalas utan), /pmu-vh (telefonos konzultacio utan)
    if (KOSZ_OLDAL === 'ok') {
      // A Salonic a /pmu-ok oldalra iranyitott. Csak a sajat foglalonkbol inditott foglalas szamit (a bookingUrl "back" parametere a mi mb_ azonositonk),
      // foglalasonkent egyszer (ujratoltes ellen sessionStorage-jel, a foglalas-azonositora kulcsolva). submit = a vendeg beadta az adatlapot;
      // success CSAK igazolt egyezesnel: a visszaadott szolgaltatas es kezdes megegyezik azzal, amit a foglalonk inditott (mhBookingCtx) - kulonben verify_failed.
      try {
        const u = new URL(new URLSearchParams(location.search).get('bookingUrl') || '');
        const bid = u.searchParams.get('back');
        if (/^mb_[a-z0-9]{12,40}$/.test(bid || '') && !sessionStorage.getItem('mhPmuSiker:' + bid)) {
          sessionStorage.setItem('mhPmuSiker:' + bid, '1');
          pmuLepes('submit', bid);
          let c = null; try { c = JSON.parse(sessionStorage.getItem('mhBookingCtx')); } catch (e) { c = null; }
          const egyezik = c && c.id === bid && String(c.service_id) === u.searchParams.get('serviceId') && String(c.slot_unix) === u.searchParams.get('startDate');
          pmuLepes(egyezik ? 'success' : 'error', bid, egyezik ? {} : { tipus: 'verify_failed' });
        }
      } catch (e) { /* a koszonooldal ettol nem akadhat el */ }
      mutat('koszonjuk'); BELEPES.koszonjuk(); return;
    }
    // /pmu-foto-ok: fotos foglalas koszonoje - NINCS submit / success lepes-meres (nem konverzio)
    if (KOSZ_OLDAL === 'foto-ok') { mutat('koszonjuk'); BELEPES.koszonjuk(); return; }
    if (KOSZ_OLDAL === 'vh') { mutat('c-kesz'); BELEPES['c-kesz'](); return; }
    if (location.hash.startsWith('#koszonjuk') && (olvas(TAROLO) || MINTA)) {
      history.replaceState({ nezet: 'koszonjuk' }, '', location.hash);
      mutat('koszonjuk');
      BELEPES.koszonjuk();
      return;
    }
    // ?minta=foto: a fotokuldes utani kepernyo (mintanezet, kuldes nelkul)
    if (MINTA === 'foto') {
      const ts = Math.floor(Date.now() / 86400000 + 7) * 86400 + 8 * 3600;
      $('foto-kesz-osszegzes').replaceChildren(elem('div', { class: 'osszegzes-kartya' }, elem('div', { class: 'fejsor', szoveg: 'Preferált időpont (nem végleges)' }), elem('div', { class: 'sor van-kezelo' }, ikon('naptar'),
        elem('span', {}, elem('b', { szoveg: teljes(ts) }), elem('span', { szoveg: 'Szemöldöktetoválás – Hibrid' })), melittaOszlop('jelentkezik'))));
      mutat('foto-kesz');
      return;
    }
    if (MINTA === 'visszahivas' || (location.hash === '#visszahivas-kesz' && olvas(TAROLO_C))) {
      mutat('c-kesz');
      BELEPES['c-kesz']();
      return;
    }
    history.replaceState({ nezet: 'kezdo' }, '', location.pathname + location.search);
    // Mentett allapot (retegben, 30 percig): ott folytatja, ahol tartott; a megelozo nezetek a reteg elozmenyeibe kerulnek (a vissza gomb azokra lep)
    if (RETEG) {
      let m = null;
      try { m = JSON.parse(sessionStorage.getItem(MENT) || 'null'); } catch (e) { m = null; }
      if (m && Date.now() - m.t < MENT_MS && Array.isArray(m.utvonal) && m.utvonal.length > 1 && !kert) {
        try {
          await kezelesekBetolt();
          const k = m.kezelesId ? allapot.kezelesek.find((x) => x.id === m.kezelesId) : null;
          Object.assign(allapot, { kezeles: k || null, ag: m.ag || 'B', kerdesCel: m.kerdesCel, kerdesValasz: m.kerdesValasz, elozmeny: m.elozmeny, fotoKuldve: !!m.fotoKuldve, cKert: !!m.cKert, cSav: m.cSav || null,
            naptarNap: m.naptarNap || null, honap: m.honap || null, slot: m.slot || null });
          // az adatlap (Salonic) es a feltoltott fotok nem allithatok vissza: az azt megelozo nezetnel folytatjuk
          // a feltoltott fotok nem allithatok vissza: a fotos ut az idopont elott a fotonal folytatodik (az "ido" csak elkuldott foto utan ervenyes)
          const ervenyes = { szolg: () => true, ido: () => !!allapot.kezeles && !!allapot.kerdesValasz && !fotoKell(), kerdes: () => allapot.kerdesCel === 'c-ido' || !!allapot.kezeles, foto: () => true,
            'c-info': () => true, 'c-ido': () => allapot.kerdesValasz === 'elso', 'c-adatok': () => allapot.cKert };
          const ut = m.utvonal.filter((v) => v === 'kezdo' || ervenyes[v]);
          while (ut.length > 1 && !(ervenyes[ut[ut.length - 1]] && ervenyes[ut[ut.length - 1]]())) ut.pop();
          if (ut.length > 1) {
            mutat('kezdo');
            for (const v of ut.slice(1)) { utvonal.push(v); mutat(v, true); }
            BELEPES[aktualis] && BELEPES[aktualis]();
            return;
          }
        } catch (e) { console.error(e); }
      }
    }
    mutat('kezdo');
    // ?lepes=foto | visszahivas | szolg: a landing gombjai egyenesen a folyamat adott lepesebe visznek
    const lepes = new URLSearchParams(location.search).get('lepes');
    if (lepes === 'foto') { allapot.ag = 'B'; ugrik('foto'); }
    else if (lepes === 'visszahivas') ugrik('c-info');
    else if (lepes === 'szolg' && !kert) ugrik('szolg');
    try {
      await kezelesekBetolt();
      if (kert) {
        // pl. ?kezeles=ajak-aquarell vagy ?kezeles=szemoldok-powder: minden szonak szerepelnie kell a nevben
        const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const szavak = norm(kert).split(/[^a-z0-9]+/).filter(Boolean);
        const k = allapot.kezelesek.find((x) => x.id === kert) || allapot.kezelesek.find((x) => szavak.every((w) => norm(x.nev).includes(w)));
        if (k) { history.pushState({ nezet: 'szolg' }, '', '#szolg'); kezelesValaszt(k); }
      }
    } catch (e) { console.error(e); }
  })();
})();
