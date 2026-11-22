# -*- coding: utf-8 -*-
"""Redraw the frequency-response solution figures in exam-paper (hand-drawn) style."""
import math, sys
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from exam_plot import Panel, piecewise, text, arrow, rot_text, BLACK, GREY

ROOT = Path(__file__).resolve().parents[1]

def save(img, rel):
    img.save(ROOT / rel)
    print("saved", rel, img.size)

def build_segments(w_start, L_start, slope0, breaks):
    segs = [(w_start, L_start, slope0)]
    for wb, sn in breaks:
        segs.append((wb, piecewise(segs, wb), sn))
    return segs

def verts(panel, segs, wlist):
    return [(panel.X(w), panel.Y(piecewise(segs, w))) for w in wlist]

# ---------------------------------------------------------------- 2019 Q4 ---
def fig_2019_4():
    W, H = 760, 460
    img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
    p = Panel(d, 150, 105, 515, 300, 0.1, 10, -28, 28)
    p.axes("ω / k", "L(ω)/dB",
           xticks=[(0.1, "0.1"), (1, "1"), (10, "10")],
           yticks=[(20, "20"), (0, "0"), (-20, "-20")], axis_val=0)
    p.polyline([(p.X(0.1), p.Y(20)), (p.X(10), p.Y(-20))], 3)
    p.dot(1, 0, 4)
    th = math.degrees(math.atan2(20*p.height/(p.ymax-p.ymin), p.width/(p.lw1-p.lw0)))
    rot_text(img, p.X(0.34) + math.sin(math.radians(th))*26,
             p.Y(-20*math.log10(0.34)) - math.cos(math.radians(th))*26, "-20dB/dec", -th, 18)
    text(d, p.X(2.7), p.Y(13), "过零：ω = k", 19, anchor="lm")
    arrow(d, (p.X(2.55), p.Y(12.4)), (p.X(1.06), p.Y(0.9)), 1.4, 8)
    save(img, "data-src/2019/img/solution-201904-bode.png")

# ---------------------------------------------------------------- 2019 Q5 ---
def fig_2019_5():
    W, H = 760, 545
    img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
    p = Panel(d, 150, 95, 530, 380, 0.1, 100, -70, 50)
    y0 = p.axes("ω / (rad/s)", "L(ω)/dB",
                xticks=[(0.1, "0.1"), (1, "1"), (10, "10"), (100, "100")],
                yticks=[(40, "40"), (20, "20"), (0, "0"), (-20, "-20"), (-40, "-40"), (-60, "-60")],
                axis_val=0)
    wb = [1.0, 1/0.612, 10.0, 1/0.044]
    segs = build_segments(0.1, 40.0, -20, [(wb[0], -40), (wb[1], -20), (wb[2], -40), (wb[3], -60)])
    wlist = [0.1] + wb + [100.0]
    p.polyline(verts(p, segs, wlist), 3)
    def exact(w):
        s = 1j*w
        return 20*math.log10(abs(100*(0.612*s + 1)/(s*(s + 1)*(s + 10)*(0.044*s + 1))))
    p.curve(exact)
    for w in wb:
        p.vdash(w, y0, p.Y(piecewise(segs, w)) - 3)
    wc = 6.12
    p.vdash(wc, y0, p.Y(piecewise(segs, wc)) - 3, dash=(6, 4), color=(55, 55, 55))
    text(d, p.X(wc), y0 + 10, "6.12", 15, anchor="ma", fill=(50, 50, 50))
    for w, s in [(0.40, "-20"), (1.35, "-40"), (15.0, "-40"), (46.0, "-60")]:
        p.slope_label(w, piecewise(segs, w), s, off=-14, size=18, anchor="mt")
    p.slope_label(4.2, piecewise(segs, 4.2), "-20", off=14, size=18, anchor="ms")
    text(d, p.X(0.11), p.Y(46), "（斜率单位：dB/dec）", 15, fill=(80, 80, 80))
    for w, lab in [(1/0.612, "1.63"), (1/0.044, "22.7")]:
        text(d, p.X(w), y0 + 10, lab, 15, anchor="ma", fill=(75, 75, 75))
    save(img, "data-src/2019/img/solution-201905-bode.png")

# ---------------------------------------------------------------- 2021 Q4 ---
def fig_2021_4():
    W, H = 760, 470
    img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
    p = Panel(d, 160, 95, 510, 300, 1e-3, 10, -8, 74)
    p.axes("ω / (rad/s)", "φ/(°)",
           xticks=[(1e-3, "0.001"), (1e-2, "0.01"), (1e-1, "0.1"), (1, "1"), (10, "10")],
           yticks=[(0, "0"), (20, "20"), (40, "40"), (60, "60")], axis_val=0)
    def ph(w):
        return math.degrees(math.atan(50*w) - math.atan(2.5*w))
    p.line_curve(ph, width=3, color=BLACK, samples=520)
    for w, v, lab, dx, dy, anc in [
            (0.08944, 64.79, "ωm  64.79°", -4, -14, "rm"),
            (0.02, 42.14, "0.02  42.14°", -8, -6, "rm"),
            (0.4, 42.14, "0.4  42.14°", 9, -4, "lm")]:
        p.dot(w, v, 4)
        text(d, p.X(w) + dx, p.Y(v) + dy, lab, 18, anchor=anc)
    save(img, "data-src/2021/img/solution-202104-bode.png")

# ---------------------------------------------------------------- 2025 Q4 ---
def fig_2025_4():
    W, H = 760, 830
    img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
    pm = Panel(d, 150, 80, 540, 300, 0.05, 1000, -88, 62)
    y0 = pm.axes("", "L(ω)/dB",
                 xticks=[(0.1, "0.1"), (1, "1"), (10, "10"), (100, "100"), (1000, "1000")],
                 yticks=[(50, "50"), (25, "25"), (0, "0"), (-25, "-25"), (-50, "-50"), (-75, "-75")],
                 axis_val=0)
    segs = build_segments(0.05, 20*math.log10(18/0.05), -20, [(2.0, -40), (100.0, -60)])
    pm.polyline(verts(pm, segs, [0.05, 2.0, 100.0, 1000.0]), 3)
    def exact(w):
        s = 1j*w
        return 20*math.log10(abs(18/(s*(s/2 + 1)*(s/100 + 1))))
    pm.curve(exact)
    for w in (2.0, 100.0):
        pm.vdash(w, y0, pm.Y(piecewise(segs, w)) - 3)
    wc = 6.0
    pm.vdash(wc, y0, pm.Y(piecewise(segs, wc)) - 3, dash=(6, 4), color=(55, 55, 55))
    text(d, pm.X(wc) - 10, y0 + 10, "6", 15, anchor="ma", fill=(50, 50, 50))
    for w, s in [(0.40, "-20"), (15.0, "-40"), (300.0, "-60")]:
        pm.slope_label(w, piecewise(segs, w), s, off=-14, size=18, anchor="mt")
    text(d, pm.X(0.06), pm.Y(58), "（斜率单位：dB/dec）", 15, fill=(80, 80, 80))
    pp = Panel(d, 150, 470, 540, 290, 0.05, 1000, -290, -80)
    pp.axes("ω / (rad/s)", "φ/(°)",
            xticks=[(0.1, "0.1"), (1, "1"), (10, "10"), (100, "100"), (1000, "1000")],
            yticks=[(-100, "-100"), (-150, "-150"), (-200, "-200"), (-250, "-250")],
            axis_val=-290)
    def ph(w):
        return -90 - math.degrees(math.atan(w/2) + math.atan(w/100))
    pp.line_curve(ph, width=3, color=BLACK, samples=520)
    pp.vdash(wc, pp.Y(-290), pp.Y(ph(wc)) + 4, dash=(6, 4), color=(55, 55, 55))
    pp.vdash(2.0, pp.Y(-290), pp.Y(ph(2.0)) + 4)
    pp.vdash(100.0, pp.Y(-290), pp.Y(ph(100.0)) + 4)
    pp.dot(wc, ph(wc), 4)
    text(d, pp.X(wc) + 10, pp.Y(ph(wc)) - 8, "φ(6) ≈ -165.00°", 18, anchor="lm")
    save(img, "data-src/2025/img/solution-202504-bode.png")

# ---------------------------------------------------------------- 2026 Q4 ---
def fig_2026_4():
    W, H = 760, 830
    img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
    pm = Panel(d, 150, 80, 540, 300, 0.05, 20, -88, 62)
    y0 = pm.axes("", "L(ω)/dB",
                 xticks=[(0.1, "0.1"), (1, "1"), (10, "10")],
                 yticks=[(50, "50"), (25, "25"), (0, "0"), (-25, "-25"), (-50, "-50"), (-75, "-75")],
                 axis_val=0)
    gb = build_segments(0.05, -20*math.log10(0.05), -20, [(1.0, -40)])
    gi = build_segments(0.05, -40*math.log10(0.05), -40, [(1.0, -60)])
    wl = [0.05, 1.0, 20.0]
    pm.polyline(verts(pm, gb, wl), 3)
    pm.polyline(verts(pm, gi, wl), 3, dash=(7, 5))
    def mag(w, order):
        s = 1j*w
        return 20*math.log10(abs(1/((s**order)*(s + 1))))
    pm.curve(lambda w: mag(w, 1), color=(155, 155, 155))
    pm.curve(lambda w: mag(w, 2), color=(155, 155, 155))
    pm.vdash(1.0, y0, pm.Y(0) - 6)
    # slope labels
    pm.slope_label(0.12, piecewise(gb, 0.12), "-20", off=-15, size=18, anchor="mt")
    pm.slope_label(0.12, piecewise(gi, 0.12), "-40", off=18, size=18)
    pm.slope_label(5.0, piecewise(gb, 5.0), "-40", off=20, size=18)
    pm.slope_label(5.0, piecewise(gi, 5.0), "-60", off=-15, size=18, anchor="mt")
    # legend
    lx = pm.X(0.061)
    def legend(v, kind, label):
        y = pm.Y(v)
        if kind == "solid":
            d.line([(lx, y), (lx + 42, y)], fill=BLACK, width=3)
        elif kind == "dash":
            for i in range(0, 42, 12):
                d.line([(lx + i, y), (lx + min(i + 7, 42), y)], fill=BLACK, width=3)
        else:
            for i in range(0, 43, 6):
                d.ellipse([lx + i - 1, y - 1, lx + i + 1, y + 1], fill=(155, 155, 155))
        text(d, lx + 52, y - 9, label, 17, anchor="la")
    legend(-48, "solid", "不加积分")
    legend(-60, "dash", "串联积分后")
    legend(-72, "dotted", "精确幅频")
    # phase
    pp = Panel(d, 150, 470, 540, 290, 0.05, 20, -290, -80)
    pp.axes("ω / (rad/s)", "φ/(°)",
            xticks=[(0.1, "0.1"), (1, "1"), (10, "10")],
            yticks=[(-100, "-100"), (-150, "-150"), (-200, "-200"), (-250, "-250")],
            axis_val=-290)
    def phb(w): return -90 - math.degrees(math.atan(w))
    def phi(w): return -180 - math.degrees(math.atan(w))
    pp.line_curve(phb, width=3, color=BLACK, samples=420)
    pp.line_curve(phi, width=3, color=BLACK, samples=420, dash=(7, 5))
    pp.vdash(1.0, pp.Y(-290), pp.Y(phb(1.0)) - 8)
    pp.dot(1.0, phb(1.0), 4); pp.dot(1.0, phi(1.0), 4)
    text(d, pp.X(1.0) + 10, pp.Y(phb(1.0)) - 8, "-135°", 18, anchor="lm")
    text(d, pp.X(1.0) + 10, pp.Y(phi(1.0)) + 16, "-225°", 18, anchor="lm")
    save(img, "data-src/2026/img/solution-202604-bode.png")


# ------------------------------------------------ 2026 Q4 separate figures ---
def _single_system(rel, order, title, ylab_pt):
    W, H = 760, 820
    img = Image.new("RGB", (W, H), "white"); d = ImageDraw.Draw(img)
    text(d, 150, 16, title, 20, anchor="la")
    pm = Panel(d, 150, 80, 540, 300, 0.05, 20, -88, 62)
    y0 = pm.axes("", "L(ω)/dB",
                 xticks=[(0.1, "0.1"), (1, "1"), (10, "10")],
                 yticks=[(50, "50"), (25, "25"), (0, "0"), (-25, "-25"), (-50, "-50"), (-75, "-75")],
                 axis_val=0)
    L0 = -20*order*math.log10(0.05)
    segs = build_segments(0.05, L0, -20*order, [(1.0, -20*order - 20)])
    def mag(w):
        s = 1j*w
        return 20*math.log10(abs(1/((s**order)*(s + 1))))
    pm.curve(mag)
    pm.polyline(verts(pm, segs, [0.05, 1.0, 20.0]), 3)
    pm.vdash(1.0, y0, pm.Y(0) - 6)
    for w, lab in [(0.26, "-%d" % (20*order)), (6.0, "-%d" % (20*order + 20))]:
        pm.slope_label(w, piecewise(segs, w), lab, off=15, size=18, anchor="ms")
    text(d, pm.X(0.06), pm.Y(58), "（斜率单位：dB/dec）", 15, fill=(80, 80, 80))
    pp = Panel(d, 150, 470, 540, 290, 0.05, 20, -290, -80)
    pp.axes("ω / (rad/s)", "φ/(°)",
            xticks=[(0.1, "0.1"), (1, "1"), (10, "10")],
            yticks=[(-100, "-100"), (-150, "-150"), (-200, "-200"), (-250, "-250")],
            axis_val=-290)
    def ph(w):
        return -90*order - math.degrees(math.atan(w))
    pp.line_curve(ph, width=3, color=BLACK, samples=420)
    pp.vdash(1.0, pp.Y(-290), pp.Y(ph(1.0)) - 8)
    pp.dot(1.0, ph(1.0), 4)
    text(d, pp.X(1.0) + 10, pp.Y(ph(1.0)) - 8, ylab_pt, 18, anchor="lm")
    save(img, rel)

def fig_2026_4_split():
    _single_system("data-src/2026/img/solution-202604-bode-before.png", 1,
                   "串联积分前  Gb(s) = 1/[s(s+1)]", "-135°")
    _single_system("data-src/2026/img/solution-202604-bode-after.png", 2,
                   "串联积分后  Gi(s) = 1/[s²(s+1)]", "-225°")

if __name__ == "__main__":
    fig_2019_4(); fig_2019_5(); fig_2021_4(); fig_2025_4(); fig_2026_4_split()
