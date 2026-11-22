# -*- coding: utf-8 -*-
"""Exam-style (hand-drawn look) pre-correction Bode magnitude for 2024 Q5, with dashed guides at 0.4/1/3."""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data-src/2024/img/solution-202405-bode-before.png"

W, H = 760, 480
X0, Y0 = 150, 250
SCALE, DEC, WMIN = 5.0, 200.0, 0.12
F = "C:/Windows/Fonts/arial.ttf"

def X(w):  return X0 + (math.log10(w)-math.log10(WMIN))*DEC
def Y(db): return Y0 - SCALE*db

def L_asym(w):
    db = 20.0
    if w > 0.4: db -= 20*math.log10(w/0.4)
    if w > 1.0: db -= 20*math.log10(w/1.0)
    if w > 3.0: db -= 20*math.log10(w/3.0)
    return db

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

arrow(X0, 430, X0, 78, 2.4)
arrow(X0, Y0, 605, Y0, 2.4)

wpts=[WMIN,0.4,1,3,9]
pts=[(X(w),Y(L_asym(w))) for w in wpts]
for i in range(len(pts)-1):
    d.line([pts[i],pts[i+1]], fill=BLACK, width=3)

def vdash(x, y1=92, y2=440, dash=6, gap=6):
    y=y1
    while y<y2:
        d.line([(x,y),(x,min(y+dash,y2))], fill=(70,70,70), width=1)
        y+=dash+gap
for w in (0.4,1,3):
    vdash(X(w))

d.text((X0+12, 60), "L(ω)/dB", font=f22, fill=BLACK)
d.text((566, Y0-32), "ω/(rad/s)", font=f22, fill=BLACK)
d.text((X0-16, Y(20)-12), "20dB", font=f20, fill=BLACK, anchor="ra")
d.text((X0-16, Y(-20)-12), "-20dB", font=f20, fill=BLACK, anchor="ra")

for w,lab in [(0.4,"0.4"),(1,"1"),(3,"3")]:
    x=X(w); d.line([(x,Y0),(x,Y0+7)], fill=BLACK, width=2)
    d.text((x, Y0+12), lab, font=f20, fill=BLACK, anchor="ma")

def slope_arrow(w1, w2, frac=0.5):
    wa = w1*(w2/w1)**(frac-0.14); wb = w1*(w2/w1)**(frac+0.14)
    arrow(X(wa), Y(L_asym(wa)), X(wb), Y(L_asym(wb)), 1.8, 9)
slope_arrow(WMIN, 0.4); slope_arrow(0.4, 1); slope_arrow(1, 3); slope_arrow(3, 9)

d.text((172, 112), "0dB/dec", font=f19, fill=BLACK)
d.text((300, 118), "-20dB/dec", font=f19, fill=BLACK)
d.text((452, 218), "-40dB/dec", font=f19, fill=BLACK)
d.text((492, 348), "-60dB/dec", font=f19, fill=BLACK)

img.save(OUT)
print("saved", OUT, img.size)
