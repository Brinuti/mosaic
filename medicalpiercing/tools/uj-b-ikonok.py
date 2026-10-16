# A "B" kategoria-oldalak "Miert a Medical Piercinget valaszd?" ikonjai (az eredeti oldal 9 ikonja) a fooldal palettajaban:
# a rozsaszin / lazac szin a fooldal palaszurke-kekes arnyalatara cserelodik (a rozsaszin csak a gomboke), az atlatszosag es a rajz valtozatlan.
# Futtatas: python3 tools/uj-b-ikonok.py  (a medicalpiercing/ mappabol) -> assets/img/uj-biz-<hash8>.webp
# A kategoria.mjs a /assets/img/<elotag>_<hash>.webp ikonok helyett az uj-biz-<hash 8 karakter>.webp-t hasznalja, ha letezik.
import glob, json, os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
HUE = 237 / 360.0        # a --slate (#454659) arnyalata
FORRAS = set()
for f in glob.glob(os.path.join(ROOT, 'uj-oldalak/tartalom/*-piercing-b.json')):
    def jar(n):
        # csak az ikon-racs ("Miert a Medical Piercinget valaszd?"): kis (<= 110 px) kepek, a varos- es csapatfotok nem
        if n.get('t') == 'racs':
            for v in n['k']:
                for x in v.get('k', []):
                    if x.get('t') == 'kep' and (x.get('w') or 999) <= 110 and (x.get('nw') or 0) <= 400:
                        FORRAS.add(x['src'])
        for x in n.get('k', []):
            jar(x)
    for sz in json.load(open(f, encoding='utf8'))['szekciok']:
        jar(sz['fa'])

for src in sorted(FORRAS):
    p = os.path.join(ROOT, src.lstrip('/'))
    nev = os.path.basename(p)
    hash8 = nev.split('_', 1)[1][:8]
    im = Image.open(p).convert('RGBA')
    a = im.getchannel('A')
    hsv = np.asarray(im.convert('RGB').convert('HSV')).astype(float)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    h[:] = HUE * 255
    w = np.clip(s / 90.0, 0, 1)                 # a telitett (rozsaszin) pixelek sulya; a feher rajz nem valtozik
    s[:] = np.minimum(s * 0.34, 78)             # visszafogott telitettseg: palaszurke
    v[:] = v * (1 - 0.42 * w)                   # a --slate sotetsege: a feher rajz jol latszik rajta
    rgb = Image.fromarray(np.stack([h, s, v], axis=-1).astype('uint8'), 'HSV').convert('RGB')
    rgb.putalpha(a)
    ki = os.path.join(ROOT, 'assets/img', f'uj-biz-{hash8}.webp')
    rgb.save(ki, 'WEBP', quality=88, method=6)
    print(os.path.relpath(ki, ROOT), os.path.getsize(ki) // 1024, 'KB')
