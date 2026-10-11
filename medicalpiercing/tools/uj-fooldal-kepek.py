#!/usr/bin/env python3
"""Az uj, rejtett fooldal (/uj-fooldal) kepei: a meglevo assets/img/ forrasokbol, ujrafuttathato.

    python3 tools/uj-fooldal-kepek.py

Kimenet (mind WebP, assets/img/uj-*.webp):
  uj-logo               a logo atlatszo hatterrel, melyebb rozsaszinnel (a latvanyterv szerint); uj-logo-rtl/-hirtv/-divany: a media-logok
                        a hatterszin eltavolitva, az eredeti szinek megtartva
  uj-orvos              Dr. Schmolcz Gergely az "Orvosi ajanlas" kepbol (a kep az eles fooldalon is szerepel)
  uj-ekszer-1..3        harom arany ekszer (2000 px-es ekszer-galeriabol)
  uj-ful-akcio          a banner fulfotoja (migren-piercing-budapest-2.jpg belso kepe)
  uj-pont-<tipus>       a fulabrak (migren, shenmen, slim): az eredeti 100 px-es abra helyett 332 px-es, a pont
                        helyzete az eredeti abrarol leolvasva (a tobbi tipus eredeti 332 px-es abrat hasznal)
  uj-video-rtl/-hirtv/-divany   a media-kartyak indexkepei (a YouTube-videok indexkepei, az RTL-cikk kepe); csak ha hianyoznak
                        vagy --videok-kal: a halozatrol toltodnek le, 640x360-ra vagva
"""
import os, glob, sys, urllib.request, io
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
IMG = os.path.join(ROOT, 'assets', 'img')


def src(stem):
    c = [f for f in glob.glob(os.path.join(IMG, stem + '*')) if not f.endswith('.webp')]
    assert c, stem
    return c[0]


def save(im, nev, q=86):
    im.convert('RGBA' if im.mode == 'RGBA' else 'RGB').save(os.path.join(IMG, nev + '.webp'), 'WEBP', quality=q, method=6)
    print('  ', nev + '.webp', im.size, os.path.getsize(os.path.join(IMG, nev + '.webp')) // 1024, 'kB')


# --- orvos: a jobb oldali portre (a kep bal oldalan az idezet szovege van, az nem kell) ---
im = Image.open(src('f18724_7538c1dee3ea42a1b5efdd9b8f726f64')).convert('RGB')
from PIL import ImageDraw
hatter = im.getpixel((470, 100))                      # a kartya egyszinu hatterszine
ImageDraw.Draw(im).rectangle((440, 60, 633, 452), fill=hatter)  # az idezet szovegenek vege (a fej es a vall nem erinti)
save(im.crop((455, 70, 940, 788)), 'uj-orvos', 88)

# --- ekszerek: szivecske, viragos, koronas gyuru (arany); a hatter vilagos, kozepre vagva ---
for i, stem in enumerate(['f18724_7df14018a68f40f59e94c3ac9b589fec', 'f18724_1527fe82090042d1bfcd459ae3033a92', 'f18724_4d23d5d2062b416389c5b373870d9b53'], 1):
    e = Image.open(src(stem)).convert('RGB')
    save(e.resize((620, 620), Image.LANCZOS), f'uj-ekszer-{i}', 84)

# --- banner: a keretezett fulfoto belso resze (a feher keretet levagjuk), fuggoleges kivagas a fulre ---
f = Image.open(src('f18724_845225eefb1e498daa49764947208c70')).convert('RGB')
belso = f.crop((470, 116, 1116, 894))            # a feher kereten belul
save(belso.resize((460, int(460 * belso.height / belso.width)), Image.LANCZOS), 'uj-ful-akcio', 84)

# --- fulabrak: egyseges, eles 332 px ---
# A 332 px-es abrak ugyanazt a fulet rajzoljak, csak a piros pont helye mas. Tiszta alap: az "allergia" abra, a pontja
# helyen a kornyezetbol diffuzioval kitoltve (a ful arnyalasa lagy, ezen a kis teruleten ez hibatlan). A pont kinezete
# (szin, sugar, fenyudvar) az eredeti pontbol jon (alfa-folt), igy ugyanolyan, mint a tobbi abran. A migren / shenmen /
# slim abrakbol csak a pont helyet olvassuk le (a ful befoglalo teglalapjahoz viszonyitva), mert azok csak 100 px-esek.
A = lambda n: np.array(Image.open(src(n)).convert('RGBA')).astype(float)
ABRA = {'migren': 'f18724_0c4ab83cfe7f4fb9872c5', 'shenmen': 'f18724_0eaecdb4953f451f8ac35', 'slim': 'f18724_a76eb0bdea2143189068e'}
piros = lambda a: (a[..., 0] > 215) & (a[..., 1] < 120) & (a[..., 2] < 140) & (a[..., 3] > 200)


def fulkeret(a):
    ys, xs = np.nonzero(a[..., 3] > 40)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def tagit(m, n):
    for _ in range(n):
        k = m.copy(); k[1:] |= m[:-1]; k[:-1] |= m[1:]; k[:, 1:] |= m[:, :-1]; k[:, :-1] |= m[:, 1:]; m = k
    return m


def kitolt(kep, maszk, kor=600):
    """A maszkolt teruletet a kornyezetbol tolti ki: elobb hagymahej-szeruen (szomszedok atlaga), aztan Laplace-simitas."""
    ki = kep.copy(); ismert = ~maszk
    ki[maszk] = 0
    hatar = ismert.copy()
    while not hatar.all():
        s = np.zeros_like(ki); n = np.zeros(maszk.shape)
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            v = np.roll(ki, d, (0, 1)); w = np.roll(hatar, d, (0, 1)).astype(float)
            s += v * w[..., None]; n += w
        uj = (~hatar) & (n > 0)
        ki[uj] = s[uj] / n[uj][:, None]; hatar = hatar | uj
    for _ in range(kor):
        s = sum(np.roll(ki, d, (0, 1)) for d in ((1, 0), (-1, 0), (0, 1), (0, -1))) / 4
        ki[maszk] = s[maszk]
    return ki


alap = A('f18724_f8ea26b1347344a6aa3f0')   # allergia (pont fent)
pont = piros(alap)
ys, xs = np.nonzero(pont); cy, cx = int(round(ys.mean())), int(round(xs.mean()))
tiszta = kitolt(alap, tagit(pont, 13))
R = 18
sl = (slice(cy - R, cy + R + 1), slice(cx - R, cx + R + 1))
mag = alap[cy - 1:cy + 2, cx - 1:cx + 2, :3].reshape(-1, 3).mean(0)
alfa = np.clip((tiszta[sl][..., 1] - alap[sl][..., 1]) / max(1.0, tiszta[cy, cx, 1] - mag[1]), 0, 1)
bb = fulkeret(tiszta)
for nev, st in ABRA.items():
    a0 = A(st); yy, xx = np.nonzero(piros(a0)); b0 = fulkeret(a0)
    rx, ry = (xx.mean() - b0[0]) / (b0[2] - b0[0]), (yy.mean() - b0[1]) / (b0[3] - b0[1])
    bx, by = bb[0] + rx * (bb[2] - bb[0]), bb[1] + ry * (bb[3] - bb[1])
    kep = tiszta.copy(); x0, y0 = int(round(bx)) - R, int(round(by)) - R
    t = (slice(y0, y0 + 2 * R + 1), slice(x0, x0 + 2 * R + 1))
    kep[t][..., :3] = kep[t][..., :3] * (1 - alfa[..., None]) + mag * alfa[..., None]
    save(Image.fromarray(np.clip(kep, 0, 255).astype('uint8'), 'RGBA'), 'uj-pont-' + nev, 90)
print('kesz')

# --- media-kartyak indexkepei ---
VIDEOK = {
    'uj-video-rtl': 'https://cdn2.rtl.hu/bc/ef/migren-fejfajas-modszerek_image_9e29fc150e3b3a3eca6cb8509b06?size=w1440',  # rtl.hu/fokusz/2023/12/14/migren-fejfajas-modszerek
    'uj-video-hirtv': 'https://i.ytimg.com/vi/JX4nNVb-jB8/maxresdefault.jpg',                                              # HirTV Radar, 2024-01-17
    'uj-video-divany': 'https://i.ytimg.com/vi/foEQNUg6DzI/maxresdefault.jpg',                                             # Divany.hu interju
}
for nev, url in VIDEOK.items():
    fajl = os.path.join(IMG, nev + '.webp')
    if os.path.exists(fajl) and '--videok' not in sys.argv:
        continue
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 Chrome/131'})
    k = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert('RGB')
    h = int(round(k.width * 9 / 16)); top = max(0, (k.height - h) // 2)
    save(k.crop((0, top, k.width, top + h)).resize((640, 360), Image.LANCZOS), nev, 82)

# --- logok: atlatszo hatter ---
def hatter_nelkul(forras, nev, szin=None, ker=4):
    """Az egyszinu hatteret atlatszova teszi (alfa = a hatterszintol valo tavolsag), a vilagos szeleket levagja.
    szin: ha megadjak, az egesz rajzolat ezzel a szinnel jelenik meg (egyszinu logo); egyebkent az eredeti szinek maradnak."""
    im = Image.open(forras).convert('RGB'); a = np.array(im).astype(float)
    hatter = a[0, 0]
    tav = np.sqrt(((a - hatter) ** 2).sum(-1))
    alfa = np.clip((tav - 6) / 70.0, 0, 1)
    if szin is None:
        szinek = np.where(alfa[..., None] > 0.02, (a - (1 - alfa[..., None]) * hatter) / np.maximum(alfa[..., None], 0.02), 0).clip(0, 255)
    else:
        szinek = np.ones_like(a) * np.array(szin, dtype=float)
    rgba = np.dstack([szinek, alfa * 255]).astype('uint8')
    ys, xs = np.nonzero(alfa > 0.08)
    kep = Image.fromarray(rgba, 'RGBA').crop((max(0, xs.min() - ker), max(0, ys.min() - ker), min(im.width, xs.max() + 1 + ker), min(im.height, ys.max() + 1 + ker)))
    save(kep, nev, 92)

hatter_nelkul(src('f18724_5d639907d27148e1a1e80625fce81d7a'), 'uj-logo', szin=(176, 82, 95))
hatter_nelkul(src('f18724_9a3801c9a2a4432691acf8bb77cd7ae7'), 'uj-logo-rtl')
hatter_nelkul(src('f18724_02c665dc12644013b715f4c02873cbae'), 'uj-logo-hirtv')
hatter_nelkul(src('f18724_812ebad008414108bbae5e673867508e'), 'uj-logo-divany')
