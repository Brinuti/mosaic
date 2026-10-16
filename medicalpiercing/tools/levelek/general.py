# Medical Piercing – foglalastol a megjelenesig: e-mail mintak (v2, 2026-10-16, a tulajdonos visszajelzese alapjan).
# Kimenet: assets/levelek/*.html + index.html + sms.json + szoveg.txt.  Futtatas: python3 general.py [kep_alap_url]
# A {mezo} jelolesek a lifecycle-motor dinamikus mezoi; a mintakban pelda ertekek, sarga jelolessel.
import html, pathlib, json, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'levelek'
OUT.mkdir(parents=True, exist_ok=True)
SITE = 'https://www.medicalpiercing.hu'
KEPALAP = (sys.argv[1] if len(sys.argv) > 1 else SITE).rstrip('/') + '/assets/levelek/kep/'
IMG = SITE + '/assets/img/f18724_'
K = {
  'logo': IMG + '5d639907d27148e1a1e80625fce81d7a.png',
  'szalon': IMG + '9523f7cd094b451aa8534ca6d7cfaa3e.jpg',
  'gabi_portre': IMG + '3ae9dfe53a07477fae1a816f79be5098.jpg',   # minta: a foglalt munkatars fotoja (Salonic employeeProfilePicture)
  'video': KEPALAP + 'szuras-video.jpg', 'ekszerek': KEPALAP + 'ekszerek.jpg', 'steril': KEPALAP + 'steril.jpg',
}
L = {
  'video': SITE + '/uj/a-szuras-folyamata#lepes-6', 'folyamat': SITE + '/uj/a-szuras-folyamata',
  'garancia': SITE + '/uj/migren-es-shenmen-piercing-garancia', 'velemenyek': SITE + '/uj/migren-shenmen-piercing-velemenyek',
  'utoapolas': SITE + '/uj/a-migren-es-shenmen-piercing-utoapolasa', 'ekszerek': SITE + '/uj/ekszereink',
  'kontroll': SITE + '/kontroll', 'foglalas': SITE + '/idopontfoglalas', 'varosok': SITE + '/elerhetosegek',
  'modositas': SITE + '/f/{token}',  # sajat "A foglalasod" oldal, mint a Mosaicnal (/f/<token>) – Salonicra soha nem visz
  'migren': SITE + '/uj/migren-piercing', 'shenmen': SITE + '/uj/shenmen-piercing', 'klimax': SITE + '/uj/klimax-piercing',
  'slim': SITE + '/uj/slim-etvagycsokkento-piercing', 'allergia': SITE + '/uj/allergia-piercing',
}
GOOGLE_DB = '5 030'  # dinamikus: /api/ertekeles (db) – minden kuldeskor a friss szam
BP = dict(nev='Feri', datum='2026. október 23., csütörtök', ido='14:30', szolg='3 db piercing (csomag)', ar='44 900 Ft',
          munkatars='Kovács Gabriella', varos='Budapest', varosban='Budapesten', cim='1137 Budapest, Újpesti rakpart 7., 5. emelet 25. (a Jászai Mari térnél)',
          ido_tart='kb. 40–50 perc', terkep='https://maps.google.com/?q=1137+Budapest+Újpesti+rakpart+7',
          erkezes='A Jászai Mari térnél vagyunk, a környező utcákban könnyen meg tudsz állni autóval; villamossal a Jászai Mari tér megálló van a legközelebb.')
VIDEK = dict(BP, datum='2026. november 3., kedd', ido='10:40', szolg='1 db migrén piercing', ar='24 900 Ft', munkatars='Fekete Henrietta',
             varos='Miskolc', varosban='Miskolcon', cim='3525 Miskolc, Széchenyi István utca 19., 4. emelet 2. ajtó (Széchenyi Egészség Központ)',
             ido_tart='kb. 30–40 perc', terkep='https://maps.google.com/?q=3525+Miskolc+Széchenyi+István+utca+19',
             erkezes='A Széchenyi Egészség Központban, a 4. emeleten, a 2-es ajtónál várunk.')

def m(v):  # dinamikus mezo jelolese a mintaban
    return f'<span class="dyn">{html.escape(v)}</span>'

def kep(src, href, alt='', stilus=''):  # minden kep linkelve: a Gmail igy nem tesz ra letoltes-gombot
    return f'<a href="{href}" style="display:block;text-decoration:none"><img src="{src}" alt="{html.escape(alt)}" width="600" style="width:100%;height:auto;display:block;border:0;{stilus}"></a>'

CSS = '''body{margin:0;background:#f6ebe4;font-family:Helvetica,Arial,sans-serif;color:#2f3044}
.wrap{max-width:600px;margin:0 auto;background:#fff}
.hd{padding:22px 28px 12px;text-align:center}.hd img{height:72px;width:auto;border:0}
.in{padding:8px 28px 22px;font-size:16px;line-height:1.6}
h1{font-size:24px;line-height:1.25;margin:16px 0 8px;color:#2f3044}
h2{font-size:18px;margin:26px 0 6px;color:#2f3044}
p{margin:10px 0}
.card{background:#f6ebe4;border-radius:10px;padding:14px 16px;margin:14px 0}
.card td{padding:3px 0;font-size:15px;vertical-align:top}.card td.l{color:#6b6c80;width:118px}
.btn{display:inline-block;background:#b0463b;color:#fff!important;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:8px;margin:6px 6px 6px 0}
.btn2{display:inline-block;color:#b0463b!important;text-decoration:none;font-weight:bold;padding:11px 18px;border:2px solid #b0463b;border-radius:8px;margin:6px 0}
.steps td{padding:7px 0;vertical-align:top;font-size:15px;line-height:1.55}.num{display:inline-block;width:26px;height:26px;border-radius:13px;background:#d7aba8;color:#2f3044;text-align:center;line-height:26px;font-weight:bold;margin-right:10px}
.trust{background:#2f3044;color:#fff;padding:18px 28px;font-size:14px;line-height:1.7}.trust b{color:#d7aba8}
.velem{background:#fbf6f3;border-left:4px solid #d7aba8;border-radius:6px;padding:10px 14px;margin:12px 0;font-size:15px;color:#454659}
.velem .cs{color:#fbbc04;letter-spacing:1px}.velem .nev{font-size:13px;color:#6b6c80}
.kep{margin:14px 0}.kep img{border-radius:8px}.felirat{font-size:13px;color:#6b6c80;margin-top:4px}
.sig{margin-top:22px}.sig img{width:64px;height:64px;border-radius:32px;vertical-align:middle;margin-right:12px}
.ft{padding:18px 28px 28px;font-size:12px;color:#6b6c80;line-height:1.5;background:#f6ebe4}
.ft a{color:#6b6c80}.dyn{background:#fff3b0}
'''

BIZALOM = f'''<div class="trust"><b>Nyugodt kezekben leszel nálunk</b><br>
✓ 2 238 megkérdezett vendégünk 93%-a jelezte vissza, hogy nála működik*<br>
✓ Fülakupunktúrás végzettség, akupunktúrás pontmérő gép – a pontot a te füleden mérjük ki<br>
✓ Egészségügyből jöttünk, havonta közel 2 000 szúrás van mögöttünk<br>
✓ Orvosilag steril körülmények, G23 orvosi titán ékszer<br>
✓ Csak nálunk: ingyenes kontroll – és garancia<br>
✓ 4,8 ★ · {m(GOOGLE_DB)} Google-vélemény · Láthattál minket az RTL Klub Fókusz és a HírTV műsorában</div>'''

def lap(cim, preheader, torzs, hero=None, hero_link=None):
    hero_html = kep(hero, hero_link or SITE) if hero else ''
    return f'''<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>{html.escape(cim)}</title><style>{CSS}</style></head><body>
<div style="display:none;max-height:0;overflow:hidden">{html.escape(preheader)}</div>
<div class="wrap"><div class="hd"><a href="{SITE}"><img src="{K['logo']}" alt="Medical Piercing"></a></div>{hero_html}
<div class="in">{torzs}</div>{BIZALOM}
<div class="ft">Medical Piercing · Tel.: +36 1 901 7444 · medicalpiercing.hu@gmail.com · <a href="{SITE}">medicalpiercing.hu</a><br>
Erre a levélre nyugodtan válaszolhatsz, kollégáink elolvassák.<br><br>
* 2 238 megkérdezett vendégünk visszajelzése alapján (migrén, shenmen és klimax piercing). Saját vendég-visszajelzés, nem reprezentatív kutatás és nem klinikai eredmény; a tapasztalat egyénenként eltér.<br>
Piercingeink közérzetjavító ékszerek; nem minősülnek gyógymódnak vagy orvosi kezelésnek, és nem helyettesítik az orvosi vizsgálatot.</div>
</div></body></html>'''

def foglalas_kartya(d):
    return f'''<div class="card"><table role="presentation" width="100%">
<tr><td class="l">Időpont</td><td><b>{m(d["datum"])}, {m(d["ido"])}</b></td></tr>
<tr><td class="l">Szolgáltatás</td><td>{m(d["szolg"])}</td></tr>
<tr><td class="l">Szakember</td><td>{m(d["munkatars"])}</td></tr>
<tr><td class="l">Helyszín</td><td>{m(d["cim"])}</td></tr>
<tr><td class="l">Időtartam</td><td>{m(d["ido_tart"])}</td></tr>
<tr><td class="l">Ár</td><td>{m(d["ar"])} – a helyszínen fizetendő</td></tr></table></div>'''

def gombok(d):
    return f'<p><a class="btn" href="{d["terkep"]}">Útvonal</a><a class="btn2" href="{L["modositas"]}">Időpont módosítása</a></p>'

def mini_idopont(d):
    return f'<p style="font-size:15px">Az időpontod: <b>{m(d["datum"])}, {m(d["ido"])}</b>, {m(d["varos"])}. Ha módosítanod kell, <a href="{L["modositas"]}">itt egy kattintással megteheted</a>.</p>'

def alairas(d, foto):
    kepe = f'<img src="{K["gabi_portre"]}" alt="">' if foto else ''
    return f'<div class="sig">{kepe}Szeretettel vár:<br><b>{m(d["munkatars"])}</b> és a Medical Piercing csapata</div>'

def velemeny(szoveg, nev):
    return f'<div class="velem"><span class="cs">★★★★★</span><br>„{szoveg}”<br><span class="nev">– {nev}, Google-vélemény</span></div>'

VIDEO = lambda: f'''<h2>Nézd meg előre, hogyan zajlik</h2><div class="kep">{kep(K["video"], L["video"], "Videó: így néz ki egy szúrás")}
<div class="felirat">Egy teljes szúrás videón, az elejétől a végéig – kattints a képre.</div></div>'''

LEVELEK = []
def level(kod, mikor, kinek, targy, preheader, torzs, hero=None, hero_link=None):
    LEVELEK.append(dict(kod=kod, mikor=mikor, kinek=kinek, targy=targy, fajl=f'{kod}.html'))
    (OUT / f'{kod}.html').write_text(lap(targy, preheader, torzs, hero, hero_link), encoding='utf-8')

# ---- 01-02  T0 visszaigazolas ------------------------------------------------------------------------------
def t0(d, bp):
    videk = '' if bp else f'<p>{m(d["varosban"])} csak meghatározott napokon vagyunk, ezért ha mégsem tudsz jönni, kérjük, minél előbb módosítsd az időpontodat – így a helyedet másnak is fel tudjuk ajánlani.</p>'
    return f'''<h1>Megvan az időpontod, {m(d["nev"])}!</h1>
<p>Köszönjük, hogy minket választottál. Innentől nincs más dolgod, csak megérkezni – minden fontos részletet ide gyűjtöttünk.</p>
{foglalas_kartya(d)}{gombok(d)}{videk}
<p><b>Hogyan találsz meg minket?</b> {m(d["erkezes"])}</p>
<h2>Így zajlik majd</h2><table role="presentation" class="steps">
<tr><td><span class="num">1</span></td><td><b>Rövid beszélgetés</b> – átbeszéljük, mi miatt érkeztél, és megnézzük a füled.</td></tr>
<tr><td><span class="num">2</span></td><td><b>Ékszerválasztás</b> – kiválasztod a neked tetsző G23 titán ékszert.</td></tr>
<tr><td><span class="num">3</span></td><td><b>Pontmérés és érzéstelenítés</b> – géppel kimérjük a pontot a füleden, majd érzéstelenítjük.</td></tr>
<tr><td><span class="num">4</span></td><td><b>Szúrás</b> – pár másodperc, steril eszközökkel. A legtöbben utána mosolyognak, hogy ettől féltek.</td></tr></table>
{VIDEO()}
<p><b>Nem kell semmit hoznod.</b> Előtte egyél rendesen, és érkezz kb. 5 perccel korábban.</p>
<p><b>Garancia:</b> ha 6 hét után nem azt tapasztalod, amit vártál, munkadíj nélkül, csak az ékszer áráért helyezünk be egy megerősítő piercinget. A kontroll ingyenes. <a href="{L["garancia"]}">A garancia részletei</a></p>
{alairas(d, bp)}'''

level('01-T0-visszaigazolas-BP', 'Azonnal a foglalás után (a Salonic „Új időpont létrehozva” és „Sikeres foglalás” levele helyett)', 'Budapesti foglaló',
      'Visszaigazoltuk az időpontodat: okt. 23., 14:30', 'Minden fontos részlet egy helyen – innentől csak meg kell érkezned.', t0(BP, True), K['szalon'], SITE + '/uj/elerhetosegek')
level('02-T0-visszaigazolas-VIDEK', 'Azonnal a foglalás után (a Salonic levelei helyett)', 'Vidéki foglaló',
      'Visszaigazoltuk az időpontodat Miskolcon: nov. 3., 10:40', 'Cím, időpont és minden, ami fontos – egy helyen.', t0(VIDEK, False))

# ---- 03  E1: miert mukodik (piercingenkent) ----------------------------------------------------------------
TIPUSOK = {
 'migren': dict(nev='migrén piercing', nevelo='a', h93=True,
   bek='A migrén piercing a fül porcába, a fülakupunktúra egyik régóta használt pontjába kerül. Sokan azért választják, mert a fejfájás és a migrénes rohamok újra és újra kiveszik őket a hétköznapokból – és szeretnének egy gyógyszermentes, közérzetjavító lehetőséget is kipróbálni.',
   tipp='Ha a fejfájásod inkább féloldali, mondd el a beszélgetésnél: ilyenkor általában arra az oldalra javasoljuk az ékszert, ahol erősebbek a tünetek.',
   vel=[('Február közepe óta nem fájt a fejem, még front idején sem. Korábban borzasztó migrénes voltam.', 'Eszter Sz.'),
        ('Kedves fogadtatás, igényes, tiszta környezet, mindent elmondott lépésről lépésre, ami megnyugtatott. Két hónap telt el, és nem volt migrénes rohamom.', 'Enikő Cs.')]),
 'shenmen': dict(nev='shenmen piercing', nevelo='a', h93=True,
   bek='A shenmen pont a fülakupunktúra egyik legismertebb pontja. Sokan stressz, belső feszültség, szorongás vagy nyugtalan alvás miatt választják – gyakran más piercingek mellé, kiegészítésként. Ha 2–3 piercinget foglaltál, a beszélgetésnél közösen döntjük el, melyik pontok illenek leginkább ahhoz, ami miatt érkezel.',
   tipp='Gondold át előre, mi zavar most a legjobban – az alvás, a feszültség, a fejfájás vagy valami más. Így a beszélgetés gyorsabb, és pontosabban tudunk javasolni.',
   vel=[('Úgy voltam vele, nincs veszteni valóm, legfeljebb lesz egy szép ékszerem. Pár hét után azt vettem észre, hogy egyre kevesebbet forgolódok, és egyre kevesebbszer ébredek fel az éjszaka.', 'Kata S.'),
        ('1 hónapon belül jelentkeztek a pozitív hatásai: nyugodtabbnak éreztem magam, kevésbé vagyok stresszes azóta is.', 'Éva K.')]),
 'klimax': dict(nev='klimax piercing', nevelo='a', h93=True,
   bek='A klimax piercinget sokan a változókor kellemetlenségei miatt választják – hőhullám, éjszakai izzadás, rossz alvás vagy hangulatingadozás miatt. Nálunk minden szúrás előtt beszélgetés van: meghallgatunk, és utána közösen választjuk ki a pontokat.',
   tipp='Írd fel magadnak, mely tünetek zavarnak most a legjobban, és mióta – a beszélgetésnél ez sokat segít.',
   vel=[('Sokkal kevesebb a hőhullámom nappal, éjszaka pedig szinte teljesen elmúlt. Eddig 4–5-ször felébredtem éjszaka, most csak egyszer, vagy egyszer sem.', 'Gabi M.'),
        ('Nem szűntek meg teljesen a panaszaim, de sokkal kevesebb a hőhullám és kisebb intenzitású, és az alvásom is sokkal nyugodtabb.', 'Noémi M.')]),
 'slim': dict(nev='slim piercing', nevelo='a', h93=False,
   bek='A slim piercinget a fül egy olyan pontjába helyezzük, amelyet a fülakupunktúra az étvággyal összefüggésben használ. Sokan a nassolás, az édesség utáni sóvárgás vagy a stresszevés miatt választják – támogatásként, nem az életmódváltás helyett.',
   tipp='A legtöbbet akkor adhat, ha segítségként tekintesz rá: az első hetekben figyeld meg magadon, mikor és miért nassolsz.',
   vel=[('Nincs az az erős édesség iránti vágyam, mint a piercing előtt. Jobban kontrollálhatók ezáltal az étkezések.', 'Katalin O.'),
        ('Nincs édesség utáni sóvárgásom, valamint étkezésnél hamarabb van telítettségérzésem. Be sem gyulladtak a szúrások.', 'Enikő P.')]),
 'allergia': dict(nev='allergia piercing', nevelo='az', h93=False,
   bek='Az allergia piercinget sokan a szezonális, tavaszi vagy őszi panaszok miatt választják. Ha most éppen erős tüneteid vannak, vagy gyógyszert szedsz, mondd el a beszélgetésnél – ehhez igazodunk.',
   tipp='Ha tudod, írd fel, melyik időszakban a legerősebbek a tüneteid – így könnyebb lesz követned, mit tapasztalsz a piercing után.',
   vel=[('Érezhetően elviselhetőbb a tavaszi allergiaszezon, amióta csináltattam allergia piercinget.', 'Rita I.'),
        ('Kevés tünetem maradt, azok is teljesen elviselhetőek, sokkal jobb, mint a piercing előtt volt. A szúrás helye gyorsan gyógyult.', 'Viki F.')]),
}
for kod, t in TIPUSOK.items():
    n, a = t['nev'], t['nevelo']
    h93 = (f'''<h2>93% – nem ígéret, hanem vendégeink visszajelzése</h2>
<p>2 238 megkérdezett vendégünk 93%-a jelezte vissza, hogy a piercing nála működik.* Fontos, hogy őszinték legyünk: ez nem akupunktúra, nem csodaszer és nem gyógymód, hanem közérzetjavító ékszer, amelyet egészségügyi alapossággal helyezünk be. Mindenki más, a tapasztalat egyénenként eltér – ezért van garancia: ha 6 hét után nem azt tapasztalod, amit vártál, munkadíj nélkül, csak az új ékszer áráért (5 000 Ft) helyezünk be egy megerősítő piercinget.</p>'''
           if t['h93'] else f'''<h2>Őszintén: mire számíthatsz?</h2>
<p>{a.capitalize()} {n} nem akupunktúra, nem csodaszer és nem gyógymód, hanem közérzetjavító ékszer, amelyet egészségügyi alapossággal helyezünk be. Mindenki más, a tapasztalat egyénenként eltér – de sok vendégünk ír arról, mit tapasztalt:</p>''')
    torzs = f'''<h1>{m(BP["nev"])}, a pontosság a lényeg – így készül {a} {n}ed</h1>
<p>{t["bek"]}</p>
<h2>Miért számít, hová kerül?</h2>
<p>A fülben sok akupunktúrás pont van, egymástól sokszor csak milliméterekre. {a.capitalize()} {n} akkor tud a legtöbbet adni, ha pontosan a megfelelő pontba kerül. Ezért nálunk ez soha nem szemmérték kérdése.</p>
<h2>A pontmérő: a te füledhez igazítva</h2>
<p>Minden fül más. A szúrás előtt akupunktúrás pontmérő géppel vizsgáljuk meg a füledet: a készülék a bőr elektromos vezetőképességét méri, ami az akupunktúrás pontokon eltér a környező bőrétől. Így a pontot a te füleden keressük meg – nem egy ábráról másoljuk.</p>
<h2>Akik szúrnak: egészségügyből jöttünk</h2>
<p>Alapítónk, Kovács Gabriella 20 évig dolgozott az egészségügyben, egyetemi okleveles ápolóként, majd osztályvezető ápolóként. Kollégáink is az egészségügyből érkeztek, és mindannyian fülakupunktúrás végzettséggel dolgozunk. Havonta közel 2 000 piercinget helyezünk be – több tízezer szúrás van a hátunk mögött.</p>
<p>Ezért mondjuk nyugodt szívvel: nálunk a szúrás helyéről nem szemmérték dönt, így nem kell attól tartanod, hogy rossz helyre kerül a piercing. Ismerjük a fül pontjait, anatómiai tudással dolgozunk, és minden pontot megmérünk.</p>
{h93}
{velemeny(*t["vel"][0])}{velemeny(*t["vel"][1])}
<p><a class="btn2" href="{L["velemenyek"]}">Mind a {m(GOOGLE_DB)} vélemény</a></p>
<h2>Egy jó tanács az időpontod előtt</h2><p>{t["tipp"]}</p>
<p><a class="btn" href="{L[kod]}">Bővebben {a} {n}ről</a></p>
{mini_idopont(BP)}<p style="font-size:15px"><b>Kérdésed van még?</b> Válaszolj erre a levélre, és még az időpontod előtt válaszolunk.</p>{alairas(BP, True)}'''
    level(f'03-E1-{kod}', 'Foglalás +1 nap, ha legalább 5 nap van az időpontig (2–3 db-os csomag = shenmen)', f'{n.capitalize()} foglalói (vidéken az aláírás fotó nélkül)',
          f'Pontosan oda kerül, ahová kell – {a} {n}edről', 'Pontmérő, egészségügyi háttér, több tízezer szúrás – és mit mondanak a vendégeink.',
          torzs, KEPALAP + f'ful-{kod}.jpg', L[kod])

# ---- 04  E2: igy telik majd a latogatasod (folyamat, biztonsag, ekszerek) -----------------------------------
level('04-E2-igy-zajlik', 'Ha legalább 7 nap van az időpontig: kb. a hátralévő idő felénél', 'Minden foglaló',
 'Így telik majd az a fél óra nálunk', 'Lépésről lépésre: mi történik, milyen ékszert kapsz, és miért vagy biztonságban.', f'''<h1>Így telik majd az a fél óra nálunk</h1>
<p>{m(BP["nev"])}, az első szúrás előtt a legtöbben ugyanazt szeretnék tudni: mi fog pontosan történni? Elmeséljük – az ajtótól az utolsó lépésig.</p>
<h2>1. Leülünk beszélgetni</h2>
<p>Minden egy rövid beszélgetéssel kezdődik: megkérdezzük, mi miatt érkeztél, milyen gyakran és mennyire zavarnak a panaszaid, és rákérdezünk a fontos előzményekre. Utána elmondjuk, hová kerül az ékszer, mire számíthatsz – és megválaszoljuk az összes kérdésedet. Semmi nem történik úgy, hogy ne tudnád előre.</p>
<h2>2. Kiválasztod az ékszeredet</h2>
<div class="kep">{kep(K["ekszerek"], L["ekszerek"], "Ékszereink")}<div class="felirat">Néhány a kedvenceink közül – a teljes választékot a helyszínen mutatjuk meg.</div></div>
<p>Megmutatjuk az összes ékszert, és te választod ki, melyik tetszik a legjobban: karika vagy talpas, sima vagy köves, nőknek és férfiaknak is. Mindegyik G23 titánium – a legmagasabb minőségű, antiallergén orvosi fém, ezért fémallergia mellett is jó választás (ha van, jelezd a beszélgetésnél). Kicsi és könnyű: a legtöbben pár nap után már észre sem veszik, és a gyógyulás után akár az oldalán is kényelmesen lehet aludni vele. Az ékszer ára benne van a szúrás árában, és a gyógyulás után bármikor lecserélheted egy másikra.</p>
<h2>3. Steril eszközök, orvosi alapossággal</h2>
<div class="kep">{kep(K["steril"], L["folyamat"], "Steril, csomagolt eszközök és autokláv")}<div class="felirat">Steril, csomagolt eszközök – és az autokláv, amelyben sterilizálunk.</div></div>
<p>Nem a bemutatott ékszert kapod, hanem annak autoklávban sterilizált, légmentesen lezárt párját. Eszközeinket zártkamrás autoklávval fertőtlenítjük, a füled felületét pedig fertőtlenítő spray-vel készítjük elő. A rendelőnket és a teljes folyamatunkat dr. Smolcz Gergely is átnézte: személyesen járt nálunk, és végignézte, hogyan dolgozunk.</p>
<h2>4. Megmérjük a pontot</h2>
<p>Akupunktúrás pontmérő géppel keressük meg a pontot a te füleden – így pontosan oda kerül a piercing, ahová kell.</p>
<h2>5. Érzéstelenítjük a füled</h2>
<p>A bemérés után érzéstelenítő spray-vel fújjuk be a fül felületét.</p>
<h2>6. Pár másodperc, és kész</h2>
<p>Maga a szúrás pár másodperc – vendégeink többsége egy szúnyogcsípéshez hasonlítja. Vendégeink nagy része utána már csak mosolyog, hogy ettől tartott. Nézd meg videón, hogy előre lásd:</p>
{kep(K["video"], L["video"], "Videó: így néz ki egy szúrás")}
{velemeny("A piercing helyét pontosan kimérte, behelyezés közben is folyamatosan jelezte, hogy éppen melyik folyamatnál tart, így semmi nem ért váratlanul. Az ékszerválaszték is nagy, szebbnél szebbek.", "Nikoletta B.")}
{velemeny("Csekély kellemetlenséggel járt, gyorsan bent volt mindkettő. Mire feleszméltem, 2 piercing boldog tulajdonosa lettem.", "Éva K.-Sz.")}
{velemeny("A csajok kedvessége minden félelmet elfeledtetett, az ékszerek pedig csoda szépek!", "Andrea V.")}
{mini_idopont(BP)}{alairas(BP, True)}''', K['szalon'], L['folyamat'])

# ---- 05  E3: nem engedjuk el a kezed (utoapolas, ingyenes kontroll, garancia) -------------------------------
level('05-E3-nem-engedjuk-el-a-kezed', 'Ha legalább 14 nap van az időpontig: egyszer, az E2 után', 'Minden foglaló',
 'A szúrás után sem engedjük el a kezed', 'Utóápolás, ingyenes kontroll – csak nálunk –, és garancia.', f'''<h1>A szúrás után sem engedjük el a kezed</h1>
<p>{m(BP["nev"])}, abban, amit csinálunk, mi magunk is hiszünk: csapatunk tagjai a saját bőrükön tapasztalták, hogy jobban vannak tőle. Ezért nekünk nem a szúrással ér véget a közös munka – akkor kezdődik igazán.</p>
<h2>Végigkísérünk a gyógyulásban</h2>
<p>A szúrás után elmondjuk, hogyan ápold a piercinged, és e-mailben is elküldjük a pontról pontra leírt útmutatót. A következő hetekben pedig rövid levelekben jelentkezünk: mikor mire figyelj, mi normális, és mikor érdemes szólnod. Nem maradsz egyedül a kérdéseiddel.</p>
<h2>Ingyenes kontroll – az egész piacon csak nálunk</h2>
<p>Ha bármi történik – lassabban gyógyul, érzékeny marad, begyullad, kiesik az ékszer, vagy egyszerűen csak bizonytalan vagy –, bejelentkezhetsz ingyenes kontrollra. Megnézzük, segítünk, és ha kell, ideiglenes szilikon ékszert vagy ékszercserét is megoldunk. A szúrás után is korlátlanul számíthatsz ránk.</p>
<p><a class="btn2" href="{L["kontroll"]}">Így működik a kontroll</a></p>
<h2>És ha nem azt tapasztalod, amit vártál?</h2>
<p>Vendégeink 93%-a jelezte vissza, hogy nála működik*, de mindenki más. Ha 6 hét után nálad nem hozza, amit vártál, munkadíj nélkül, csak az új ékszer áráért (5 000 Ft) helyezünk be egy megerősítő piercinget – a szúrás után 6 hét és 6 hónap között.</p>
<p><a class="btn2" href="{L["garancia"]}">A garancia részletei</a></p>
{velemeny("A klimax rögtön segített a hőhullámaimon. Sajnos ez később kilökődött, ezért visszamentem garanciaidőn belül, megnézték és újraszúrták.", "Liza P.")}
{velemeny("Kaptam utókezeléshez is tájékoztatást, és ha segítségre lenne szükségem, akkor keressem őket bizalommal!", "Andrea K.")}
{velemeny("Előtte és közben is végig mondták, éppen mit és miért csinálnak. És utána is teljes értékű tájékoztatást kaptam mindenről: utókezelés, ápolás, hatások.", "Gábor D.")}
<p>Több mint {m(GOOGLE_DB)} vendégünk írt rólunk Google-véleményt, az átlagunk 4,8 csillag. <a href="{L["velemenyek"]}">Olvass bele a véleményekbe</a>.</p>
{mini_idopont(BP)}{alairas(BP, True)}''')

# ---- 06-07  T-48 felkeszules (a Salonic emlekezteto helyett) ------------------------------------------------
def t48(d, bp):
    return f'''<h1>Két nap múlva találkozunk, {m(d["nev"])}!</h1>
<p>Már nagyon várunk. Hogy minden simán menjen, összeszedtük, amit érdemes tudnod.</p>
{foglalas_kartya(d)}<p><a class="btn" href="{L['modositas']}?ott-leszek=1">Ott leszek ✓</a><a class="btn2" href="{L['modositas']}">Időpont módosítása</a></p><p style="font-size:14px"><a href="{d['terkep']}">Útvonaltervezés a térképen »</a></p>
<h2>Így készülj</h2><table role="presentation" class="steps">
<tr><td><span class="num">1</span></td><td><b>Egyél előtte rendesen</b> – üres gyomorral könnyebben megszédül az ember.</td></tr>
<tr><td><span class="num">2</span></td><td><b>Ha hosszú a hajad, fogd össze</b>, hogy ne lógjon a füledre.</td></tr>
<tr><td><span class="num">3</span></td><td><b>Szólj előre</b>, ha vérhígítót szedsz, várandós vagy, volt már ájulásod, vagy a füled most gyulladt – így felelősen tudunk dönteni. Hívj nyugodtan: +36 1 901 7444.</td></tr>
<tr><td><span class="num">4</span></td><td><b>Tervezz {m(d["ido_tart"])}et</b>, és érkezz 5 perccel korábban. Ha késnél, hívj minket.</td></tr></table>
<p><b>Hogyan találsz meg minket?</b> {m(d["erkezes"])}</p>
<h2>Mi fog történni?</h2>
<p>Leülünk beszélgetni: megkérdezzük, mi miatt érkeztél, és elmondjuk, hová kerül az ékszer. Kiválasztod a neked tetsző G23 titán ékszert, akupunktúrás pontmérővel kimérjük a pontot a füleden, érzéstelenítjük – és a szúrás maga pár másodperc – a legtöbben egy szúnyogcsípéshez hasonlítják. Vendégeink nagy része utána csak mosolyog, hogy ettől tartott.</p>
<div class="kep">{kep(K["ekszerek"], L["ekszerek"], "Ékszereink")}<div class="felirat">Antiallergén G23 titán ékszerek – a helyszínen te választasz.</div></div>
{kep(K["video"], L["video"], "Videó: így néz ki egy szúrás")}
<h2>Utána sem maradsz egyedül</h2>
<p>A szúrás után elmondjuk és e-mailben is elküldjük az utóápolás lépéseit, és a gyógyulás alatt is jelentkezünk. Ha bármi kérdésed van, ingyenes kontrollra bármikor bejelentkezhetsz – ez az egész piacon csak nálunk van így.</p>
{velemeny("Kedves fogadtatás, igényes, tiszta környezet, mindent elmondott a hölgy lépésről lépésre, ami megnyugtatott.", "Enikő Cs.")}
<p style="font-size:15px"><b>Kérdésed van még?</b> Válaszolj erre a levélre, és még az időpontod előtt válaszolunk.</p>
{alairas(d, bp)}'''
level('06-T48-felkeszules-BP', '48 órával előtte, ha a foglalás legalább 3 nappal az időpont előtt történt (a Salonic „Időpont emlékeztető” helyett)', 'Budapesti foglaló',
      'Két nap múlva találkozunk – így készülj', 'Négy apróság, és minden simán megy. Plusz: mi fog pontosan történni.', t48(BP, True))
level('07-T48-felkeszules-VIDEK', '48 órával előtte, ha a foglalás legalább 3 nappal előtte történt (a Salonic emlékeztető helyett)', 'Vidéki foglaló',
      'Két nap múlva Miskolcon találkozunk – így készülj', 'Négy apróság, és minden simán megy. Plusz: mi fog pontosan történni.', t48(VIDEK, False))

# ---- 08-09  modositas, lemondas (a Salonic levelei helyett) --------------------------------------------------
level('08-modositas', 'Azonnal, időpont-módosításkor (a Salonic „Foglalás módosítva” levele helyett)', 'Mindenki',
 'Megvan az új időpontod: okt. 23., 14:30', 'A korábbi helyett már ezt tartjuk neked.', f'''<h1>Megvan az új időpontod!</h1>
<p>Rendben, módosítottuk az időpontodat. A korábbi helyett már ezt tartjuk neked:</p>{foglalas_kartya(BP)}{gombok(BP)}
{VIDEO()}{alairas(BP, True)}''')
level('09-lemondas', 'Azonnal, lemondáskor vagy törléskor (a Salonic „Lemondás” és „Időpont törlés” levele helyett)', 'Mindenki',
 'Töröltük az időpontodat – itt választhatsz újat', 'Ha csak az időpont nem volt jó, innen egyből választhatsz másikat.', f'''<h1>Töröltük az időpontodat</h1>
<p>Az alábbi időpontodat töröltük: <b>{m(BP["datum"])}, {m(BP["ido"])}</b> – {m(BP["szolg"])}.</p>
<p>A legtöbben csak időpontot cserélnek. Ha nálad is csak az időpont nem volt jó, nem kell elölről kezdened – itt egy perc alatt választhatsz újat:</p>
<p><a class="btn" href="{L["foglalas"]}">Új időpontot választok</a></p>
<p>Ha vidéki helyszínre foglalnál újra, a következő helyi napokat a <a href="{L["varosok"]}">helyszíneink oldalán</a> látod. Ha kérdésed van, hívj nyugodtan: +36 1 901 7444.</p>
<p>Ha később jönnél, akkor is szeretettel várunk.<br><b>A Medical Piercing csapata</b></p>''')

SMS = [
 ('T0', 'Azonnal', 'Szia {keresztnev}! Megvan az idopontod: {datum} {ido}, {helyszin_rovid}. Reszletek, modositas: {link} - Medical Piercing'),
 ('T-72', '72 órával előtte (ha legalább 96 órája foglalt)', 'Szia {keresztnev}! {nap} {ido}-kor varunk. Megerosited, vagy attennad? Egy kattintas: {link} - MP'),
 ('T-72 vidék', '72 órával előtte, vidéken', 'Szia {keresztnev}! {nap} {ido}-kor varunk {varosban}. Ha nem jo, itt atteheted: {link}. Legkozelebb itt: {kov_nap}. - MP'),
 ('T-24', '24 órával előtte', 'Szia {keresztnev}! Holnap {ido}-kor varunk: {cim_rovid}. Egyel elotte, erkezz 5 perccel korabban. - MP'),
 ('Lemondás', 'Azonnal', 'Szia {keresztnev}! Toroltuk a {datum} {ido}-s idopontodat. Ha csak az idopont nem jo, itt valaszthatsz ujat: {link} - MP'),
 ('Módosítás', 'Azonnal', 'Szia {keresztnev}! Megvan az uj idopontod: {datum} {ido}, {helyszin_rovid}. Reszletek: {link} - MP'),
 ('No-show', 'Következő munkanap 10:00', 'Szia {keresztnev}! Tegnap nem talalkoztunk, remeljuk, minden rendben. Ha attennad az idopontot: {link} - MP'),
]
(OUT / 'sms.json').write_text(json.dumps(SMS, ensure_ascii=False), encoding='utf-8')

sorok = ''.join(f'<tr><td><a href="{x["fajl"]}">{html.escape(x["targy"])}</a><br><small>{html.escape(x["kinek"])}</small></td><td>{html.escape(x["mikor"])}</td></tr>' for x in LEVELEK)
smssor = ''.join(f'<tr><td><b>{a}</b><br><small>{html.escape(b)}</small></td><td>{html.escape(c)}<br><small>{len(c)} karakter (a mezők nélkül)</small></td></tr>' for a, b, c in SMS)
(OUT / 'index.html').write_text(f'''<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MP foglalási levelek – v2</title>
<meta name="robots" content="noindex"><style>body{{font-family:Helvetica,Arial,sans-serif;background:#f6ebe4;color:#2f3044;margin:0;padding:24px}}main{{max-width:960px;margin:0 auto;background:#fff;padding:24px;border-radius:12px}}
table{{border-collapse:collapse;width:100%}}td{{border-bottom:1px solid #eee;padding:9px 8px;vertical-align:top;font-size:15px}}a{{color:#b0463b}}small{{color:#6b6c80}}h2{{margin-top:28px}}</style></head><body><main>
<h1>Medical Piercing – foglalástól a megjelenésig (v2)</h1>
<p>A sárgával jelölt részek dinamikus mezők (példaértékekkel). Budapesten az aláírásban a foglalt piercer fotója, vidéken fotó nélkül.
Időzítés a foglalás és az időpont közti idő szerint: 3 napnál kevesebb – csak a visszaigazolás és az SMS-ek; legalább 3 nap – + felkészítő levél 2 nappal előtte; legalább 5 nap – + a piercinghez illő levél; legalább 7 nap – + „Így telik majd”; legalább 14 nap – + „Nem engedjük el a kezed”.</p>
<h2>E-mailek</h2><table>{sorok}</table><h2>SMS-ek</h2><table>{smssor}</table></main></body></html>''', encoding='utf-8')

# kinyert szoveg (lektoralashoz)
ki = []
for x in LEVELEK:
    s = (OUT / x['fajl']).read_text(encoding='utf-8'); s = re.sub(r'<style>.*?</style>', '', s, flags=re.S)
    t = html.unescape(re.sub(r'<[^>]+>', ' ', s)); t = re.sub(r'[ \t]+', ' ', t); t = re.sub(r'\n\s*\n+', '\n', t)
    ki.append(f'=== {x["fajl"]} | TÁRGY: {x["targy"]}\n{t.strip()}')
(OUT / 'szoveg.txt').write_text('\n\n'.join(ki), encoding='utf-8')
print(len(LEVELEK), 'level kesz')
