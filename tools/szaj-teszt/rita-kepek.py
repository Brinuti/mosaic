# A szajtetovalas landing (/szajtetovalas-budapest) videoja es allokepei Rita vendegvideojabol.
#
#   FFMPEG=<ffmpeg> python3 -I tools/szaj-teszt/rita-kepek.py <forras-video> [<kimeneti-gyoker>]
#
# Forras: a MOSAIC Google Drive "smink rita" fajlja (azonosito: 1OiKIofHiJZH25rB59TH3JcYMq-XPUNtH; a fajl valojaban MP4,
# H.264 Main yuv420p, 360x640, 37 mp, AAC-hang, beegetett magyar felirattal). A build NEM hasznalja, csak ujragyartashoz kell.
#
# Kimenet (a repo gyokeren belul):
#   assets/video/szajtetovalas-rita.mp4         a video ujracsomagolva (nincs ujrakodolas: -c copy; metaadat nelkul, moov elol = azonnal indul)
#   assets/img/szaj/rita-poszter.jpg            a video nyitokepe (Melitta dolgozik, felirat nelkul)
#   assets/img/szaj/rita-<lepes>.jpg            allokepek a folyamat-lepesekhez (a video kepkockai, a feliratsav nelkul vagva)
import os
import subprocess
import sys
import tempfile
from PIL import Image

FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
forras = sys.argv[1]
gyoker = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
KEP = os.path.join(gyoker, 'assets', 'img', 'szaj')
VIDEO = os.path.join(gyoker, 'assets', 'video')
os.makedirs(KEP, exist_ok=True)
os.makedirs(VIDEO, exist_ok=True)

# (kimeneti nev, masodperc a videoban, kivagas: bal, felso, jobb, also) - a beegetett felirat a kep also harmadaban van, ezt a vagas kihagyja
KOCKAK = [
    ('rita-poszter', 26.8, None),                    # Melitta dolgozik az ajkon (a teljes 360x640-es kocka, felirat nelkul)
    ('rita-konzultacio', 19.4, (0, 20, 360, 430)),   # Melitta es a vendeg a szalonban
    ('rita-elorajzolas', 10.5, (0, 50, 360, 430)),   # az ajak kontúrjanak elorajzolasa ceruzaval
    ('rita-jovahagyas', 9.0, (0, 40, 360, 420)),     # a vendeg az elorajzolas elott / utan
    ('rita-pigmentalas', 24.2, (0, 60, 360, 440)),   # pigmentalas
    ('rita-gyogyult', 35.1, (0, 60, 360, 420)),      # a vendeg hetekkel kesobb, a gyogyult eredmennyel (a videoban: "szepen kivilagosodott")
]
with tempfile.TemporaryDirectory() as tmp:
    for nev, mp, vagas in KOCKAK:
        png = os.path.join(tmp, nev + '.png')
        subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(mp), '-i', forras, '-frames:v', '1', png], check=True)
        im = Image.open(png).convert('RGB')
        if vagas:
            im = im.crop(vagas)
        im.save(os.path.join(KEP, nev + '.jpg'), quality=84, optimize=True, progressive=True)
        print(nev, im.size)

# a video: ujrakodolas nelkul (mar H.264 / yuv420p / AAC), a Facebook-azonosito metaadat nelkul, a moov az elejen
subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', forras, '-map', '0', '-c', 'copy', '-map_metadata', '-1', '-movflags', '+faststart',
                os.path.join(VIDEO, 'szajtetovalas-rita.mp4')], check=True)
print('szajtetovalas-rita.mp4', os.path.getsize(os.path.join(VIDEO, 'szajtetovalas-rita.mp4')), 'bajt')
