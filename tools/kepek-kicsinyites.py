# A kepfajlok kicsinyitese a tenyleges megjelenitesi meretukre (2x-es
# pixelsuruseggel), a tools/kepmeretek.json meresei alapjan
# (tools/kepmeret-meres.mjs). Ugyanaz, amit a Wix tett: a latogato nem kap
# nagyobb kepet, mint ami a kepernyon kell - igy kevesebb a letoltott adat.
#
#   python3 tools/kepek-kicsinyites.py          (Pillow kell hozza)
#
# - csak a megmert kepekhez nyul; a galeriak (galeriak.js) es a PMU-foglalo
#   kepeit kihagyja, mert azok nagyitva is megjelennek;
# - a mobil oldalak a dist/assets/img/m/ mappabol kerik a kepet: ha ott sajat
#   valtozat van (assets/img/m/), azt meretezi, kulonben az asztali fajlt, a ket
#   nezet nagyobbik igenye szerint;
# - csak akkor irja felul a fajlt, ha legalabb 10%-kal kisebb lesz.
# Az eredeti kepek a git-tortenetben (es a Wix CDN-en) megmaradnak.
import io
import json
import os
import re
from PIL import Image

GYOKER = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
IMG = os.path.join(GYOKER, 'assets', 'img')
SURUSEG = 2.0
MINOSEG = 82

meres = json.load(open(os.path.join(GYOKER, 'tools', 'kepmeretek.json'), encoding='utf-8'))

kihagy = set()
for js in ('galeriak.js', 'foglalo-pmu.js'):
    szoveg = open(os.path.join(GYOKER, 'assets', 'js', js), encoding='utf-8').read()
    kihagy |= set(re.findall(r'[\w~.-]+\.(?:jpe?g|png|webp)', szoveg, re.I))

# fajl (assets/img-hez kepest) -> szukseges arany
igeny = {}
for kulcs, e in meres.items():
    if not e.get('nw') or not e.get('szuks'):
        continue
    nev = kulcs[2:] if kulcs.startswith('m/') else kulcs
    if nev in kihagy:
        continue
    if kulcs.startswith('m/') and os.path.exists(os.path.join(IMG, 'm', nev)):
        fajl = 'm/' + nev
    else:
        fajl = nev
    igeny[fajl] = max(igeny.get(fajl, 0), e['szuks'])

elotte = utana = db = 0
for fajl, szuks in sorted(igeny.items()):
    ut = os.path.join(IMG, fajl)
    if not os.path.isfile(ut) or not re.search(r'\.(jpe?g|png)$', fajl, re.I):
        continue
    arany = min(1.0, szuks * SURUSEG)
    meret = os.path.getsize(ut)
    with Image.open(ut) as kep:
        kep.load()
        formatum = kep.format
        w, h = kep.size
        uj_w, uj_h = max(1, round(w * arany)), max(1, round(h * arany))
        if (uj_w, uj_h) != (w, h):
            kep = kep.resize((uj_w, uj_h), Image.LANCZOS)
        buf = io.BytesIO()
        if formatum == 'PNG':
            kep.save(buf, 'PNG', optimize=True)
        else:
            if kep.mode not in ('RGB', 'L'):
                kep = kep.convert('RGB')
            kep.save(buf, 'JPEG', quality=MINOSEG, optimize=True, progressive=True)
    adat = buf.getvalue()
    if len(adat) <= meret * 0.9:
        open(ut, 'wb').write(adat)
        elotte += meret
        utana += len(adat)
        db += 1

print(f'{db} kep kicsinyitve: {elotte / 1048576:.1f} MB -> {utana / 1048576:.1f} MB')
