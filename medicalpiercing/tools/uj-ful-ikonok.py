# Az arlista-doboz fulikonjai (a tulajdonos kerese, 2026-10-16): GPT-vel rajzolt vonalas ful a piercing-ekszerekkel (1, 2, 3 db; a 4 piercing,
# ketten: ket ful, 2-2 ekszerrel). Forras: tools/kep-forras/ful-ikonok-gpt.webp (gpt-image-1.5, atlatszo hatter, 2x2-es lap: 1 / 2 / 3 / par).
# A part (jobb also negyed) nem a generalt kepbol vesszuk (ott a ket ful kozott hibas vonas van): a 2 ekszeres fulet tesszuk egymas melle ketszer.
#   python3 tools/uj-ful-ikonok.py   ->   assets/img/uj-ful-1.webp, uj-ful-2.webp, uj-ful-3.webp, uj-ful-2x2.webp
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
lap = Image.open(ROOT / 'tools/kep-forras/ful-ikonok-gpt.webp').convert('RGBA')
MAGAS = 128  # a lapon ~40 px magas, 3x-os kijelzon is eles


def negyed(x0, y0):
    q = lap.crop((x0, y0, x0 + 512, y0 + 512))
    return q.crop(q.getchannel('A').point(lambda a: 255 if a > 12 else 0).getbbox())


def ment(kep, nev):
    m = MAGAS / kep.height
    kep.resize((round(kep.width * m), MAGAS), Image.LANCZOS).save(ROOT / 'assets/img' / f'uj-ful-{nev}.webp', quality=92, method=6)


fulek = {'1': negyed(0, 0), '2': negyed(512, 0), '3': negyed(0, 512)}
# a harom ful egyforma magas legyen (a generalt lapon nehany px elteres van)
h = max(f.height for f in fulek.values())
for nev, f in fulek.items():
    vaszon = Image.new('RGBA', (f.width, h), (0, 0, 0, 0))
    vaszon.alpha_composite(f, (0, h - f.height))
    ment(vaszon, nev)
# par: ket 2 ekszeres ful egymas mellett (atfedes nelkul: a vonalas fulek atfedve keresztezik egymast)
f = fulek['2']
koz = round(f.width * 1.12)
par = Image.new('RGBA', (koz + f.width, f.height), (0, 0, 0, 0))
par.alpha_composite(f, (koz, 0))
par.alpha_composite(f, (0, 0))
ment(par, '2x2')
print('kesz: uj-ful-1/2/3/2x2.webp')
