"""Sajat betufajlok a fizetos Wix-betuk helyett, pixelpontos szovegtoreshez.

    python3 tools/betu-epites.py      (elotte: python3 -m pip install fonttools brotli)
    python3 tools/betu-epites.py helvetica-w01-light   csak ezt a Wix-csaladot epiti ujra
                                      (a wix-fonts.css-t ilyenkor nem irja at)

A Wix fizetos betuit (Helvetica, DIN Next, Avenir, Proxima Nova, Futura) nem
masolhatjuk at. Egy hasonlo ingyenes betu (Arimo, Hanken Grotesk, Sarabun, Jost)
viszont csak atlagosan igazithato hozzajuk: betunkent mas a szelesseg, ezert a
sorok mashol tornek. Ezert minden Wix-betufajlhoz epitunk egy sajat fajlt:

  - a betuk RAJZOLATA a szabad licencu helyettesitobol jon (Apache 2.0 / OFL,
    modosithato; a nevuk ezert nem a helyettesito neve),
  - a betuk SZELESSEGE, a betuparok alagasa (kerning) es a fuggoleges meretek
    (ascent/descent/sorkoz) az eredeti Wix-betu MERESEIBOL - ugyanugy, ahogy
    az Arimo is az Arial mereteit koveti (metrikakompatibilis betu).

Igy minden szo pontosan olyan szeles, mint az eles oldalon, es a sorok
ugyanott tornek. A Wix-betuket csak a mereshez toltjuk le (tools/wix-betuk/,
nincs a tarhazban); belőluk tablazatot, rajzolatot nem viszunk at.

Eredmeny: assets/fonts/mp-<wix-fajlnev>.woff2 es assets/css/wix-fonts.css
(a Wix csaladnevevel es unicode-tartomanyaival, igy a Wix CSS-e valtozatlanul hat).
"""
import os, re, sys, glob, json, urllib.request
from fontTools.ttLib import TTFont, newTable
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.fontBuilder import FontBuilder
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIX = os.path.join(ROOT, 'tools/wix-betuk')
FONTS = os.path.join(ROOT, 'assets/fonts')
os.makedirs(WIX, exist_ok=True)

# Wix csalad -> (helyettesito csalad, vastagsag)
HELYETTESITO = {
    # a Wix Helvetica Light vekony betu: a Roboto Light rajzolata all hozza a legkozelebb (2026-10-10,
    # mintaszovegen merve a Wix eredetijehez: festekfedes 0.96, az Arimo 400-ae 1.35 - tul vastag volt)
    'helvetica-w01-light': ('Roboto', 300),
    'helvetica-w01-roman': ('Arimo', 400),
    'helvetica-w01-bold': ('Arimo', 700),
    'din-next-w01-light': ('Hanken Grotesk', 400),
    'avenir-lt-w01_35-light1475496': ('Hanken Grotesk', 400),
    'avenir-lt-w01_85-heavy1475544': ('Sarabun', 700),
    'proxima-n-w01-reg': ('Hanken Grotesk', 400),
    'futura-lt-w01-light': ('Jost', 300),
    'futura-lt-w01-book': ('Jost', 400),
}
jegyzek = json.load(open(os.path.join(ROOT, 'tools/fonts-jegyzek.json')))

# --- 1. a Wix @font-face szabalyai (csalad, fajl, unicode-range) a lementett oldalakbol ---
szabalyok = {}
for f in glob.glob(os.path.join(ROOT, 'tools/raw/**/*.html'), recursive=True) + glob.glob(os.path.join(ROOT, 'tools/raw-mobil/**/*.html'), recursive=True):
    s = open(f, encoding='utf-8', errors='ignore').read()
    for b in re.findall(r'@font-face\s*\{[^}]*\}', s):
        csal = re.search(r"font-family:\s*['\"]?([^;'\"]+)", b)
        url = re.search(r"url\(['\"]?(//static\.parastorage\.com/fonts/v2/[^'\")]+\.woff2)", b)
        if not csal or not url or csal.group(1) not in HELYETTESITO:
            continue
        rng = re.search(r'unicode-range:\s*([^;}]+)', b)
        szabalyok[(csal.group(1), 'https:' + url.group(1))] = rng.group(1).strip() if rng else None

# --- 2. a helyettesito betu rajzolatai, kodpont szerint (a latin + latin-ext fajlbol) ---
def helyettesito_betuk(csalad, suly):
    ki = {}
    for j in jegyzek:
        if j['family'] != csalad or j['weight'] != suly:
            continue
        f = TTFont(os.path.join(ROOT, 'tools/helyettesito-betuk', j['file']))
        if 'fvar' in f:
            # a Google Fonts valtoztathato vastagsagu betut ad (alapallasa 400): a kert vastagsag
            # peldanya kell (enelkul pl. az Arimo 700 is 400-as rajzolattal epult)
            f = instancer.instantiateVariableFont(f, {'wght': suly})
        gs = f.getGlyphSet()
        upem = f['head'].unitsPerEm
        for cp, g in f.getBestCmap().items():
            if cp not in ki:
                ki[cp] = (gs, g, f['hmtx'][g][0], upem)
    return ki

def wix_kerning(f):
    """Betupar -> alagas (font-egysegben), a Wix-fajl kern vagy GPOS tablajabol."""
    cm = {g: cp for cp, g in f.getBestCmap().items()}
    parok = {}
    if 'kern' in f:
        for t in f['kern'].kernTables:
            for (a, b), v in getattr(t, 'kernTable', {}).items():
                if a in cm and b in cm and v:
                    parok[(cm[a], cm[b])] = v
    if 'GPOS' in f:
        gpos = f['GPOS'].table
        idx = set()
        for fr in gpos.FeatureList.FeatureRecord:
            if fr.FeatureTag == 'kern':
                idx.update(fr.Feature.LookupListIndex)
        for i in sorted(idx):
            lk = gpos.LookupList.Lookup[i]
            for st in lk.SubTable:
                if lk.LookupType == 9:
                    st = st.ExtSubTable
                if getattr(st, 'LookupType', 2) != 2 and lk.LookupType not in (2, 9):
                    continue
                if not hasattr(st, 'Format'):
                    continue
                elso = st.Coverage.glyphs
                if st.Format == 1:
                    for g1, ps in zip(elso, st.PairSet):
                        for pv in ps.PairValueRecord:
                            v = getattr(pv.Value1, 'XAdvance', 0) if pv.Value1 else 0
                            if v and g1 in cm and pv.SecondGlyph in cm:
                                parok.setdefault((cm[g1], cm[pv.SecondGlyph]), v)
                elif st.Format == 2:
                    c1 = st.ClassDef1.classDefs if st.ClassDef1 else {}
                    c2 = st.ClassDef2.classDefs if st.ClassDef2 else {}
                    masodik = list(cm)
                    for g1 in elso:
                        if g1 not in cm:
                            continue
                        rek = st.Class1Record[c1.get(g1, 0)]
                        for g2 in masodik:
                            v = rek.Class2Record[c2.get(g2, 0)].Value1
                            v = getattr(v, 'XAdvance', 0) if v else 0
                            if v:
                                parok.setdefault((cm[g1], cm[g2]), v)
    return parok

def epit(csal, url, rng):
    nev = url.split('/')[-1]
    helyi = os.path.join(WIX, nev)
    if not os.path.exists(helyi):
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.medicalpiercing.hu/', 'Origin': 'https://www.medicalpiercing.hu'})
        open(helyi, 'wb').write(urllib.request.urlopen(req).read())
    w = TTFont(helyi)
    wupem = w['head'].unitsPerEm
    wcm = w.getBestCmap()
    h_csal, h_suly = HELYETTESITO[csal]
    hb = helyettesito_betuk(h_csal, h_suly)

    # a mereteket a nagybetu-magassaggal hozzuk kozos alapra (igy a betuk latszo merete is egyezik)
    def nagybetu(gs, g):
        p = DecomposingRecordingPen(gs); gs[g].draw(p)
        ys = [pt[1] for op, args in p.value for pt in args if isinstance(pt, tuple)]
        return max(ys) if ys else 0
    wgs = w.getGlyphSet()
    try:
        arany_y = (nagybetu(wgs, wcm[ord('H')]) / wupem) / (nagybetu(hb[ord('H')][0], hb[ord('H')][1]) / hb[ord('H')][3])
    except Exception:
        arany_y = 1.0

    rend = ['.notdef']
    glyfok, metrika, cmap = {}, {}, {}
    ures = TTGlyphPen(None); glyfok['.notdef'] = ures.glyph(); metrika['.notdef'] = (w['hmtx'][w.getGlyphOrder()[0]][0], 0)
    for cp, wg in sorted(wcm.items()):
        adv = w['hmtx'][wg][0]
        gn = 'u%04X' % cp
        pen = TTGlyphPen(None)
        if cp in hb and cp not in (0x20, 0xA0):
            gs, g, hadv, hupem = hb[cp]
            sk = wupem / hupem * arany_y          # egyseges meretezes
            szel = hadv * sk
            sx = sk * max(0.88, min(1.12, adv / szel)) if szel else sk   # kis vizszintes igazitas
            # a betu a cellaban: a ket oldali ures hely aranyosan
            rp = DecomposingRecordingPen(gs); gs[g].draw(rp)
            xs = [pt[0] for op, args in rp.value for pt in args if isinstance(pt, tuple)]
            if xs:
                bal, jobb = min(xs) * sx, max(xs) * sx
                tomeg = jobb - bal
                hely = adv - tomeg
                eredeti_bal = min(xs) * sk; eredeti_jobb = szel - max(xs) * sk
                osszes = eredeti_bal + eredeti_jobb
                ujbal = hely * (eredeti_bal / osszes) if osszes > 0 else hely / 2
                dx = ujbal - bal
            else:
                dx = 0
            rp.replay(TransformPen(Cu2QuPen(pen, 1.0, reverse_direction=False), (sx, 0, 0, sk, dx, 0)))
        glyfok[gn] = pen.glyph()
        metrika[gn] = (adv, 0)
        cmap[cp] = gn
        rend.append(gn)

    fb = FontBuilder(wupem, isTTF=True)
    fb.setupGlyphOrder(rend)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyfok)
    for g in rend:
        if g in fb.font['glyf']:
            fb.font['glyf'][g].recalcBounds(fb.font['glyf'])
            metrika[g] = (metrika[g][0], getattr(fb.font['glyf'][g], 'xMin', 0))
    fb.setupHorizontalMetrics(metrika)
    hh, o2 = w['hhea'], w['OS/2']
    fb.setupHorizontalHeader(ascent=hh.ascent, descent=hh.descent, lineGap=hh.lineGap)
    csaladnev = 'MP ' + nev.replace('.woff2', '')
    fb.setupNameTable({'familyName': csaladnev, 'styleName': 'Regular',
                       'copyright': f'Rajzolat: {h_csal} (Apache 2.0 / SIL OFL 1.1), modositva; meretek az eredeti Wix-betu meresebol. Medical Piercing klon.'})
    fb.setupOS2(sTypoAscender=o2.sTypoAscender, sTypoDescender=o2.sTypoDescender, sTypoLineGap=o2.sTypoLineGap,
                usWinAscent=o2.usWinAscent, usWinDescent=o2.usWinDescent, fsSelection=(o2.fsSelection & 0b10000000) | 0x40,
                usWeightClass=400, sxHeight=getattr(o2, 'sxHeight', 0), sCapHeight=getattr(o2, 'sCapHeight', 0))
    fb.setupPost()
    fb.setupDummyDSIG = None
    # alagas: a Wix-betu betuparjai, a mi betuneveinkkel
    parok = wix_kerning(w)
    if parok:
        sorok = [f'pos {cmap[a]} {cmap[b]} {v};' for (a, b), v in parok.items() if a in cmap and b in cmap]
        fea = 'languagesystem DFLT dflt;\nlanguagesystem latn dflt;\nfeature kern {\n' + '\n'.join(sorok) + '\n} kern;\n'
        addOpenTypeFeaturesFromString(fb.font, fea)
    fb.font.flavor = 'woff2'
    ki = os.path.join(FONTS, 'mp-' + nev)
    fb.save(ki)
    return ki, len(rend) - 1, len(parok), os.path.getsize(ki)

csak = set(sys.argv[1:])
if csak:
    # csak a megadott csaladok fajljai epulnek ujra (azonos fajlnevvel); a CSS valtozatlan
    for (csal, url), rng in sorted(szabalyok.items()):
        if csal in csak:
            ki, db, kern, meret = epit(csal, url, rng)
            print(f'{csal:32} {url.split("/")[-1]:36} -> {os.path.basename(ki)}  {db} betu, {kern} betupar, {meret // 1024} kB')
    sys.exit(0)

css = '/* Automatikusan generalt - ne szerkeszd kezzel. Forras: tools/betu-epites.py\n   Sajat betufajlok a Wix fizetos betui helyett: szabad licencu rajzolat, az eredetivel azonos betuszelessegek es sormeretek. */\n'
for (csal, url), rng in sorted(szabalyok.items()):
    ki, db, kern, meret = epit(csal, url, rng)
    print(f'{csal:32} {url.split("/")[-1]:36} -> {os.path.basename(ki)}  {db} betu, {kern} betupar, {meret // 1024} kB')
    css += (f"@font-face{{font-family:'{csal}';font-style:normal;font-weight:400;font-display:swap;"
            f"src:url(../fonts/{os.path.basename(ki)}) format('woff2')" + (f';unicode-range:{rng}' if rng else '') + '}\n')
open(os.path.join(ROOT, 'assets/css/wix-fonts.css'), 'w').write(css)
print('assets/css/wix-fonts.css kesz')
