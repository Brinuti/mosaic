"""WebP-valtozat a kiszolgalt kepekhez: assets/img/<nev>.jpg|png -> assets/img/<nev>.webp

    python3 tools/webp.py

A Wix is WebP-ben (85-os minoseggel) kuldi a kepeit; a klon eddig a JPG/PNG-t, ami kb. ketszer
akkora. A build (tools/gyorsitas.mjs) a lapok <img> cimkeiben a WebP-t hivatkozza, ha van
ilyen fajl; mashol (megosztasi kep, ikon) az eredeti marad. Csak akkor keszul WebP, ha
legalabb 10%-kal kisebb; a mar meglevo, frissebb WebP-t nem kesziti ujra. Az atlatszosag megmarad.
A tools/kepek-kicsinyites.py utan kell futtatni.
"""
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPPA = os.path.join(ROOT, 'assets/img')
MINOSEG = 85


def atalakit(nev):
    be = os.path.join(MAPPA, nev)
    ki = os.path.join(MAPPA, os.path.splitext(nev)[0] + '.webp')
    if os.path.exists(ki) and os.path.getmtime(ki) >= os.path.getmtime(be):
        return nev, 'mar kesz', 0, 0
    try:
        with Image.open(be) as im:
            if getattr(im, 'n_frames', 1) > 1:
                return nev, 'animalt', 0, 0
            im.load()
            atlatszo = im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)
            im = im.convert('RGBA' if atlatszo else 'RGB')
            ideiglenes = ki + '.tmp'
            im.save(ideiglenes, 'WEBP', quality=MINOSEG, method=6, alpha_quality=100)
    except Exception as e:  # serult vagy ismeretlen formatumu fajl: marad az eredeti
        return nev, f'hiba: {e}', 0, 0
    eredeti, uj = os.path.getsize(be), os.path.getsize(ideiglenes)
    if uj > eredeti * 0.9:
        os.remove(ideiglenes)
        if os.path.exists(ki):
            os.remove(ki)
        return nev, 'nem eri meg', eredeti, eredeti
    os.replace(ideiglenes, ki)
    return nev, 'kesz', eredeti, uj


if __name__ == '__main__':
    nevek = sorted(f for f in os.listdir(MAPPA) if f.lower().endswith(('.jpg', '.jpeg', '.png')))
    # azonos alapnevu (pl. x.jpg es x.png) fajloknal a WebP-nev utkozne: ezek kimaradnak
    alap = {}
    for n in nevek:
        alap.setdefault(os.path.splitext(n)[0], []).append(n)
    nevek = [n for n in nevek if len(alap[os.path.splitext(n)[0]]) == 1]
    osszes_be = osszes_ki = db = 0
    with ProcessPoolExecutor() as ex:
        for nev, allapot, e, u in ex.map(atalakit, nevek, chunksize=8):
            if allapot == 'kesz':
                db += 1
                osszes_be += e
                osszes_ki += u
            elif allapot.startswith('hiba'):
                print(f'  ! {nev}: {allapot}', file=sys.stderr)
    print(f'webp: {db} uj kep, {osszes_be / 1e6:.1f} MB -> {osszes_ki / 1e6:.1f} MB')
