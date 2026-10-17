# A nagy kepek kisebb valtozatai a valaszado kepekhez (srcset; gyorsitas, 2026-10-17: a Lighthouse / PageSpeed minden oldalon a "Properly size images"
# tetelt jelezte, oldalankent atlagosan ~600 KB folosleges kepbajttal). Az uj oldalak (dist/_a, dist/_m, a /regi nelkul) <img src> kepeibol
# a 400 px-nel szelesebbeknek 320 / 400 / 480 / 640 / 800 / 1200 / 1600 px szeles WebP valtozata keszul, a JPG / PNG kepeknek az eredeti szelessegben is (modern formatum):
#   assets/img/valtozat/<kep neve kiterjesztes nelkul>-<szelesseg>.webp     + assets/img/valtozat/jegyzek.json (a build ebbol irja a srcset-et)
#   python3 tools/kep-valtozatok.py        (a build utan; csak a hianyzo / regebbi valtozatokat kesziti)
# A meretezes arcot / tartalmat nem modosit (csak kicsinyit). A build a srcset-et a tools/kep-meretek.mjs mert megjelenesi meretei szerint teszi a lapokra.
import os, re, glob, json
from PIL import Image

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(R, 'assets/img')
KI = os.path.join(IMG, 'valtozat')
SZELESSEGEK = (320, 400, 480, 640, 800, 1200, 1600)
MIN = 400            # ennel keskenyebb kepnek nem kell valtozat
MINOSEG = 80

hivatkozott = set()
for f in glob.glob(os.path.join(R, 'dist/_[am]/**/*.html'), recursive=True):
    if '/regi/' in f:
        continue
    h = open(f, encoding='utf8', errors='ignore').read()
    for tag in re.findall(r'<img\b[^>]*>', h):
        m = re.search(r'\ssrc="/assets/img/([^"?#]+\.(?:webp|jpe?g|png))', tag, re.I)
        if m and not m.group(1).startswith('valtozat/'):
            hivatkozott.add(m.group(1))

os.makedirs(KI, exist_ok=True)
jp = os.path.join(KI, 'jegyzek.json')
jegyzek = json.load(open(jp)) if os.path.exists(jp) else {}
uj = 0
for nev in sorted(hivatkozott):
    p = os.path.join(IMG, nev)
    if not os.path.exists(p):
        continue
    try:
        im = Image.open(p)
        W, H = im.size
    except Exception:
        continue
    jpg = not nev.lower().endswith('.webp')
    if W <= MIN and not jpg:
        continue
    alap = os.path.splitext(nev)[0]
    celok = [w for w in SZELESSEGEK if w * 1.1 < W]
    if jpg:
        celok.append(W)   # (az eredeti meretben is WebP)
    if not celok:
        continue
    kesz = []
    for w in celok:
        ki = os.path.join(KI, f'{alap}-{w}.webp')
        os.makedirs(os.path.dirname(ki), exist_ok=True)
        if not os.path.exists(ki) or os.path.getmtime(ki) < os.path.getmtime(p):
            alfa = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
            k = im.convert('RGBA' if alfa else 'RGB')
            if w != W:
                k = k.resize((w, round(H * w / W)), Image.LANCZOS)
            k.save(ki, 'WEBP', quality=MINOSEG, method=6)
            uj += 1
        # a valtozat csak akkor kell, ha tenyleg kisebb, mint az eredeti fajl
        if os.path.getsize(ki) < os.path.getsize(p) * 0.95 or w < W:
            kesz.append(w)
    if kesz:
        jegyzek[nev] = {'w': W, 'h': H, 'valtozatok': sorted(kesz)}
json.dump(jegyzek, open(jp, 'w'), ensure_ascii=False, indent=0, sort_keys=True)
print(f'{len(hivatkozott)} hivatkozott kep, {len(jegyzek)} kapott valtozatot, {uj} uj fajl')
