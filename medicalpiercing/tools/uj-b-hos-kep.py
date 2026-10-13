# A "B" kategoria-oldalak hosgaleriajanak elso kepe: az eredeti kepen egy "<- Lapozz balra" jelzes van (a Wix-galeria lapozasi tippje).
# Ez a script a jelzest kitorli (a haj-textura a hely fole masolodik), es a kep JOBB also sarkaba "Lapozz jobbra ->" jelzest rajzol.
# Kimenet: assets/img/uj-hos-01.webp (800x800). A kategoria.mjs a 54ef80f3... forraskep helyett ezt hasznalja.
# Futtatas: python3 tools/uj-b-hos-kep.py   (kell: numpy, Pillow, fonttools + brotli a betutipus woff2 -> ttf atalakitasahoz)
import io, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FORRAS = os.path.join(ROOT, 'assets/img/f18724_54ef80f3849d46cfa63ae77598afbcf7.webp')
CEL = os.path.join(ROOT, 'assets/img/uj-hos-01.webp')
BETU = os.path.join(ROOT, 'assets/fonts/plus-jakarta-sans-latin.woff2')

im = Image.open(FORRAS).convert('RGB')
W, H = im.size
# az eredeti jelzes (kb. 31..306 x 692..766): ezt fedjuk le
x0, x1, y0, y1 = 14, 324, 676, 782
hw, hh = x1 - x0, y1 - y0

# 1) a jelzes helyere a fole levo haj-textura kerul (a csikok iranya miatt vizszintesen eltolva, ahol a legkisebb a varrat)
a = np.asarray(im).astype(float)
dy = hh + 6
legjobb = None
for dx in range(-40, 41):
    sx0 = x0 + dx
    if sx0 < 0 or sx0 + hw > W:
        continue
    forras = a[y0 - dy:y0 - dy + hh, sx0:sx0 + hw]
    fent = np.abs(forras[:3].mean(axis=0) - a[y0 - 3:y0, x0:x1].mean(axis=0)).mean()
    lent = np.abs(forras[-3:].mean(axis=0) - a[y1:y1 + 3, x0:x1].mean(axis=0)).mean()
    k = fent + lent
    if legjobb is None or k < legjobb[0]:
        legjobb = (k, dx)
dx = legjobb[1]
patch = im.crop((x0 + dx, y0 - dy, x0 + dx + hw, y0 - dy + hh))
# szinillesztes: a foltnak es a kore eso (hatarolo) savnak azonos az atlagszine, hogy ne latsszon a teglalap
pa = np.asarray(patch).astype(float)
keret = np.ones((hh, hw), dtype=bool)
keret[6:hh - 6, 6:hw - 6] = False
kor = np.zeros((H, W), dtype=bool)
kor[y0 - 8:y1 + 8, x0 - 8:x1 + 8] = True
kor[y0:y1, x0:x1] = False
delta = a[kor].mean(axis=0) - pa[keret].mean(axis=0)
patch = Image.fromarray(np.clip(pa + delta, 0, 255).astype('uint8'))
m = np.zeros((hh, hw), dtype=np.uint8)
m[6:hh - 6, 6:hw - 6] = 255
maszk = Image.fromarray(m).filter(ImageFilter.GaussianBlur(2.6))
tiszta = im.copy()
tiszta.paste(patch, (x0, y0), maszk)

# 2) az uj jelzes jobb oldalon (4x-es felbontasban rajzolva, majd kicsinyitve: sima el)
S = 4
px0, px1, py0, py1 = W - 306, W - 31, 692, 766        # az eredetivel azonos meret, tukrozve
pw, ph = (px1 - px0) * S, (py1 - py0) * S
pill = Image.new('RGBA', (pw, ph), (0, 0, 0, 0))
d = ImageDraw.Draw(pill)
d.rounded_rectangle((0, 0, pw - 1, ph - 1), radius=22 * S, fill=(253, 248, 246, 255))
szin = (125, 62, 72, 255)
try:
    from fontTools.ttLib import TTFont
    t = TTFont(BETU)
    t.flavor = None
    puf = io.BytesIO()
    t.save(puf)
    puf.seek(0)
    betu = ImageFont.truetype(puf, 30 * S)
    betu.set_variation_by_axes([700])
except ImportError:
    betu = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 28 * S)
szavak = ['Lapozz', 'jobbra']
szeles = [d.textbbox((0, 0), w, font=betu) for w in szavak]
szokoz = int(9 * S)                                   # a szavak kozotti ures hely
szoveg_w = sum(b[2] - b[0] for b in szeles) + szokoz
nyil_w, koz = 44 * S, 16 * S
teljes = szoveg_w + koz + nyil_w
sx = (pw - teljes) // 2
fent = min(b[1] for b in szeles)
lent = max(b[3] for b in szeles)
x = sx
for w, b in zip(szavak, szeles):
    d.text((x - b[0], (ph - (lent - fent)) // 2 - fent - 1 * S), w, font=betu, fill=szin)
    x += b[2] - b[0] + szokoz
# a nyil jobbra mutat: vonal + ket szar
ax0, ax1, ay = sx + szoveg_w + koz, sx + szoveg_w + koz + nyil_w, ph // 2
v = 3.6 * S
d.line((ax0, ay, ax1, ay), fill=szin, width=int(v))
d.line((ax1 - 15 * S, ay - 15 * S, ax1, ay), fill=szin, width=int(v))
d.line((ax1 - 15 * S, ay + 15 * S, ax1, ay), fill=szin, width=int(v))
for (cx, cy) in ((ax0, ay), (ax1, ay)):
    d.ellipse((cx - v / 2, cy - v / 2, cx + v / 2, cy + v / 2), fill=szin)
pill = pill.resize((px1 - px0, py1 - py0), Image.LANCZOS)
tiszta.paste(pill, (px0, py0), pill)
tiszta.save(CEL, 'WEBP', quality=88, method=6)
print(os.path.relpath(CEL, ROOT), os.path.getsize(CEL) // 1024, 'KB', 'dx =', dx)
