#!/usr/bin/env python3
"""A szolgaltatas-ikonok szetvagasa az AI-val generalt ikonlapokbol (OpenAI kepgeneralas; a generalas leirasa: docs/ATADAS.md).

  python3 tools/ikon-vagas.py <A-lap.png> <B-lap.png> <C-lap.png>      ->  assets/img/ikon/<kod>.webp  (96x96, atlatszo hatter)

A lapok 3 oszlop x 2 sor racsban vannak (atlatszo hatterrel). Minden cellabol kivagja az ikont, negyzetre igazitja, es egysegesiti a szineket
(sotetkek #454659, kiemeles #ab6354, feher gyuru), hogy a 12 ikon egy csomagnak latszon. A nyers lapok (~2 MB) nem kerulnek a repoba.
Kodok: mi migren, sh shenmen, kl klimax, sl slim, al allergia, mj maj, vb vastagbel, lp lep, pm pajzsmirigy, divat fulbevalo, akcio akcios csomag, ketto ket szemely.
"""
import sys, os
from PIL import Image

NAVY, ACCENT = (0x45, 0x46, 0x59), (0xAB, 0x63, 0x54)
MERET, MARGO = 96, 6
KI = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'img', 'ikon')

def egysegesit(im):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 8: px[x, y] = (0, 0, 0, 0); continue
            luma = 0.3 * r + 0.59 * g + 0.11 * b
            if luma > 205 and max(r, g, b) - min(r, g, b) < 40: px[x, y] = (255, 255, 255, a)
            elif r - b > 35: px[x, y] = ACCENT + (a,)
            else: px[x, y] = NAVY + (a,)
    return im

def cella(lap, oszlop, sor):
    w, h = lap.size
    k = 24  # a cellahatarokon halvany racsvonalak lehetnek (a B / C lapon): a szelso sav levagva (az ikonok mellett >=15% ures margo van)
    c = lap.crop((oszlop * w // 3 + k, sor * h // 2 + k, (oszlop + 1) * w // 3 - k, (sor + 1) * h // 2 - k))
    a = c.getchannel('A').point(lambda v: 255 if v > 40 else 0)  # a halvany racsvonalak / zaj kiesnek
    bb = a.getbbox()
    if not bb: raise SystemExit('ures cella')
    c = c.crop(bb)
    s = max(c.size)
    ker = Image.new('RGBA', (s, s), (0, 0, 0, 0)); ker.paste(c, ((s - c.width) // 2, (s - c.height) // 2))
    ker = ker.resize((MERET - 2 * MARGO, MERET - 2 * MARGO), Image.LANCZOS)
    kimenet = Image.new('RGBA', (MERET, MERET), (0, 0, 0, 0)); kimenet.paste(ker, (MARGO, MARGO))
    return egysegesit(kimenet)

# (lap-index, oszlop, sor, kod)
TERV = [(0, 0, 0, 'mi'), (0, 1, 0, 'sh'), (0, 2, 0, 'kl'), (0, 0, 1, 'sl'), (0, 1, 1, 'al'), (0, 2, 1, 'mj'),
        (1, 0, 0, 'vb'), (1, 1, 0, 'lp'), (1, 0, 1, 'divat'), (1, 1, 1, 'akcio'), (1, 2, 1, 'ketto'),
        (2, 0, 0, 'pm')]
lapok = [Image.open(p).convert('RGBA') for p in sys.argv[1:4]]
os.makedirs(KI, exist_ok=True)
for li, o, s, kod in TERV:
    im = cella(lapok[li], o, s)
    ut = os.path.join(KI, kod + '.webp')
    im.save(ut, 'WEBP', quality=92, method=6)
    print(kod, os.path.getsize(ut), 'B')
