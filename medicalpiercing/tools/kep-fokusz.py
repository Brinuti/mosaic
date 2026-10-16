#!/usr/bin/env python3
"""Arc-fokusz a levagott (object-fit: cover) kepekhez (a tulajdonos kerese, 2026-10-16: "ahol mobilon osszenyomsz egy szekciot, ugy vagd be a kepet, hogy ne logjon ki arc meg fej").

Bemenet: a levagott kepek listaja (JSON, a tools/_vagas-gyujt.mjs-szeru Playwright-bejaras kimenete: [{src, ...}]) vagy kepek utvonalai.
Kimenet: uj-oldalak/kep-fokusz.json  {"/assets/img/<kep>": "X% Y%"}  -> a tools/uj-fooldal.mjs (oldalKiir) object-positionkent irja a kepre.
Arcfelismeres: OpenCV FaceDetectorYN (YuNet, opencv_zoo face_detection_yunet_2023mar.onnx; a modell nincs a repoban, --modell <ut>).
A pozicio: a fo arcok (a legnagyobb, es ami legalabb 45%-a akkora; homlokkal, hajjal kibovitett) befoglalo teglalapja a kivagasban aranyosan kozepen: p = elotte / (elotte + utana)
(igy barmilyen doboz-aranynal benne marad, ha a doboz nagyobb a teglalapnal). Arc nelkuli kepnel nincs bejegyzes (marad a CSS-ben megadott pozicio).
Futtatas: python3 tools/kep-fokusz.py --modell yunet.onnx <vagott.json | kep ...>   (pip install opencv-python-headless)"""
import json, os, sys
import cv2, numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CEL = os.path.join(ROOT, 'uj-oldalak', 'kep-fokusz.json')
args = sys.argv[1:]
modell = args[args.index('--modell') + 1]; args = [a for i, a in enumerate(args) if a != '--modell' and (i == 0 or args[i - 1] != '--modell')]
srcek = []
for a in args:
    if a.endswith('.json'): srcek += [x['src'] for x in json.load(open(a))]
    else: srcek.append(a)
d = cv2.FaceDetectorYN.create(modell, '', (320, 320), 0.8, 0.3, 5000)   # 0,8 alatt a fulfotok fuleit is arcnak veszi
ki = json.load(open(CEL)) if os.path.exists(CEL) else {}
for src in sorted(set(s for s in srcek if s.startswith('/assets/img/'))):
    fajl = os.path.join(ROOT, src.lstrip('/'))
    img = cv2.imread(fajl)
    if img is None: print('nem olvashato:', src); continue
    h, w = img.shape[:2]
    k = 1280 / max(w, h) if max(w, h) > 1280 else 1.0
    kis = cv2.resize(img, (round(w * k), round(h * k))) if k != 1.0 else img
    d.setInputSize((kis.shape[1], kis.shape[0]))
    _, arcok = d.detect(kis)
    if arcok is None or not len(arcok):
        ki.pop(src, None); continue
    # a kis (a kep 1,2%-anal kisebb) talalatok zajnak szamitanak
    arcok = [a for a in arcok if a[3] / k >= 0.012 * h]
    if not arcok: ki.pop(src, None); continue
    # csoportkepen a fo szereplok: a legnagyobb arc, es ami legalabb 45%-a akkora (a hatterben levo apro arcok nem huzzak el a kivagast)
    nagy = max(a[3] for a in arcok)
    arcok = [a for a in arcok if a[3] >= 0.45 * nagy]
    x0 = min(a[0] for a in arcok) / k; y0 = min(a[1] for a in arcok) / k
    x1 = max(a[0] + a[2] for a in arcok) / k; y1 = max(a[1] + a[3] for a in arcok) / k
    fm = max(a[3] for a in arcok) / k
    # homlok + haj felul, egy kis vall alul, oldalt egy kis levego
    x0, x1 = max(0, x0 - 0.15 * fm), min(w, x1 + 0.15 * fm)
    y0, y1 = max(0, y0 - 0.45 * fm), min(h, y1 + 0.25 * fm)
    px = x0 / max(1e-6, x0 + (w - x1)); py = y0 / max(1e-6, y0 + (h - y1))
    ki[src] = f'{round(px * 100)}% {round(py * 100)}%'
    print(f'{src}: {len(arcok)} arc -> {ki[src]}')
json.dump(dict(sorted(ki.items())), open(CEL, 'w'), ensure_ascii=False, indent=1)
print('kiirva:', CEL, len(ki), 'kep')
