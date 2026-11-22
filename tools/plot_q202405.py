# -*- coding: utf-8 -*-
"""Draw the pre-correction open-loop Bode magnitude of 2024 Q5 (G(s)=12/[(s+1)(s+3)(s+0.4)])."""
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data-src/2024/img/solution-202405-bode-before.png"

W, H = 1000, 610
left, right, top, bottom = 105, 950, 70, 520
logmin, logmax = -1.0, 1.0          # 0.1 .. 10 rad/s
ymax, ymin = 25.0, -50.0            # dB

def xmap(w): return left + (math.log10(w)-logmin)/(logmax-logmin)*(right-left)
def ymap(db): return top + (ymax-db)/(ymax-ymin)*(bottom-top)

def L_asym(w):
    db = 20.0
    if w > 0.4: db -= 20*math.log10(w/0.4)
    if w > 1.0: db -= 20*math.log10(w/1.0)
    if w > 3.0: db -= 20*math.log10(w/3.0)
    return db

def mag_db(w):
    return 20*math.log10(12.0/(math.hypot(w,1)*math.hypot(w,3)*math.hypot(w,0.4)))

img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)
FNT = "C:/Windows/Fonts/msyh.ttc"
def font(sz, bold=False):
    return ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc" if bold else FNT, sz)

title_f = font(26, True)
lab_f = font(20)
tick_f = font(17)
small_f = font(17)

GRID=(220,226,232); AX=(40,40,40); DOT=(120,125,132); DASH=(150,155,162)

# grid
for w in [0.1,0.2,0.4,1,2,3,5,10]:
    x=xmap(w); d.line([(x,top),(x,bottom)], fill=GRID, width=1)
for db in [20,10,0,-10,-20,-30,-40]:
    y=ymap(db); d.line([(left,y),(right,y)], fill=GRID, width=1)
# axes
d.line([(left,top),(left,bottom)], fill=AX, width=2)
d.line([(left,bottom),(right,bottom)], fill=AX, width=2)
# 0 dB line
y0=ymap(0); d.line([(left,y0),(right,y0)], fill=(90,90,90), width=1)

# ticks
for w,lab in [(0.1,"0.1"),(0.4,"0.4"),(1,"1"),(2,"2"),(3,"3"),(10,"10")]:
    x=xmap(w); d.line([(x,bottom),(x,bottom+6)], fill=AX, width=1)
    tw=d.textlength(lab,font=tick_f); d.text((x-tw/2,bottom+10), lab, font=tick_f, fill=AX)
for db in [20,10,0,-10,-20,-30,-40]:
    y=ymap(db); d.line([(left-6,y),(left,y)], fill=AX, width=1)
    lab=str(db); tw=d.textlength(lab,font=tick_f); d.text((left-10-tw,y-9), lab, font=tick_f, fill=AX)

# asymptote (piecewise linear in log w)
pts=[(xmap(w),ymap(L_asym(w))) for w in [0.1,0.4,1,3,10]]
d.line(pts, fill=AX, width=3)
# exact curve dotted
n=400; prev=None
for i in range(n+1):
    w=10**(logmin+(logmax-logmin)*i/n); p=(xmap(w),ymap(mag_db(w)))
    if prev: d.line([prev,p], fill=DOT, width=2)
    prev=p

# vertical dashed construction lines at corners and wc=2
def vdash(w, ytop=None, ybot=None):
    x=xmap(w); yt=ytop if ytop is not None else top; yb=ybot if ybot is not None else bottom
    yy=yt
    while yy<yb:
        d.line([(x,yy),(x,min(yy+8,yb))], fill=DASH, width=1); yy+=14
for w in [0.4,1,3]:
    vdash(w, ymap(L_asym(w)), bottom)
vdash(2, ymap(0), bottom)
# mark wc=2 point
xc=xmap(2); yc=ymap(0); r=5
d.ellipse([xc-r,yc-r,xc+r,yc+r], fill="white", outline=AX, width=2)
tw=d.textlength("ωc=2",font=tick_f); d.text((xc-tw/2,bottom+30), "ωc=2", font=tick_f, fill=(20,90,160))


# slope labels
def slopetext(w, db, text, dy=-18):
    x=xmap(w); y=ymap(db)+dy; tw=d.textlength(text,font=small_f)
    d.text((x-tw/2,y), text, font=small_f, fill=(30,30,30))
slopetext(0.18, L_asym(0.18), "0 dB/dec")
slopetext(math.sqrt(0.4*1), (L_asym(0.4)+L_asym(1))/2, "−20 dB/dec")
slopetext(math.sqrt(1*3), (L_asym(1)+L_asym(3))/2, "−40 dB/dec")
slopetext(math.sqrt(3*10), (L_asym(3)+L_asym(10))/2, "−60 dB/dec")

# axis labels + title
def centered(text, y, fnt, fill=AX):
    tw=d.textlength(text,font=fnt); d.text(((left+right)/2-tw/2, y), text, font=fnt, fill=fill)
centered("ω / (rad/s)", bottom+52, lab_f)
tw=d.textlength("校正前开环对数幅频特性",font=title_f); d.text(((left+right)/2-tw/2, 16), "校正前开环对数幅频特性", font=title_f, fill=AX)
# rotated ylabel
yl=Image.new("RGBA",(340,34),(255,255,255,0)); yd=ImageDraw.Draw(yl)
yd.text((0,0),"L(ω) / dB",font=lab_f,fill=AX)
yl=yl.rotate(90,expand=True)
img.paste(yl,(18,int((top+bottom)/2-170)),yl)

# legend (dashed construction note + line styles)
lx, ly = right-250, top+6
d.line([(lx,ly+6),(lx+42,ly+6)], fill=AX, width=3); d.text((lx+50,ly-4),"渐近线",font=small_f,fill=AX)
d.line([(lx,ly+34),(lx+42,ly+34)], fill=DOT, width=2); d.text((lx+50,ly+24),"精确幅频",font=small_f,fill=AX)

img.save(OUT)
print("saved", OUT, img.size)
