"""A persona-oldalak (ajandek-landing variansok) hero-videoi: rovid, hang nelkuli, ismetlodo klipek a MOSAIC MEGLEVO felvetelebol.

Csak az ujrafuthatosag miatt van a repoban: az eredmeny (assets/video/ajandek-hero-*.mp4 + assets/img/ajandek/hero-*.jpg) be van commitolva,
a build nem hasznalja. Egy uj / mas persona-videohoz ezt a fajlt kell bovitni (HEROK), majd futtatni.

  pip install av          (PyAV: beepitett ffmpeg, H.264 dekodolas + libx264 kodolas; ffmpeg a gepen nem kell)
  python3 -I tools/ajandek-variansok/hero-videok.py [kulcs ...]      (alapbol mind; PYAV_UTVONAL = ahol a PyAV van, ha nem a rendszer-site-packages)

Mit csinal: a szegmensekbol (video-szakasz vagy allokep lassu nagyitassal) 720x720-as (1:1), 24 fps, hang nelkuli klipet rak ossze
(a 16:9 / allo forrasbol kozep-kivagas, a "x" / "y" a kivagas kozeppontja), a szegmensek kozott 0,5 mp-es keresztatuntetes, a vegen
a hurok varratat is elfedi (az utolso szakasz atuszik a kezdetbe). H.264 (libx264), yuv420p, faststart. A poszterkep (JPEG) a klip elso kockaja.
A forrasokat (VIDEOK.md, ajandek-adat.js ELEMEK / HEADSPA_VIDEO) a MOSAIC mar publikalt felvetelei adjak; a feliratos / arazott hirdetes-videok nincsenek hasznalva.
"""
import os
import sys

if os.environ.get('PYAV_UTVONAL'):
    sys.path.insert(0, os.environ['PYAV_UTVONAL'])
import av
import numpy as np
from PIL import Image

GYOKER = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
VIDEO = os.path.join(GYOKER, 'assets', 'video')
KEP = os.path.join(GYOKER, 'assets', 'img')
MERET = 720
FPS = 24
ATTUNES = 12      # a szegmensek kozotti keresztatuntetes (kocka) = 0,5 mp
HUROK = 14        # a hurok-varrat elfedese (kocka)
CRF = '28'

# Forrasok (assets/video, assets/img):
HS = 'ajandek-headspa.mp4'                                      # "szoveg nelkul.mp4" (640x640, 0:57): az egesz kezeles, felirat nelkul
GAL_HAJMOSAS = 'c2eb0f_a772c9222aa949a0888a4aa2298ef0b5.mp4'    # "Fejmasszazs eszkozokkel" galeria-klip (meleg, gyertyafenyes hajmosas)
GAL_KOR = 'c2eb0f_c68f720ea07c4cc6b19dd56b1ab51f35.mp4'         # "Korvizsugaras vizterapia": az arany hajmoso-iv, fenygyuruk
GAL_ROZSA = 'c2eb0f_95f0e62128e946b98eff0a6adda4c14c.mp4'       # "Rozsakvarc fejborfesu" (gyertyak a hatterben)
GAL_DEKOLT = 'c2eb0f_cefa94f02ca34e3388845e308afc24f7.mp4'      # "Dekoltazs masszazs" (arany iv, meleg fenyek)
GAL_NYAK = 'c2eb0f_c02456fd01664cb59eb593266e0a8279.mp4'        # "Nyakmasszazs" (sotet, lagy fenyek)
GAL_ARCPAKOLAS = 'c2eb0f_4b543396abd34dcc92dfe594049c8a78.mp4'  # "Szemelyre kikevert arcpakolas"
KARTYA_KEP = 'c2eb0f_159a37af224544a5ad517896a34f9a0a.jpg'     # a MOSAIC "HEADSPA KEZELES AJANDEKKARTYA" boriteka (foto, 1000x1000)
IV_FOTO = 'ajandek/galeria-06.jpg'                              # a hajmoso-iv hatulrol (profi foto, 1200x1042)
ARANYIV_FOTO = 'ajandek/hero.jpg'                               # nyugodt no az arany iv alatt (profi foto, 2000x1333)

# szegmens: ('video', fajl, t0, t1, {x, y, zoom}) vagy ('kep', fajl, hossz_mp, {zoom: (ettol, eddig), x, y})
HEROK = {
    # szulinap: az ajandekkartya (boritek) -> gyertyafenyes kezeles: az unnepelt kenyeztetese
    'szulinap': [
        ('kep', KARTYA_KEP, 3.6, {'zoom': (1.0, 1.08), 'x': 0.5, 'y': 0.5}),
        ('video', GAL_HAJMOSAS, 0.4, 5.6, {'x': 0.42}),
        ('video', GAL_ROZSA, 1.4, 6.0, {'x': 0.55}),
    ],
    # japan: a hires korvizsugaras (arany iv) vizterapia
    'japan': [
        ('kep', IV_FOTO, 3.4, {'zoom': (1.0, 1.10), 'x': 0.5, 'y': 0.5}),
        ('video', GAL_KOR, 26.6, 31.0, {'x': 0.5}),
        ('video', HS, 41.6, 44.6, {}),
    ],
    # ezo: csend, lagy fenyek, a kezelo rahangolodasa, fenygyuru
    'ezo': [
        ('video', HS, 7.4, 9.0, {}),
        ('video', HS, 11.6, 13.3, {}),
        ('video', HS, 18.0, 20.0, {}),
        ('video', GAL_KOR, 21.0, 24.8, {'x': 0.45}),
    ],
    # noknek: nyugodt no, arc- / nyakmasszazs (neki jar a torodes)
    'noknek': [
        ('kep', ARANYIV_FOTO, 3.0, {'zoom': (1.0, 1.08), 'x': 0.6, 'y': 0.45}),
        ('video', HS, 34.3, 38.0, {}),
        ('video', HS, 46.2, 49.4, {}),
    ],
    # selfcare: lassu, lagy, "csak te" pillanatok
    'selfcare': [
        ('video', GAL_ARCPAKOLAS, 1.2, 5.8, {'x': 0.5}),
        ('video', GAL_DEKOLT, 0.3, 6.4, {'x': 0.45}),
        ('video', GAL_NYAK, 0.5, 6.3, {'x': 0.5}),
    ],
    # fiatalok: mentalis reset (hajmosas, fejmasszazs) -> glow up (a szaritas utani fodrok)
    'fiatalok': [
        ('video', HS, 24.4, 27.0, {}),
        ('video', HS, 39.3, 41.4, {}),
        ('video', HS, 52.0, 56.9, {}),
    ],
}


# a poszterkep alapbol a klip elso kockaja; ahol egy kesobbi kocka a szebb (a poszter az LCP-kep es a "csendes mozgas" nezet), itt a masodperce
POSZTER_MP = {'fiatalok': 6.4}   # a kesz, hullamos haj (glow up)


def kocka_kivag(arr, x=0.5, y=0.5, zoom=1.0):
    """Egy kocka negyzetes kivagasa (kozeppont: x, y a kep szelessegenek / magassaganak aranyaban) es MERET x MERET-re meretezese."""
    h, w = arr.shape[:2]
    oldal = min(w, h) / zoom
    x0 = min(max(x * w - oldal / 2, 0), w - oldal)
    y0 = min(max(y * h - oldal / 2, 0), h - oldal)
    kep = Image.fromarray(arr).crop((round(x0), round(y0), round(x0 + oldal), round(y0 + oldal)))
    return np.asarray(kep.resize((MERET, MERET), Image.LANCZOS))


def video_szakasz(fajl, t0, t1, x=0.5, y=0.5, zoom=1.0):
    c = av.open(os.path.join(VIDEO, fajl))
    v = c.streams.video[0]
    c.seek(int(max(0, t0 - 2) * 1e6), backward=True, any_frame=False)
    kockak = []
    for fr in c.decode(video=0):
        t = float(fr.pts * v.time_base)
        if t < t0 - 0.2:
            continue
        if t > t1 + 0.2:
            break
        kockak.append((t, kocka_kivag(fr.to_ndarray(format='rgb24'), x, y, zoom)))
    c.close()
    ki = []
    for k in range(int(round((t1 - t0) * FPS))):
        cel = t0 + k / FPS
        elozo = [a for t, a in kockak if t <= cel + 1e-3]
        ki.append((elozo[-1] if elozo else kockak[0][1]))
    return ki


def allokep_szakasz(fajl, hossz, zoom=(1.0, 1.08), x=0.5, y=0.5):
    arr = np.asarray(Image.open(os.path.join(KEP, fajl)).convert('RGB'))
    n = int(round(hossz * FPS))
    return [kocka_kivag(arr, x, y, zoom[0] + (zoom[1] - zoom[0]) * i / max(1, n - 1)) for i in range(n)]


def keveres(a, b, w):
    return (a.astype(np.float32) * (1 - w) + b.astype(np.float32) * w + 0.5).astype(np.uint8)


def osszefuz(szakaszok, n=ATTUNES):
    ki = list(szakaszok[0])
    for kov in szakaszok[1:]:
        for i in range(n):
            ki[len(ki) - n + i] = keveres(ki[len(ki) - n + i], kov[i], (i + 1) / (n + 1))
        ki.extend(kov[n:])
    return ki


def hurkol(kockak, n=HUROK):
    """A klip kezdete utan indul, a vege atuszik a kezdetbe: a ketszeres lejatszas varrata nem latszik."""
    L = len(kockak)
    kozep = kockak[n:L - n]
    veg = [keveres(kockak[L - n + j], kockak[j], (j + 1) / (n + 1)) for j in range(n)]
    return kozep + veg


def ir(kockak, ut):
    ki = av.open(ut, 'w', options={'movflags': '+faststart'})
    s = ki.add_stream('libx264', rate=FPS)
    s.width = s.height = MERET
    s.pix_fmt = 'yuv420p'
    s.options = {'crf': CRF, 'preset': 'slow', 'profile': 'high', 'g': str(FPS * 2)}
    for a in kockak:
        for p in s.encode(av.VideoFrame.from_ndarray(a, format='rgb24')):
            ki.mux(p)
    for p in s.encode():
        ki.mux(p)
    ki.close()


def keszit(kulcs):
    szakaszok = []
    for sz in HEROK[kulcs]:
        if sz[0] == 'kep':
            szakaszok.append(allokep_szakasz(sz[1], sz[2], **sz[3]))
        else:
            szakaszok.append(video_szakasz(sz[1], sz[2], sz[3], **sz[4]))
    kockak = hurkol(osszefuz(szakaszok))
    nev = 'ajandek-hero-' + kulcs
    ir(kockak, os.path.join(VIDEO, nev + '.mp4'))
    poszter = os.path.join(KEP, 'ajandek', 'hero-' + kulcs + '.jpg')
    Image.fromarray(kockak[min(len(kockak) - 1, int(POSZTER_MP.get(kulcs, 0) * FPS))]).save(poszter, quality=80, optimize=True, progressive=True)
    print(kulcs, len(kockak), 'kocka', round(len(kockak) / FPS, 1), 'mp;', round(os.path.getsize(os.path.join(VIDEO, nev + '.mp4')) / 1e6, 2), 'MB;',
          round(os.path.getsize(poszter) / 1e3), 'KB poszter')


if __name__ == '__main__':
    for k in (sys.argv[1:] or list(HEROK)):
        keszit(k)
