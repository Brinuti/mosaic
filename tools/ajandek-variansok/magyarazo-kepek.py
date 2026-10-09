"""A persona-oldalak magyarazo-szekcioinak ujra-vagott kepei (2026-10-09, 2. kor): egy-egy allokep a MOSAIC meglevo videoibol.

Csak az ujrafuthatosag miatt van a repoban: az eredmeny (assets/img/ajandek/magyarazo-*.jpg) be van commitolva, a build nem hasznalja.
A forras-videok NINCSENEK a repoban (nagyok): a Drive-rol kell egy mappaba tolteni (FORRAS_MAPPA), a fajlnevek alabb.

  pip install av          (PyAV: videodekodolas; ffmpeg a gepen nem kell)
  FORRAS_MAPPA=/ut/a/videokhoz python3 -I tools/ajandek-variansok/magyarazo-kepek.py [kimeneti-fajlnev ...]      (alapbol mind; PYAV_UTVONAL, ha a PyAV nem a rendszer-site-packages-ben van)

A vagas (x0, y0, x1, y1: a kocka szelessegenek / magassaganak aranyaban) mindig a beegetett felirat / ar / logo FELETTI savot tartja meg
(a 9:16-os hirdetesi videokban a felirat a kep also harmadaban van).
"""
import os
import sys

if os.environ.get('PYAV_UTVONAL'):
    sys.path.insert(0, os.environ['PYAV_UTVONAL'])
import av
from PIL import Image

GYOKER = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
KI = os.path.join(GYOKER, 'assets', 'img', 'ajandek')
MAPPA = os.environ.get('FORRAS_MAPPA', '.')
SZELES = 1000
MINOSEG = 82

# kimeneti fajl: (forras-video a FORRAS_MAPPA-ban, idopont mp, vagas)
KEPEK = {
    # csajos nap (friend): Drive "paros csajos erzelmes.mp4" (1080 x 1920): ket no karoltve a folyoson, furdolepedoben
    'magyarazo-csajos-ketto.jpg': ('paros csajos erzelmes.mp4', 17.53, (0.0, 0.19, 1.0, 0.70)),
    # anyukaknak (mother): Drive "Anya-lanya.MP4" (eredeti, 1080 x 1920): a lany beszel, az anya mosolyog (a hero ugyanebbol keszult, de mas kocka)
    'magyarazo-anya-lanya.jpg': ('Anya-lanya.MP4', 75.47, (0.02, 0.095, 1.0, 0.645)),
    # self-care (self_care): Drive "Self care headspa+ajikartya.mp4" (1080 x 1920): csukott szemmel pihenő arc az arany zuhanyiv alatt
    'magyarazo-selfcare-pihenes.jpg': ('Self care headspa+ajikartya.mp4', 5.2, (0.0, 0.06, 1.0, 0.66)),
}


def kocka(fajl, cel):
    """A cel idoponthoz legkozelebbi kocka (PIL kep)."""
    c = av.open(fajl)
    v = c.streams.video[0]
    c.seek(int(max(0, cel - 1.5) * 1e6), backward=True)
    legjobb = None
    for fr in c.decode(video=0):
        ts = float(fr.pts * v.time_base)
        d = abs(ts - cel)
        if legjobb is None or d < legjobb[0]:
            legjobb = (d, ts, fr.to_image())
        if ts > cel + 0.1:
            break
    c.close()
    return legjobb[1], legjobb[2]


def keszit(nev):
    forras, cel, vagas = KEPEK[nev]
    ts, im = kocka(os.path.join(MAPPA, forras), cel)
    w, h = im.size
    im = im.crop((round(vagas[0] * w), round(vagas[1] * h), round(vagas[2] * w), round(vagas[3] * h)))
    if im.width > SZELES:
        im = im.resize((SZELES, round(im.height * SZELES / im.width)), Image.LANCZOS)
    ut = os.path.join(KI, nev)
    im.save(ut, quality=MINOSEG, optimize=True, progressive=True)
    print(nev, 'kocka %.2f mp;' % ts, im.size, round(os.path.getsize(ut) / 1e3), 'KB')


if __name__ == '__main__':
    for n in (sys.argv[1:] or list(KEPEK)):
        keszit(n)
