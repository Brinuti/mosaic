# Medical Piercing – foglalási lifecycle e-mail mintak (v1, 2026-10-16). Kimenet: assets/levelek/*.html + index.html.
# A {mezo} jelolesek a production motor dinamikus mezoi; a mintakban pelda ertekek szerepelnek, sarga jelolessel.
import html, pathlib, json
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'levelek'
OUT.mkdir(parents=True, exist_ok=True)
SITE = 'https://www.medicalpiercing.hu'
IMG = SITE + '/assets/img/f18724_'
K = {  # kepek az eles oldalrol
  'logo': IMG + '5d639907d27148e1a1e80625fce81d7a.png',
  'gabi_portre': IMG + '3ae9dfe53a07477fae1a816f79be5098.jpg',
  'gabi_munka': IMG + '54b61499c5b84a13a36273a398325981.jpg',
  'gabi_ekszer': IMG + '081b67638fbe42ee9d0c8b11ea28d392.jpg',
  'ricsi_ful': IMG + '1bbe5960f5f647c08ac7539907b96ef0.jpg',
  'ricsi_munka': IMG + '934eb02c7f7440a9b97932a3d6a66909.jpg',
  'viki_munka': IMG + '71cd1079723b46709aa7810769747a4b.jpg',
  'fanni_munka': IMG + '26a67e3ee9e04936b55ba455034f6f40.jpg',
  'szalon': IMG + '9523f7cd094b451aa8534ca6d7cfaa3e.jpg',
  'video_szuras': 'https://img.youtube.com/vi/GCO50aHDAyU/hqdefault.jpg',
  'video_gabi': 'https://img.youtube.com/vi/foEQNUg6DzI/hqdefault.jpg',
}
L = {
  'folyamat': SITE + '/a-szuras-folyamata', 'garancia': SITE + '/migren-es-shenmen-piercing-garancia',
  'fajdalom': SITE + '/mennyire-faj-a-migren-piercing-behelyezese', 'velemenyek': SITE + '/migren-shenmen-piercing-velemenyek',
  'utoapolas': SITE + '/a-migren-es-shenmen-piercing-utoapolasa', 'kontroll': SITE + '/kontroll', 'rolunk': SITE + '/rolunk',
  'foglalas': SITE + '/idopontfoglalas', 'varosok': SITE + '/varosok',
  'migren': SITE + '/migren-piercing', 'shenmen': SITE + '/shenmen-piercing', 'klimax': SITE + '/klimax-piercing',
  'slim': SITE + '/slim-etvagycsokkento-piercing', 'allergia': SITE + '/allergia-piercing',
}
# minta-ertekek (production: dinamikus mezok)
BP = dict(nev='Feri', datum='2026. október 23., csütörtök', ido='14:30', szolg='3 db piercing (csomag)', ar='44 900 Ft',
          munkatars='Kovács Gabriella', varos='Budapest', cim='1137 Budapest, Újpesti rakpart 7., 5. emelet 25. (a Jászai Mari térnél)',
          ido_tart='kb. 40–50 perc', terkep='https://maps.google.com/?q=1137+Budapest+Újpesti+rakpart+7')
VIDEK = dict(BP, datum='2026. november 3., kedd', ido='10:40', szolg='1 db migrén piercing', ar='24 900 Ft', munkatars='Fekete Henrietta',
             varos='Miskolc', cim='3525 Miskolc, Széchenyi István utca 19., 4. emelet 2. ajtó (Széchenyi Egészség Központ)',
             ido_tart='kb. 30–40 perc', terkep='https://maps.google.com/?q=3525+Miskolc+Széchenyi+István+utca+19')
GOOGLE = '4,8 ★ · 4 900+ Google-vélemény'

def m(v):  # dinamikus mezo jelolese a mintaban
    return f'<span class="dyn">{html.escape(v)}</span>'

CSS = '''body{margin:0;background:#f6ebe4;font-family:Helvetica,Arial,sans-serif;color:#2f3044}
.wrap{max-width:600px;margin:0 auto;background:#fff}
.hd{padding:22px 28px 10px;text-align:center}.hd img{height:46px}
.hero img{width:100%;display:block}
.in{padding:8px 28px 22px;font-size:16px;line-height:1.55}
h1{font-size:23px;line-height:1.25;margin:14px 0 8px;color:#2f3044}
h2{font-size:18px;margin:22px 0 6px;color:#2f3044}
.card{background:#f6ebe4;border-radius:10px;padding:14px 16px;margin:14px 0}
.card td{padding:3px 0;font-size:15px;vertical-align:top}.card td.l{color:#6b6c80;width:118px}
.btn{display:inline-block;background:#b0463b;color:#fff!important;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:8px;margin:6px 6px 6px 0}
.btn2{display:inline-block;color:#b0463b!important;text-decoration:none;font-weight:bold;padding:12px 18px;border:2px solid #b0463b;border-radius:8px;margin:6px 0}
.steps td{padding:6px 0;vertical-align:top;font-size:15px}.num{display:inline-block;width:26px;height:26px;border-radius:13px;background:#d7aba8;color:#2f3044;text-align:center;line-height:26px;font-weight:bold;margin-right:10px}
.trust{background:#2f3044;color:#fff;padding:16px 28px;font-size:14px;line-height:1.6}.trust b{color:#d7aba8}
.team td{text-align:center;font-size:12px;color:#6b6c80;padding:4px}.team img{width:120px;height:120px;object-fit:cover;border-radius:60px}
.quote{border-left:4px solid #d7aba8;padding:6px 14px;margin:14px 0;font-style:italic;color:#454659}
.vid{display:block;position:relative;margin:12px 0}.vid img{width:100%;border-radius:8px;display:block}
.sig{margin-top:18px}.sig img{width:64px;height:64px;border-radius:32px;object-fit:cover;vertical-align:middle;margin-right:12px}
.ft{padding:18px 28px 28px;font-size:12px;color:#6b6c80;line-height:1.5;background:#f6ebe4}
.ft a{color:#6b6c80}.dyn{background:#fff3b0}
'''

def lap(cim, preheader, torzs, hero=None):
    hero_html = f'<div class="hero"><img src="{hero}" alt=""></div>' if hero else ''
    return f'''<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>{html.escape(cim)}</title><style>{CSS}</style></head><body>
<div style="display:none;max-height:0;overflow:hidden">{html.escape(preheader)}</div>
<div class="wrap"><div class="hd"><img src="{K['logo']}" alt="Medical Piercing"></div>{hero_html}
<div class="in">{torzs}</div>
<div class="trust"><b>Miért nyugodt kezekben vagy nálunk?</b><br>
✓ Alapítónk 20 év egészségügyi tapasztalattal (egyetemi okleveles ápoló) &nbsp;✓ Fülakupunktúrás végzettség, akupunktúrás pontmérő gép<br>
✓ Orvosilag steril körülmények, orvosi titán ékszer &nbsp;✓ Ingyenes kontroll és garancia &nbsp;✓ 14 helyszín az országban<br>
✓ {GOOGLE} &nbsp;✓ Szerepeltünk az RTL Klub Fókusz és a HírTV műsorában</div>
<div class="ft">Medical Piercing · GFRP Kft. · {m('1137 Budapest, Újpesti rakpart 7.')} · Tel.: +36 1 901 7444 · medicalpiercing.hu@gmail.com<br>
Erre a levélre válaszolhatsz, kollégáink elolvassák.<br><br>
Piercingeink közérzetjavító ékszerek; nem minősülnek gyógymódnak vagy orvosi kezelésnek, és nem helyettesítik az orvosi vizsgálatot. A tapasztalatok egyénenként eltérnek.</div>
</div></body></html>'''

def foglalas_kartya(d):
    return f'''<div class="card"><table role="presentation" width="100%">
<tr><td class="l">Időpont</td><td><b>{m(d["datum"])}, {m(d["ido"])}</b></td></tr>
<tr><td class="l">Szolgáltatás</td><td>{m(d["szolg"])}</td></tr>
<tr><td class="l">Szakember</td><td>{m(d["munkatars"])}</td></tr>
<tr><td class="l">Helyszín</td><td>{m(d["cim"])}</td></tr>
<tr><td class="l">Időtartam</td><td>{m(d["ido_tart"])}</td></tr>
<tr><td class="l">Ár</td><td>{m(d["ar"])} – helyszínen fizetendő</td></tr></table></div>'''

def gombok(d, modositas=True):
    g = f'<a class="btn" href="{d["terkep"]}">Útvonal</a>'
    if modositas: g += f'<a class="btn2" href="{L["foglalas"]}">Időpont módosítása</a>'
    return '<p>' + g + '</p>'

LEPESEK = '''<h2>Így zajlik majd, 4 lépésben</h2><table role="presentation" class="steps">
<tr><td><span class="num">1</span></td><td><b>Állapotfelmérés</b> – átbeszéljük a panaszaidat és az előzményeidet, és megnézzük a füled.</td></tr>
<tr><td><span class="num">2</span></td><td><b>Érzéstelenítés</b> – a szúrás helyét helyileg érzéstelenítjük.</td></tr>
<tr><td><span class="num">3</span></td><td><b>Gépi bemérés</b> – akupunktúrás pontmérővel jelöljük ki a pontos helyet a te füleden.</td></tr>
<tr><td><span class="num">4</span></td><td><b>Szúrás</b> – néhány másodperc, orvosi titán ékszerrel, steril körülmények között.</td></tr></table>'''

def csapat():
    return f'''<h2>Akik várnak</h2><table role="presentation" class="team" width="100%"><tr>
<td><img src="{K['gabi_portre']}" alt=""><br>Gabi – alapító,<br>20 év eü. tapasztalat</td>
<td><img src="{K['ricsi_ful']}" alt=""><br>Ricsi – fülakupunktúrás<br>addiktológus</td>
<td><img src="{K['viki_munka']}" alt=""><br>Viki</td><td><img src="{K['fanni_munka']}" alt=""><br>Fanni</td></tr></table>'''

def alairas(bp=True):
    if bp:
        return f'<div class="sig"><img src="{K["gabi_portre"]}" alt="">Szeretettel vár<br><b>Kovács Gabriella</b>, a Medical Piercing alapítója</div>'
    return '<div class="sig">Szeretettel várunk:<br><b>a Medical Piercing csapata</b></div>'

LEVELEK = []
def level(kod, mikor, kinek, targy, preheader, torzs, hero=None):
    LEVELEK.append(dict(kod=kod, mikor=mikor, kinek=kinek, targy=targy, fajl=f'{kod}.html'))
    (OUT / f'{kod}.html').write_text(lap(targy, preheader, torzs, hero), encoding='utf-8')

# ---- T0 visszaigazolas -------------------------------------------------------------------------------
def t0(d, bp):
    varos_sor = '' if bp else f'<p>A {m(d["varos"].lower()+"i")} kitelepülésünk csak meghatározott napokon van, ezért ha bármi közbejönne, kérjük, minél előbb tedd át az időpontot – így a helyedet más is megkaphatja.</p>'
    kep = f'<a class="vid" href="{L["folyamat"]}"><img src="{K["video_szuras"]}" alt="Videó: így néz ki egy szúrás"></a>'
    return f'''<h1>Megvan az időpontod, {m(d["nev"])}!</h1>
<p>Köszönjük, hogy minket választottál. Innentől nincs más dolgod, csak megérkezni – minden fontos részletet ide összegyűjtöttünk.</p>
{foglalas_kartya(d)}{gombok(d)}{varos_sor}{LEPESEK}
<p><b>Nem kell semmit hoznod.</b> Előtte egyél rendesen, és érkezz kb. 5 perccel korábban.</p>
<h2>Nézd meg előre, hogyan zajlik</h2>{kep}
<p><b>Garancia:</b> ha a piercing nálad nem váltja ki a várt hatást, munkadíj nélkül, csak az ékszer áráért helyezünk el egy megerősítő piercinget. A kontroll ingyenes. <a href="{L["garancia"]}">A garancia részletei</a></p>
{csapat() if bp else ''}{alairas(bp)}'''

level('01-T0-visszaigazolas-BP', 'Azonnal a foglalás után (Salonic „Új időpont létrehozva” + „Sikeres foglalás” helyett)', 'Budapesti foglaló',
      'Megvan az időpontod – okt. 23., 14:30 · Medical Piercing', 'Minden fontos részlet egy helyen – innentől csak meg kell érkezned.', t0(BP, True), K['szalon'])
level('02-T0-visszaigazolas-VIDEK', 'Azonnal a foglalás után (Salonic helyett)', 'Vidéki foglaló',
      'Megvan az időpontod Miskolcon – nov. 3., 10:40', 'Cím, időpont és minden, ami fontos – egy helyen.', t0(VIDEK, False))

# ---- E1 piercing-specifikus --------------------------------------------------------------------------
TIPUSOK = {
 'migren': dict(cim='migrén piercing', targy='Miért pont oda kerül a migrén piercinged?',
   bek='A migrén piercinget a fül egy olyan pontjába helyezzük, amelyet a fülakupunktúra régóta használ. A pontot nem szemmértékre jelöljük ki: akupunktúrás pontmérő géppel keressük meg a te füleden.',
   tipp='Ha a fejfájásod inkább féloldali, jelezd az állapotfelmérésnél – ilyenkor általában arra az oldalra javasoljuk az ékszert, ahol erősebbek a tünetek.',
   tort=('Kovács Gabriella, alapítónk', 'Gabi maga is évekig küzdött migrénnel. 20 évig dolgozott ápolóként az egészségügyben – a saját migrén piercingje után kezdett el mélyen foglalkozni a fülakupunktúrával.'), kep='ricsi_ful'),
 'shenmen': dict(cim='shenmen piercing', targy='Amit a shenmen piercingről érdemes tudnod',
   bek='A shenmen pont a fülakupunktúra egyik legismertebb pontja; sokan stressz, feszültség és nyugtalan alvás miatt választják. Ha több piercinget foglaltál, az állapotfelmérésnél közösen döntjük el, melyik pontok illenek a panaszaidhoz.',
   tipp='Gondold át előre, mi zavar most a legjobban (pl. alvás, feszültség, fejfájás) – így az állapotfelmérés gyorsabb és pontosabb lesz.',
   tort=('Kamilli Viktória (Viki), piercerünk', 'Viki korábban fogászati asszisztensként dolgozott. Saját tapasztalata, hogy a piercingje után a szédülése és az alvása is javult – ezért tanulta ki a szakmát.'), kep='viki_munka'),
 'klimax': dict(cim='klimax piercing', targy='Amit a klimax piercingről érdemes tudnod',
   bek='A klimax piercinget sok hölgy választja a változókor kellemetlenségei miatt – például hőhullám, éjszakai izzadás, rossz alvás vagy hangulatingadozás. A pontot akupunktúrás pontmérő géppel jelöljük ki a te füleden.',
   tipp='Írd fel magadnak, mely tünetek zavarnak most a legjobban, és mióta – az állapotfelmérésnél ez sokat segít.',
   tort=('Kovács Gabriella, alapítónk', 'Gabi 20 évet dolgozott az egészségügyben, egyetemi okleveles ápolóként, majd osztályvezető ápolóként. Nálunk minden szúrás előtt állapotfelmérés van: meghallgatunk, és csak utána döntünk a pontokról.'), kep='gabi_munka'),
 'slim': dict(cim='slim (étvágycsökkentő) piercing', targy='Amit a slim piercingről érdemes tudnod',
   bek='A slim piercinget a fül egy olyan pontjába helyezzük, amelyet a fülakupunktúra az étvággyal kapcsolatban használ. Sokan a nassolás, a stresszevés vagy a falási rohamok miatt választják – a tapasztalat egyénenként eltér, és nem helyettesíti az életmódváltást.',
   tipp='A legtöbbet akkor adhat, ha támogatásként tekintesz rá: figyeld meg magadon, mikor és miért nassolsz.',
   tort=('Kovács Gabriella, alapítónk', 'Minden szúrás előtt átbeszéljük, mit vársz, és mi az, ami reális. Nálunk nincs csodaígéret – csak pontos munka és őszinte tájékoztatás.'), kep='gabi_munka'),
 'allergia': dict(cim='allergia piercing', targy='Amit az allergia piercingről érdemes tudnod',
   bek='Az allergia piercinget sokan a szezonális panaszok miatt választják. A pontot akupunktúrás pontmérő géppel jelöljük ki a te füleden, egészségügyi tapasztalattal rendelkező szakember végzi a szúrást.',
   tipp='Ha éppen erős allergiás tüneteid vannak vagy gyógyszert szedsz, jelezd az állapotfelmérésnél.',
   tort=('Kovács Richárd (Ricsi), piercerünk', 'Ricsi fülakupunktúrás addiktológus. Nálunk minden vendégnél akupunktúrás pontmérő géppel, ugyanazzal a pontossággal jelöljük ki a helyet.'), kep='ricsi_munka'),
}
for kod, t in TIPUSOK.items():
    torzs = f'''<h1>{m(BP["nev"])}, pár szó a {t["cim"]}edről</h1><p>{t["bek"]}</p>
<div class="quote">{t["tort"][1]}<br><span style="font-style:normal;font-size:14px">– {t["tort"][0]}</span></div>
<h2>Egy jó tanács az időpontod előtt</h2><p>{t["tipp"]}</p>
<p><a class="btn" href="{L[kod]}">Bővebben a {t["cim"]}ről</a></p>
<p>Az időpontod: <b>{m(BP["datum"])}, {m(BP["ido"])}</b>. Ha módosítanod kell, <a href="{L["foglalas"]}">itt teheted meg</a>.</p>{alairas(True)}'''
    level(f'03-E1-{kod}', 'Foglalás +1 nap, ha ≥5 nap van az időpontig (2–3 db csomag = shenmen)', f'{t["cim"].capitalize()} foglalói (BP-minta; vidéken fotó nélkül)',
          t['targy'], 'Hova kerül, miért ott, és mit érdemes előre átgondolnod.', torzs, K[t['kep']])

# ---- E2 fajdalom + garancia --------------------------------------------------------------------------
level('04-E2-faj-garancia', '≥10 nap az időpontig: kb. a hátralévő idő felénél', 'Minden foglaló',
 'Fáj? Őszintén válaszolunk', 'Mit érzel majd, mennyi ideig tart – és mi van, ha nem hat.', f'''<h1>Fáj? Őszintén válaszolunk.</h1>
<p>Ez a leggyakoribb kérdés, amit kapunk, ezért röviden és őszintén:</p>
<ul><li><b>A szúrás helyét érzéstelenítjük.</b> A legtöbben egy rovarcsípéshez hasonlítják – és pár másodpercig tart.</li>
<li><b>Utána néhány napig érzékeny lehet a fül,</b> előfordulhat, hogy arra az oldalra nem tudsz feküdni; ez általában 1–2 hét alatt elmúlik.</li>
<li><b>Ha volt már ájulásod vagy félsz a tűtől,</b> szólj nyugodtan – az állapotfelmérésnél erre is rákérdezünk, és ehhez igazodunk.</li></ul>
<h2>És ha nálad nem hat?</h2>
<p>Vendégeink visszajelzései alapján a piercingek többségüknél pozitív hatást váltanak ki<sup>*</sup>, de van, akinek a szervezete nem fogékony a fülbéli pontok stimulálására. Ha te is így jársz, <b>munkadíj nélkül, csak az ékszer áráért</b> elhelyezünk egy megerősítő piercinget. A kontroll ingyenes.</p>
<p><a class="btn" href="{L["garancia"]}">A garancia részletei</a><a class="btn2" href="{L["fajdalom"]}">Mennyire fáj? – cikk</a></p>
<p style="font-size:12px;color:#6b6c80">* 2 238 megkérdezett vendégünk 93%-a számolt be pozitív hatásról. A statisztika nem minősül hivatalosnak.</p>
<p>Várunk: <b>{m(BP["datum"])}, {m(BP["ido"])}</b>.</p>{alairas(True)}''', K['gabi_munka'])

# ---- E3 velemenyek -----------------------------------------------------------------------------------
level('05-E3-velemenyek', '≥21 nap az időpontig: egyszer, az E2 után', 'Minden foglaló',
 'Akik előtted jártak nálunk', 'Valódi vendégek, valódi tapasztalatok – a te időpontod is közeleg.', f'''<h1>Akik előtted jártak nálunk</h1>
<p>Még van egy kis idő az időpontodig, ezért nem reklámot küldünk – csak megmutatjuk, mit mondanak, akik már nálunk jártak.</p>
<div class="quote">„Egy piercingért mentem, hárommal távoztam. Sokkal kevésbé volt para, mint ahogy elképzeltem.”<br><span style="font-style:normal;font-size:14px">– Domján Dóra</span></div>
<div class="quote">„Nagyon kedves és segítőkész volt a szakember, teljesen meg vagyok elégedve.”<br><span style="font-style:normal;font-size:14px">– Zseszti, Kecskemét</span></div>
<p>Több mint 4 900 vendégünk írt rólunk a Google-ön, átlagosan <b>4,8 csillag</b>. Rólunk szólt az RTL Klub Fókusz és a HírTV is.</p>
<p><a class="btn" href="{L["velemenyek"]}">Vendégvélemények és videók</a></p>
<a class="vid" href="{L["rolunk"]}"><img src="{K["video_gabi"]}" alt="Videó: Gabi bemutatkozik"></a>
<p>Az időpontod továbbra is: <b>{m(BP["datum"])}, {m(BP["ido"])}</b>.</p>{alairas(True)}''')

# ---- T-48 felkeszules (Salonic emlekezteto helyett) ---------------------------------------------------
def t48(d, bp):
    return f'''<h1>Két nap múlva találkozunk, {m(d["nev"])}!</h1>
<p>Már csak ennyi, hogy minden simán menjen:</p>
<table role="presentation" class="steps">
<tr><td><span class="num">1</span></td><td><b>Egyél előtte rendesen</b> – üres gyomorral könnyebben megszédül az ember.</td></tr>
<tr><td><span class="num">2</span></td><td><b>A hajad legyen összefogva</b>, hogy ne lógjon a fülbe.</td></tr>
<tr><td><span class="num">3</span></td><td><b>Szólj előre</b>, ha vérhígítót szedsz, várandós vagy, vagy volt már ájulásod – így biztonságosan tudunk dönteni. Hívj: +36 1 901 7444.</td></tr>
<tr><td><span class="num">4</span></td><td><b>Tervezz {m(d["ido_tart"])} időt</b>, és érkezz 5 perccel korábban.</td></tr></table>
{foglalas_kartya(d)}{gombok(d)}{alairas(bp)}'''
level('06-T48-felkeszules-BP', '48 órával előtte, ha ≥5 nap volt a foglalás és az időpont között (Salonic „Időpont emlékeztető” helyett)', 'Budapesti foglaló',
      'Két nap múlva találkozunk – így készülj', 'Négy apróság, és minden simán megy.', t48(BP, True), K['gabi_ekszer'])
level('07-T48-felkeszules-VIDEK', '48 órával előtte (Salonic emlékeztető helyett)', 'Vidéki foglaló',
      'Két nap múlva Miskolcon találkozunk – így készülj', 'Négy apróság, és minden simán megy.', t48(VIDEK, False))

# ---- modositas, lemondas (Salonic helyett) ------------------------------------------------------------
level('08-modositas', 'Azonnal, időpont-módosításkor (Salonic „Foglalás módosítva” helyett)', 'Mindenki',
 'Megvan az új időpontod – okt. 23., 14:30', 'A régi időpont helyett már ezt tartjuk neked.', f'''<h1>Megvan az új időpontod!</h1>
<p>Rendben, módosítottuk – a régi időpont helyett már ezt tartjuk neked:</p>{foglalas_kartya(BP)}{gombok(BP)}{alairas(True)}''')
level('09-lemondas', 'Azonnal, lemondáskor vagy törléskor (Salonic „Lemondás” és „Időpont törlés” helyett)', 'Mindenki',
 'Rendben, töröltük az időpontodat', 'Ha csak az időpont nem volt jó, innen egyből választhatsz újat.', f'''<h1>Rendben, töröltük az időpontodat</h1>
<p>Az alábbi időpontodat töröltük: <b>{m(BP["datum"])}, {m(BP["ido"])}</b> – {m(BP["szolg"])}.</p>
<p>Ha csak az időpont nem volt jó, nem kell elölről kezdened – itt egy perc alatt választhatsz újat:</p>
<p><a class="btn" href="{L["foglalas"]}">Új időpontot választok</a></p>
<p>Ha most nem szeretnél új időpontot, az is teljesen rendben van. Ha kérdésed van, hívj nyugodtan: +36 1 901 7444.</p>
<p style="font-size:14px;color:#6b6c80">Vidéken a következő helyi napokat a <a href="{L["varosok"]}">kitelepülési naptárban</a> látod.</p>{alairas(True)}''')

SMS = [
 ('T0', 'Azonnal', 'Szia {keresztnév}! Megvan az időpontod: {dátum} {idő}, {helyszín}. Részletek, módosítás: {link} – Medical Piercing'),
 ('T-72', '72 órával előtte (ha ≥96 órája foglalt)', 'Szia {keresztnév}! {nap} {idő}-kor várunk. Megerősíted, vagy áttennéd? Egy kattintás: {link} – Medical Piercing'),
 ('T-72 vidék', '72 órával előtte, vidéken', 'Szia {keresztnév}! {nap} {idő}-kor várunk {városban}. Ha nem jó, itt áttehető: {link}. Itt legközelebb {köv_nap}-n leszünk. – MP'),
 ('T-24', '24 órával előtte', 'Szia {keresztnév}! Holnap {idő}-kor várunk: {cím}. Egyél előtte, érkezz 5 perccel korábban. – Medical Piercing'),
 ('Lemondás', 'Azonnal', 'Szia {keresztnév}! Töröltük a {dátum} {idő}-s időpontodat. Ha csak az időpont nem volt jó, itt választhatsz újat: {link} – MP'),
 ('Módosítás', 'Azonnal', 'Szia {keresztnév}! Megvan az új időpontod: {dátum} {idő}, {helyszín}. Részletek: {link} – Medical Piercing'),
 ('No-show', 'Következő munkanap 10:00', 'Szia {keresztnév}! Tegnap nem találkoztunk, reméljük, minden rendben. Ha csak csúszott az időpont: {link} – Medical Piercing'),
]
(OUT / 'sms.json').write_text(json.dumps(SMS, ensure_ascii=False), encoding='utf-8')

sorok = ''.join(f'<tr><td><b>{x["kod"][:2]}</b></td><td><a href="{x["fajl"]}">{html.escape(x["targy"])}</a><br><small>{html.escape(x["kinek"])}</small></td><td>{html.escape(x["mikor"])}</td></tr>' for x in LEVELEK)
smssor = ''.join(f'<tr><td><b>{a}</b></td><td>{html.escape(b)}</td><td>{html.escape(c)}<br><small>{len(c)} karakter</small></td></tr>' for a, b, c in SMS)
(OUT / 'index.html').write_text(f'''<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MP foglalási levelek – v1</title>
<meta name="robots" content="noindex"><style>body{{font-family:Helvetica,Arial,sans-serif;background:#f6ebe4;color:#2f3044;margin:0;padding:24px}}main{{max-width:960px;margin:0 auto;background:#fff;padding:24px;border-radius:12px}}
table{{border-collapse:collapse;width:100%}}td{{border-bottom:1px solid #eee;padding:9px 8px;vertical-align:top;font-size:15px}}a{{color:#b0463b}}small{{color:#6b6c80}}h2{{margin-top:28px}}</style></head><body><main>
<h1>Medical Piercing – foglalástól a megjelenésig: levelek és SMS-ek (v1)</h1>
<p>A sárgával jelölt részek dinamikus mezők (a minta példaértékekkel). Budapesten a csapat fotóival, vidéken fotó nélkül (a vidéki fotózás után kerülnek be képek).</p>
<h2>E-mailek</h2><table>{sorok}</table><h2>SMS-ek</h2><table>{smssor}</table></main></body></html>''', encoding='utf-8')
print(len(LEVELEK), 'level kesz')
