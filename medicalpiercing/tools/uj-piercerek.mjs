// A piercereink bemutatkozo oldalai (/uj/piercer-*), egyseges, megtervezett szerkezettel (a tulajdonos kerese, 2026-10-16: "a bemutatkozo szovegek
// nagyon nyersek es hosszuak, ez nem design"): hos (nev, szerep, rovid bevezeto, portre), "Rolam" doboz (tenyek + tagolt szoveg, mellette a
// bemutatkozo video allo keretben), a videok racsban (allo / fekvo keret a video szerint), utana a kozos dobozok. A szovegek az eredeti
// oldalakrol, roviditve, tagolva.
//
//   node tools/uj-piercerek.mjs   ->  uj-oldalak/sajat/piercer-<nev>.html
import fs from 'node:fs';
import path from 'node:path';
const ROOT = new URL('..', import.meta.url).pathname;
const IK = (n, o = '') => `<svg class="ik${o ? ' ' + o : ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const fb = (id, cim) => ({ t: 'fb', id, cim });
const yt = (id, cim) => ({ t: 'yt', id, cim });
const mp4 = (nev, cim) => ({ t: 'mp4', src: `/assets/video/${nev}.mp4`, poster: `/assets/img/${nev}f000.webp`, cim });

const PIERCEREK = [
  {
    ut: 'piercer-kovacs-gabriella', nev: 'Kovács Gabriella', becenev: 'Gabi', szerep: 'a Medical Piercing alapítója',
    leiras: 'Kovács Gabriella, a Medical Piercing alapítója: 20 év egészségügyi tapasztalat, migrén-, shenmen-, klimax- és slim piercing garanciával. Ismerd meg Gabit!',
    bev: 'Migrén gyógyult alapítóként és 20 év egészségügyi tapasztalattal: valóban működő migrén-, shenmen-, klimax- vagy slim piercing behelyezés orvosi minőségben, garanciával.',
    kep: ['/assets/img/f18724_54b61499c5b84a13a36273a398325981.webp', 1000, 963, 'Kovács Gabriella, a Medical Piercing alapítója, munka közben'],
    tenyek: [['steth', '20 év', 'az egészségügyben'], ['userc', 'Okleveles ápoló', 'majd osztályvezető ápoló'], ['leaf', 'Fül-addiktológus', 'akupunktúrás piercer'], ['users', '2 000+ vendég', 'havonta a csapattal']],
    idezet: 'Az első migrén piercingem után olyan drasztikus hatást tapasztaltam, hogy elkezdtem beleásni magam a témába.',
    bio: [
      'A Medical Piercing alapítója vagyok – és migrén gyógyult. 20 évet töltöttem az egészségügyben, egyetemi okleveles ápolóként, majd osztályvezető ápolóként. Rengeteg emberrel beszélgettem, és megtapasztaltam, hogy a migrén nemcsak nálam jelent komoly gondot.',
      'Az első migrén piercingem után elvégeztem egy fül-addiktológus képzést, egy akupunktúrás tanfolyamot, és megszereztem az akupunktúrás piercer képesítést is.',
      'Ma csapatommal havonta több mint 2 000 embernek segítünk egy kiegyensúlyozottabb élethez. <b>Szívből remélem, hogy veled is mihamarabb – mint gyógyult vendégemmel – találkozhatok budapesti vagy soproni szalonunkban!</b>',
    ],
    link: ['/igy-szabadultam-meg-a-migrentol', 'Olvasd el a történetemet: így szabadultam meg a migréntől »'],
    videokCim: 'A 4+1 közérzetjavító piercingünk videón',
    videok: [yt('7bGYxWxje2U', 'Így működik a migrén piercing'), yt('x332O9DyMHc', 'Így működik a shenmen piercing'), yt('paM9uwnJfZI', 'Így működik a klimax piercing'), yt('MBr44D96ed0', 'Így működik a slim piercing'), yt('GP8JN-ouuxU', 'Így működik az allergia piercing')],
  },
  {
    ut: 'piercer-kovacs-richard', nev: 'Kovács Richárd', becenev: 'Ricsi', szerep: 'fülakupunktúrás addiktológus',
    leiras: 'Kovács Richárd, a Medical Piercing szakértője: fülakupunktúrás addiktológus, gyógymasszőr. Migrén-, shenmen-, klimax- és slim piercing garanciával. Ismerd meg Ricsit!',
    bev: '<b>Mikorra írhatlak be?</b> Akár már ma elkészítem migrén-, shenmen-, klimax- vagy slim piercingedet, garanciával, biztonságos, steril körülmények között.',
    kep: ['/assets/img/f18724_934eb02c7f7440a9b97932a3d6a66909.webp', 1000, 1000, 'Kovács Richárd piercer munka közben'],
    tenyek: [['leaf', 'Fülakupunktúrás', 'addiktológus'], ['steth', 'Gyógymasszőr', 'anatómia, élettan, közegészségügy'], ['users', 'Több száz', 'panaszos vendég'], ['map', 'Budapest', 'és Sopron']],
    idezet: 'Miután nekem is ennyit segített, szerettem volna másokon is segíteni – ezért csatlakoztam a Medical Piercinghez.',
    bio: [
      'Fülakupunktúrás addiktológusként pontosan tudom, milyen az, amikor a legfontosabb pillanatokat tönkreteszi egy migrénes fejfájás, vagy amikor a stressz kihat a munkára. Ezért vállaltam be először egy migrén, majd egy shenmen piercinget – és hamar megtapasztaltam, milyen e tünetek nélkül élni.',
      'Gyógymasszőri végzettségem során alaposan megismertem a test anatómiáját és élettanát; emellett elvégeztem a fülakupunktúrás addiktológus képzést is, így már több száz panaszos vendégen segítettem.',
      '<b>Nézd meg néhány videómat, és ha szimpatikus vagyok, foglalj hozzám időpontot budapesti vagy soproni szalonunkba!</b>',
    ],
    videokCim: 'Ricsi videói',
    videok: [fb('375744912143900', 'Klimax piercing – mire jó?'), fb('840415047883660', 'Ezért fontos az utóápolás'), fb('1470124043914508', 'Így működik a garancia')],
  },
  {
    ut: 'piercer-kamilli-viktoria', nev: 'Kamilli Viktória', becenev: 'Viki', szerep: 'a Medical Piercing szakértője',
    leiras: 'Kamilli Viktória, a Medical Piercing szakértője: fogászati asszisztensből lett piercer. Migrén-, shenmen-, klimax- és slim piercing garanciával. Ismerd meg Vikit!',
    bev: 'Fogászati asszisztensként dolgoztam, amikor a migrén piercingem után – több év sikertelen keresés után – elmúlt a szédülésem, és rengeteget javult az alvásom. Akkor döntöttem el, hogy másoknak is segítek.',
    kep: ['/assets/img/f18724_82ec0f0190fc482fa2aa112d0fe1e884.webp', 1258, 1258, 'Kamilli Viktória piercer munka közben'],
    tenyek: [['steth', 'Fogászati asszisztens', 'egészségügyi háttér'], ['cross', 'Kórházi gyakorlat', 'több osztályon'], ['heart', 'Empatikus', 'a folyamat is legyen kellemes'], ['check', 'Migrén piercinggel', 'saját tapasztalat']],
    idezet: 'Nagyon fontos számomra, hogy a piercinged ne csak hatásos legyen, hanem magát a folyamatot is kellemes élményként éld meg.',
    bio: [
      'A migrén piercingem után végre elmúlt a szédülésem, és az alvásom is rengeteget javult. Ekkor döntöttem el, hogy kitanulom a piercer szakmát, és segítek azoknak, akik fejfájással, klimaxszal vagy más olyan tünettel küzdenek, amelyre a közérzetjavító piercing megoldás lehet.',
      'Fogászati asszisztensi gyakorlatom első évét kórházakban töltöttem, különböző osztályokon (belgyógyászat, fül-orr-gégészet, traumatológia, bőrgyógyászat, intenzív osztály), így egészségügyi tapasztalatom miatt nagyon közel érzem magamhoz az akupunktúrás piercingeket.',
      'Már az előző rendelőben is megtaláltam a hivatásomat a gyógyításban és az emberek segítésében. <b>Vendégeim empatikusnak tartanak.</b>',
    ],
  },
  {
    ut: 'piercer-fanni', nev: 'Nagy-Markó Fanni', becenev: 'Fanni', szerep: 'a Medical Piercing szakértője',
    leiras: 'Nagy-Markó Fanni, a Medical Piercing szakértője: 15 év fejfájás után vendégként érkezett, ma piercerként segít. Ismerd meg Fannit!',
    bev: '15 év fejfájás után vendégként kerestem fel a Medical Piercinget. A migrén piercing már a 3. héten segített – akkor határoztam el, hogy másoknak is segíteni fogok.',
    kep: ['/assets/img/f18724_f9c0a8fd686f422482c6a443ea951b6d.webp', 1000, 1000, 'Nagy-Markó Fanni piercer a budapesti szalonban'],
    tenyek: [['heart', '15 év fejfájás', 'után vendégként jött'], ['check', 'A 3. héten', 'segített a migrén piercing'], ['users', 'Közel 2 éve', 'a csapatban'], ['pin', 'Budapest', 'Jászai Mari tér']],
    bioVideo: mp4('f18724_bd92f8df0ee74d78bfb66849ae811e87', 'Fanni bemutatkozó videója'),
    bio: [
      '15 év fejfájással, amikor már azt hittem, hogy soha nem fog elmúlni, vendégként kerestem fel a Medical Piercinget. A migrén piercing már a 3. héten segített nekem, és akkor határoztam el, hogy másoknak is segíteni fogok.',
      'Több hónapos képzés után már közel 2 éve erősítem a Medical Piercing csapatát.',
      '<b>Nézd meg bemutatkozó videómat, és ha szimpatikusnak találsz, szeretettel várlak bármelyik közérzetjavító piercinggel a Jászai Mari téri szalonunkban!</b>',
    ],
  },
  {
    ut: 'piercer-mester-brigitta', nev: 'Mester Brigitta', becenev: 'Brigi', szerep: 'a soproni szalon szakértője',
    leiras: 'Mester Brigitta, a Medical Piercing soproni szakértője: volt migrénes, AcuPiercer és fülakupunktúrás addiktológus. Ismerd meg Brigit!',
    bev: '<b>Tűpontos, fájdalommentes és biztonságos behelyezés</b>, egészségügyi tapasztalattal és fülakupunktúrás végzettséggel. Garancia és ingyenes kontroll – Sopron, Füredi O. sétány 9.',
    kep: ['/assets/img/f18724_ceb9d9dee26d47738ddde803fd53e4a4.webp', 1000, 1000, 'Mester Brigitta, a Medical Piercing soproni szakértője'],
    hosVideo: mp4('f18724_5fcb7231c8a243c28ec400efbb921342', 'Brigi bemutatkozó videója'),
    tenyek: [['leaf', 'AcuPiercer', 'fülakupunktúrás addiktológus'], ['steth', 'Főápoló volt', 'Sopronban'], ['sparkles', '10+ év', 'természetes egészségmegőrzés'], ['userc', 'Ápoló szak', 'Széchenyi István Egyetem']],
    idezet: '„Semmi nem segített a migrénre. Aztán kipróbáltam ezt az egyetlen piercinget – és új életet kaptam.”',
    bioVideo: mp4('f18724_1669d518e10043deabff26251298f021', 'Brigi a migrén piercingről'),
    bio: [
      '<b>Szia, Brigi vagyok</b>, szakképzett AcuPiercer és fülakupunktúrás addiktológus. Több mint tíz éve foglalkozom természetes egészségmegőrzéssel; dolgoztam főápolóként Sopronban, üzemeltettem természetgyógyász rendelőt és masszázsszalont – de azt, amit a migrén piercing hozott az életembe, semmihez nem tudom hasonlítani.',
      '<b>A migrén éveken át irányította az életem.</b> Egy műtét után kialakult agyvíz-szivárgás miatt állandó, kínzó fejfájásokkal éltem; kipróbáltam szinte mindent – gyógyszert, terápiát, étrendet –, de semmi nem hozott tartós megkönnyebbülést. A fordulatot egy apró eszköz hozta: a migrén piercing. Ekkor döntöttem el, hogy ezt az élményt másokkal is megosztom.',
    ],
    extra: `
  <!-- MIÉRT BÍZD RÁM, AKIKKEL DOLGOZOM -->
  <section class="tarto">
    <div class="szakasz-fej"><h2>Miért bízd rám a piercinged?</h2></div>
    <ul class="kartya-racs">
      <li class="info-kartya"><span class="info-ik">${IK('steth')}</span><h3>Egészségügyi végzettség</h3><p>Pontosan tudom, mit csinálok – nem hobbiból, hanem szakértelemmel dolgozom.</p></li>
      <li class="info-kartya"><span class="info-ik">${IK('users')}</span><h3>Több száz vendég</h3><p>Segítettem már migrén, stressz, alvászavar vagy hormonális panaszok enyhítésében.</p></li>
      <li class="info-kartya"><span class="info-ik">${IK('shield')}</span><h3>Steril, orvosi környezet</h3><p>Biztos kézzel, egyénre szabott pontokon helyezem be a piercinget.</p></li>
      <li class="info-kartya"><span class="info-ik">${IK('heart')}</span><h3>Saját tapasztalat</h3><p>Tudom, mit élsz át – nem elméletből beszélek, a saját utamat jártam végig.</p></li>
    </ul>
  </section>
  <section class="tarto">
    <article class="ketto-doboz">
      <div class="szoveg">
        <h2>Akikkel dolgozom</h2>
        <ul class="pipak">
          <li>${IK('check')}<span>Akiknek a migrén már az életminőségét veszélyezteti.</span></li>
          <li>${IK('check')}<span>Akik belefáradtak az újabb és újabb gyógyszerekbe.</span></li>
          <li>${IK('check')}<span>Akik természetes megoldást keresnek – nem hókuszpókuszt, hanem valódi szakértelmet.</span></li>
        </ul>
        <p class="idezet-nagy">A célom, hogy minél többen megismerjék a migrén piercing valódi hatékonyságát – és ne a migrén irányítsa az életedet, hanem te.</p>
      </div>
      <div class="szoveg">
        <h2>Egészségügyi tapasztalatom</h2>
        <ol class="rutin-lista evszam-lista">
          <li><b>2008</b> – tradicionális thai és svéd masszázs</li>
          <li><b>2014</b> – kínai fejmasszázs (Dr. Wu-féle)</li>
          <li><b>2015</b> – fülakupunktúrás addiktológia</li>
          <li><b>2016</b> – akupresszúra</li>
          <li><b>2018</b> – Tuina masszázsterápia (kínai gyógymasszázs)</li>
          <li><b>Most</b> – harmadéves diplomás ápoló szak, Széchenyi István Egyetem, Győr</li>
        </ol>
      </div>
    </article>
  </section>`,
  },
];

const videoElem = (v) => {
  if (v.t === 'fb') return `<figure class="video-elem"><div class="allo-keret"><iframe src="https://www.facebook.com/plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Fmedicalpiercing.hu%2Fvideos%2F${v.id}%2F&amp;show_text=false&amp;width=300&amp;t=0" title="${v.cim}" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe></div><figcaption>${v.cim}</figcaption></figure>`;
  if (v.t === 'mp4') return `<figure class="video-elem"><div class="allo-keret"><video src="${v.src}" poster="${v.poster}" controls preload="none" playsinline></video></div><figcaption>${v.cim}</figcaption></figure>`;
  return `<figure class="video-elem"><a class="video" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener" data-embed="https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&amp;rel=0" data-cim="${v.cim}" aria-label="Videó lejátszása: ${v.cim}"><span class="video-kep"><img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" width="480" height="360" alt="" loading="lazy"><span class="lejatszo">${IK('play')}</span></span></a><figcaption>${v.cim}</figcaption></figure>`;
};

for (const p of PIERCEREK) {
  const [ksrc, kw, kh, kalt] = p.kep;
  const hosMedia = p.hosVideo
    ? `<video class="vid vid-allo hos-video-mp4" src="${p.hosVideo.src}" poster="${p.hosVideo.poster}" controls preload="metadata" playsinline></video>`
    : `<img src="${ksrc}" width="${kw}" height="${kh}" alt="${kalt}" fetchpriority="high">`;
  const tenyek = `<ul class="teny-lista">${p.tenyek.map(([ik, b, s]) => `<li><span class="info-ik">${IK(ik)}</span><span><b>${b}</b>${s}</span></li>`).join('')}</ul>`;
  // a "Rolam" doboz bal hasabja: a bemutatkozo video (allo), vagy ha nincs, a portre (a hosben video van) / a tenyek
  const balra = p.bioVideo
    ? `<div class="rolam-media"><div class="allo-keret"><video src="${p.bioVideo.src}" poster="${p.bioVideo.poster}" controls preload="none" playsinline></video></div><p class="allo-cimke">${p.bioVideo.cim}</p></div>`
    : p.hosVideo ? `<img src="${ksrc}" width="${kw}" height="${kh}" alt="${kalt}" loading="lazy" decoding="async">` : '';
  const html = `<!--oldal ${JSON.stringify({ cim: `${p.nev} – ${p.szerep[0].toUpperCase()}${p.szerep.slice(1)} | Medical Piercing`, leiras: p.leiras })} -->
  <!-- a piercer bemutatkozo oldala: tools/uj-piercerek.mjs (ne kezzel szerkeszd) -->
  <section class="hos">
    <div class="tarto hos-racs">
      <h1 class="hos-cim">${p.nev}, <em>${p.szerep}</em></h1>
      <div class="hos-szoveg">
        <p class="hos-bevezeto">${p.bev}</p>
        <div class="gombsor">
          <a class="gomb gomb-tomor" href="/idopontfoglalas">${IK('calendar')}Időpontot foglalok${IK('chev', 'ik-nyil')}</a>
          <a class="gomb gomb-ures" href="#rolam">Ismerd meg ${p.becenev}t${IK('chev', 'ik-nyil')}</a>
        </div>
        <div class="hos-ertek-sav">
<!--#ertekeles-->
          <ul class="hos-linkek"><li><a href="/migren-es-shenmen-piercing-garancia">Garancia »</a></li><li><a href="/elerhetosegek">Helyszíneink »</a></li><li><a href="/uj/csapatunk">Csapatunk »</a></li></ul>
        </div>
      </div>
      <figure class="hos-kep">
        ${hosMedia}
      </figure>
    </div>
  </section>

  <!-- RÓLAM -->
  <section class="tarto" id="rolam">
    <article class="ketto-doboz rolam${p.bioVideo ? ' allo-bal' : !balra ? ' rolam-tenyek' : ''}">
      ${balra || tenyek}
      <div class="szoveg">
        <h2>${p.nev} vagyok</h2>
        ${balra ? tenyek : ''}
        ${p.idezet ? `<p class="idezet-nagy">${p.idezet}</p>` : ''}
        ${p.bio.map((x) => `<p>${x}</p>`).join('\n        ')}
        ${p.link ? `<p><a class="szoveg-link" href="${p.link[0]}">${p.link[1]}</a></p>` : ''}
        <a class="gomb gomb-tomor" href="/idopontfoglalas">Időpontot foglalok${IK('chev', 'ik-nyil')}</a>
      </div>
    </article>
  </section>
${p.extra || ''}
${p.videok ? `
  <!-- VIDEÓK -->
  <section class="tarto">
    <div class="szakasz-fej"><h2>${p.videokCim}</h2></div>
    <div class="video-racs${p.videok[0].t === 'yt' ? '' : ' allo'}">
      ${p.videok.map(videoElem).join('\n      ')}
    </div>
  </section>
` : ''}
<!--#piercingek-->

<!--#tudtad-->

<!--#stat-93-->

<!--#velemenyek-->
<!--#video-velemeny-mind-->

<!--#helyszinek-->
`;
  fs.writeFileSync(path.join(ROOT, `uj-oldalak/sajat/${p.ut}.html`), html);
  console.log(`${p.ut}: kesz`);
}
