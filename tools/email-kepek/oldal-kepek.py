#!/usr/bin/env python3
# Egy oldal (foglalas/*.html) kepei szakaszonkent (a legutobbi h1-h3 cimmel), alt-szoveggel + a video-kartyak (data-video). Hasznalat: python3 -I tools/email-kepek/oldal-kepek.py foglalas/sminktetovalas-budapest.html
import re,sys,html
def run(path):
    h=open(path,encoding='utf-8').read()
    h=re.sub(r'<(script|style)[\s\S]*?</\1>','',h)
    pos=[]
    for m in re.finditer(r'<h[1-3][^>]*>([\s\S]*?)</h[1-3]>',h):
        t=re.sub(r'<[^>]+>','',m.group(1)); t=html.unescape(re.sub(r'\s+',' ',t)).strip()
        pos.append((m.start(),'H',t[:70]))
    for m in re.finditer(r'<img\b[^>]*>',h):
        tag=m.group(0)
        s=re.search(r'src="([^"]+)"',tag); a=re.search(r'alt="([^"]*)"',tag); w=re.search(r'width="(\d+)"',tag); hh=re.search(r'height="(\d+)"',tag)
        if not s or 'assets/img' not in s.group(1): continue
        f=s.group(1).split('/')[-1]
        pos.append((m.start(),'I',f"{f[:34]} {w.group(1) if w else '?'}x{hh.group(1) if hh else '?'} alt={html.unescape(a.group(1))[:60] if a else ''}"))
    for m in re.finditer(r'data-video="([^"]+)"',h): pos.append((m.start(),'V',m.group(1)))
    pos.sort()
    seen=set()
    for _,k,t in pos:
        if k=='I':
            key=t.split()[0]
            if key in seen: continue
            seen.add(key)
        print(('## ' if k=='H' else ('   VIDEO ' if k=='V' else '   ')) + t)
run(sys.argv[1])
