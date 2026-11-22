# -*- coding: utf-8 -*-
"""Exam-style (hand-drawn look) compensator Bode magnitude for 2024 Q5 (Gc)."""
import math, cmath
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data-src/2024/img/solution-202405-bode.png"

W, H = 760, 480
X0, Y0 = 165, 360
SCALE, DEC, WMIN, WMAX = 6.0, 190.0, 0.3, 34.0
F = "C:/Windows/Fonts/arial.ttf"

def X(w):  return X0 + (math.log10(w)-math.log10(WMIN))*DEC
def Y(db): return Y0 - SCALE*db

BRK = [1.0, 2.0, 3.0, 10.0, 20.0]

def L_asym(w):
    db = 10.0 - 20.0*math.log10(w)          # sqrt(10)/w
    for b in (1.0, 2.0, 3.0):
        if w > b: db += 20*math.log10(w/b)
    for b in (10.0, 20.0):
        if w > b: db -= 20*math.log10(w/b)
    return db

def L_exact(w):
    jw = 1j*w
    G = (math.sqrt(10)*(jw/2+1)*(jw+1)*(jw/3+1))/(jw*(jw/10+1)*(jw/20+1))
    return 20*math.log10(abs(G))

img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)
def font(sz, bold=False):
    try: return ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf" if bold else F, sz)
    except Exception: return ImageFont.truetype(F, sz)
f22 = font(22); f20 = font(20); f19 = font(19)
BLACK=(20,20,20)

def arrow(x1,y1,x2,y2,w=2,ah=11):
    d.line([(x1,y1),(x2,y2)], fill=BLACK, width=int(round(w)))
    ang=math.atan2(y2-y1,x2-x1)
    for s in (+1,-1):
        xx=x2-ah*math.cos(ang-s*0.42); yy=y2-ah*math.sin(ang-s*0.42)
        d.line([(x2,y2),(xx,yy)], fill=BLACK, width=int(round(w)))

# axes
arrow(X0, 430, X0, 80, 2.4)
arrow(X0, Y0, 640, Y0, 2.4)

# asymptote polyline
wpts=[WMIN]+BRK+[WMAX]
pts=[(X(w),Y(L_asym(w))) for w in wpts]
for i in range(len(pts)-1):
    d.line([pts[i],pts[i+1]], fill=BLACK, width=3)

# exact magnitude, fine dotted points
for k in range(0, 320):
    w = WMIN*(WMAX/WMIN)**(k/319.0)
    x=X(w); y=Y(L_exact(w))
    if k % 3 == 0:
        d.ellipse([x-1,y-1,x+1,y+1], fill=(140,140,140))

# dashed vertical guides at break frequencies (axis up to curve)
def vdash(x, y1, y2, dash=5, gap=5):
    y=min(y1,y2); ye=max(y1,y2)
    while y<ye:
        d.line([(x,y),(x,min(y+dash,ye))], fill=(80,80,80), width=1)
        y+=dash+gap
for b in BRK:
    vdash(X(b), Y0, Y(L_asym(b))-4)

d.text((X0+12, 58), "Lc(ω)/dB", font=f22, fill=BLACK)
d.text((598, Y0-32), "ω/(rad/s)", font=f22, fill=BLACK)

# y ticks
for db in (0,10,20,30,40):
    y=Y(db); d.line([(X0-7,y),(X0,y)], fill=BLACK, width=2)
    d.text((X0-12, y), str(db), font=f20, fill=BLACK, anchor="rm")

# x ticks + labels
labels={1.0:"1",2.0:"2",3.0:"3",10.0:"10",20.0:"20"}
for b in BRK:
    x=X(b); d.line([(x,Y0),(x,Y0+7)], fill=BLACK, width=2)
    d.text((x, Y0+12), labels[b], font=f20, fill=BLACK, anchor="ma")

# slope labels
def slope_lab(w, text, off):
    d.text((X(w), Y(L_asym(w))-off), text, font=f19, fill=BLACK, anchor="ms")
slope_lab(0.75, "-20dB/dec", 40)
slope_lab(1.45, "0dB/dec", 30)
slope_lab(2.55, "+20dB/dec", 40)
slope_lab(5.00, "+40dB/dec", 24)
slope_lab(11.3, "+20dB/dec", 32)
slope_lab(26.0, "0dB/dec", 32)

# exact-curve legend
try:
    fCJK = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 18)
except Exception:
    fCJK = f19
for i in range(200, 240, 4):
    d.ellipse([i-1,107,i+1,109], fill=(140,140,140))
d.text((248,106), "精确幅频", font=fCJK, fill=BLACK, anchor="lm")

img.save(OUT)
print("saved", OUT, img.size)
