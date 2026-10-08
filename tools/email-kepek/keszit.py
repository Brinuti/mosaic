#!/usr/bin/env python3
# E-mail-kepek keszitese az oldal meglevo kepeibol (assets/img/...): meretre vagas, atmeretezes, JPEG-optimalizalas, opcionalisan lejatszo-jel a video-elonezetekre.
#
#   python3 -I tools/email-kepek/keszit.py                 # az osszes tools/email-kepek/lista-*.json
#   python3 -I tools/email-kepek/keszit.py lista-pmu.json  # egy lista
#
# lista-<uzletag>.json:
#   { "kepek": [ { "ki": "pmu/melitta-portre.jpg", "forras": "assets/img/melitta-portre.jpg", "mod": "szeles|negyzet|kepek",
#                  "arany": [3, 2], "fokusz": [0.5, 0.4], "szelesseg": 1088, "lejatszo": false } ] }
#   mod: szeles  = egesz levelszeles kep (kep / video blokk), alap szelesseg 1088 (a 544 px-es hely 2x-e), alap arany 3:2
#        kepek   = 2-3 db egymas melletti kep (kepek blokk), alap szelesseg 540, alap arany 1:1
#        negyzet = kerek portre (szemely blokk), alap szelesseg 232 (a 116 px-es hely 2x-e), 1:1
#   fokusz: a kivagas kozeppontja a forraskep aranyaban (0..1, alap [0.5, 0.5])
#   lejatszo: true = a kep kozepere "lejatszas" jel kerul (video-elonezet; a levelben a kep a videora vezet)
#   kocka: { "video": "assets/video/x.mp4", "ido": 1.0 } = a forras egy videokocka (ffmpeg kell: PATH-on vagy az FFMPEG kornyezeti valtozoban) a "forras" helyett
#   arany [9, 16] + szelesseg: allo (portre) video-elonezet; a katalogusban a blokk "szelesseg" mezoje a megjelenitesi szelesseg (a kep >= 1,6-szerese legyen)
# A kimenet: assets/email/<ki>; a levelek a katalogusban a "ki" nevvel hivatkoznak ra. Kepenkent legfeljebb 240 KB (a katalogus-teszt 260 KB-ot enged).
import json, os, sys, glob, subprocess, tempfile
from PIL import Image, ImageDraw

GYOKER = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MOD = {'szeles': (1088, (3, 2)), 'kepek': (540, (1, 1)), 'negyzet': (232, (1, 1))}
MAX_BAJT = 240 * 1024

def vag(im, arany, fokusz):
    w, h = im.size
    cel = arany[0] / arany[1]
    if w / h > cel:
        nw = round(h * cel); x0 = round((w - nw) * fokusz[0]); return im.crop((x0, 0, x0 + nw, h))
    nh = round(w / cel); y0 = round((h - nh) * fokusz[1]); return im.crop((0, y0, w, y0 + nh))

def lejatszo(im):
    w, h = im.size
    d = min(w, h) * 0.24
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    dr = ImageDraw.Draw(ov)
    cx, cy = w / 2, h / 2
    dr.ellipse((cx - d / 2, cy - d / 2, cx + d / 2, cy + d / 2), fill=(15, 58, 60, 175), outline=(255, 255, 255, 235), width=max(3, round(d * 0.045)))
    t = d * 0.2
    dr.polygon([(cx - t * 0.7, cy - t), (cx - t * 0.7, cy + t), (cx + t * 1.05, cy)], fill=(255, 255, 255, 240))
    return Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB')

def keszit(tetel):
    mod = tetel.get('mod', 'szeles')
    szeles, arany = MOD[mod]
    szeles = tetel.get('szelesseg', szeles); arany = tuple(tetel.get('arany', arany))
    if tetel.get('kocka'):
        k = tetel['kocka']; tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False); tmp.close()
        subprocess.run([os.environ.get('FFMPEG', 'ffmpeg'), '-y', '-loglevel', 'error', '-ss', str(k.get('ido', 0)), '-i', os.path.join(GYOKER, k['video']), '-frames:v', '1', tmp.name], check=True)
        im = Image.open(tmp.name); im.load(); os.unlink(tmp.name); tetel = {**tetel, 'forras': k['video'] + f" @{k.get('ido', 0)}s"}
    else:
        if not os.path.exists(os.path.join(GYOKER, tetel['forras'])):
            print(f"{tetel['ki']:48s} kihagyva: a forras nincs a repoban ({tetel['forras']}; Drive-kep, lasd a README-t)"); return
        im = Image.open(os.path.join(GYOKER, tetel['forras']))
    if im.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', im.size, (255, 255, 255)); im = im.convert('RGBA'); bg.paste(im, mask=im.split()[-1]); im = bg
    else:
        im = im.convert('RGB')
    im = vag(im, arany, tetel.get('fokusz', [0.5, 0.5]))
    if im.size[0] > szeles:
        im = im.resize((szeles, round(szeles * im.size[1] / im.size[0])), Image.LANCZOS)
    if tetel.get('lejatszo'): im = lejatszo(im)
    ki = os.path.join(GYOKER, 'assets', 'email', tetel['ki'])
    os.makedirs(os.path.dirname(ki), exist_ok=True)
    for q in (84, 80, 76, 72, 68, 64, 60):
        im.save(ki, 'JPEG', quality=q, optimize=True, progressive=True)
        if os.path.getsize(ki) <= MAX_BAJT: break
    print(f"{tetel['ki']:48s} {im.size[0]}x{im.size[1]}  {os.path.getsize(ki) // 1024} KB  q{q}  <- {tetel['forras']}")

utak = [os.path.join(os.path.dirname(os.path.abspath(__file__)), a) for a in sys.argv[1:]] or sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lista-*.json')))
for ut in utak:
    for t in json.load(open(ut, encoding='utf-8'))['kepek']: keszit(t)
