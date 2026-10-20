# Medical Piercing – foglalastol a megjelenesig: e-mail mintak (v2, 2026-10-16, a tulajdonos visszajelzese alapjan).
# Kimenet: assets/levelek/*.html + index.html + sms.json + szoveg.txt.  Futtatas: python3 general.py [kep_alap_url] [--minta]
# A {mezo} jelolesek a lifecycle-motor dinamikus mezoi; a mintakban pelda ertekek, sarga jelolessel.
# --motor: a mintaertekek helyett a lifecycle-motor helyorzoi ({keresztnév}, {dátum}, ...), a kimenet a motor katalogusa:
#   netlify/lib/lifecycle/katalog/mp.js (a repo gyokereben; a foglalas elotti levelek + SMS-ek). A valodi velemeny-idezetek NEM kerulnek bele:
#   helyettuk {vélemény:vNN} helyorzo all, amit a motor kuldeskor a D1 mp_velemenyek tablajabol tolt ki (render.js htmlKitolt).
#   A helyszinhez kotott sorok (cim, erkezes, utvonal, ar, munkatars) <!--?-->...<!--/?--> feltetelt blokkban: ismeretlen ertekkel kimaradnak.
import html, pathlib, json, re, sys
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets' / 'levelek'
OUT.mkdir(parents=True, exist_ok=True)
SITE = 'https://www.medicalpiercing.hu'
MOTOR = '--motor' in sys.argv
_ARGOK = [a for a in sys.argv[1:] if not a.startswith('--')]
KEPALAP = (_ARGOK[0] if _ARGOK and not MOTOR else SITE).rstrip('/') + '/assets/levelek/kep/'
IMG = SITE + '/assets/img/f18724_'
K = {
  'logo': KEPALAP + 'logo.png',
  'szalon': IMG + '9523f7cd094b451aa8534ca6d7cfaa3e.jpg',
  'gabi_portre': IMG + '3ae9dfe53a07477fae1a816f79be5098.jpg',   # minta: a foglalt munkatars fotoja (Salonic employeeProfilePicture)
  'video': KEPALAP + 'szuras-video.jpg', 'ekszerek': KEPALAP + 'ekszerek.jpg', 'steril': KEPALAP + 'steril.jpg',
}
L = {
  'video': SITE + '/a-szuras-folyamata#lepes-6', 'folyamat': SITE + '/a-szuras-folyamata',
  'garancia': SITE + '/migren-es-shenmen-piercing-garancia', 'velemenyek': SITE + '/migren-shenmen-piercing-velemenyek',
  'utoapolas': SITE + '/a-migren-es-shenmen-piercing-utoapolasa', 'ekszerek': SITE + '/ekszereink',
  'kontroll': SITE + '/kontroll', 'foglalas': SITE + '/idopontfoglalas', 'varosok': SITE + '/elerhetosegek',
  'modositas': SITE + '/f/{token}',  # sajat "A foglalasod" oldal, mint a Mosaicnal (/f/<token>) – Salonicra soha nem visz
  'migren': SITE + '/migren-piercing', 'shenmen': SITE + '/shenmen-piercing', 'klimax': SITE + '/klimax-piercing',
  'slim': SITE + '/slim-etvagycsokkento-piercing', 'allergia': SITE + '/allergia-piercing',
}
L['ott_leszek'] = L['modositas'] + '?ott-leszek=1'
GOOGLE_DB = '5 033'  # dinamikus: /api/ertekeles (db) – minden kuldeskor a friss szam
if MOTOR:
    L['modositas'] = '{foglalás_részletei_link}'   # medicalpiercing.hu/f/<token> (medicalpiercing/lib/foglalasom.js)
    L['ott_leszek'] = '{megerősítés_link}'         # medicalpiercing.hu/m/<token>: egy kattintas, "Ott leszek"
    L['foglalas'] = '{foglalás_link}'
    GOOGLE_DB = '{google_vélemények}'
BP = dict(nev='Feri', datum='2026. október 23., csütörtök', ido='14:30', szolg='3 db piercing (csomag)', ar='44 900 Ft',
          munkatars='Kovács Gabriella', varos='Budapest', varosban='Budapesten', cim='1137 Budapest, Újpesti rakpart 7., 5. emelet 25. (a Jászai Mari térnél)',
          ido_tart='kb. 15–25 perc', terkep='https://maps.google.com/?q=1137+Budapest+Újpesti+rakpart+7',
          erkezes='A Jászai Mari térnél vagyunk, a környező utcákban könnyen meg tudsz állni autóval; villamossal a Jászai Mari tér megálló van a legközelebb.')
VIDEK = dict(BP, datum='2026. november 3., kedd', ido='10:40', szolg='1 db migrén piercing', ar='24 900 Ft', munkatars='Fekete Henrietta',
             varos='Miskolc', varosban='Miskolcon', cim='3525 Miskolc, Széchenyi István utca 19., 4. emelet 2. ajtó (Széchenyi Egészség Központ)',
             ido_tart='kb. 10–20 perc', terkep='https://maps.google.com/?q=3525+Miskolc+Széchenyi+István+utca+19',
             erkezes='A Széchenyi Egészség Központban, a 4. emeleten, a 2-es ajtónál várunk.')
if MOTOR:  # a motor helyorzoi (katalog/ertekek.js HELYORZOK); a videki varost phase 1-ben nem ismerjuk: varos nelkuli (altalanos) mondatok
    BP = dict(nev='{keresztnév}', datum='{dátum}', ido='{időpont}', szolg='{szolgáltatás}', ar='{aktuális_ár}', munkatars='{munkatárs}', varos=None, varosban=None,
              cim='{helyszín}', ido_tart='{látogatás_hossza}', terkep='{útvonal_link}', erkezes='{érkezés}')
    VIDEK = dict(BP)

def opt(a, b=''):
    """Feltetelt blokk: a motor A-t kuldi, ha minden helyorzoje ismert, kulonben B-t. A mintaban mindig A."""
    if not MOTOR: return a
    return f'<!--?-->{a}<!--|-->{b}<!--/?-->' if b else f'<!--?-->{a}<!--/?-->'
MINTA = '--minta' in sys.argv  # a mintaoldalon sargaval jeloljuk a dinamikus mezoket; a kikuldott levelben nincs jeloles
def m(v):  # dinamikus mezo
    return f'<span class="dyn">{html.escape(v)}</span>'

KW = 536  # a hasab szelessege (600 - 2x32 px): minden kep ilyen szeles, mint a szoveg
def kep(src, href, alt=''):  # minden kep linkelve: a Gmail igy nem tesz ra letoltes-gombot
    return f'<a href="{href}" style="display:block;text-decoration:none"><img src="{src}" alt="{html.escape(alt)}" width="{KW}" style="width:100%;max-width:{KW}px;height:auto;display:block;border:0;border-radius:12px"></a>'

FONT = "'Plus Jakarta Sans',Helvetica,Arial,sans-serif"
CSS = f'''body{{margin:0;padding:0;background:#f6ebe4;font-family:{FONT};color:#2f3044;-webkit-font-smoothing:antialiased}}
.wrap{{max-width:600px;margin:0 auto;background:#fff}}
.hd{{padding:28px 32px 18px;text-align:center}}.hd img{{width:270px;max-width:70%;height:auto;border:0}}
.in{{padding:4px 32px 8px;font-size:16px;line-height:1.65;color:#454659}}
h1{{font-family:{FONT};font-size:26px;line-height:1.25;font-weight:800;margin:22px 0 10px;color:#2f3044;letter-spacing:-0.3px}}
h2{{font-family:{FONT};font-size:18px;line-height:1.35;font-weight:700;margin:30px 0 8px;color:#2f3044}}
p{{margin:10px 0}} a{{color:#b0463b}} b{{color:#2f3044}}
.cimke{{font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#b0463b;margin:0 0 6px}}
.card{{border:1px solid #ecdcd4;border-radius:14px;padding:18px 20px;margin:18px 0;background:#fffaf7}}
.card td{{padding:0 0 10px;font-size:15px;line-height:1.45;vertical-align:top;border-bottom:1px solid #f1e6e0;word-wrap:break-word;overflow-wrap:anywhere}}.card tr:last-child td{{border-bottom:0;padding-bottom:0}}
.card td.l{{color:#8a8b9c;font-size:12px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:10px 0 2px;border-bottom:0}}
.btn{{display:inline-block;background:#b0463b;color:#ffffff!important;text-decoration:none;font-weight:700;font-size:15px;padding:14px 26px;border-radius:999px;margin:6px 8px 6px 0}}
.btn2{{display:inline-block;color:#b0463b!important;text-decoration:none;font-weight:700;font-size:15px;padding:12px 22px;border:2px solid #e3c4bf;border-radius:999px;margin:6px 0}}
.steps td{{padding:9px 0;vertical-align:top;font-size:15px;line-height:1.55}}
.num{{display:inline-block;width:28px;height:28px;border-radius:14px;background:#f6ebe4;color:#b0463b;text-align:center;line-height:28px;font-weight:800;font-size:14px;margin-right:12px}}
.velem{{background:#fbf6f3;border-radius:14px;padding:16px 18px 14px;margin:14px 0;font-size:15px;line-height:1.55;color:#454659}}
.velem .cs{{color:#f5b400;font-size:14px;letter-spacing:2px}}.velem .nev{{display:block;margin-top:8px;font-size:13px;font-weight:700;color:#2f3044}}.velem .nev span{{font-weight:400;color:#8a8b9c}}
.kep{{margin:18px 0}}.felirat{{font-size:13px;color:#8a8b9c;margin-top:6px;text-align:center}}
.sig{{margin:28px 0 8px;padding-top:20px;border-top:1px solid #f1e6e0;font-size:15px}}.sig img{{width:56px;height:56px;border-radius:28px;display:block;border:0}}
.trustw{{padding:8px 32px 30px}}
.trust{{background:#2f3044;border-radius:16px;padding:22px 24px;color:#e9e9f0;font-size:14px;line-height:1.5}}
.trust .cim{{font-size:17px;font-weight:800;color:#ffffff;margin-bottom:10px}}
.trust td{{padding:5px 0;vertical-align:top;color:#e9e9f0;font-size:14px}}.trust .pipa{{color:#d7aba8;font-weight:800;width:24px}}
.ft{{padding:22px 32px 30px;font-size:12px;color:#8a8b9c;line-height:1.55;background:#f6ebe4}}
.ft a{{color:#8a8b9c}}
.dyn{{background:{'#fff3b0' if MINTA else 'transparent'}}}.trust .dyn{{color:inherit}}
'''

def _pipa(sor): return f'<tr><td class="pipa">✓</td><td>{sor}</td></tr>'
BIZALOM = '<div class="trustw"><div class="trust"><div class="cim">Nyugodt kezekben leszel nálunk</div><table role="presentation" width="100%">' + ''.join(_pipa(x) for x in [
  'Megkérdezett vendégeink 93%-a jelezte vissza, hogy nála működik*',
  'Fülakupunktúrás végzettség, akupunktúrás pontmérő gép – a pontot a te füleden mérjük ki',
  'Egészségügyből jöttünk, több tízezer szúrás van mögöttünk',
  'Orvosilag steril körülmények, G23 orvosi titán ékszer',
  'Csak nálunk: ingyenes kontroll – és garancia',
  f'4,8 ★ · {m(GOOGLE_DB)} Google-vélemény · Láthattál minket az RTL Klub Fókusz és a HírTV műsorában']) + '</table></div></div>'

def lap(cim, preheader, torzs, hero=None, hero_link=None):
    hero_html = f'<div class="kep" style="margin-top:6px">{kep(hero, hero_link or SITE)}</div>' if hero else ''
    return f'''<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet">
<title>{html.escape(cim)}</title><style>{CSS}</style></head><body>
<div style="display:none;max-height:0;overflow:hidden">{html.escape(preheader)}</div>
<div class="wrap"><div class="hd"><a href="{SITE}"><img src="{K['logo']}" width="270" alt="Medical Piercing"></a></div>
<div class="in">{hero_html}{torzs}</div>{BIZALOM}
<div class="ft">Medical Piercing · Tel.: +36 1 901 7444 · medicalpiercing.hu@gmail.com · <a href="{SITE}">medicalpiercing.hu</a><br>
Erre a levélre nyugodtan válaszolhatsz, kollégáink elolvassák.<br><br>
* 2 238 megkérdezett vendégünk visszajelzése alapján (migrén, shenmen és klimax piercing). Saját vendég-visszajelzés, nem reprezentatív kutatás és nem klinikai eredmény; a tapasztalat egyénenként eltér.<br>
Piercingeink közérzetjavító ékszerek; nem minősülnek gyógymódnak vagy orvosi kezelésnek, és nem helyettesítik az orvosi vizsgálatot.</div>
</div></body></html>'''

def _kartya_sor(cimke, ertek):  # cimke es ertek EGYMAS ALATT: nincs fix oszlopszelesseg, nagy betumeretnel / keskeny kepernyon sem csuszik egymasba
    return f'<tr><td class="l">{cimke}</td></tr><tr><td>{ertek}</td></tr>'

def foglalas_kartya(d):
    return f'''<div class="card"><div class="cimke">A foglalásod</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;table-layout:fixed">
{_kartya_sor("Időpont", f'<b>{m(d["datum"])}, {m(d["ido"])}</b>')}
{_kartya_sor("Szolgáltatás", m(d["szolg"]))}
{opt(_kartya_sor("Szakember", m(d["munkatars"])))}
{opt(_kartya_sor("Helyszín", m(d["cim"])))}
{opt(_kartya_sor("Időtartam", m(d["ido_tart"])))}
{opt(_kartya_sor("Ár", f'{m(d["ar"])} – a helyszínen fizetendő'))}</table></div>'''

def gombok(d):
    return f'<p>{opt(f"<a class=\"btn\" href=\"{d["terkep"]}\">Útvonal</a>")}<a class="btn2" href="{L["modositas"]}">Időpont módosítása</a></p>'

def mini_idopont(d):
    varos = f', {m(d["varos"])}' if d.get('varos') else ''
    return f'<p style="font-size:15px">Az időpontod: <b>{m(d["datum"])}, {m(d["ido"])}</b>{varos}. Ha módosítanod kell, <a href="{L["modositas"]}">itt egy kattintással megteheted</a>.</p>'

def alairas(d, foto, szoveg='Szeretettel vár:'):
    if MOTOR:  # a foglalt piercer fotoja (ha van), a neve (ha ismert); kulonben "a Medical Piercing csapata"
        kep_td = opt('<td style="width:70px;vertical-align:middle"><img src="{munkatárs_fotó}" width="56" alt=""></td>')
        nev = opt(f'{szoveg} <b>{m(d["munkatars"])}</b><br><span style="font-size:14px;color:#8a8b9c">és a Medical Piercing csapata</span>', f'{szoveg} <b>a Medical Piercing csapata</b>')
        return f'<div class="sig"><table role="presentation" cellspacing="0" cellpadding="0"><tr>{kep_td}<td style="vertical-align:middle">{nev}</td></tr></table></div>'
    kepe = f'<img src="{K["gabi_portre"]}" width="56" alt="">' if foto else ''
    return (f'<div class="sig"><table role="presentation" cellspacing="0" cellpadding="0"><tr>'
            + (f'<td style="width:70px;vertical-align:middle">{kepe}</td>' if foto else '')
            + f'<td style="vertical-align:middle">{szoveg} <b>{m(d["munkatars"])}</b><br><span style="font-size:14px;color:#8a8b9c">és a Medical Piercing csapata</span></td></tr></table></div>')

_VELPATH = pathlib.Path(__file__).with_name('velemenyek.json')  # a valodi idezetek: nem a nyilvanos repoban (gitignore)
_VELEK = json.loads(_VELPATH.read_text(encoding='utf-8')) if _VELPATH.exists() else {}
def VEL(k):
    if MOTOR: return ('\x00' + k, '')  # a motorban helyorzo: {vélemény:k} (a szoveg a D1-ben, nem a repoban)
    return tuple(_VELEK.get(k, ['Itt egy valódi Google-vélemény jelenik meg.', 'Vendégünk']))

def velemeny(szoveg, nev):
    if szoveg.startswith('\x00'): return '{vélemény:' + szoveg[1:] + '}'
    return f'<div class="velem"><span class="cs">★★★★★</span><br>„{szoveg}”<span class="nev">{nev} <span>· Google-vélemény</span></span></div>'

VIDEO = lambda: f'''<h2>Nézd meg előre, hogyan zajlik</h2><div class="kep">{kep(K["video"], L["video"], "Videó: így néz ki egy szúrás")}
<div class="felirat">Egy teljes szúrás videón, az elejétől a végéig – kattints a képre.</div></div>'''

LEVELEK = []
MOTOR_LEVELEK = []
# a motor-katalogus (--motor): level-kod -> (azonosito, mikor, szegmensek, motor-targy vagy None). A szuras utani levelek (10-11) a 2. fazisban.
_E1 = dict(tipus='tartalom', utan_napok=1, min_lead_nap=5)
MOTOR_META = {
  '01-T0-visszaigazolas-BP': ('MP-EMAIL-01', dict(tipus='t0'), ['bp'], 'Visszaigazoltuk az időpontodat: {dátum}, {időpont}'),
  '02-T0-visszaigazolas-VIDEK': ('MP-EMAIL-02', dict(tipus='t0'), ['videk'], 'Visszaigazoltuk az időpontodat: {dátum}, {időpont}'),
  '03-E1-migren': ('MP-EMAIL-03', _E1, ['migren'], None), '03-E1-shenmen': ('MP-EMAIL-04', _E1, ['shenmen'], None),
  '03-E1-klimax': ('MP-EMAIL-05', _E1, ['klimax'], None), '03-E1-slim': ('MP-EMAIL-06', _E1, ['slim'], None), '03-E1-allergia': ('MP-EMAIL-07', _E1, ['allergia'], None),
  '04-E2-igy-zajlik': ('MP-EMAIL-08', dict(tipus='tartalom', aranyban=0.5, min_lead_nap=7), None, None),
  '05-E3-nem-engedjuk-el-a-kezed': ('MP-EMAIL-09', dict(tipus='tartalom', aranyban=0.75, min_lead_nap=14), None, None),
  '06-T48-felkeszules-BP': ('MP-EMAIL-10', dict(tipus='elott_ora', ora=48, min_lead_ora=72), ['bp'], None),
  '07-T48-felkeszules-VIDEK': ('MP-EMAIL-11', dict(tipus='elott_ora', ora=48, min_lead_ora=72), ['videk'], 'Két nap múlva találkozunk – így készülj'),
  '08-modositas': ('MP-EMAIL-12', dict(tipus='athelyezve'), None, 'Megvan az új időpontod: {dátum}, {időpont}'),
  '09-lemondas': ('MP-EMAIL-13', dict(tipus='lemondva'), None, None),
}
_SORREND = {'MP-EMAIL-08': 2, 'MP-EMAIL-09': 3}
def level(kod, mikor, kinek, targy, preheader, torzs, hero=None, hero_link=None):
    LEVELEK.append(dict(kod=kod, mikor=mikor, kinek=kinek, targy=targy, fajl=f'{kod}.html'))
    if MOTOR:
        if kod not in MOTOR_META: return
        azon, mk, szeg, mtargy = MOTOR_META[kod]
        u = dict(id=azon, csatorna='email', mikor=mk)
        if szeg: u['szegmensek'] = szeg
        if mk['tipus'] == 'tartalom': u['sorrend'] = _SORREND.get(azon, 1)
        u.update(targy=mtargy or targy, elotag=preheader, html=lap(mtargy or targy, preheader, torzs, hero, hero_link))
        MOTOR_LEVELEK.append(u)
        return
    (OUT / f'{kod}.html').write_text(lap(targy, preheader, torzs, hero, hero_link), encoding='utf-8')

# ---- 01-02  T0 visszaigazolas ------------------------------------------------------------------------------
T0_VEL_BP=VEL("v13")
T0_VEL_VIDEK=VEL("v14")
def t0(d, bp):
    hol = f'{m(d["varosban"])} csak' if d.get('varosban') else 'Vidéki helyszíneinken csak'
    videk = '' if bp else f'<p>{hol} meghatározott napokon vagyunk, ezért ha mégsem tudsz jönni, kérjük, minél előbb módosítsd az időpontodat – így a helyedet másnak is fel tudjuk ajánlani.</p>'
    return f'''<h1>{opt(f'Megvan az időpontod, {m(d["nev"])}!', 'Megvan az időpontod!')}</h1>
<p>Köszönjük, hogy minket választottál. Innentől nincs más dolgod, csak megérkezni – minden fontos részletet ide gyűjtöttünk.</p>
{foglalas_kartya(d)}{gombok(d)}{videk}
{opt(f'<p><b>Hogyan találsz meg minket?</b> {m(d["erkezes"])}</p>')}
<h2>Így zajlik majd</h2><table role="presentation" class="steps">
<tr><td><span class="num">1</span></td><td><b>Rövid beszélgetés</b> – átbeszéljük, mi miatt érkeztél, és megnézzük a füled.</td></tr>
<tr><td><span class="num">2</span></td><td><b>Ékszerválasztás</b> – kiválasztod a neked tetsző G23 titán ékszert.</td></tr>
<tr><td><span class="num">3</span></td><td><b>Pontmérés és érzéstelenítés</b> – géppel kimérjük a pontot a füleden, majd érzéstelenítjük.</td></tr>
<tr><td><span class="num">4</span></td><td><b>Szúrás</b> – pár másodperc, steril eszközökkel. A legtöbben utána mosolyognak, hogy ettől féltek.</td></tr></table>
{VIDEO()}
{velemeny(*(T0_VEL_BP if bp else T0_VEL_VIDEK))}
<p><b>Nem kell semmit hoznod.</b> Előtte egyél rendesen, és érkezz kb. 5 perccel korábban.</p>
<p><b>Garancia:</b> ha 6 hét után nem azt tapasztalod, amit vártál, munkadíj nélkül, csak az ékszer áráért helyezünk be egy megerősítő piercinget. A kontroll ingyenes. <a href="{L["garancia"]}">A garancia részletei</a></p>
{alairas(d, bp)}'''

level('01-T0-visszaigazolas-BP', 'Azonnal a foglalás után (a Salonic „Új időpont létrehozva” és „Sikeres foglalás” levele helyett)', 'Budapesti foglaló',
      'Visszaigazoltuk az időpontodat: okt. 23., 14:30', 'Minden fontos részlet egy helyen – innentől csak meg kell érkezned.', t0(BP, True), K['szalon'], SITE + '/elerhetosegek')
level('02-T0-visszaigazolas-VIDEK', 'Azonnal a foglalás után (a Salonic levelei helyett)', 'Vidéki foglaló',
      'Visszaigazoltuk az időpontodat Miskolcon: nov. 3., 10:40', 'Cím, időpont és minden, ami fontos – egy helyen.', t0(VIDEK, False))

# ---- 03  E1: miert mukodik (piercingenkent) ----------------------------------------------------------------
TIPUSOK = {
 'migren': dict(nev='migrén piercing', nevelo='a', h93=True,
   bek='A migrén piercing a fül porcába, a fülakupunktúra egyik régóta használt pontjába kerül. Sokan azért választják, mert a fejfájás és a migrénes rohamok újra és újra kiveszik őket a hétköznapokból – és szeretnének egy gyógyszermentes, közérzetjavító lehetőséget is kipróbálni.',
   tipp='Ha a fejfájásod inkább féloldali, mondd el a beszélgetésnél: ilyenkor általában arra az oldalra javasoljuk az ékszert, ahol erősebbek a tünetek.',
   vel=[VEL("v15"), VEL("v16")]),
 'shenmen': dict(nev='shenmen piercing', nevelo='a', h93=True,
   bek='A shenmen pont a fülakupunktúra egyik legismertebb pontja. Sokan stressz, belső feszültség, szorongás vagy nyugtalan alvás miatt választják – gyakran más piercingek mellé, kiegészítésként. Ha 2–3 piercinget foglaltál, a beszélgetésnél közösen döntjük el, melyik pontok illenek leginkább ahhoz, ami miatt érkezel.',
   tipp='Gondold át előre, mi zavar most a legjobban – az alvás, a feszültség, a fejfájás vagy valami más. Így a beszélgetés gyorsabb, és pontosabban tudunk javasolni.',
   vel=[VEL("v17"), VEL("v18")]),
 'klimax': dict(nev='klimax piercing', nevelo='a', h93=True,
   bek='A klimax piercinget sokan a változókor kellemetlenségei miatt választják – hőhullám, éjszakai izzadás, rossz alvás vagy hangulatingadozás miatt. Nálunk minden szúrás előtt beszélgetés van: meghallgatunk, és utána közösen választjuk ki a pontokat.',
   tipp='Írd fel magadnak, mely tünetek zavarnak most a legjobban, és mióta – a beszélgetésnél ez sokat segít.',
   vel=[VEL("v19"), VEL("v20")]),
 'slim': dict(nev='slim piercing', nevelo='a', h93=False,
   bek='A slim piercinget a fül egy olyan pontjába helyezzük, amelyet a fülakupunktúra az étvággyal összefüggésben használ. Sokan a nassolás, az édesség utáni sóvárgás vagy a stresszevés miatt választják – sokan már az első hetekben érzik a különbséget.',
   tipp='A legtöbbet akkor adhat, ha segítségként tekintesz rá: az első hetekben figyeld meg magadon, mikor és miért nassolsz.',
   vel=[VEL("v21"), VEL("v22")]),
 'allergia': dict(nev='allergia piercing', nevelo='az', h93=False,
   bek='Az allergia piercinget sokan a szezonális, tavaszi vagy őszi panaszok miatt választják. Ha most éppen erős tüneteid vannak, vagy gyógyszert szedsz, mondd el a beszélgetésnél – ehhez igazodunk.',
   tipp='Ha tudod, írd fel, melyik időszakban a legerősebbek a tüneteid – így könnyebb lesz követned, mit tapasztalsz a piercing után.',
   vel=[VEL("v23"), VEL("v24")]),
}
for kod, t in TIPUSOK.items():
    n, a = t['nev'], t['nevelo']
    h93 = (f'''<h2>Vendégeink visszajelzése alapján: működik</h2>
<p>{a.capitalize()} {n} vendégeink visszajelzése alapján hatásos módszer: megkérdezett vendégeink 93%-a jelezte vissza, hogy nála működik.* Ez nem a mi ígéretünk – ők mondják. Olvasd el, mit írnak:</p>'''
           if t['h93'] else f'''<h2>Vendégeink visszajelzése alapján: működik</h2>
<p>{a.capitalize()} {n} vendégeink visszajelzése alapján hatásos módszer. Ez nem a mi ígéretünk – ők mondják. Olvasd el, mit írnak:</p>''')
    torzs = f'''<h1>{opt(f'{m(BP["nev"])}, a pontosság a lényeg', 'A pontosság a lényeg')} – így készül {a} {n}ed</h1>
<p>{t["bek"]}</p>
<h2>Miért számít, hová kerül?</h2>
<p>A fülben sok akupunktúrás pont van, egymástól sokszor csak milliméterekre. {a.capitalize()} {n} akkor tud a legtöbbet adni, ha pontosan a megfelelő pontba kerül. Ezért nálunk ez soha nem szemmérték kérdése.</p>
{velemeny(*VEL("v01"))}
<h2>A pontmérő: a te füledhez igazítva</h2>
<p>Minden fül más. A szúrás előtt akupunktúrás pontmérő géppel vizsgáljuk meg a füledet: a készülék a bőr elektromos vezetőképességét méri, ami az akupunktúrás pontokon eltér a környező bőrétől. Így a pontot a te füleden keressük meg – nem egy ábráról másoljuk.</p>
<h2>Akik szúrnak: egészségügyből jöttünk</h2>
<p>Alapítónk, Kovács Gabriella 20 évig dolgozott az egészségügyben, egyetemi okleveles ápolóként, majd osztályvezető ápolóként. Kollégáink is az egészségügyből érkeztek, és mindannyian fülakupunktúrás végzettséggel dolgozunk. Több tízezer szúrás van a hátunk mögött.</p>
<p>Ezért mondjuk nyugodt szívvel: nálunk a szúrás helyéről nem szemmérték dönt, így nem kell attól tartanod, hogy rossz helyre kerül a piercing. Ismerjük a fül pontjait, anatómiai tudással dolgozunk, és minden pontot megmérünk.</p>
{h93}
{velemeny(*t["vel"][0])}{velemeny(*t["vel"][1])}
<p><a class="btn2" href="{L["velemenyek"]}">Mind az {m(GOOGLE_DB)} vélemény</a></p>
<h2>Egy jó tanács az időpontod előtt</h2><p>{t["tipp"]}</p>
<p><a class="btn" href="{L[kod]}">Bővebben {a} {n}ről</a></p>
{mini_idopont(BP)}<p style="font-size:15px"><b>Kérdésed van még?</b> Válaszolj erre a levélre, és még az időpontod előtt válaszolunk.</p>{alairas(BP, True)}'''
    level(f'03-E1-{kod}', 'Foglalás +1 nap, ha legalább 5 nap van az időpontig (2–3 db-os csomag = shenmen)', f'{n.capitalize()} foglalói (vidéken az aláírás fotó nélkül)',
          f'Pontosan oda kerül, ahová kell – {a} {n}edről', 'Pontmérő, egészségügyi háttér, több tízezer szúrás – és mit mondanak a vendégeink.',
          torzs, KEPALAP + f'ful-{kod}.jpg', L[kod])

# ---- 04  E2: igy telik majd a latogatasod (folyamat, biztonsag, ekszerek) -----------------------------------
level('04-E2-igy-zajlik', 'Ha legalább 7 nap van az időpontig: kb. a hátralévő idő felénél', 'Minden foglaló',
 'Így telik majd az a fél óra nálunk', 'Lépésről lépésre: mi történik, milyen ékszert kapsz, és miért vagy biztonságban.', f'''<h1>Így telik majd az a fél óra nálunk</h1>
<p>{opt(f'{m(BP["nev"])}, az első', 'Az első')} szúrás előtt a legtöbben ugyanazt szeretnék tudni: mi fog pontosan történni? Elmeséljük – az ajtótól az utolsó lépésig.</p>
<h2>1. Leülünk beszélgetni</h2>
<p>Minden egy rövid beszélgetéssel kezdődik: megkérdezzük, mi miatt érkeztél, milyen gyakran és mennyire zavarnak a panaszaid, és rákérdezünk a fontos előzményekre. Utána elmondjuk, hová kerül az ékszer, mire számíthatsz – és megválaszoljuk az összes kérdésedet. Semmi nem történik úgy, hogy ne tudnád előre.</p>
<h2>2. Kiválasztod az ékszeredet</h2>
<div class="kep">{kep(K["ekszerek"], L["ekszerek"], "Ékszereink")}<div class="felirat">Néhány a kedvenceink közül – a teljes választékot a helyszínen mutatjuk meg.</div></div>
<p>Megmutatjuk az összes ékszert, és te választod ki, melyik tetszik a legjobban: karika vagy talpas, sima vagy köves, nőknek és férfiaknak is. Mindegyik G23 titánium – a legmagasabb minőségű, antiallergén orvosi fém, ezért fémallergia mellett is jó választás (ha van, jelezd a beszélgetésnél). Kicsi és könnyű: a legtöbben pár nap után már észre sem veszik, és a gyógyulás után akár az oldalán is kényelmesen lehet aludni vele. Az ékszer ára benne van a szúrás árában, és a gyógyulás után bármikor lecserélheted egy másikra.</p>
<h2>3. Steril eszközök, orvosi alapossággal</h2>
<div class="kep">{kep(K["steril"], L["folyamat"], "Steril, csomagolt eszközök és autokláv")}<div class="felirat">Steril, csomagolt eszközök – és az autokláv, amelyben sterilizálunk.</div></div>
<p>Nem a bemutatott ékszert kapod, hanem annak autoklávban sterilizált, légmentesen lezárt párját. Eszközeinket zártkamrás autoklávval fertőtlenítjük, a füled felületét pedig fertőtlenítő spray-vel készítjük elő. Szakmai mentorunk, Dr. Schmolcz Gergely személyesen is járt nálunk: átnézte a rendelőt, és végignézte a teljes folyamatunkat.</p>
{velemeny(*VEL("v02"))}
<h2>4. Megmérjük a pontot</h2>
<p>Akupunktúrás pontmérő géppel keressük meg a pontot a te füleden – így pontosan oda kerül a piercing, ahová kell.</p>
<h2>5. Érzéstelenítjük a füled</h2>
<p>A bemérés után érzéstelenítő spray-vel fújjuk be a fül felületét.</p>
<h2>6. Pár másodperc, és kész</h2>
<p>Maga a szúrás pár másodperc – vendégeink többsége egy szúnyogcsípéshez hasonlítja. Vendégeink nagy része utána már csak mosolyog, hogy ettől tartott. Nézd meg videón, hogy előre lásd:</p>
{kep(K["video"], L["video"], "Videó: így néz ki egy szúrás")}
{velemeny(*VEL("v03"))}
{velemeny(*VEL("v04"))}
{velemeny(*VEL("v05"))}
{velemeny(*VEL("v06"))}
{mini_idopont(BP)}{alairas(BP, True)}''', K['szalon'], L['folyamat'])

# ---- 05  E3: nem engedjuk el a kezed (utoapolas, ingyenes kontroll, garancia) -------------------------------
level('05-E3-nem-engedjuk-el-a-kezed', 'Ha legalább 14 nap van az időpontig: egyszer, az E2 után', 'Minden foglaló',
 'A szúrás után sem engedjük el a kezed', 'Utóápolás, ingyenes kontroll – csak nálunk –, és garancia.', f'''<h1>A szúrás után sem engedjük el a kezed</h1>
<p>{opt(f'{m(BP["nev"])}, abban', 'Abban')}, amit csinálunk, mi magunk is hiszünk: csapatunk tagjai a saját bőrükön tapasztalták, hogy jobban vannak tőle. Ezért nekünk nem a szúrással ér véget a közös munka – akkor kezdődik igazán.</p>
<h2>Végigkísérünk a gyógyulásban</h2>
<p>A szúrás után elmondjuk, hogyan ápold a piercinged, és e-mailben is elküldjük a pontról pontra leírt útmutatót. A következő hetekben pedig rövid levelekben jelentkezünk: mikor mire figyelj, mi normális, és mikor érdemes szólnod. Nem maradsz egyedül a kérdéseiddel.</p>
<h2>Ingyenes kontroll – az egész piacon csak nálunk</h2>
<p>Ha bármi történik – lassabban gyógyul, érzékeny marad, begyullad, kiesik az ékszer, vagy egyszerűen csak bizonytalan vagy –, bejelentkezhetsz ingyenes kontrollra. Megnézzük, segítünk, és ha kell, ideiglenes szilikon ékszert vagy ékszercserét is megoldunk. A szúrás után is korlátlanul számíthatsz ránk.</p>
<p><a class="btn2" href="{L["kontroll"]}">Így működik a kontroll</a></p>
<h2>És ha nem azt tapasztalod, amit vártál?</h2>
<p>Vendégeink 93%-a jelezte vissza, hogy nála működik*, de mindenki más. Ha 6 hét után nálad nem hozza, amit vártál, munkadíj nélkül, csak az új ékszer áráért (5 000 Ft) helyezünk be egy megerősítő piercinget – a szúrás után 6 hét és 6 hónap között.</p>
<p><a class="btn2" href="{L["garancia"]}">A garancia részletei</a></p>
{velemeny(*VEL("v07"))}
{velemeny(*VEL("v08"))}
{velemeny(*VEL("v09"))}
<p>Több mint {m(GOOGLE_DB)} vendégünk írt rólunk Google-véleményt, az átlagunk 4,8 csillag. <a href="{L["velemenyek"]}">Olvass bele a véleményekbe</a>.</p>
{mini_idopont(BP)}{alairas(BP, True)}''')

# ---- 06-07  T-48 felkeszules (a Salonic emlekezteto helyett) ------------------------------------------------
def t48(d, bp):
    return f'''<h1>{opt(f'Két nap múlva találkozunk, {m(d["nev"])}!', 'Két nap múlva találkozunk!')}</h1>
<p>Már nagyon várunk. Hogy minden simán menjen, összeszedtük, amit érdemes tudnod.</p>
{foglalas_kartya(d)}<p><a class="btn" href="{L['ott_leszek']}">Ott leszek ✓</a><a class="btn2" href="{L['modositas']}">Időpont módosítása</a></p>{opt(f'<p style="font-size:14px"><a href="{d["terkep"]}">Útvonaltervezés a térképen »</a></p>')}
<h2>Így készülj</h2><table role="presentation" class="steps">
<tr><td><span class="num">1</span></td><td><b>Egyél előtte rendesen</b> – üres gyomorral könnyebben megszédül az ember.</td></tr>
<tr><td><span class="num">2</span></td><td><b>Ha hosszú a hajad, fogd össze</b>, hogy ne lógjon a füledre.</td></tr>
<tr><td><span class="num">3</span></td><td><b>Szólj előre</b>, ha vérhígítót szedsz, várandós vagy, volt már ájulásod, vagy a füled most gyulladt – így felelősen tudunk dönteni. Hívj nyugodtan: +36 1 901 7444.</td></tr>
<tr><td><span class="num">4</span></td><td>{opt(f'<b>Tervezz {m(d["ido_tart"])}et</b>, és érkezz 5 perccel korábban.', '<b>Érkezz 5 perccel korábban.</b>')} Ha késnél, hívj minket.</td></tr></table>
{opt(f'<p><b>Hogyan találsz meg minket?</b> {m(d["erkezes"])}</p>')}
<h2>Mi fog történni?</h2>
<p>Leülünk beszélgetni: megkérdezzük, mi miatt érkeztél, és elmondjuk, hová kerül az ékszer. Kiválasztod a neked tetsző G23 titán ékszert, akupunktúrás pontmérővel kimérjük a pontot a füleden, érzéstelenítjük – és a szúrás maga pár másodperc – a legtöbben egy szúnyogcsípéshez hasonlítják. Vendégeink nagy része utána csak mosolyog, hogy ettől tartott.</p>
<div class="kep">{kep(K["ekszerek"], L["ekszerek"], "Ékszereink")}<div class="felirat">Antiallergén G23 titán ékszerek – a helyszínen te választasz.</div></div>
{kep(K["video"], L["video"], "Videó: így néz ki egy szúrás")}
<h2>Utána sem maradsz egyedül</h2>
<p>A szúrás után elmondjuk és e-mailben is elküldjük az utóápolás lépéseit, és a gyógyulás alatt is jelentkezünk. Ha bármi kérdésed van, ingyenes kontrollra bármikor bejelentkezhetsz – ez az egész piacon csak nálunk van így.</p>
{velemeny(*VEL("v10"))}
{velemeny(*VEL("v11"))}
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

# ---- 10-14  A szuras utan: utoapolas, kontroll, garancia ---------------------------------------------------
UTO = dict(BP, szolg='migrén piercing')
GOOGLE_IRAS = 'https://g.page/r/CYXBM5zFeg70EB0/review'  # a fo Google-profil (4,8, 4 800+ velemeny) – ezt hasznalja most a Salonic is
# Piercingenkent kulon level (a motorban szegmens szerint): a hos-kep es a "mire figyelj" bekezdes mas. Az "egyeb" (maj, pajzsmirigy, divat stb.) altalanos.
UTO_TIPUSOK = ['migren', 'shenmen', 'klimax', 'slim', 'allergia', 'egyeb'] if MOTOR else ['migren']
_F6 = ', de a 6 hetet mindenképp érdemes kivárni. '
FIGYELJ = {
  'migren': 'A migrén piercing hatását a legtöbben néhány hét alatt kezdik érezni' + _F6 + 'Ha szeretnéd, jegyezd fel magadnak, hány napon fáj a fejed, és mennyire erősen – így 6 hét múlva te magad is látod, mit hozott.',
  'shenmen': 'A shenmen piercing hatását a legtöbben néhány hét alatt kezdik érezni' + _F6 + 'Ha szeretnéd, figyeld meg, hogyan alszol, és mennyire vagy feszült a nap végén – így 6 hét múlva te magad is látod, mit hozott.',
  'klimax': 'A klimax piercing hatását a legtöbben néhány hét alatt kezdik érezni' + _F6 + 'Ha szeretnéd, jegyezd fel magadnak, naponta hányszor jön hőhullám, és mennyire erős – így 6 hét múlva te magad is látod, mit hozott.',
  'slim': 'A slim piercing hatását a legtöbben néhány hét alatt kezdik érezni' + _F6 + 'Ha szeretnéd, figyeld meg, mikor és mennyire vagy éhes a nap során, és mennyire kívánod a nassolást – így 6 hét múlva te magad is látod, mit hozott.',
  'allergia': 'Az allergia piercing hatását a legtöbben néhány hét alatt kezdik érezni' + _F6 + 'Ha szeretnéd, jegyezd fel magadnak, mennyire zavarnak a tüneteid – így 6 hét múlva te magad is látod, mit hozott.',
  'egyeb': 'Ha közérzetjavító piercinget kaptál, a hatást a legtöbben néhány hét alatt kezdik érezni' + _F6 + 'Ha szeretnéd, jegyezz fel magadnak néhány szót arról, hogy érzed magad – így 6 hét múlva te magad is látod, mit hozott.',
}
UTO_KEP = {'egyeb': 'ekszerek.jpg'}
def utoapolas(tip):
    sfx = f'-{tip}' if MOTOR else ''
    if MOTOR:
        n = UTO_TIPUSOK.index(tip)
        MOTOR_META[f'10-A0-utoapolas{sfx}'] = (f'MP-EMAIL-{14 + n}', dict(tipus='utan_ora', ora=1), [tip], None)
        MOTOR_META[f'11-A2-ket-het{sfx}'] = (f'MP-EMAIL-{20 + n}', dict(tipus='utan_ora', napok=14), [tip], None)
    level(f'10-A0-utoapolas{sfx}', '1 órával a szúrás után, mint most a Salonic véleménykérő levele (+ SMS a linkkel) – ezt váltja ki', 'Mindenki, aki megjelent (a nagy kép a szúrt piercing fotója)',
 'Így ápold a piercinged – az első hetek', 'Napi két perc, és a piercinged szépen gyógyul. Minden, amit tudnod kell, egy helyen.', f'''<h1>{opt(f'Köszönjük, hogy ma nálunk jártál, {m(UTO["nev"])}!', 'Köszönjük, hogy ma nálunk jártál!')}</h1>
<p>Reméljük, jól vagy, és már csak mosolyogsz azon, mennyire tartottál tőle. Ahogy ígértük, nem engedjük el a kezed: ebben a levélben mindent összeszedtünk, amire az első hetekben szükséged lesz.</p>
<p>Az utóápolás nem csak azért fontos, hogy a gyógyulás gondtalan legyen: a piercing akkor tudja a legtöbbet adni, ha szépen gyógyul. {'Ha közérzetjavító piercinget kaptál, a hatást' if tip == 'egyeb' else 'A hatást'} fokozatosan fogod érezni – egyénenként eltérő, akár 4–6 hét is lehet, úgyhogy ne ijedj meg, ha nem azonnal jön.</p>
<h2>A napi rutinod – reggel és este, két perc</h2><table role="presentation" class="steps">
<tr><td><span class="num">1</span></td><td><b>Spray reggel és este.</b> A nálunk kapott otthonápolási csomag spray-jét fújd a sebre, amíg érzékeny.</td></tr>
<tr><td><span class="num">2</span></td><td><b>Ne forgasd, ne mozgasd az ékszert.</b> Az ékszer porcba került, nem zsírszövetbe: ha mozgatod, nem tud gyógyulni.</td></tr>
<tr><td><span class="num">3</span></td><td><b>Esténként öblítsd le</b> vízsugárral a szennyeződést, az alvadt vért. Alkoholt ne használj.</td></tr>
<tr><td><span class="num">4</span></td><td><b>Kozmetikumot ne tegyél a seb környékére</b> – se krémet, se hajlakkot, se parfümöt.</td></tr></table>
<h2>Mit szabad és mit kerülj?</h2>
<div class="card"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">
<tr><td class="l">Ma is</td><td>Hajat moshatsz, zuhanyozhatsz – a víz érheti a füled, csak ne ázzon.</td></tr>
<tr><td class="l">2–3 hétig</td><td>Kerüld a kádas fürdést, a medencét, a szaunát, a szoláriumot és az erős napsütést.</td></tr>
<tr><td class="l">A gyógyulásig</td><td>Ne cseréld ki az ékszert – erre a végleges gyógyulás után (8–12 hét) lesz lehetőség.</td></tr>
<tr><td class="l">Alváskor</td><td>Az első hetekben próbálj a másik oldaladon aludni.</td></tr>
<tr><td class="l">2 hét múlva</td><td>Jöhet az olaj is – erről szólunk majd.</td></tr></table></div>
<h2>Mi normális?</h2>
<p>A 4–5. napon a füled bepirosodhat, megduzzadhat – ez a gyógyulás része, nem kell megijedned. A porc lassan gyógyul: a duzzanat 3–5 hétig is megmaradhat, a teljes gyógyulás akár 6 hónap. Ha bármi bizonytalan, írj vagy gyere el ingyenes kontrollra – csak nálunk.</p>
<p><a class="btn" href="{L["utoapolas"]}">A teljes utóápolási útmutató</a><a class="btn2" href="{L["kontroll"]}">Ingyenes kontroll</a></p>
<h2>Hogy érezted magad nálunk?</h2>
<p>Nekünk nagyon sokat jelent a véleményed – és annak is, aki most ugyanúgy bizonytalan, ahogy talán te voltál a foglalás előtt.</p>
<p><a class="btn" style="font-size:14px;padding:10px 20px" href="{GOOGLE_IRAS}">★ Értékelem a Google-ön</a></p>
<div class="card"><b>Valami nem úgy alakult, ahogy szeretted volna?</b><br>Akkor szeretnénk tőled közvetlenül hallani. Az itt küldött visszajelzésed kiemelten kezeljük, és egyenesen a tulajdonosunkhoz kerül – személyesen nézzük meg, és megoldjuk.<br><a href="{SITE}/visszajelzes" style="font-weight:700">Írok a tulajdonosnak »</a></div>
{alairas(UTO, True, 'Jó gyógyulást kíván:')}''', KEPALAP + UTO_KEP.get(tip, f'ful-{tip}.jpg'), L['utoapolas'])

    level(f'11-A2-ket-het{sfx}', 'A szúrás után 14 nappal', 'Mindenki, aki megjelent (a „mire figyelj” bekezdés piercingenként más)',
 'Két hét telt el – most jöhet az olaj', 'A gyógyulás második szakasza: mit csinálj most, és mire figyelj a következő hetekben.', f'''<h1>Két hét telt el – hogy van a füled?</h1>
<p>{opt(f'{m(UTO["nev"])}, eddig', 'Eddig')} a legnehezebb részen túl vagy. Most egy apró lépéssel bővül a rutinod.</p>
<h2>Mostantól: spray, utána egy csepp olaj</h2>
<p>Reggel és este a spray után tegyél <b>1 csepp olajat</b> a sebre. Ha a füled begyulladna, ne ijedj meg: fültisztítóval vékonyan vidd fel rá az olajat, hetente 2–3-szor; ha nem múlik, naponta kétszer – és szólj nekünk.</p>
<h2>Mire figyelj a következő hetekben?</h2>
<p>{m(FIGYELJ[tip])}</p>
<p>A tapasztalat egyénenként eltér – és ha 6 hét után nem azt érzed, amit vártál, ott a garancia.</p>
<h2>Ha valami nem úgy gyógyul, ahogy kellene</h2>
<p>Ha érzékeny marad, hegszövet képződik, kiesett vagy cserélni kell az ékszert – foglalj ingyenes kontrollt. Megnézzük, és segítünk.</p>
<p><a class="btn" href="{L["kontroll"]}">Ingyenes kontrollt kérek</a></p>
{velemeny(*VEL("v12"))}
{alairas(UTO, True, 'Jó gyógyulást kíván:')}''')

for _t in UTO_TIPUSOK: utoapolas(_t)

SMS = [
 ('T0', 'Azonnal', 'Szia {keresztnev}! Megvan az idopontod: {datum} {ido}, {helyszin_rovid}. Reszletek, modositas: {link} - Medical Piercing'),
 ('T-72', '72 órával előtte (ha legalább 96 órája foglalt)', 'Szia {keresztnev}! {nap} {ido}-kor varunk. Megerosited, vagy attennad? Egy kattintas: {link} - MP'),
 ('T-72 vidék', '72 órával előtte, vidéken', 'Szia {keresztnev}! {nap} {ido}-kor varunk {varosban}. Ha nem jo, itt atteheted: {link}. Legkozelebb itt: {kov_nap}. - MP'),
 ('T-24', '24 órával előtte', 'Szia {keresztnev}! Holnap {ido}-kor varunk: {cim_rovid}. Egyel elotte, erkezz 5 perccel korabban. - MP'),
 ('Lemondás', 'Azonnal', 'Szia {keresztnev}! Toroltuk a {datum} {ido}-s idopontodat. Ha csak az idopont nem jo, itt valaszthatsz ujat: {link} - MP'),
 ('Módosítás', 'Azonnal', 'Szia {keresztnev}! Attettuk az idopontodat: {datum} {ido}, {helyszin_rovid}. Reszletek: {link} - MP'),
 ('A0', 'A szúrás napján 19:00', 'Szia {keresztnev}! Koszonjuk, hogy nalunk jartal! Itt az utoapolasi utmutatod: {link} - Medical Piercing'),
 ('A1', 'A szúrás utáni 4. napon', 'Szia {keresztnev}! Ha most kicsit piros vagy duzzadt a fuled: ez a gyogyulas resze. Ha bizonytalan vagy: {link} - MP'),
 ('No-show', 'Következő munkanap 10:00', 'Szia {keresztnev}! Tegnap nem talalkoztunk, remeljuk, minden rendben. Ha attennad az idopontot: {link} - MP'),
]
# a motor SMS-ei (--motor): a fenti lista a motor helyorzoivel, a vegen mindig "- Medical Piercing" (1 SMS-szegmens: a katalogus-teszt ellenorzi)
MOTOR_SMS = [
 dict(id='MP-SMS-01', csatorna='sms', mikor=dict(tipus='t0', max_lead_ora=30),  # SMS-sporolas (tulajdonos, 2026-10-16): csak a 30 oran belulre foglalok kapjak
 szoveg='Szia {keresztnév}! Megvan az időpontod: {dátum} {időpont}, {helyszín_rövid}. Részletek: {foglalás_részletei_link} - Medical Piercing'),
 dict(id='MP-SMS-02', csatorna='sms', mikor=dict(tipus='t72'), szegmensek=['videk'],  # csak videk
 szoveg='Szia {keresztnév}! Várunk {dátum_ragos} {időpont}-kor. Megerősíted, vagy átteszed? Egy kattintás: {foglalás_részletei_link} - Medical Piercing'),
 dict(id='MP-SMS-03', csatorna='sms', mikor=dict(tipus='t24'), szoveg='Szia {keresztnév}! Holnap {időpont}-kor várunk, {helyszín_rövid}. Egyél előtte, érkezz 5 perccel korábban. - Medical Piercing'),
 # MP-SMS-04 (lemondas SMS) torolve: a lemondasrol csak e-mail megy (SMS-sporolas, 2026-10-16)
 dict(id='MP-SMS-05', csatorna='sms', mikor=dict(tipus='athelyezve'), szoveg='Szia {keresztnév}! Áttettük az időpontodat: {új_dátum} {új_időpont}. Részletek: {foglalás_részletei_link} - Medical Piercing'),
 dict(id='MP-SMS-06', csatorna='sms', mikor=dict(tipus='nem_jelent_meg'), szoveg='Szia {keresztnév}! {nem_találkoztunk}. Új időpont: {foglalás_link} - Medical Piercing'),
]
if MOTOR:
    # az esemeny-uzenetek sorrendje: az SMS elol (az engine az elso azonositot hasznalja ismetlodes-szuresre)
    uzenetek = MOTOR_SMS + MOTOR_LEVELEK
    uzenetek = [u for u in uzenetek if u['mikor']['tipus'] not in ('lemondva', 'athelyezve', 'nem_jelent_meg')] + \
               sorted([u for u in uzenetek if u['mikor']['tipus'] in ('lemondva', 'athelyezve', 'nem_jelent_meg')], key=lambda u: (u['mikor']['tipus'], u['csatorna'] != 'sms'))
    ki = ['// GENERALT - NE SZERKESZD KEZZEL. Forras: medicalpiercing/tools/levelek/general.py --motor (python3 medicalpiercing/tools/levelek/general.py --motor)',
          '// A Medical Piercing (uzletag "mp") foglalas elotti levelei es SMS-ei. Az e-mail kesz HTML-sablon (`html`): render.js htmlKitolt tolti ki',
          '// (helyorzok: katalog/ertekek.js; feltetelt blokk: <!--?-->A<!--|-->B<!--/?-->; {vélemény:vNN}: a D1 mp_velemenyek tablajabol).',
          'export default {', "  uzletag: 'mp',", '  tartalomKeret: false, // a tartalmi levelek sajat min_lead_nap szabalyai donetnek (5+ nap E1, 7+ nap E2, 14+ nap E3)',
          '  uzenetek: [']
    for u in uzenetek: ki.append('    ' + json.dumps(u, ensure_ascii=False) + ',')
    ki += ['  ],', '};', '']
    cel = ROOT.parent / 'netlify' / 'lib' / 'lifecycle' / 'katalog' / 'mp.js'
    cel.write_text('\n'.join(ki), encoding='utf-8')
    print(len(uzenetek), 'motor-uzenet ->', cel)
    sys.exit(0)
(OUT / 'sms.json').write_text(json.dumps(SMS, ensure_ascii=False), encoding='utf-8')

sorok = ''.join(f'<tr><td><a href="{x["fajl"]}">{html.escape(x["targy"])}</a><br><small>{html.escape(x["kinek"])}</small></td><td>{html.escape(x["mikor"])}</td></tr>' for x in LEVELEK)
smssor = ''.join(f'<tr><td><b>{a}</b><br><small>{html.escape(b)}</small></td><td>{html.escape(c)}<br><small>{len(c)} karakter (a mezők nélkül)</small></td></tr>' for a, b, c in SMS)
(OUT / 'index.html').write_text(f'''<!doctype html><html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MP levelek – v3</title>
<meta name="robots" content="noindex"><style>body{{font-family:Helvetica,Arial,sans-serif;background:#f6ebe4;color:#2f3044;margin:0;padding:24px}}main{{max-width:960px;margin:0 auto;background:#fff;padding:24px;border-radius:12px}}
table{{border-collapse:collapse;width:100%}}td{{border-bottom:1px solid #eee;padding:9px 8px;vertical-align:top;font-size:15px}}a{{color:#b0463b}}small{{color:#6b6c80}}h2{{margin-top:28px}}</style></head><body><main>
<h1>Medical Piercing – levelek a foglalástól az utóápolásig (v3)</h1>
<p>A változó részek (név, időpont, helyszín, piercer, ár) példaértékekkel szerepelnek; a vendég a sajátjait látja. Budapesten az aláírásban a foglalt piercer fotója, vidéken fotó nélkül.
Időzítés a foglalás és az időpont közti idő szerint: 3 napnál kevesebb – csak a visszaigazolás és az SMS-ek; legalább 3 nap – + felkészítő levél 2 nappal előtte; legalább 5 nap – + a piercinghez illő levél; legalább 7 nap – + „Így telik majd”; legalább 14 nap – + „Nem engedjük el a kezed”.</p>
<h2>E-mailek</h2><table>{sorok}</table><h2>SMS-ek</h2><table>{smssor}</table><h2>A Salonic mostani levelei – mi lesz velük</h2><table>
<tr><td><b>Új időpont létrehozva</b> + <b>Sikeres foglalás</b> (e-mail)</td><td>kikapcsoljuk → 01/02 visszaigazolás</td></tr>
<tr><td><b>Sikeres foglalás</b> (SMS)</td><td>kikapcsoljuk → T0 SMS</td></tr>
<tr><td><b>Foglalás módosítva</b></td><td>kikapcsoljuk → 08 módosítás + SMS</td></tr>
<tr><td><b>Időpont törlés</b> + <b>Ügyfél lemondás</b></td><td>kikapcsoljuk → 09 lemondás + SMS</td></tr>
<tr><td><b>Időpont emlékeztető</b></td><td>kikapcsoljuk → 06/07 felkészítő levél + T-72 és T-24 SMS</td></tr>
<tr><td><b>Vélemények kérése</b> (most: új vendégnek, 1 órával a szúrás után, utóápolás + Google-link)</td><td>kikapcsoljuk → 10 utóápolás ugyanekkor, véleménykéréssel, minden vendégnek</td></tr>
<tr><td><b>Előleg-levelek</b></td><td>maradnak (előleget most nem kérünk)</td></tr>
<tr><td><b>Hírlevél-feliratkozás</b></td><td>marad, a „hílrevélre” elírás javítva</td></tr>
<tr><td><b>Születésnapi levél</b></td><td>marad</td></tr></table>
<p><small>Kikapcsolás csak az új rendszer éles indulásakor, a tulajdonos külön kérésére.</small></p></main></body></html>''', encoding='utf-8')

# kinyert szoveg (lektoralashoz)
ki = []
for x in LEVELEK:
    s = (OUT / x['fajl']).read_text(encoding='utf-8'); s = re.sub(r'<style>.*?</style>', '', s, flags=re.S)
    t = html.unescape(re.sub(r'<[^>]+>', ' ', s)); t = re.sub(r'[ \t]+', ' ', t); t = re.sub(r'\n\s*\n+', '\n', t)
    ki.append(f'=== {x["fajl"]} | TÁRGY: {x["targy"]}\n{t.strip()}')
(OUT / 'szoveg.txt').write_text('\n\n'.join(ki), encoding='utf-8')
print(len(LEVELEK), 'level kesz')
