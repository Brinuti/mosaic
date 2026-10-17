# A feliratos abrak / szoveges kepek listaja, amelyek SOHA nem vagodhatnak le (a tulajdonos kerese, 2026-10-17: "ezek a kepek latszodjanak teljesen ...
# le van vagva"; pl. a pajzsmirigy / maj / lep / vastagbel abraja, a fulpontos abrak, a "Tragus / Shenmen / Klimax pont" cimkes fotok, a 93%-os blokk kepe,
# a varosnev-csempek). A build (tools/valaszado-kepek.mjs, teljesKepek) ezekre data-teljes jelet tesz: a kep egeszben latszik (object-fit: contain), a keret
# maradek savjat a kep sajat szelenek szine tolti ki (ezt szamolja ki ez a szkript a kep kulso keretenek mediansziniebol).
#   uj kep: a fajlnevet ird az uj-oldalak/teljes-kepek.json-ba (barmilyen ertekkel), majd: python3 tools/teljes-kepek.py
import os, json
from PIL import Image

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = os.path.join(R, 'uj-oldalak/teljes-kepek.json')
lista = json.load(open(P, encoding='utf8'))
ki = {}
for nev in sorted(lista):
    p = os.path.join(R, 'assets/img', nev)
    if not os.path.exists(p):
        print('nincs ilyen kep:', nev)
        continue
    im = Image.open(p).convert('RGB')
    w, h = im.size
    k = max(2, round(min(w, h) * 0.02))
    keret = [im.getpixel((x, y)) for x in range(0, w, max(1, w // 60)) for y in (*range(k), *range(h - k, h))]
    keret += [im.getpixel((x, y)) for y in range(0, h, max(1, h // 60)) for x in (*range(k), *range(w - k, w))]
    med = [sorted(c[i] for c in keret)[len(keret) // 2] for i in range(3)]
    ki[nev] = '#%02x%02x%02x' % tuple(med)
json.dump(ki, open(P, 'w', encoding='utf8'), ensure_ascii=False, indent=1, sort_keys=True)
print(f'{len(ki)} kep:', ', '.join(f'{k[:20]}={v}' for k, v in ki.items()))
