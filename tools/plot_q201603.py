#!/usr/bin/env python3
"""Deterministic root-locus diagram generator for the Q3 root-locus questions.

This single tool renders the exam-style root-locus figures embedded in the
written explanations of 2016-2026 Q3 (Q201603 ... Q202603). The tool is filed
under the earliest of those questions because the repository names plotting
tools tools/plot_q<year><no>.py; render(qid) regenerates one asset and main()
regenerates them all.

Every curve is obtained by sampling the closed-loop characteristic equation
A(s) + K B(s) = 0 (A from the open-loop poles, B from the zeros) and tracking
the roots as K grows; breakaway points and imaginary-axis crossings are drawn
from the same equation. Negative-real-axis segments follow the standard
odd-count rule. Nothing is hand-placed: the SVG therefore always matches the
plant in the question stem.

Only the Python standard library is used (no numpy), matching the rest of the
repository tooling and the CI runner.
"""
import cmath
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def poly_from_roots(roots):
    """Coefficients (highest degree first) of prod(s - r), as real floats."""
    coeff = [1.0 + 0j]
    for r in roots:
        r = complex(r)
        nxt = [0j] * (len(coeff) + 1)
        for i, c in enumerate(coeff):
            nxt[i] += c
            nxt[i + 1] -= c * r
        coeff = nxt
    return [c.real for c in coeff]


def polyval(coeff, s):
    v = 0j
    for c in coeff:
        v = v * s + c
    return v


def polyadd(p, q):
    p = list(p)
    q = list(q)
    if len(p) < len(q):
        p = [0.0] * (len(q) - len(p)) + p
    else:
        q = [0.0] * (len(p) - len(q)) + q
    return [a + b for a, b in zip(p, q)]


def polyder(p):
    n = len(p) - 1
    if n <= 0:
        return [0.0]
    return [p[i] * (n - i) for i in range(n)]


def _cbrt(x):
    return math.copysign(abs(x) ** (1.0 / 3.0), x) if x else 0.0


def _quadratic(a, b, c):
    d = b * b - 4 * a * c
    if d >= 0:
        s = math.sqrt(d)
        return [complex((-b + s) / (2 * a), 0.0), complex((-b - s) / (2 * a), 0.0)]
    s = math.sqrt(-d)
    return [complex(-b / (2 * a), s / (2 * a)), complex(-b / (2 * a), -s / (2 * a))]


def _cubic(a, b, c):
    """Roots of x^3 + a x^2 + b x + c with real coefficients."""
    p = b - a * a / 3.0
    q = 2 * a ** 3 / 27.0 - a * b / 3.0 + c
    disc = (q / 2.0) ** 2 + (p / 3.0) ** 3
    if disc > 1e-12:
        s = math.sqrt(disc)
        u, v = _cbrt(-q / 2.0 + s), _cbrt(-q / 2.0 - s)
        y1 = u + v
        yr = -y1 / 2.0
        yi = math.sqrt(3.0) / 2.0 * (u - v)
        return [complex(y1 - a / 3.0, 0.0), complex(yr - a / 3.0, yi), complex(yr - a / 3.0, -yi)]
    if disc < -1e-12:
        r = math.sqrt(-(p / 3.0) ** 3)
        val = max(-1.0, min(1.0, -q / (2.0 * r)))
        phi = math.acos(val)
        m = 2.0 * math.sqrt(-p / 3.0)
        return [complex(m * math.cos((phi + 2 * math.pi * k) / 3.0) - a / 3.0, 0.0) for k in range(3)]
    if abs(q) < 1e-12:
        return [complex(-a / 3.0, 0.0)] * 3
    u = _cbrt(-q / 2.0)
    return [complex(2 * u - a / 3.0, 0.0), complex(-u - a / 3.0, 0.0), complex(-u - a / 3.0, 0.0)]


def roots_of(coeff):
    c = [complex(x) for x in coeff]
    while len(c) > 1 and abs(c[0]) < 1e-12:
        c.pop(0)
    n = len(c) - 1
    if n <= 0:
        return []
    if n == 1:
        return [complex(-c[1] / c[0], 0.0)]
    if n == 2:
        return _quadratic(c[0].real, c[1].real, c[2].real)
    if n == 3:
        return _cubic(c[1].real / c[0].real, c[2].real / c[0].real, c[3].real / c[0].real)
    # Generic fallback (not used by these quadratics/cubics): Durand-Kerner.
    monic = [x / c[0] for x in c]
    rad = 1.0 + max(abs(x) for x in monic[1:])
    roots = [rad * cmath.exp(1j * (2 * math.pi * k / n + 0.4)) for k in range(n)]
    for _ in range(600):
        nxt = []
        for i in range(n):
            num = polyval(monic, roots[i])
            den = 1 + 0j
            for j in range(n):
                if j != i:
                    den *= roots[i] - roots[j]
            nxt.append(roots[i] - num / den if den != 0 else roots[i])
        roots = nxt
    return roots


def real_axis_segments(poles, zeros):
    pts = sorted([p.real for p in list(poles) + list(zeros) if abs(p.imag) < 1e-9])
    uniq = []
    for x in pts:
        if not uniq or abs(x - uniq[-1]) > 1e-9:
            uniq.append(x)
    segs = []
    bounds = [-math.inf] + uniq + [math.inf]
    for i in range(len(bounds) - 1):
        a, b = bounds[i], bounds[i + 1]
        if math.isinf(a):
            test = uniq[0] - 1 if uniq else 0
        elif math.isinf(b):
            test = uniq[-1] + 1 if uniq else 0
        else:
            test = (a + b) / 2
        if sum(1 for x in uniq if x > test) % 2 == 1:
            segs.append((a, b))
    return segs


def roots_for(A, B, K):
    return roots_of(polyadd(A, [K * x for x in B]))


def track(A, B, Ks):
    branches = None
    for K in Ks:
        r = roots_for(A, B, K)
        if branches is None:
            branches = [[z] for z in r]
            continue
        used = [False] * len(r)
        for br in branches:
            last = br[-1]
            best, bd = -1, 1e18
            for i, z in enumerate(r):
                if used[i]:
                    continue
                d = abs(z - last)
                if d < bd:
                    bd, best = d, i
            used[best] = True
            br.append(r[best])
    return branches


def sample_ks(A, B, Kmin, Kmax, N):
    N = int(N)
    base = [Kmin * (Kmax / Kmin) ** (i / (N - 1)) for i in range(N)]
    imag = [max(abs(z.imag) for z in roots_for(A, B, K)) for K in base]
    extra = []
    for i in range(N - 1):
        if (imag[i] < 1e-5) != (imag[i + 1] < 1e-5):
            a, b = base[i], base[i + 1]
            extra.extend(a + (b - a) * t / 159.0 for t in range(1, 160))
    return sorted(set(base + extra)) if extra else base


class Figure:
    def __init__(self, poles, zeros, ReMin, ReMax, ImMin, ImMax, Kmin=1e-4, Kmax=1e8, N=900,
                 maxw=540, maxh=470):
        self.poles = [complex(p) for p in poles]
        self.zeros = [complex(z) for z in zeros]
        self.ReMin, self.ReMax, self.ImMin, self.ImMax = ReMin, ReMax, ImMin, ImMax
        self.Kmin, self.Kmax, self.N = Kmin, Kmax, N
        self.U = min(maxw / (ReMax - ReMin), maxh / (ImMax - ImMin))
        self.mL, self.mR, self.mT, self.mB = 78, 48, 38, 58
        self.W = self.mL + (ReMax - ReMin) * self.U + self.mR
        self.H = self.mT + (ImMax - ImMin) * self.U + self.mB
        self.items = []

    def fx(self, re):
        return self.mL + (re - self.ReMin) * self.U

    def fy(self, im):
        return self.mT + (self.ImMax - im) * self.U

    def _exit_t(self, cx, cy, ang):
        dx, dy = math.cos(ang), math.sin(ang)
        tmax = 1e9
        for cv, dv, lo, hi in [(cx, dx, self.ReMin, self.ReMax), (cy, dy, self.ImMin, self.ImMax)]:
            if abs(dv) > 1e-12:
                for bnd in (lo, hi):
                    t = (bnd - cv) / dv
                    if t > 0:
                        tmax = min(tmax, t)
        return tmax

    def arrow(self, x1, y1, x2, y2, size=8.0):
        ang = math.atan2(y2 - y1, x2 - x1)
        x, y = x2, y2
        p1 = (x - size * math.cos(ang) + size * 0.5 * math.sin(ang), y - size * math.sin(ang) - size * 0.5 * math.cos(ang))
        p2 = (x - size * math.cos(ang) - size * 0.5 * math.sin(ang), y - size * math.sin(ang) + size * 0.5 * math.cos(ang))
        self.items.append(f'<polygon points="{x:.2f},{y:.2f} {p1[0]:.2f},{p1[1]:.2f} {p2[0]:.2f},{p2[1]:.2f}" fill="#111"/>')

    def render(self, asymptotes=(), labels=(), dots=(), real_segments=None, arrows=True,
               sigma=None, sigma_text=None, arrow_fracs=(0.32, 0.66)):
        out = []
        out.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.W:.0f}" height="{self.H:.0f}" viewBox="0 0 {self.W:.0f} {self.H:.0f}" role="img">')
        out.append('<rect width="100%" height="100%" fill="white"/>')
        out.append('<defs>'
                   '<marker id="ar" markerWidth="11" markerHeight="11" refX="8.5" refY="5.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0 1L10 5.5L0 10Z" fill="#111"/></marker>'
                   f'<clipPath id="pc"><rect x="{self.mL:.2f}" y="{self.mT:.2f}" width="{(self.ReMax - self.ReMin) * self.U:.2f}" height="{(self.ImMax - self.ImMin) * self.U:.2f}"/></clipPath>'
                   '</defs>')
        self.items = []
        ox, oy = self.fx(0), self.fy(0)
        for (ang, label, cen) in asymptotes:
            if isinstance(cen, complex):
                cx, cy = cen.real, cen.imag
            else:
                cx, cy = float(cen), 0.0
            th = math.radians(ang)
            t = self._exit_t(cx, cy, th)
            ex, ey = cx + t * math.cos(th), cy + t * math.sin(th)
            self.items.append(f'<line x1="{self.fx(cx):.2f}" y1="{self.fy(cy):.2f}" x2="{self.fx(ex):.2f}" y2="{self.fy(ey):.2f}" stroke="#8f97a3" stroke-width="1.3" stroke-dasharray="8 5"/>')
            if label:
                lx, ly = cx + 0.8 * t * math.cos(th), cy + 0.8 * t * math.sin(th)
                px, py = self.fx(lx), self.fy(ly)
                px += -10 * math.sin(th)
                py += -10 * math.cos(th)
                self.items.append(f'<text x="{px:.2f}" y="{py:.2f}" font-size="15" fill="#3a3f47" text-anchor="middle">{label}</text>')
        segs = real_segments if real_segments is not None else real_axis_segments(self.poles, self.zeros)
        for (a, b) in segs:
            x1 = self.fx(max(a, self.ReMin))
            x2 = self.fx(min(b, self.ReMax))
            self.items.append(f'<line x1="{x1:.2f}" y1="{oy:.2f}" x2="{x2:.2f}" y2="{oy:.2f}" stroke="#111" stroke-width="4.4"/>')
        if sigma is not None:
            xs = self.fx(sigma)
            self.items.append(f'<line x1="{xs:.2f}" y1="{oy - 6:.2f}" x2="{xs:.2f}" y2="{oy + 6:.2f}" stroke="#111" stroke-width="1.6"/>')
            txt = sigma_text if sigma_text is not None else f'sigma_a={sigma:.2f}'
            self.items.append(f'<text x="{xs:.2f}" y="{oy + 21:.2f}" font-size="14" text-anchor="middle">{txt}</text>')
        Ks = sample_ks(poly_from_roots(self.poles), poly_from_roots(self.zeros), self.Kmin, self.Kmax, self.N)
        brs = track(poly_from_roots(self.poles), poly_from_roots(self.zeros), Ks)
        pad = 4.0
        def clip(pts):
            res, cur = [], []
            for z in pts:
                if (self.ReMin - pad <= z.real <= self.ReMax + pad) and (self.ImMin - pad <= z.imag <= self.ImMax + pad):
                    cur.append(z)
                else:
                    if len(cur) > 1:
                        res.append(cur)
                    cur = []
            if len(cur) > 1:
                res.append(cur)
            return res
        for br in brs:
            for sg in clip(br):
                pth = ' '.join(f'{self.fx(z.real):.1f},{self.fy(z.imag):.1f}' for z in sg)
                self.items.append(f'<polyline points="{pth}" fill="none" stroke="#111" stroke-width="2.3" stroke-linejoin="round"/>')
                if arrows:
                    n = len(sg)
                    px = [self.fx(z.real) for z in sg]
                    py = [self.fy(z.imag) for z in sg]
                    cum = [0.0]
                    for i in range(1, n):
                        cum.append(cum[-1] + math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]))
                    total = cum[-1]
                    if total > 12:
                        for frac in arrow_fracs:
                            target = total * frac
                            i = 1
                            while i < n - 1 and cum[i] < target:
                                i += 1
                            j0, j1 = max(0, i - 6), min(n - 1, i + 6)
                            if j1 > j0:
                                self.arrow(px[j0], py[j0], px[j1], py[j1])
        d = 6.2
        for p in self.poles:
            x, y = self.fx(p.real), self.fy(p.imag)
            self.items.append(f'<line x1="{x - d:.2f}" y1="{y - d:.2f}" x2="{x + d:.2f}" y2="{y + d:.2f}" stroke="#111" stroke-width="2.5"/>')
            self.items.append(f'<line x1="{x - d:.2f}" y1="{y + d:.2f}" x2="{x + d:.2f}" y2="{y - d:.2f}" stroke="#111" stroke-width="2.5"/>')
        for z0 in self.zeros:
            x, y = self.fx(z0.real), self.fy(z0.imag)
            self.items.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="5.6" fill="white" stroke="#111" stroke-width="2.3"/>')
        for (sx, sy) in dots:
            self.items.append(f'<circle cx="{self.fx(sx):.2f}" cy="{self.fy(sy):.2f}" r="4.8" fill="#111"/>')
        for (sx, sy, text, dx, dy, anchor) in labels:
            self.items.append(f'<text x="{self.fx(sx) + dx:.2f}" y="{self.fy(sy) + dy:.2f}" font-size="15" text-anchor="{anchor}">{text}</text>')
        out.append('<g font-family="Arial,Helvetica,sans-serif" fill="#111">')
        out.append('<g clip-path="url(#pc)">')
        out.extend(self.items)
        out.append('</g>')
        out.append(f'<line x1="{self.fx(self.ReMin):.2f}" y1="{oy:.2f}" x2="{self.fx(self.ReMax):.2f}" y2="{oy:.2f}" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>')
        out.append(f'<line x1="{ox:.2f}" y1="{self.fy(self.ImMin):.2f}" x2="{ox:.2f}" y2="{self.fy(self.ImMax):.2f}" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>')
        out.append(f'<text x="{self.fx(self.ReMax) - 2:.2f}" y="{oy + 24:.2f}" font-size="17" text-anchor="end">Re</text>')
        out.append(f'<text x="{ox + 10:.2f}" y="{self.fy(self.ImMax) + 8:.2f}" font-size="17">Im</text>')
        out.append(f'<text x="{ox - 9:.2f}" y="{oy + 19:.2f}" font-size="14" text-anchor="end">0</text>')
        out.append('</g></svg>')
        return '\n'.join(out) + '\n'


# --------------------------------------------------------------------------- #
# Per-question geometry. Each spec fixes the plant (poles/zeros), the visible
# window, the asymptote rays, the labelled feature points and the text offsets.
# --------------------------------------------------------------------------- #
def _bp(x, text):
    return (x, 0.0, text, 0.0, -11, 'middle')


SPECS = {
    201603: dict(poles=[0, -1, -10], zeros=[], window=(-13, 4, -7.5, 7.5),
        asymptotes=[(60, '60°', -11 / 3), (300, '−60°', -11 / 3)],
        labels=[(-1, 0, '−1', 0, 25, 'middle'), (-10, 0, '−10', 0, 25, 'middle'),
                _bp(-0.487, 'd≈−0.487'), (-12.2, 0, '180°', 0, -11, 'middle'),
                (0, 3.162, 'j3.16', -11, 21, 'end'), (0, -3.162, '−j3.16', 12, 21, 'start')],
        dots=[(-0.487, 0), (0, 3.162), (0, -3.162)], sigma=-11 / 3, sigma_text='σa=−11/3'),
    201703: dict(poles=[complex(-0.1, 0.995), complex(-0.1, -0.995)], zeros=[0], window=(-2.6, 0.9, -1.5, 1.5),
        asymptotes=[(180, '', -0.2)],
        labels=[(-1, 0, '−1 (Ta=1.8)', 0, 25, 'middle'), (-2.35, 0, '180°', 0, -12, 'middle'),
                (-0.2, 0, 'σa=−0.2', 0, -12, 'middle'),
                (-0.1, 0.995, '−0.1+j1', -9, -11, 'end'), (-0.1, -0.995, '−0.1−j1', -9, 20, 'end')],
        dots=[(-1, 0)], sigma=-0.2, sigma_text=''),
    201803: dict(poles=[0, -1, -2], zeros=[], window=(-3.5, 1.5, -2.6, 2.6),
        asymptotes=[(60, '60°', -1), (300, '−60°', -1)],
        labels=[(-1, 0, '−1', 0, 25, 'middle'), (-2, 0, '−2', 0, 25, 'middle'),
                _bp(-0.423, 'd≈−0.423'), (-2.55, 0, '180°', 0, -11, 'middle'),
                (-1, 0, 'σa=−1（即极点）', 0, -25, 'middle'),
                (0, 1.414, 'j1.41', -11, 21, 'end'), (0, -1.414, '−j1.41', 12, 21, 'start')],
        dots=[(-0.423, 0), (0, 1.414), (0, -1.414)], sigma=-1, sigma_text=''),
    201903: dict(poles=[0, -6, -7.5], zeros=[], window=(-10, 1.5, -8, 8),
        asymptotes=[(60, '60°', -4.5), (300, '−60°', -4.5)],
        labels=[(-6, 0, '−6', 0, 25, 'middle'), (-7.5, 0, '−7.5', -4, 25, 'middle'),
                _bp(-2.209, 'd≈−2.21'), (-9.2, 0, '180°', 0, -11, 'middle'),
                (0, 6.708, 'j6.71', -11, 21, 'end'), (0, -6.708, '−j6.71', 12, 21, 'start')],
        dots=[(-2.209, 0), (0, 6.708), (0, -6.708)], sigma=-4.5, sigma_text='σa=−4.5'),
    202003: dict(poles=[0, -2, -4], zeros=[], window=(-5.5, 1.5, -4, 4),
        asymptotes=[(60, '60°', -2), (300, '−60°', -2)],
        labels=[(-2, 0, '−2', 0, 25, 'middle'), (-4, 0, '−4', 0, 25, 'middle'),
                _bp(-0.845, 'd≈−0.845'), (-4.8, 0, '180°', 0, -11, 'middle'),
                (-2, 0, 'σa=−2（即极点）', 0, -27, 'middle'),
                (0, 2.828, 'j2.83', -11, 21, 'end'), (0, -2.828, '−j2.83', 12, 21, 'start')],
        dots=[(-0.845, 0), (0, 2.828), (0, -2.828)], sigma=-2, sigma_text=''),
    202103: dict(poles=[0, -5, -10], zeros=[-2], window=(-12, 1, -5, 5),
        asymptotes=[(90, '90°', -6.5), (270, '−90°', -6.5)],
        labels=[(-5, 0, '−5', 0, 25, 'middle'), (-10, 0, '−10', 0, 25, 'middle'),
                (-2, 0, '−2', 0, 25, 'middle'), _bp(-7.341, 'd≈−7.34')],
        dots=[(-7.341, 0)], sigma=-6.5, sigma_text='σa=−6.5'),
    202203: dict(poles=[0, 0, -5], zeros=[-3], window=(-6, 1.5, -4, 4),
        asymptotes=[(90, '90°', -1), (270, '−90°', -1)],
        labels=[(-5, 0, '−5', 0, 25, 'middle'), (-3, 0, '−3', 0, 25, 'middle')],
        dots=[], sigma=-1, sigma_text='σa=−1'),
    202303: dict(poles=[0, -2, -15], zeros=[-4], window=(-16, 1.5, -8, 8),
        asymptotes=[(90, '90°', -6.5), (270, '−90°', -6.5)],
        labels=[(-2, 0, '−2', 0, 25, 'middle'), (-15, 0, '−15', 0, 25, 'middle'),
                (-4, 0, '−4', 0, 25, 'middle'), _bp(-1.136, 'd≈−1.14')],
        dots=[(-1.136, 0)], sigma=-6.5, sigma_text='σa=−6.5'),
    202403: dict(poles=[0, -5, -12], zeros=[], window=(-14, 3, -10, 10),
        asymptotes=[(60, '60°', -17 / 3), (300, '−60°', -17 / 3)],
        labels=[(-5, 0, '−5', -6, 25, 'middle'), (-12, 0, '−12', 0, 25, 'middle'),
                _bp(-2.187, 'd≈−2.19'), (-13.2, 0, '180°', 0, -11, 'middle'), (-17 / 3, 0, 'σa=−5.67', 0, -13, 'middle'),
                (0, 7.746, 'j7.75', -11, 21, 'end'), (0, -7.746, '−j7.75', 12, 21, 'start')],
        dots=[(-2.187, 0), (0, 7.746), (0, -7.746)], sigma=-17 / 3, sigma_text=''),
    202503: dict(poles=[0, -2], zeros=[-4], window=(-8, 1.0, -3.2, 3.2),
        asymptotes=[],
        labels=[(-2, 0, '−2', 0, 25, 'middle'), (-4, 0, '−4', 0, 25, 'middle'),
                (-1.172, 0, 'd1≈−1.17', 8, -11, 'start'), (-6.828, 0, 'd2≈−6.83', -8, -11, 'end')],
        dots=[(-1.172, 0), (-6.828, 0)], sigma=None, sigma_text=None),
    202603: dict(poles=[0, -2], zeros=[-4, -6], window=(-7, 1.0, -2.6, 2.6),
        asymptotes=[],
        labels=[(-2, 0, '−2', 0, 25, 'middle'), (-4, 0, '−4', 0, 25, 'middle'),
                (-6, 0, '−6', 0, 25, 'middle'),
                (-1.268, 0, 'd1≈−1.27', 8, -11, 'start'), (-4.732, 0, 'd2≈−4.73', -8, -11, 'end')],
        dots=[(-1.268, 0), (-4.732, 0)], sigma=None, sigma_text=None),
}


def figure(qid):
    s = SPECS[qid]
    return Figure(s['poles'], s['zeros'], *s['window'], maxw=540, maxh=470)


def render(qid):
    s = SPECS[qid]
    return figure(qid).render(asymptotes=s['asymptotes'], labels=s['labels'], dots=s['dots'],
                              sigma=s['sigma'], sigma_text=s['sigma_text'])


def geometry(qid):
    """Pixel mapping needed to invert an SVG point back to the s-plane."""
    f = figure(qid)
    return dict(U=f.U, mL=f.mL, mT=f.mT, ReMin=f.ReMin, ImMax=f.ImMax)


def asset_path(qid):
    return ROOT / 'data-src' / str(qid // 100) / 'img' / f'solution-{qid}-rootlocus.svg'


def render_all():
    for qid in SPECS:
        path = asset_path(qid)
        path.write_bytes(render(qid).encode('utf-8'))
        print(path.relative_to(ROOT))


if __name__ == '__main__':
    render_all()