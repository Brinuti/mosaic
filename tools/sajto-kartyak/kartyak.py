#!/usr/bin/env python3
"""A /head-spa-velemenyek 'Női lapok akik írtak rólunk' szekciójának generátora (a kártyák adata: tools/sajto-kartyak/adat.json).

  python3 tools/sajto-kartyak/kartyak.py                      # csak a HTML-t írja újra (foglalas/head-spa-velemenyek.html)
  python3 tools/sajto-kartyak/kartyak.py --kepek <mappa>      # + a nyers képekből (<mappa>/<kep>.raw) legyártja az assets/img/sajto/<slug>.jpg fájlokat

A kártya: nagy kép (3:2) → portál + dátum → a cikk címe → szó szerinti idézet → "Tovább a cikkhez". Reklám-jelölés nincs a kártyán.
"""
import argparse, html, json, os, re, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
HONAPOK = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december']
OLDAL = os.path.join(ROOT, 'foglalas', 'head-spa-velemenyek.html')
KEPMAPPA = os.path.join(ROOT, 'assets', 'img', 'sajto')
JEL_KEZD, JEL_VEG = '<!-- SAJTO-KARTYAK:KEZDET (generalja: tools/sajto-kartyak/kartyak.py, adat: tools/sajto-kartyak/adat.json - kezzel ne szerkeszd) -->', '<!-- SAJTO-KARTYAK:VEGE -->'
PLAY = '<span class="video-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg></span>'

def kepek_gyartasa(adat, mappa):
    from PIL import Image, ImageOps
    os.makedirs(KEPMAPPA, exist_ok=True)
    for k in adat['kartyak']:
        im = ImageOps.exif_transpose(Image.open(os.path.join(mappa, k['kep'] + '.raw'))).convert('RGB')
        sw, sh = im.size
        cw = min(sw, int(sh * 3 / 2)); ch = int(cw * 2 / 3)           # a legnagyobb 3:2 kivagas
        px, py = k.get('poz', [0.5, 0.5])
        x = int((sw - cw) * px); y = int((sh - ch) * py)
        im = im.crop((x, y, x + cw, y + ch))
        w = min(960, cw); h = int(w * 2 / 3)
        im = im.resize((w, h), Image.LANCZOS)
        im.save(os.path.join(KEPMAPPA, k['slug'] + '.jpg'), 'JPEG', quality=80, optimize=True, progressive=True)
        print(k['slug'], (w, h), os.path.getsize(os.path.join(KEPMAPPA, k['slug'] + '.jpg')) // 1024, 'KB')

def datum_szoveg(d):
    ev, ho, nap = d.split('-')
    return f'{ev}. {HONAPOK[int(ho) - 1]} {int(nap)}.'

def kartya(k):
    from PIL import Image
    w, h = Image.open(os.path.join(KEPMAPPA, k['slug'] + '.jpg')).size
    e = html.escape
    video = k['tipus'] == 'video'
    cel = 'videóhoz' if video else 'cikkhez'
    url = e(k['url'], quote=True)
    return f'''      <article class="sajto-kartya">
        <a class="sajto-kep" href="{url}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="/assets/img/sajto/{k['slug']}.jpg" alt="" width="{w}" height="{h}" loading="lazy" decoding="async">{PLAY if video else ''}</a>
        <div class="sajto-test">
          <p class="sajto-portal">{e(k['portal'])}<time datetime="{k['datum']}">{datum_szoveg(k['datum'])}</time></p>
          <h3 class="sajto-cim">{e(k['cim'], quote=False)}</h3>
          <q>{e(k['idezet'], quote=False)}</q>
          <a class="link-gomb" href="{url}" target="_blank" rel="noopener">Tovább a {cel} <span class="nyil">→</span></a>
        </div>
      </article>'''

def szekcio(adat):
    kartyak = '\n'.join(kartya(k) for k in adat['kartyak'])
    return f'''<section class="szekcio zsalya" id="sajto" aria-labelledby="sajto-cim">
  <div class="tartalom">
    <div class="szekcio-fej">
      <h2 id="sajto-cim">Női lapok akik írtak rólunk</h2>
      <span class="rombusz" aria-hidden="true"></span>
      <p class="lead">Olvasd el, hogyan látják a MOSAIC Head Spa kezelését a hazai női lapok, magazinok és portálok.</p>
    </div>
    {JEL_KEZD}
    <div class="sajto-racs sajto-egyseges">
{kartyak}
    </div>
    {JEL_VEG}
  </div>
</section>'''

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--kepek'); a = ap.parse_args()
    adat = json.load(open(os.path.join(os.path.dirname(__file__), 'adat.json'), encoding='utf8'))
    if a.kepek: kepek_gyartasa(adat, a.kepek)
    for k in adat['kartyak']:
        assert os.path.exists(os.path.join(KEPMAPPA, k['slug'] + '.jpg')), 'hianyzik a kep: ' + k['slug']
    h = open(OLDAL, encoding='utf8').read()
    uj, db = re.subn(r'<section class="szekcio zsalya" id="sajto".*?</section>', lambda m: szekcio(adat), h, count=1, flags=re.S)
    assert db == 1, 'nem talalom a #sajto szekciot'
    open(OLDAL, 'w', encoding='utf8').write(uj)
    print('kesz:', len(adat['kartyak']), 'kartya')

if __name__ == '__main__': main()
