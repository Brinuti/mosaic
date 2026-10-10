"""A kiszolgalt kepek elkeszitese: az eredeti Wix-kepek kicsinyitese a megjelenitett meretre.

    python3 tools/kepek-kicsinyites.py

Forras: tools/eredeti-kepek/ (tools/media.mjs tolti le), cel: assets/img/ (ugyanazzal a nevvel).
A Wix minden kepet a dobozhoz vagva kuld (a cimben: /v1/fill/w_<sz>,h_<m>/...). Az oldalakbol
kigyujtjuk, mekkora dobozokban jelenik meg egy kep, es akkorara kicsinyitjuk, hogy a
legnagyobb dobozt is ketszeres (retina) felbontassal fedje le - az aranya nem valtozik, a
vagast a CSS object-fit vegzi, mint a Wixen. A lusta betoltes elmosott helyorzo-cimeit
(blur_) nem vesszuk figyelembe. Felso korlat: 2560 px; ha nincs meretadat: 1920 px.
"""
import os, re, html as H
from urllib.parse import unquote
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BE = os.path.join(ROOT, 'tools/eredeti-kepek')
KI = os.path.join(ROOT, 'assets/img')
os.makedirs(KI, exist_ok=True)
MAX, ALAP = 2560, 1920

dobozok = {}
minta = re.compile(r'static\.wixstatic\.com/media/([A-Za-z0-9_]+?)(?:~mv2)?(?:_[a-z]_[0-9_]+)*\.(jpg|jpeg|png|gif|webp)/v1/(fill|fit|crop)/([^/]*)', re.I)
for mappa in ('tools/raw', 'tools/raw-mobil', 'tools/elo-dom/asztali', 'tools/elo-dom/mobil'):
    for gy, _, fajlok in os.walk(os.path.join(ROOT, mappa)):
        for f in fajlok:
            s = unquote(H.unescape(open(os.path.join(gy, f), encoding='utf-8', errors='ignore').read()))
            for m in minta.finditer(s):
                if 'blur_' in m.group(4):
                    continue
                w = re.search(r'(?:^|,)w_(\d+)', m.group(4)); h = re.search(r',h_(\d+)', m.group(4))
                if w and h:
                    dobozok.setdefault(m.group(1) + '.' + m.group(2).lower(), set()).add((int(w.group(1)), int(h.group(1)), m.group(3)))

elotte = utana = 0
for f in sorted(os.listdir(BE)):
    be, ki = os.path.join(BE, f), os.path.join(KI, f)
    ext = f.rsplit('.', 1)[-1].lower()
    meg = os.path.getsize(be); elotte += meg
    if ext not in ('jpg', 'jpeg', 'png', 'webp'):
        open(ki, 'wb').write(open(be, 'rb').read()); utana += meg; continue
    im = Image.open(be); im.load(); im = ImageOps.exif_transpose(im)
    W0, H0 = im.size
    if f in dobozok:
        # fill: a dobozt fedni kell (a nagyobbik arany szamit); fit: bele kell ferni
        kell = max((max(w / W0, h / H0) if mod != 'fit' else min(w / W0, h / H0)) for w, h, mod in dobozok[f])
        cel = min(MAX, W0, max(64, round(2 * kell * W0)))
    else:
        cel = min(MAX, W0, ALAP)
    if cel >= W0 and meg < 400_000:
        open(ki, 'wb').write(open(be, 'rb').read()); utana += meg; continue
    if cel < W0:
        im = im.resize((cel, max(1, round(H0 * cel / W0))), Image.LANCZOS)
    if ext in ('jpg', 'jpeg'):
        im.convert('RGB').save(ki, 'JPEG', quality=84, optimize=True, progressive=True)
    elif ext == 'png':
        im.save(ki, 'PNG', optimize=True)
    else:
        im.save(ki, 'WEBP', quality=84)
    if os.path.getsize(ki) > meg and cel >= W0:
        open(ki, 'wb').write(open(be, 'rb').read())
    utana += os.path.getsize(ki)
print(f'{len(os.listdir(KI))} kep: {elotte/1e6:.0f} MB -> {utana/1e6:.0f} MB')
