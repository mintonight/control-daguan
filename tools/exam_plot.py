# -*- coding: utf-8 -*-
"""Small exam-paper style plotting helpers (PIL) shared by the Bode redraws."""
import math

CJK = "C:/Windows/Fonts/msyh.ttc"
CJKB = "C:/Windows/Fonts/msyhbd.ttc"
LAT = "C:/Windows/Fonts/arial.ttf"
LATB = "C:/Windows/Fonts/arialbd.ttf"

BLACK = (25, 25, 25)
GREY = (130, 130, 130)
DASH = (95, 95, 95)

_FONTS = {}

def font(size, bold=False, cjk=False):
    key = (size, bold, cjk)
    if key in _FONTS:
        return _FONTS[key]
    from PIL import ImageFont
    path = CJKB if (cjk and bold) else CJK if cjk else (LATB if bold else LAT)
    try:
        f = ImageFont.truetype(path, size)
    except Exception:
        f = ImageFont.truetype(LAT, size)
    _FONTS[key] = f
    return f

def has_cjk(s):
    return any(ord(c) > 0x2E80 for c in s)

def arrow(d, p1, p2, w=2.2, ah=10):
    x1, y1 = p1; x2, y2 = p2
    d.line([(x1, y1), (x2, y2)], fill=BLACK, width=int(round(w)))
    ang = math.atan2(y2 - y1, x2 - x1)
    for s in (+1, -1):
        xx = x2 - ah*math.cos(ang - s*0.42)
        yy = y2 - ah*math.sin(ang - s*0.42)
        d.line([(x2, y2), (xx, yy)], fill=BLACK, width=int(round(w)))

def rot_text(img, x, y, s, angle_deg, size=18, fill=BLACK):
    from PIL import Image as _I, ImageDraw as _ID
    f = font(size, False, has_cjk(s))
    tmp = _I.new("RGBA", (520, 100), (0, 0, 0, 0))
    _ID.Draw(tmp).text((260, 50), s, font=f, fill=fill + (255,), anchor="mm")
    rot = tmp.rotate(angle_deg, resample=_I.BICUBIC, center=(260, 50))
    bb = rot.getbbox()
    rot = rot.crop(bb)
    img.paste(rot, (int(round(x - rot.width/2)), int(round(y - rot.height/2))), rot)

def text(d, x, y, s, size=19, bold=False, anchor="la", fill=BLACK):
    d.text((x, y), s, font=font(size, bold, has_cjk(s)), fill=fill, anchor=anchor)

class Panel:
    def __init__(self, draw, left, top, width, height, wmin, wmax, ymin, ymax):
        self.d = draw
        self.left, self.top, self.width, self.height = left, top, width, height
        self.wmin, self.wmax, self.ymin, self.ymax = wmin, wmax, ymin, ymax
        self.lw0 = math.log10(wmin)
        self.lw1 = math.log10(wmax)
    def X(self, w):
        return self.left + (math.log10(w) - self.lw0)/(self.lw1 - self.lw0)*self.width
    def Y(self, v):
        return self.top + (self.ymax - v)/(self.ymax - self.ymin)*self.height

    def axes(self, xlabel, ylabel, xticks=None, yticks=None, axis_val=None,
             xlabel_at=None, ylabel_at=None):
        """Draw axes with arrows, ticks and labels."""
        d = self.d
        x0 = self.left
        y0 = self.Y(self.ymin) if axis_val is None else self.Y(axis_val)
        # y axis
        arrow(d, (x0, self.Y(self.ymin)), (x0, self.top - 14))
        # x axis
        arrow(d, (x0, y0), (self.left + self.width + 14, y0))
        # x ticks
        if xticks:
            for w, lab in xticks:
                xx = self.X(w)
                d.line([(xx, y0), (xx, y0 + 6)], fill=BLACK, width=2)
                if xx <= self.left + 2:
                    text(d, xx + 2, y0 + 10, lab, 18, anchor="lm")
                elif xx >= self.left + self.width - 2:
                    text(d, xx - 2, y0 + 10, lab, 18, anchor="rm")
                else:
                    text(d, xx, y0 + 10, lab, 18, anchor="ma")
        # y ticks
        if yticks:
            for v, lab in yticks:
                yy = self.Y(v)
                d.line([(x0 - 6, yy), (x0, yy)], fill=BLACK, width=2)
                text(d, x0 - 10, yy, lab, 18, anchor="rm")
        # labels
        if ylabel_at is None:
            ylabel_at = (x0 + 8, self.top - 26)
        text(d, ylabel_at[0], ylabel_at[1], ylabel, 21, anchor="la")
        if xlabel_at is None:
            xlabel_at = (self.left + self.width - 6, y0 + 26)
        text(d, xlabel_at[0], xlabel_at[1], xlabel, 21, anchor="ra")
        return y0

    def polyline(self, pts, width=3, color=BLACK, dash=None):
        d = self.d
        if dash:
            # dashed polyline between consecutive points
            for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
                self._dash_line(xa, ya, xb, yb, color, width, dash)
        else:
            d.line(pts, fill=color, width=int(round(width)), joint="curve")

    def _dash_line(self, xa, ya, xb, yb, color, width, dash):
        on, off = dash
        L = math.hypot(xb - xa, yb - ya)
        if L == 0:
            return
        ux, uy = (xb - xa)/L, (yb - ya)/L
        t = 0.0
        while t < L:
            t2 = min(t + on, L)
            self.d.line([(xa + ux*t, ya + uy*t), (xa + ux*t2, ya + uy*t2)], fill=color, width=int(round(width)))
            t = t2 + off

    def curve(self, f, width=2, color=GREY, dots=True, step=2, samples=360):
        """f(w)->value ; draw fine dotted sample points."""
        d = self.d
        for k in range(0, samples + 1):
            if k % step:
                continue
            w = self.wmin*(self.wmax/self.wmin)**(k/samples)
            x, y = self.X(w), self.Y(f(w))
            d.ellipse([x - 1.1, y - 1.1, x + 1.1, y + 1.1], fill=color)

    def line_curve(self, f, width=3, color=BLACK, samples=420, dash=None):
        pts = []
        for k in range(samples + 1):
            w = self.wmin*(self.wmax/self.wmin)**(k/samples)
            pts.append((self.X(w), self.Y(f(w))))
        self.polyline(pts, width, color, dash)

    def vdash(self, w, y1, y2, dash=(5, 5), color=DASH):
        self._dash_line(self.X(w), y1, self.X(w), y2, color, 1, dash)

    def dot(self, w, v, r=4, color=BLACK):
        x, y = self.X(w), self.Y(v)
        self.d.ellipse([x - r, y - r, x + r, y + r], fill=color)

    def slope_label(self, w, v, s, off=16, size=18, anchor="ms"):
        text(self.d, self.X(w), self.Y(v) - off, s, size, anchor=anchor)

def piecewise(segments, w):
    """segments: list of (w0, L0, slope_db_per_dec) sorted by w0."""
    cur = segments[0]
    for seg in segments:
        if w >= seg[0]:
            cur = seg
    w0, L0, slope = cur
    return L0 + slope*math.log10(w/w0)
