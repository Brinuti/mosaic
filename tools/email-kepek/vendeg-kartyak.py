"""Az oxigen-landing "Legfrissebb eredmenyeink" kartya-kepei (assets/img/oxigen/vendeg-NN.jpg).

A Zapier-atviteli cso (drive-atvitel.zapier.ts, 'masol' mod) a Drive-mappa kepeibol kicsinyitett masolatot hoz (assets/img/oxigen/vendeg/<sorszam>-elotte.jpg /
-utana.jpg; a belyegkep PNG-forrasnal PNG, a kiterjesztes ettol fuggetlenul .jpg - a Pillow a tartalom alapjan nyitja meg). Ebbol keszul egy-egy osszetett kep,
mint a regi eredmeny-NN.jpg: 760x507, ket felkep (378x507) + 4 px feher sav. Az ELOTTE / UTANA cimke es a felirat HTML, a kepen nincs szoveg.

  python3 -I tools/email-kepek/vendeg-kartyak.py <nyers-mappa> <kimeneti-mappa>
  pelda: python3 -I tools/email-kepek/vendeg-kartyak.py /tmp/vendeg-nyers assets/img/oxigen

A nyers mappa (assets/img/oxigen/vendeg/) NEM kerul a repoba. A TERULET a telefonos kepernyomentesek fekete savjait / felületet vagja le: a fotoresz
(bal, felso, jobb, also) a nyers kepen; a KARTYAK adja, melyik ketto kerul egymas melle. Uj kepeknel a TERULET-et a kepek megnezesevel kell felvenni.
"""
import os
import sys
from PIL import Image

if len(sys.argv) != 3:
    sys.exit(__doc__)
RAW, KI = sys.argv[1].rstrip('/') + '/', sys.argv[2].rstrip('/')

FW, FH, GAP = 378, 507, 4
ARANY = FW / FH

# nev: (bal, felso, jobb, also) - a fotoresz a nyers kepen (a 443x960-as kepeken y 184..775, az 554x1200-asokon y 230..969, a HEIC-bol szarmazo 900x1200-asok teljesek)
TERULET = {
    '01-elotte': (0, 184, 443, 776),
    '01-utana': (0, 0, 900, 1200),
    '02-elotte': (0, 184, 443, 776),
    '02-utana': (0, 184, 443, 776),
    '03-elotte': (0, 184, 443, 776),
    '03-utana': (0, 0, 900, 1200),
    '04-elotte': (0, 184, 443, 776),
    '04-utana': (0, 230, 554, 970),
    '05-elotte': (0, 184, 443, 776),
    '05-utana': (0, 184, 443, 776),   # a telefon-felulet (ido, eszkoztar, bélyegkep-sor) a fotoresz alatt / folott van
    '06-elotte': (0, 125, 355, 601),   # teljes kepes foto, a telefon-felulet (felul / alul) nelkul; mar a vegleges ablak
    '06-utana': (0, 136, 443, 730),    # 9:16 foto, a kez es a fej teteje korul
    '07-utana-10': (0, 184, 443, 776),
    '07-utana-15': (0, 184, 443, 776),
    '08-elotte-b': (0, 184, 443, 776),  # a Drive-ban "08 Elotte .PNG" (szokozzel): a 07-es sorszam vendegenek elotte-kepe
    '08-elotte': (0, 184, 443, 776),
    '08-utana': (0, 0, 900, 1200),
    '09-elotte': (0, 230, 554, 970),
    '09-utana': (0, 184, 443, 776),
}

# kimeneti nev, elotte, utana (2026-10-09, a tulajdonos kerese: mindenki egyszer, egy kepen - a 03 (osszefogott hajjal) es az 05 (felulrol) kartya kimaradt, mert ugyanaz a vendeg mar szerepel jobban latszo kepen - a 07-es sorszam vendege csak a 15 alkalom utani kepevel -, es a szemuveges, szakallas ferfi (09-es sorszam) kartyaja kimaradt)
KARTYAK = [
    ('vendeg-01', '01-elotte', '01-utana'),
    ('vendeg-02', '02-elotte', '02-utana'),
    ('vendeg-04', '04-elotte', '04-utana'),
    ('vendeg-06', '06-elotte', '06-utana'),
    ('vendeg-07', '08-elotte-b', '07-utana-15'),
    ('vendeg-08', '08-elotte', '08-utana'),
]


def felkep(nev):
    im = Image.open(RAW + nev + '.jpg').convert('RGB')
    l, t, r, b = TERULET[nev]
    w, h = r - l, b - t
    # a legnagyobb ablak a cel-aranyban, kozepre
    if w / h > ARANY:  # tul szeles: oldalrol vagunk
        nw = round(h * ARANY)
        l += (w - nw) // 2
        r = l + nw
    else:              # tul magas: fent-lent vagunk
        nh = round(w / ARANY)
        t += (h - nh) // 2
        b = t + nh
    return im.crop((l, t, r, b)).resize((FW, FH), Image.LANCZOS)


for nev, e, u in KARTYAK:
    vaszon = Image.new('RGB', (FW * 2 + GAP, FH), (255, 255, 255))
    vaszon.paste(felkep(e), (0, 0))
    vaszon.paste(felkep(u), (FW + GAP, 0))
    ut = f'{KI}/{nev}.jpg'
    vaszon.save(ut, 'JPEG', quality=80, optimize=True, subsampling=2)
    print(ut, os.path.getsize(ut), vaszon.size)
