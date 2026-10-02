# Mobilra kisebb kepvaltozatok: assets/img/<nev> -> assets/img/m/<nev>
#
# A mobil oldalak (dist/_m) es a klon.js mobilon az assets/img/m/ mappabol
# kerik a kepeket. Ide csak azok kerulnek, amelyeknek a kicsinyitett valtozata
# erdemben kisebb; a tobbit a netlify-build.mjs masolja be valtozatlanul.
# Uj kep utan futtasd ujra (Pillow kell hozza):
#
#   python3 tools/mobil-kepek.py
import io
import os
from PIL import Image, ImageOps

Image.MAX_IMAGE_PIXELS = None
GYOKER = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FORRAS = os.path.join(GYOKER, 'assets', 'img')
CEL = os.path.join(FORRAS, 'm')
SZELES = 1000      # 390 px-es kepernyon 2,5x-es pixelsuruseghez is eleg
MAGAS = 2000
os.makedirs(CEL, exist_ok=True)

uj = kihagy = 0
elotte = utana = 0
for nev in sorted(os.listdir(FORRAS)):
    ut = os.path.join(FORRAS, nev)
    if not os.path.isfile(ut) or not nev.lower().endswith(('.jpg', '.jpeg', '.png')):
        continue
    cel = os.path.join(CEL, nev)
    if os.path.exists(cel) and os.path.getmtime(cel) >= os.path.getmtime(ut):
        continue
    meret = os.path.getsize(ut)
    try:
        kep = Image.open(ut)
        if getattr(kep, 'is_animated', False):
            continue
        formatum = kep.format
        kep = ImageOps.exif_transpose(kep)
    except Exception:
        continue
    if kep.width <= SZELES and kep.height <= MAGAS and meret < 120 * 1024:
        kihagy += 1
        continue
    kep.thumbnail((SZELES, MAGAS), Image.LANCZOS)
    puffer = io.BytesIO()
    if formatum == 'JPEG' or nev.lower().endswith(('.jpg', '.jpeg')):
        kep.convert('RGB').save(puffer, 'JPEG', quality=78, optimize=True, progressive=True)
    else:
        if kep.mode == 'P':
            kep = kep.convert('RGBA')
        kep.save(puffer, 'PNG', optimize=True)
    if puffer.tell() < meret * 0.9:
        with open(cel, 'wb') as f:
            f.write(puffer.getvalue())
        uj += 1
        elotte += meret
        utana += puffer.tell()
    else:
        kihagy += 1
print(f'{uj} uj mobilkep ({elotte / 1048576:.1f} MB -> {utana / 1048576:.1f} MB), {kihagy} kihagyva (eleg kicsi)')
