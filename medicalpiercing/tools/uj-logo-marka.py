#!/usr/bin/env python3
"""A logo jelmondat nelkul (a TikTok-landolohoz, a tulajdonos kerese, 2026-10-16: a landolon semmi orvosi kifejezes, igy az
"EU szakembertol!" jelmondat sem): a jel + a "Medical Piercing" nev egy sorban, atlatszo hatterrel.
Forras: assets/img/uj-logo.webp es uj-logo-feher.webp (tools/uj-fooldal-kepek.py kimenete).
Kimenet: assets/img/uj-logo-marka.webp, uj-logo-marka-feher.webp.  Futtatas: python3 tools/uj-logo-marka.py"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'assets/img')

def futasok(maszk):
    ki, s = [], None
    for x, v in enumerate(maszk):
        if v and s is None: s = x
        if not v and s is not None: ki.append((s, x - 1)); s = None
    if s is not None: ki.append((s, len(maszk) - 1))
    return ki

def marka(forras, nev, jel_mag=64, hezag=10, ker=3):
    im = Image.open(os.path.join(IMG, forras)).convert('RGBA')
    a = np.array(im)[:, :, 3] > 40
    oszl = futasok(a.any(0))
    jel_x = oszl[0]                                    # a kor alaku jel (bal szelso osszefuggo resz)
    szoveg_x0 = oszl[1][0]
    sorok = futasok(a[:, szoveg_x0:].any(1))
    nev_y = sorok[0]                                   # az elso szovegsor: "Medical Piercing" (alatta a jelmondat ket sora)
    ys = np.nonzero(a[:, jel_x[0]:jel_x[1] + 1].any(1))[0]
    jel = im.crop((jel_x[0], ys.min(), jel_x[1] + 1, ys.max() + 1))
    jel = jel.resize((round(jel.width * jel_mag / jel.height), jel_mag), Image.LANCZOS)
    szoveg = im.crop((szoveg_x0, nev_y[0], oszl[-1][1] + 1, nev_y[1] + 1))
    w = ker + jel.width + hezag + szoveg.width + ker
    h = ker + jel_mag + ker
    ki = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ki.alpha_composite(jel, (ker, ker))
    ki.alpha_composite(szoveg, (ker + jel.width + hezag, (h - szoveg.height) // 2))
    ki.save(os.path.join(IMG, nev + '.webp'), 'WEBP', quality=92, method=6)
    print(nev, ki.size)

marka('uj-logo.webp', 'uj-logo-marka')
marka('uj-logo-feher.webp', 'uj-logo-marka-feher')
