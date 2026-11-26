#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate exam-paper-style vector SVG figures for solution explanations.

Conforms to the repository's pure black-and-white engineering figure standard
(white background, #111 primary ink, #777/#888 secondary dashed ink) so figures
render cleanly in both light mode and dark-mode CSS inversion.
"""
import html
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FONT = "Arial,'PingFang SC','Microsoft YaHei',sans-serif"
HALO = 'paint-order="stroke" stroke="white" stroke-width="3.5" stroke-linejoin="round"'


def esc(s):
    return html.escape(str(s), quote=True)


def fmt_sub(s):
    """Convert X_y or X_{yz} tokens into clean SVG <tspan> subscripts."""
    out = []
    pos = 0
    for m in re.finditer(r'_\{([^}]+)\}|_([A-Za-z0-9]+)', s):
        if m.start() > pos:
            out.append(esc(s[pos:m.start()]))
        sub = m.group(1) or m.group(2)
        out.append(f'<tspan dy="3.5" font-size="76%">{esc(sub)}</tspan><tspan dy="-3.5">&#8203;</tspan>')
        pos = m.end()
    if pos < len(s):
        out.append(esc(s[pos:]))
    return ''.join(out)


def arrow_poly(x, y, ang, size=8.0, wr=0.48):
    dx, dy = math.cos(ang), math.sin(ang)
    px, py = -dy * size * wr, dx * size * wr
    p1 = (x - dx * size + px, y - dy * size + py)
    p2 = (x - dx * size - px, y - dy * size - py)
    return f'{x:.2f},{y:.2f} {p1[0]:.2f},{p1[1]:.2f} {p2[0]:.2f},{p2[1]:.2f}'


def polyline_arrow(pts, idx, size=8.0, fill='#111'):
    i0 = max(0, idx - 1)
    i1 = min(len(pts) - 1, idx + 1)
    ang = math.atan2(pts[i1][1] - pts[i0][1], pts[i1][0] - pts[i0][0])
    return f'    <polygon points="{arrow_poly(pts[idx][0], pts[idx][1], ang, size)}" fill="{fill}"/>'


def svg_wrap(width, height, body_lines, title=''):
    head = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img">',
    ]
    if title:
        head.append(f'  <title>{esc(title)}</title>')
    head += [
        '  <rect width="100%" height="100%" fill="white"/>',
        '  <defs>',
        '    <marker id="ar" markerWidth="10" markerHeight="10" refX="7.5" refY="4" orient="auto-start-reverse" markerUnits="userSpaceOnUse">',
        '      <path d="M0 1.5L8 4L0 6.5Z" fill="#111"/>',
        '    </marker>',
        '  </defs>',
        f'  <g font-family="{FONT}" fill="#111">',
    ]
    tail = ['  </g>', '</svg>', '']
    return '\n'.join(head + body_lines + tail)


def save_svg(rel_path, content):
    p = ROOT / rel_path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')
    print(f'wrote {rel_path}')


# ============================================================================
# 1. NYQUIST & DESCRIBING FUNCTION PLOTS
# ============================================================================

def _sample_type1_3rd(K, w_min, w_max, n=260):
    """Exact G(jw) = K / [jw(1+jw)(2+jw)] for w > 0."""
    pts = []
    for i in range(n + 1):
        w = w_min * ((w_max / w_min) ** (i / n))
        z = K / (1j * w * (1 + 1j * w) * (2 + 1j * w))
        pts.append((w, z.real, z.imag))
    return pts


def fig_201604():
    """201604: G(s) = 10(Ts+1)/[s(s-1)], two panels: stable (T>0.1) vs unstable (0<T<0.1)."""
    W, H = 740, 390
    lines = []

    def panel(ox, oy, title_txt, T_val, crit_label, x_minus1):
        sx, sy = 36.0, 34.0
        fx = lambda u: ox + sx * math.asinh(u / 0.9)
        fy = lambda v: oy - sy * math.asinh(v / 0.9)

        x_left, x_right = ox - 155, ox + 52
        y_top, y_bot = oy - 135, oy + 135

        lines.append(f'    <text x="{ox - 52:.1f}" y="26" font-size="14" font-weight="bold" text-anchor="middle">{esc(title_txt)}</text>')
        lines.append(f'    <line x1="{x_left:.1f}" y1="{oy:.1f}" x2="{x_right:.1f}" y2="{oy:.1f}" stroke="#111" stroke-width="1.3" marker-end="url(#ar)"/>')
        lines.append(f'    <line x1="{ox:.1f}" y1="{y_bot:.1f}" x2="{ox:.1f}" y2="{y_top:.1f}" stroke="#111" stroke-width="1.3" marker-end="url(#ar)"/>')
        lines.append(f'    <text x="{x_right - 2:.1f}" y="{oy + 18:.1f}" font-size="13" font-style="italic" text-anchor="end">Re</text>')
        lines.append(f'    <text x="{ox + 9:.1f}" y="{y_top + 10:.1f}" font-size="13" font-style="italic">Im</text>')
        lines.append(f'    <text x="{ox + 6:.1f}" y="{oy + 16:.1f}" font-size="12">0</text>')

        x_asym = fx(-10.0 * (1.0 + T_val))
        lines.append(f'    <line x1="{x_asym:.2f}" y1="{y_top + 14:.1f}" x2="{x_asym:.2f}" y2="{y_bot - 14:.1f}" stroke="#999" stroke-width="1.0" stroke-dasharray="4 4"/>')

        pos_raw = []
        w_min, w_max = 0.28, 250.0
        for i in range(260):
            w = w_min * ((w_max / w_min) ** (i / 259.0))
            z = 10.0 * (1.0 + 1j * T_val * w) / (1j * w * (1j * w - 1.0))
            px, py = fx(z.real), fy(z.imag)
            if y_top + 14 <= py <= y_bot - 14:
                pos_raw.append((px, py))
        pos_raw.append((ox, oy))
        neg_raw = [(x, 2 * oy - y) for x, y in reversed(pos_raw)]

        p_bot, p_top = neg_raw[-1], pos_raw[0]
        rx, ry = 26.0, (p_bot[1] - p_top[1]) / 2.0
        cx_arc, cy_arc = p_bot[0], oy
        arc_pts = [(cx_arc + rx * math.cos(math.pi / 2.0 + math.pi * i / 40.0),
                    cy_arc + ry * math.sin(math.pi / 2.0 + math.pi * i / 40.0)) for i in range(41)]

        lines.append(f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in arc_pts)}" fill="none" stroke="#888" stroke-width="1.3" stroke-dasharray="3 4"/>')
        lines.append(polyline_arrow(arc_pts, 20, size=7.5, fill='#777'))
        lines.append(f'    <text x="{cx_arc - rx - 4:.1f}" y="{oy - 8:.1f}" font-size="11" fill="#555" text-anchor="end">R→∞</text>')

        lines.append(f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in neg_raw)}" fill="none" stroke="#777" stroke-width="1.5" stroke-dasharray="5 4" stroke-linejoin="round"/>')
        lines.append(polyline_arrow(neg_raw, len(neg_raw) // 2, size=7.5, fill='#777'))

        lines.append(f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in pos_raw)}" fill="none" stroke="#111" stroke-width="2.2" stroke-linejoin="round"/>')
        lines.append(polyline_arrow(pos_raw, max(10, len(pos_raw) // 5), size=8.0))
        lines.append(polyline_arrow(pos_raw, int(len(pos_raw) * 0.62), size=8.0))

        x_cr = fx(-10.0 * T_val)
        lines.append(f'    <circle cx="{x_cr:.2f}" cy="{oy:.2f}" r="3.6" fill="#111"/>')
        if T_val > 0.1:
            lines.append(f'    <text x="{x_cr - 5:.1f}" y="{oy + 22:.1f}" font-size="12" font-weight="bold" text-anchor="end" {HALO}>−10T</text>')
        else:
            lines.append(f'    <text x="{x_cr + 4:.1f}" y="{oy - 12:.1f}" font-size="12" font-weight="bold" text-anchor="start" {HALO}>−10T</text>')

        xm1 = fx(x_minus1)
        lines.append(f'    <line x1="{xm1 - 5:.1f}" y1="{oy - 5:.1f}" x2="{xm1 + 5:.1f}" y2="{oy + 5:.1f}" stroke="#111" stroke-width="2.0"/>')
        lines.append(f'    <line x1="{xm1 - 5:.1f}" y1="{oy + 5:.1f}" x2="{xm1 + 5:.1f}" y2="{oy - 5:.1f}" stroke="#111" stroke-width="2.0"/>')
        if T_val > 0.1:
            lines.append(f'    <text x="{xm1:.1f}" y="{oy - 15:.1f}" font-size="12" font-weight="bold" text-anchor="middle" {HALO}>(−1, j0)</text>')
        else:
            lines.append(f'    <text x="{xm1 - 6:.1f}" y="{oy + 24:.1f}" font-size="12" font-weight="bold" text-anchor="middle" {HALO}>(−1, j0)</text>')

        lines.append(f'    <text x="{p_top[0] + 6:.1f}" y="{p_top[1] + 4:.1f}" font-size="11" fill="#444">ω=0⁺</text>')
        lines.append(f'    <text x="{p_bot[0] + 6:.1f}" y="{p_bot[1] + 4:.1f}" font-size="11" fill="#444">ω=0⁻</text>')
        lines.append(f'    <text x="{ox - 52:.1f}" y="{H - 18:.1f}" font-size="12" fill="#333" text-anchor="middle">{esc(crit_label)}</text>')

    panel(265, 195, '(a) 稳定：T > 0.1（−10T < −1）', 0.25, 'N = +1（逆时针绕 1 圈），Z = P − N = 0', -1.0)
    panel(625, 195, '(b) 不稳定：0 < T < 0.1（−1 < −10T < 0）', 0.045, 'N = −1（顺时针绕 1 圈），Z = P − N = 2', -1.0)
    lines.append(f'    <line x1="365" y1="22" x2="365" y2="{H - 22}" stroke="#ddd" stroke-width="1" stroke-dasharray="4 4"/>')

    save_svg('data-src/2016/img/solution-201604-nyquist.svg',
             svg_wrap(W, H, lines, '201604 开环幅相特性曲线与 (-1,j0) 位置'))


def _type1_describing_svg(rel_path, title, K, asym_lbl, cross_val, cross_lbl, na_kind, na_params, caption):
    """Unified mathematically exact Nyquist + -1/N(A) SVG for G(s) = K/[s(s+1)(s+2)]."""
    W, H = 580, 385
    OX, OY = 410.0, 170.0
    s0 = max(abs(cross_val) * 0.6, 0.25)
    SX, SY = 95.0, 82.0
    fx = lambda u: OX + SX * math.asinh(u / s0)
    fy = lambda v: OY - SY * math.asinh(v / s0)

    raw = _sample_type1_3rd(K, 0.12, 80.0, 260)
    pos_pts = [(fx(re), fy(im)) for _, re, im in raw if 36 <= fy(im) <= H - 48 and 40 <= fx(re) <= W - 30]
    pos_pts.append((OX, OY))
    neg_pts = [(x, 2 * OY - y) for x, y in reversed(pos_pts)]

    x_asym = fx(-0.75 * K)
    x_cross = fx(cross_val)

    lines = [
        f'    <line x1="36" y1="{OY:.1f}" x2="{W - 28}" y2="{OY:.1f}" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <line x1="{OX:.1f}" y1="{H - 44}" x2="{OX:.1f}" y2="26" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <text x="{W - 30}" y="{OY + 22:.1f}" font-size="15" font-style="italic" text-anchor="end">Re</text>',
        f'    <text x="{OX + 10:.1f}" y="38" font-size="15" font-style="italic">Im</text>',
        f'    <text x="{OX + 8:.1f}" y="{OY + 18:.1f}" font-size="13">0</text>',
        f'    <line x1="{x_asym:.2f}" y1="42" x2="{x_asym:.2f}" y2="{H - 48}" stroke="#999" stroke-width="1.1" stroke-dasharray="4 4"/>',
        f'    <text x="{x_asym - 6:.1f}" y="{H - 54}" font-size="12" fill="#555" text-anchor="end">{esc(asym_lbl)}</text>',
        f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in neg_pts)}" fill="none" stroke="#888" stroke-width="1.4" stroke-dasharray="5 4" stroke-linejoin="round"/>',
        f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in pos_pts)}" fill="none" stroke="#111" stroke-width="2.3" stroke-linejoin="round"/>',
    ]
    if len(pos_pts) > 30:
        lines.append(polyline_arrow(pos_pts, len(pos_pts) // 5, size=8.5))
        lines.append(polyline_arrow(pos_pts, int(len(pos_pts) * 0.65), size=8.5))
    # Place G(jw) cleanly near lower-right of Q3 branch
    idx_lbl = min(14, len(pos_pts) - 1)
    lines.append(f'    <text x="{pos_pts[idx_lbl][0] + 14:.1f}" y="{pos_pts[idx_lbl][1] + 6:.1f}" font-size="14" font-weight="bold" {HALO}>G(jω)</text>')
    lines.append(f'    <text x="{OX - 12:.1f}" y="{OY - 28:.1f}" font-size="11" fill="#444" text-anchor="end" {HALO}>ω→+∞</text>')

    if na_kind == 'ray':
        lines.append(f'    <line x1="{OX:.2f}" y1="{OY:.2f}" x2="54" y2="{OY:.2f}" stroke="#111" stroke-width="4.0" stroke-linecap="round"/>')
        lines.append(f'    <polygon points="{arrow_poly(fx(cross_val * 2.1), OY, math.pi, 9.0)}" fill="#111"/>')
        lines.append(f'    <text x="112" y="{OY - 16:.1f}" font-size="13" font-weight="bold" text-anchor="middle" {HALO}>−1/N(A)</text>')
        lines.append(f'    <text x="112" y="{OY - 33:.1f}" font-size="11" fill="#444" text-anchor="middle" {HALO}>(A 增大方向)</text>')
    elif na_kind == 'segment':
        u_l, u_r, lbl_l, lbl_r = na_params
        xl, xr = fx(u_l), fx(u_r)
        lines.append(f'    <line x1="{xr:.2f}" y1="{OY:.2f}" x2="{xl:.2f}" y2="{OY:.2f}" stroke="#111" stroke-width="4.4" stroke-linecap="round"/>')
        xm = (xl + xr) / 2.0
        lines.append(f'    <polygon points="{arrow_poly(xm - 6, OY, math.pi, 8.8)}" fill="#111"/>')
        lines.append(f'    <circle cx="{xl:.2f}" cy="{OY:.2f}" r="4.0" fill="white" stroke="#111" stroke-width="1.8"/>')
        lines.append(f'    <circle cx="{xr:.2f}" cy="{OY:.2f}" r="4.0" fill="white" stroke="#111" stroke-width="1.8"/>')
        lines.append(f'    <text x="{xl:.1f}" y="{OY + 22:.1f}" font-size="12" font-weight="bold" text-anchor="middle" {HALO}>{esc(lbl_l)}</text>')
        if lbl_r:
            lines.append(f'    <text x="{xr:.1f}" y="{OY + 22:.1f}" font-size="12" font-weight="bold" text-anchor="middle" {HALO}>{esc(lbl_r)}</text>')
        # Place -1/N(A) label cleanly ABOVE the Q2 arch so zero overlap!
        lbl_y = OY - 50.0 if u_r == 0.0 else OY - 44.0
        lines.append(f'    <line x1="{xm:.1f}" y1="{OY - 5:.1f}" x2="{xm:.1f}" y2="{lbl_y + 6:.1f}" stroke="#777" stroke-width="0.9" stroke-dasharray="2 2"/>')
        lines.append(f'    <text x="{xm:.1f}" y="{lbl_y:.1f}" font-size="13" font-weight="bold" text-anchor="middle" {HALO}>−1/N(A)</text>')
        lines.append(f'    <text x="{xm:.1f}" y="{lbl_y - 16:.1f}" font-size="11" fill="#444" text-anchor="middle" {HALO}>(A 增大方向)</text>')
    elif na_kind == 'folded':
        u_tip, tip_lbl = na_params
        xt = fx(u_tip)
        lines.append(f'    <line x1="52" y1="{OY - 3.5:.2f}" x2="{xt:.2f}" y2="{OY - 3.5:.2f}" stroke="#111" stroke-width="2.6"/>')
        lines.append(f'    <line x1="{xt:.2f}" y1="{OY + 3.5:.2f}" x2="52" y2="{OY + 3.5:.2f}" stroke="#111" stroke-width="2.6"/>')
        lines.append(f'    <path d="M {xt:.2f} {OY - 3.5:.2f} A 3.5 3.5 0 0 1 {xt:.2f} {OY + 3.5:.2f}" fill="none" stroke="#111" stroke-width="2.6"/>')
        lines.append(f'    <polygon points="{arrow_poly((52 + xt) / 2.0 + 12, OY - 3.5, 0.0, 7.5)}" fill="#111"/>')
        lines.append(f'    <polygon points="{arrow_poly((52 + xt) / 2.0 - 12, OY + 3.5, math.pi, 7.5)}" fill="#111"/>')
        lines.append(f'    <circle cx="{xt:.2f}" cy="{OY:.2f}" r="3.8" fill="#111"/>')
        lines.append(f'    <text x="{xt:.1f}" y="{OY - 16:.1f}" font-size="12" font-weight="bold" text-anchor="middle" {HALO}>{esc(tip_lbl)}</text>')
        lines.append(f'    <text x="108" y="{OY - 20:.1f}" font-size="13" font-weight="bold" text-anchor="middle" {HALO}>−1/N(A)</text>')
        lines.append(f'    <text x="108" y="{OY + 24:.1f}" font-size="11" fill="#444" text-anchor="middle" {HALO}>A: a→√2a→∞</text>')

    # Crossing point marker + non-overlapping label placed to bottom-right of crossing
    lines.append(f'    <circle cx="{x_cross:.2f}" cy="{OY:.2f}" r="4.0" fill="#111"/>')
    if na_kind != 'folded' and not (na_kind == 'segment' and na_params[0] > cross_val):
        lines.append(f'    <circle cx="{x_cross:.2f}" cy="{OY:.2f}" r="7.5" fill="none" stroke="#111" stroke-width="1.3"/>')
    lines.append(f'    <line x1="{x_cross:.2f}" y1="{OY:.2f}" x2="{x_cross:.2f}" y2="{OY + 46:.2f}" stroke="#111" stroke-width="1.0" stroke-dasharray="3 3"/>')
    lines.append(f'    <text x="{x_cross + 6:.1f}" y="{OY + 58:.1f}" font-size="12.5" font-weight="bold" text-anchor="start" {HALO}>{esc(cross_lbl)}</text>')

    lines.append(f'    <text x="{W / 2:.1f}" y="{H - 14}" font-size="14" font-weight="bold" text-anchor="middle">{esc(caption)}</text>')
    save_svg(rel_path, svg_wrap(W, H, lines, title))


def fig_201606():
    _type1_describing_svg(
        'data-src/2016/img/solution-201606-nyquist.svg',
        '201606 G(jw) 与 -1/N(A)',
        K=10.0,
        asym_lbl='Re = −7.5',
        cross_val=-10.0 / 6.0,
        cross_lbl='−5/3 (ω=√2, A=20M/3π)',
        na_kind='ray',
        na_params=None,
        caption='G(jω) 与 −1/N(A) 轨迹及稳定自振交点'
    )


def fig_201806():
    W, H = 580, 385
    OX, OY = 410.0, 170.0
    K = 10.0
    s0 = 1.6
    SX, SY = 95.0, 82.0
    fx = lambda u: OX + SX * math.asinh(u / s0)
    fy = lambda v: OY - SY * math.asinh(v / s0)

    pts0, pts_tau = [], []
    w_min, w_max = 0.16, 60.0
    tau = math.atan(1.0 / 3.0)
    for i in range(260):
        w = w_min * ((w_max / w_min) ** (i / 259.0))
        z0 = K / (1j * w * (1 + 1j * w) * (2 + 1j * w))
        zt = z0 * complex(math.cos(-tau * w), math.sin(-tau * w))
        p0 = (fx(z0.real), fy(z0.imag))
        pt = (fx(zt.real), fy(zt.imag))
        if 36 <= p0[1] <= H - 48 and 40 <= p0[0] <= W - 30:
            pts0.append(p0)
        if 36 <= pt[1] <= H - 48 and 40 <= pt[0] <= W - 30:
            pts_tau.append(pt)
    pts0.append((OX, OY))
    pts_tau.append((OX, OY))

    x_c0 = fx(-K / 6.0)
    x_ct = fx(-K / math.sqrt(10.0))

    lines = [
        f'    <line x1="36" y1="{OY:.1f}" x2="{W - 28}" y2="{OY:.1f}" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <line x1="{OX:.1f}" y1="{H - 44}" x2="{OX:.1f}" y2="26" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <text x="{W - 30}" y="{OY + 22:.1f}" font-size="15" font-style="italic" text-anchor="end">Re</text>',
        f'    <text x="{OX + 10:.1f}" y="38" font-size="15" font-style="italic">Im</text>',
        f'    <text x="{OX + 8:.1f}" y="{OY + 18:.1f}" font-size="13">0</text>',
        f'    <line x1="{OX:.2f}" y1="{OY:.2f}" x2="54" y2="{OY:.2f}" stroke="#111" stroke-width="3.8" stroke-linecap="round"/>',
        f'    <polygon points="{arrow_poly(fx(-6.0), OY, math.pi, 9.0)}" fill="#111"/>',
        f'    <text x="108" y="{OY - 15:.1f}" font-size="13" font-weight="bold" text-anchor="middle" {HALO}>−1/N(A) = −πA/4</text>',
        f'    <text x="108" y="{OY - 31:.1f}" font-size="11" fill="#444" text-anchor="middle" {HALO}>(A 增大方向)</text>',
        f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in pts0)}" fill="none" stroke="#111" stroke-width="2.3" stroke-linejoin="round"/>',
        polyline_arrow(pts0, len(pts0) // 4, size=8.0),
        f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in pts_tau)}" fill="none" stroke="#666" stroke-width="1.9" stroke-dasharray="6 4" stroke-linejoin="round"/>',
        polyline_arrow(pts_tau, len(pts_tau) // 4, size=7.5, fill='#666'),
        f'    <circle cx="{x_c0:.2f}" cy="{OY:.2f}" r="4.0" fill="#111"/>',
        f'    <circle cx="{x_c0:.2f}" cy="{OY:.2f}" r="7.2" fill="none" stroke="#111" stroke-width="1.2"/>',
        f'    <line x1="{x_c0:.2f}" y1="{OY:.2f}" x2="{x_c0:.2f}" y2="{OY + 42:.2f}" stroke="#111" stroke-width="1.0" stroke-dasharray="3 3"/>',
        f'    <text x="{x_c0 + 6:.1f}" y="{OY + 55:.1f}" font-size="12" font-weight="bold" text-anchor="start" {HALO}>−K/6 (τ=0, ω=√2)</text>',
        f'    <circle cx="{x_ct:.2f}" cy="{OY:.2f}" r="4.0" fill="#555"/>',
        f'    <line x1="{x_ct:.2f}" y1="{OY:.2f}" x2="{x_ct:.2f}" y2="{OY - 48:.2f}" stroke="#666" stroke-width="1.0" stroke-dasharray="3 3"/>',
        f'    <text x="{x_ct:.1f}" y="{OY - 54:.1f}" font-size="12" fill="#333" text-anchor="middle" {HALO}>τ&gt;0 穿越左移（ω↓, A↑）</text>',
        f'    <line x1="432" y1="68" x2="468" y2="68" stroke="#111" stroke-width="2.3"/>',
        f'    <text x="476" y="72" font-size="12">τ = 0</text>',
        f'    <line x1="432" y1="90" x2="468" y2="90" stroke="#666" stroke-width="1.9" stroke-dasharray="6 4"/>',
        f'    <text x="476" y="94" font-size="12" fill="#444">τ &gt; 0</text>',
        f'    <text x="{W / 2:.1f}" y="{H - 14}" font-size="14" font-weight="bold" text-anchor="middle">G(jω) 与 −1/N(A) 及延迟 τ 对交点的影响</text>',
    ]
    save_svg('data-src/2018/img/solution-201806-nyquist.svg', svg_wrap(W, H, lines, '201806 描述函数分析图'))


def fig_201906():
    _type1_describing_svg(
        'data-src/2019/img/solution-201906-nyquist.svg',
        '201906 G(jw) 与带死区继电特性 -1/N(A)',
        K=4.0,
        asym_lbl='Re = −3',
        cross_val=-2.0 / 3.0,
        cross_lbl='−2/3 (ω=√2)',
        na_kind='folded',
        na_params=(-1.55, '−πa/(2b)'),
        caption='无自振临界条件：−πa/(2b) < −2/3（a/b > 4/3π）'
    )


def fig_202106():
    _type1_describing_svg(
        'data-src/2021/img/solution-202106-nyquist.svg',
        '202106 G(jw) 与 -1/N(A)',
        K=8.0,
        asym_lbl='Re = −6',
        cross_val=-4.0 / 3.0,
        cross_lbl='−4/3 (ω=√2)',
        na_kind='segment',
        na_params=(-1.0, 0.0, '−1', ''),
        caption='G(jω) 与 −1/N(A) ∈ (−1, 0) 无交点（无有限自振、等效闭环不稳定）'
    )


def fig_202204():
    """202204: G(s) = 10(10s+1)/[s(s+1)(0.02s+1)] exact polar/Nyquist curve (angle-preserving radial compression)."""
    W, H = 580, 390
    OX, OY = 240.0, 142.0

    def map_z(z):
        r = abs(z)
        if r == 0:
            return (OX, OY)
        rm = 40.0 * math.asinh(r / 2.0)
        return (OX + rm * (z.real / r), OY - rm * (z.imag / r))

    pos_pts = []
    w_min, w_max = 0.08, 600.0
    for i in range(320):
        w = w_min * ((w_max / w_min) ** (i / 319.0))
        z = 10.0 * (1 + 10j * w) / (1j * w * (1 + 1j * w) * (1 + 0.02j * w))
        px, py = map_z(z)
        if 34 <= py <= H - 46 and 40 <= px <= W - 30:
            pos_pts.append((px, py))
    pos_pts.append((OX, OY))

    w_im = math.sqrt(44.9)
    z_im = 10.0 * (1 + 10j * w_im) / (1j * w_im * (1 + 1j * w_im) * (1 + 0.02j * w_im))
    p_im = map_z(z_im)
    p_m1 = map_z(-1.0 + 0j)

    p_start = pos_pts[0]
    r_inf = math.hypot(p_start[0] - OX, p_start[1] - OY)
    th_start = math.atan2(OY - p_start[1], p_start[0] - OX)
    arc_pts = [(OX + r_inf * math.cos(th_start + (0.0 - th_start) * i / 34.0),
                OY - r_inf * math.sin(th_start + (0.0 - th_start) * i / 34.0)) for i in range(35)]

    lines = [
        f'    <line x1="40" y1="{OY:.1f}" x2="{W - 26}" y2="{OY:.1f}" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <line x1="{OX:.1f}" y1="{H - 40}" x2="{OX:.1f}" y2="26" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <text x="{W - 28}" y="{OY + 22:.1f}" font-size="15" font-style="italic" text-anchor="end">Re</text>',
        f'    <text x="{OX + 10:.1f}" y="38" font-size="15" font-style="italic">Im</text>',
        f'    <text x="{OX + 8:.1f}" y="{OY - 8:.1f}" font-size="13">0</text>',
        # (-1, j0)
        f'    <line x1="{p_m1[0] - 5:.1f}" y1="{OY - 5:.1f}" x2="{p_m1[0] + 5:.1f}" y2="{OY + 5:.1f}" stroke="#111" stroke-width="2.0"/>',
        f'    <line x1="{p_m1[0] - 5:.1f}" y1="{OY + 5:.1f}" x2="{p_m1[0] + 5:.1f}" y2="{OY - 5:.1f}" stroke="#111" stroke-width="2.0"/>',
        f'    <text x="{p_m1[0] - 6:.1f}" y="{OY - 16:.1f}" font-size="13" font-weight="bold" text-anchor="end" {HALO}>(−1, j0)</text>',
        # Dashed R->inf arc
        f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in arc_pts)}" fill="none" stroke="#888" stroke-width="1.4" stroke-dasharray="4 4"/>',
        polyline_arrow(list(reversed(arc_pts)), 17, size=7.5, fill='#777'),
        f'    <text x="{arc_pts[17][0] + 10:.1f}" y="{arc_pts[17][1] + 8:.1f}" font-size="12" fill="#555">R→∞ (90° 顺时针补弧)</text>',
        # Exact G(jw)
        f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in pos_pts)}" fill="none" stroke="#111" stroke-width="2.4" stroke-linejoin="round"/>',
        polyline_arrow(pos_pts, len(pos_pts) // 4, size=8.5),
        polyline_arrow(pos_pts, int(len(pos_pts) * 0.68), size=8.5),
        f'    <circle cx="{p_im[0]:.2f}" cy="{p_im[1]:.2f}" r="3.8" fill="#111"/>',
        f'    <text x="{p_im[0] + 10:.1f}" y="{p_im[1] + 5:.1f}" font-size="12" fill="#222" {HALO}>ω ≈ 6.70 (−j14.9)</text>',
        f'    <text x="{p_start[0] + 8:.1f}" y="{p_start[1] + 4:.1f}" font-size="12" fill="#333">ω→0⁺ (渐近 Re=+89.8, Im→−∞)</text>',
        f'    <text x="112" y="{OY + 34:.1f}" font-size="12" fill="#333" text-anchor="middle" {HALO}>ω→+∞ (沿 −180° 趋于原点)</text>',
        f'    <line x1="188" y1="{OY + 28:.1f}" x2="{OX - 16:.1f}" y2="{OY + 8:.1f}" stroke="#777" stroke-width="0.9" stroke-dasharray="2 2"/>',
        f'    <text x="{W / 2:.1f}" y="{H - 14}" font-size="14" font-weight="bold" text-anchor="middle">开环幅相频率特性曲线 G(jω)（按相角精确压缩径向示意）</text>',
    ]
    save_svg('data-src/2022/img/solution-202204-nyquist.svg', svg_wrap(W, H, lines, '202204 开环幅相特性曲线'))


def fig_202306():
    """202306: Two-panel: Left = equivalent dead-zone relay N (h=0.5, M=2); Right = G(jw) & -1/N(A)."""
    W, H = 740, 370
    lines = []

    ox1, oy1 = 155.0, 180.0
    lines += [
        f'    <text x="{ox1:.1f}" y="28" font-size="14" font-weight="bold" text-anchor="middle">(a) 等效非线性特性 N（h=0.5, M=2）</text>',
        f'    <line x1="35" y1="{oy1:.1f}" x2="285" y2="{oy1:.1f}" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <line x1="{ox1:.1f}" y1="315" x2="{ox1:.1f}" y2="48" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <text x="282" y="{oy1 + 20:.1f}" font-size="14" font-style="italic" text-anchor="end">x</text>',
        f'    <text x="{ox1 + 10:.1f}" y="58" font-size="14" font-style="italic">y</text>',
        f'    <text x="{ox1 - 8:.1f}" y="{oy1 + 17:.1f}" font-size="12" text-anchor="end">0</text>',
        f'    <polyline points="55,{oy1 + 72:.1f} {ox1 - 36:.1f},{oy1 + 72:.1f} {ox1 - 36:.1f},{oy1:.1f} {ox1 + 36:.1f},{oy1:.1f} {ox1 + 36:.1f},{oy1 - 72:.1f} 262,{oy1 - 72:.1f}" fill="none" stroke="#111" stroke-width="2.6" stroke-linejoin="miter"/>',
        f'    <line x1="{ox1:.1f}" y1="{oy1 - 72:.1f}" x2="{ox1 + 36:.1f}" y2="{oy1 - 72:.1f}" stroke="#888" stroke-width="1.0" stroke-dasharray="4 4"/>',
        f'    <line x1="{ox1:.1f}" y1="{oy1 + 72:.1f}" x2="{ox1 - 36:.1f}" y2="{oy1 + 72:.1f}" stroke="#888" stroke-width="1.0" stroke-dasharray="4 4"/>',
        f'    <text x="{ox1 - 8:.1f}" y="{oy1 - 68:.1f}" font-size="13" text-anchor="end">2</text>',
        f'    <text x="{ox1 + 8:.1f}" y="{oy1 + 76:.1f}" font-size="13">−2</text>',
        f'    <text x="{ox1 + 36:.1f}" y="{oy1 + 18:.1f}" font-size="13" text-anchor="middle">0.5</text>',
        f'    <text x="{ox1 - 36:.1f}" y="{oy1 - 8:.1f}" font-size="13" text-anchor="middle">−0.5</text>',
        f'    <line x1="315" y1="24" x2="315" y2="{H - 20}" stroke="#ddd" stroke-width="1" stroke-dasharray="4 4"/>',
    ]

    ox2, oy2 = 640.0, 180.0
    s0 = 1.4
    fx = lambda u: ox2 + 78.0 * math.asinh(u / s0)
    fy = lambda v: oy2 - 68.0 * math.asinh(v / s0)

    pts = []
    w_min, w_max = 0.25, 40.0
    for i in range(240):
        w = w_min * ((w_max / w_min) ** (i / 239.0))
        z = 10.0 / (1j * w * (1 + 1j * w) ** 2)
        px, py = fx(z.real), fy(z.imag)
        if 48 <= py <= H - 44 and 335 <= px <= W - 24:
            pts.append((px, py))
    pts.append((ox2, oy2))

    x_cr = fx(-5.0)
    x_tip = fx(-math.pi / 8.0)

    lines += [
        f'    <text x="528" y="28" font-size="14" font-weight="bold" text-anchor="middle">(b) G(jω) 与 −1/N(A) 交点（k=10）</text>',
        f'    <line x1="335" y1="{oy2:.1f}" x2="{W - 22}" y2="{oy2:.1f}" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <line x1="{ox2:.1f}" y1="322" x2="{ox2:.1f}" y2="48" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <text x="{W - 24}" y="{oy2 + 20:.1f}" font-size="14" font-style="italic" text-anchor="end">Re</text>',
        f'    <text x="{ox2 + 10:.1f}" y="58" font-size="14" font-style="italic">Im</text>',
        f'    <text x="{ox2 + 8:.1f}" y="{oy2 + 17:.1f}" font-size="12">0</text>',
        f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in pts)}" fill="none" stroke="#111" stroke-width="2.3" stroke-linejoin="round"/>',
        polyline_arrow(pts, len(pts) // 4, size=8.0),
        polyline_arrow(pts, int(len(pts) * 0.65), size=8.0),
        # G(jw) cleanly at lower-left of Q3 branch
        f'    <text x="{pts[4][0] - 8:.1f}" y="{pts[4][1] - 4:.1f}" font-size="13" font-weight="bold" text-anchor="end" {HALO}>G(jω)</text>',
        # Folded -1/N(A)
        f'    <line x1="350" y1="{oy2 - 3.5:.2f}" x2="{x_tip:.2f}" y2="{oy2 - 3.5:.2f}" stroke="#111" stroke-width="2.5"/>',
        f'    <line x1="{x_tip:.2f}" y1="{oy2 + 3.5:.2f}" x2="350" y2="{oy2 + 3.5:.2f}" stroke="#111" stroke-width="2.5"/>',
        f'    <path d="M {x_tip:.2f} {oy2 - 3.5:.2f} A 3.5 3.5 0 0 1 {x_tip:.2f} {oy2 + 3.5:.2f}" fill="none" stroke="#111" stroke-width="2.5"/>',
        f'    <polygon points="{arrow_poly(x_cr + 42, oy2 - 3.5, 0.0, 7.2)}" fill="#111"/>',
        f'    <polygon points="{arrow_poly(x_cr + 30, oy2 + 3.5, math.pi, 7.2)}" fill="#111"/>',
        f'    <circle cx="{x_tip:.2f}" cy="{oy2:.2f}" r="3.6" fill="#111"/>',
        # Tip label cleanly below the axis so it never touches the Q2 curve
        f'    <text x="{x_tip:.1f}" y="{oy2 + 22:.1f}" font-size="11.5" font-weight="bold" text-anchor="middle" {HALO}>−π/8</text>',
        # Intersection (-5, 0) + right-aligned callout below axis
        f'    <circle cx="{x_cr:.2f}" cy="{oy2:.2f}" r="4.0" fill="#111"/>',
        f'    <circle cx="{x_cr:.2f}" cy="{oy2:.2f}" r="7.5" fill="none" stroke="#111" stroke-width="1.2"/>',
        f'    <line x1="{x_cr:.2f}" y1="{oy2:.2f}" x2="{x_cr:.2f}" y2="{oy2 + 52:.2f}" stroke="#111" stroke-width="1.0" stroke-dasharray="3 3"/>',
        f'    <text x="{x_cr + 6:.1f}" y="{oy2 + 56:.1f}" font-size="12" font-weight="bold" text-anchor="start" {HALO}>−5 (ω=1)</text>',
        f'    <text x="{x_cr + 6:.1f}" y="{oy2 + 73:.1f}" font-size="11" fill="#333" text-anchor="start" {HALO}>A₁≈12.72(稳), A₂≈0.5004(不稳)</text>',
        f'    <text x="410" y="{oy2 - 18:.1f}" font-size="12" font-weight="bold" {HALO}>−1/N(A)</text>',
    ]
    save_svg('data-src/2023/img/solution-202306-equiv.svg', svg_wrap(W, H, lines, '202306 等效非线性特性与描述函数分析'))


def fig_202404():
    _type1_describing_svg(
        'data-src/2024/img/solution-202404-nyquist.svg',
        '202404 G(jw) 与 -1/N(A)',
        K=1.0,
        asym_lbl='Re = −3/4',
        cross_val=-1.0 / 6.0,
        cross_lbl='−1/6 (ω=√2, A=2/3π)',
        na_kind='ray',
        na_params=None,
        caption='G(jω) 奈奎斯特曲线与 −1/N(A) = −πA/4'
    )


def fig_202506():
    _type1_describing_svg(
        'data-src/2025/img/solution-202506-nyquist.svg',
        '202506 G(jw) 与 -1/N(A)（自振 2<K<6）',
        K=3.0,
        asym_lbl='Re = −3K/4',
        cross_val=-0.5,
        cross_lbl='−K/6 (ω=√2)',
        na_kind='segment',
        na_params=(-1.0, -1.0 / 3.0, '−1', '−1/3'),
        caption='自振状态（2 < K < 6）下 G(jω) 与 −1/N(A) 图像'
    )


# ============================================================================
# 2. PHASE PORTRAITS
# ============================================================================

def fig_201706():
    W, H = 560, 360
    OX, OY = 210.0, 175.0
    SX, SY = 155.0, 260.0
    fx = lambda x: OX + x * SX
    fy = lambda y: OY - y * SY

    pts = []
    for i in range(201):
        x = -0.68 + 2.36 * i / 200.0
        y = x - x * x
        px, py = fx(x), fy(y)
        if 38 <= py <= H - 46:
            pts.append((px, py))

    pt_at = lambda xv: (fx(xv), fy(xv - xv * xv))
    slope_ang = lambda xv, sgn: math.atan2(-sgn * (1.0 - 2.0 * xv) * SY, sgn * SX)

    lines = [
        f'    <line x1="45" y1="{OY:.1f}" x2="{W - 32}" y2="{OY:.1f}" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <line x1="{OX:.1f}" y1="{H - 42}" x2="{OX:.1f}" y2="28" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <text x="{W - 34}" y="{OY + 22:.1f}" font-size="16" font-style="italic" text-anchor="end">x</text>',
        f'    <text x="{OX + 12:.1f}" y="42" font-size="16" font-style="italic">ẋ</text>',
        f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in pts)}" fill="none" stroke="#111" stroke-width="2.4" stroke-linejoin="round"/>',
        f'    <polygon points="{arrow_poly(*pt_at(-0.32), slope_ang(-0.32, -1), 9.0)}" fill="#111"/>',
        f'    <polygon points="{arrow_poly(*pt_at(0.50), slope_ang(0.50, +1), 9.0)}" fill="#111"/>',
        f'    <polygon points="{arrow_poly(*pt_at(1.32), slope_ang(1.32, -1), 9.0)}" fill="#111"/>',
        f'    <line x1="{fx(0.5):.2f}" y1="{OY:.2f}" x2="{fx(0.5):.2f}" y2="{fy(0.25):.2f}" stroke="#888" stroke-width="1.0" stroke-dasharray="4 4"/>',
        f'    <line x1="{OX:.2f}" y1="{fy(0.25):.2f}" x2="{fx(0.5):.2f}" y2="{fy(0.25):.2f}" stroke="#888" stroke-width="1.0" stroke-dasharray="4 4"/>',
        f'    <text x="{fx(0.5):.1f}" y="{fy(0.25) - 12:.1f}" font-size="12.5" text-anchor="middle">(1/2, 1/4)</text>',
        f'    <text x="{OX - 10:.1f}" y="{fy(0.25) + 4:.1f}" font-size="12" text-anchor="end">1/4</text>',
        f'    <circle cx="{fx(0):.2f}" cy="{OY:.2f}" r="4.8" fill="white" stroke="#111" stroke-width="2.0"/>',
        f'    <text x="{fx(0) - 10:.1f}" y="{OY - 12:.1f}" font-size="12.5" font-weight="bold" text-anchor="end">(0, 0) 不稳定</text>',
        f'    <circle cx="{fx(1):.2f}" cy="{OY:.2f}" r="4.8" fill="#111"/>',
        f'    <text x="{fx(1) + 10:.1f}" y="{OY - 12:.1f}" font-size="12.5" font-weight="bold">(1, 0) 渐近稳定</text>',
        f'    <text x="{fx(1):.1f}" y="{OY + 20:.1f}" font-size="13" text-anchor="middle">1</text>',
        f'    <text x="{W / 2:.1f}" y="{H - 14}" font-size="14" font-weight="bold" text-anchor="middle">系统 ẋ = x − x² 的相轨迹图</text>',
    ]
    save_svg('data-src/2017/img/solution-201706-phase.svg', svg_wrap(W, H, lines, '201706 相轨迹图'))


def fig_202005():
    """202005: Two-panel phase portrait: (a) without velocity loop; (b) with velocity loop e+beta*edot=0."""
    W, H = 740, 385
    lines = []

    ox1, oy1 = 180.0, 198.0
    S = 54.0
    fx1 = lambda e: ox1 + e * S
    fy1 = lambda v: oy1 - v * S
    lines += [
        f'    <text x="{ox1:.1f}" y="26" font-size="14" font-weight="bold" text-anchor="middle">(a) 不加入速度控制环（等幅周期振荡）</text>',
        f'    <line x1="36" y1="{oy1:.1f}" x2="332" y2="{oy1:.1f}" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <line x1="{ox1:.1f}" y1="340" x2="{ox1:.1f}" y2="46" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <text x="330" y="{oy1 + 20:.1f}" font-size="15" font-style="italic" text-anchor="end">e</text>',
        f'    <text x="{ox1 + 10:.1f}" y="58" font-size="15" font-style="italic">ė</text>',
        f'    <text x="{ox1 - 8:.1f}" y="{oy1 + 17:.1f}" font-size="12" text-anchor="end">0</text>',
        f'    <text x="{ox1 + 8:.1f}" y="340" font-size="11.5" fill="#444">开关线 e = 0</text>',
    ]
    for C in (0.55, 1.30, 2.25):
        vmax = math.sqrt(2.0 * C)
        rpts = [(fx1(C - 0.5 * v * v), fy1(v)) for v in [vmax - 2 * vmax * i / 80.0 for i in range(81)]]
        lpts = [(fx1(-(C - 0.5 * v * v)), fy1(v)) for v in [-vmax + 2 * vmax * i / 80.0 for i in range(81)]]
        lines.append(f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in rpts)}" fill="none" stroke="#111" stroke-width="1.9"/>')
        lines.append(f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in lpts)}" fill="none" stroke="#111" stroke-width="1.9"/>')
        lines.append(polyline_arrow(rpts, 24, size=7.2))
        lines.append(polyline_arrow(lpts, 24, size=7.2))

    lines.append(f'    <line x1="365" y1="22" x2="365" y2="{H - 20}" stroke="#ddd" stroke-width="1" stroke-dasharray="4 4"/>')

    # Panel (b): beta = 0.22 gives 3 crisp clockwise spiraling loops converging smoothly to origin!
    ox2, oy2 = 555.0, 198.0
    fx2 = lambda e: ox2 + e * S
    fy2 = lambda v: oy2 - v * S
    beta = 0.22
    lines += [
        f'    <text x="{ox2:.1f}" y="26" font-size="14" font-weight="bold" text-anchor="middle">(b) 加入速度控制环（收敛于原点）</text>',
        f'    <line x1="400" y1="{oy2:.1f}" x2="712" y2="{oy2:.1f}" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <line x1="{ox2:.1f}" y1="340" x2="{ox2:.1f}" y2="46" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <text x="710" y="{oy2 + 20:.1f}" font-size="15" font-style="italic" text-anchor="end">e</text>',
        f'    <text x="{ox2 + 10:.1f}" y="58" font-size="15" font-style="italic">ė</text>',
        f'    <line x1="{fx2(-beta * 2.5):.2f}" y1="{fy2(2.5):.2f}" x2="{fx2(beta * 2.5):.2f}" y2="{fy2(-2.5):.2f}" stroke="#555" stroke-width="1.5" stroke-dasharray="6 4"/>',
        f'    <text x="{fx2(beta * 2.5) + 8:.1f}" y="{fy2(-2.45):.1f}" font-size="12" fill="#333">e + βė = 0</text>',
    ]
    e_cur, v_cur = 2.35, 0.0
    reg = 1
    for step in range(14):
        seg = []
        if reg == 1:
            C = e_cur + 0.5 * v_cur * v_cur
            v_next = beta - math.sqrt(beta * beta + 2.0 * C)
            for i in range(45):
                v = v_cur + (v_next - v_cur) * i / 44.0
                e = C - 0.5 * v * v
                seg.append((fx2(e), fy2(v)))
            e_cur, v_cur = -beta * v_next, v_next
            reg = 2
        else:
            C2 = e_cur - 0.5 * v_cur * v_cur
            disc = beta * beta - 2.0 * C2
            if disc <= 0:
                break
            v_next = -beta + math.sqrt(disc)
            for i in range(45):
                v = v_cur + (v_next - v_cur) * i / 44.0
                e = C2 + 0.5 * v * v
                seg.append((fx2(e), fy2(v)))
            e_cur, v_cur = -beta * v_next, v_next
            reg = 1
        lines.append(f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in seg)}" fill="none" stroke="#111" stroke-width="1.9" stroke-linejoin="round"/>')
        if step < 6:
            lines.append(polyline_arrow(seg, 22, size=7.0))
        if abs(e_cur) < 0.03 and abs(v_cur) < 0.08:
            break
    lines.append(f'    <circle cx="{ox2:.2f}" cy="{oy2:.2f}" r="3.6" fill="#111"/>')
    lines.append(f'    <circle cx="{fx2(2.35):.2f}" cy="{oy2:.2f}" r="3.6" fill="#111"/>')
    lines.append(f'    <text x="{fx2(2.35) + 6:.1f}" y="{oy2 - 10:.1f}" font-size="11.5">起点</text>')

    save_svg('data-src/2020/img/solution-202005-phase.svg', svg_wrap(W, H, lines, '202005 相轨迹对比图'))


def fig_202205():
    W, H = 560, 360
    OX, OY = 280.0, 178.0
    S = 49.0
    fx = lambda e: OX + e * S
    fy = lambda v: OY - v * S

    arc_r1 = [(fx(2 + 2 * math.cos(t)), fy(2 * math.sin(t))) for t in [0 - (math.pi / 2) * i / 40.0 for i in range(41)]]
    seg_b = [(fx(2 - 4 * i / 40.0), fy(-2)) for i in range(41)]
    arc_l = [(fx(-2 + 2 * math.cos(t)), fy(2 * math.sin(t))) for t in [-math.pi / 2 - math.pi * i / 80.0 for i in range(81)]]
    seg_t = [(fx(-2 + 4 * i / 40.0), fy(2)) for i in range(41)]
    arc_r2 = [(fx(2 + 2 * math.cos(t)), fy(2 * math.sin(t))) for t in [math.pi / 2 - (math.pi / 2) * i / 40.0 for i in range(41)]]
    full = arc_r1 + seg_b[1:] + arc_l[1:] + seg_t[1:] + arc_r2[1:]

    lines = [
        f'    <line x1="40" y1="{OY:.1f}" x2="{W - 30}" y2="{OY:.1f}" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <line x1="{OX:.1f}" y1="{H - 42}" x2="{OX:.1f}" y2="26" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <text x="{W - 32}" y="{OY + 22:.1f}" font-size="16" font-style="italic" text-anchor="end">e</text>',
        f'    <text x="{OX + 12:.1f}" y="40" font-size="16" font-style="italic">ė</text>',
        f'    <text x="{OX - 10:.1f}" y="{OY + 18:.1f}" font-size="13" text-anchor="end">0</text>',
        f'    <line x1="{fx(2):.2f}" y1="54" x2="{fx(2):.2f}" y2="{H - 48}" stroke="#888" stroke-width="1.1" stroke-dasharray="5 4"/>',
        f'    <line x1="{fx(-2):.2f}" y1="54" x2="{fx(-2):.2f}" y2="{H - 48}" stroke="#888" stroke-width="1.1" stroke-dasharray="5 4"/>',
        f'    <polyline points="{" ".join(f"{x:.2f},{y:.2f}" for x, y in full)}" fill="none" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/>',
        polyline_arrow(arc_r1, 20, size=8.5),
        polyline_arrow(seg_b, 20, size=8.5),
        polyline_arrow(arc_l, 22, size=8.5),
        polyline_arrow(arc_l, 58, size=8.5),
        polyline_arrow(seg_t, 20, size=8.5),
        polyline_arrow(arc_r2, 20, size=8.5),
        f'    <circle cx="{fx(2):.2f}" cy="{OY:.2f}" r="3.2" fill="#111"/>',
        f'    <circle cx="{fx(-2):.2f}" cy="{OY:.2f}" r="3.2" fill="#111"/>',
        f'    <circle cx="{fx(4):.2f}" cy="{OY:.2f}" r="4.5" fill="#111"/>',
        f'    <text x="{fx(2) + 6:.1f}" y="{OY + 18:.1f}" font-size="13">2</text>',
        f'    <text x="{fx(-2) - 6:.1f}" y="{OY + 18:.1f}" font-size="13" text-anchor="end">−2</text>',
        f'    <text x="{fx(4) + 10:.1f}" y="{OY - 10:.1f}" font-size="13" font-weight="bold">4 (起点)</text>',
        f'    <text x="{fx(-4) - 8:.1f}" y="{OY + 18:.1f}" font-size="13" text-anchor="end">−4</text>',
        f'    <text x="{OX - 10:.1f}" y="{fy(2) - 8:.1f}" font-size="13" text-anchor="end">2</text>',
        f'    <text x="{OX + 8:.1f}" y="{fy(-2) + 20:.1f}" font-size="13">−2</text>',
        f'    <text x="{fx(3.0):.1f}" y="58" font-size="12" fill="#555" text-anchor="middle">e &gt; 2</text>',
        f'    <text x="{fx(-0.95):.1f}" y="58" font-size="12" fill="#555" text-anchor="middle">−2 ≤ e ≤ 2</text>',
        f'    <text x="{fx(-3.0):.1f}" y="58" font-size="12" fill="#555" text-anchor="middle">e &lt; −2</text>',
        f'    <text x="{W / 2:.1f}" y="{H - 14}" font-size="14" font-weight="bold" text-anchor="middle">e–ė 相轨迹（起点 (4, 0) 的封闭等幅周期轨道）</text>',
    ]
    save_svg('data-src/2022/img/solution-202205-phase.svg', svg_wrap(W, H, lines, '202205 相轨迹图'))


# ============================================================================
# 3. SIGNAL FLOW GRAPHS (FOR MASON'S GAIN FORMULA)
# ============================================================================

def _sfg_edge_straight(lines, p1, p2, label, dy=-10, font_size=13):
    x1, y1 = p1
    x2, y2 = p2
    lines.append(f'    <line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="#111" stroke-width="1.8"/>')
    mx, my = (x1 + x2) / 2.0, (y1 + y2) / 2.0
    ang = math.atan2(y2 - y1, x2 - x1)
    lines.append(f'    <polygon points="{arrow_poly(mx + 4 * math.cos(ang), my + 4 * math.sin(ang), ang, 8.0)}" fill="#111"/>')
    if label:
        lines.append(f'    <text x="{mx:.1f}" y="{my + dy:.1f}" font-size="{font_size}" text-anchor="middle" {HALO}>{fmt_sub(label)}</text>')


def _sfg_arc(lines, p1, p2, ctrl_y, label, lbl_dy=17, font_size=13, stroke='#111'):
    x1, y1 = p1
    x2, y2 = p2
    cx, cy = (x1 + x2) / 2.0, ctrl_y
    lines.append(f'    <path d="M {x1:.1f} {y1:.1f} Q {cx:.1f} {cy:.1f} {x2:.1f} {y2:.1f}" fill="none" stroke="{stroke}" stroke-width="1.7"/>')
    mx = 0.25 * x1 + 0.5 * cx + 0.25 * x2
    my = 0.25 * y1 + 0.5 * cy + 0.25 * y2
    ang = math.atan2(y2 - y1, x2 - x1)
    lines.append(f'    <polygon points="{arrow_poly(mx + 4 * math.cos(ang), my + 4 * math.sin(ang), ang, 8.0)}" fill="{stroke}"/>')
    if label:
        lines.append(f'    <text x="{mx:.1f}" y="{my + lbl_dy:.1f}" font-size="{font_size}" text-anchor="middle" fill="{stroke}" {HALO}>{fmt_sub(label)}</text>')


def _sfg_nodes(lines, nodes):
    for item in nodes:
        x, y, name, dy = item[:4]
        dx = item[4] if len(item) > 4 else 0
        lines.append(f'    <circle cx="{x:.1f}" cy="{y:.1f}" r="4.2" fill="white" stroke="#111" stroke-width="2.0"/>')
        lines.append(f'    <text x="{x + dx:.1f}" y="{y + dy:.1f}" font-size="14" font-weight="bold" text-anchor="middle" {HALO}>{fmt_sub(name)}</text>')


def fig_201602_sfg():
    W, H = 580, 230
    y = 95.0
    pts = [(65, y), (180, y), (325, y), (505, y)]
    lines = []
    _sfg_edge_straight(lines, pts[0], pts[1], '1', -12)
    _sfg_edge_straight(lines, pts[1], pts[2], '2', -12)
    _sfg_edge_straight(lines, pts[2], pts[3], '10/[s(s+1)]', -12)
    _sfg_arc(lines, pts[3], pts[2], y + 72, '−0.5s', 18)
    _sfg_arc(lines, pts[3], pts[1], y + 165, '−1', 18)
    _sfg_nodes(lines, [(pts[0][0], y, 'R(s)', -14), (pts[1][0], y, 'E(s)', -14), (pts[2][0], y, 'X_1(s)', -14), (pts[3][0], y, 'Y(s)', -14)])
    lines.append(f'    <text x="{W / 2:.1f}" y="{H - 12}" font-size="13.5" font-weight="bold" text-anchor="middle">{fmt_sub("系统信号流图（L_1 = −5/(s+1)，L_2 = −20/[s(s+1)]）")}</text>')
    save_svg('data-src/2016/img/solution-201602-sfg.svg', svg_wrap(W, H, lines, '201602 信号流图'))


def fig_201802_sfg():
    W, H = 580, 230
    y = 95.0
    pts = [(65, y), (185, y), (320, y), (505, y)]
    lines = []
    _sfg_edge_straight(lines, pts[0], pts[1], '1', -12)
    _sfg_edge_straight(lines, pts[1], pts[2], '1', -12)
    _sfg_edge_straight(lines, pts[2], pts[3], '10/[s(s+1)]', -12)
    _sfg_arc(lines, pts[3], pts[2], y + 72, '−K_L s', 18)
    _sfg_arc(lines, pts[3], pts[1], y + 165, '−1', 18)
    _sfg_nodes(lines, [(pts[0][0], y, 'R(s)', -14), (pts[1][0], y, 'E(s)', -14), (pts[2][0], y, 'X_1(s)', -14), (pts[3][0], y, 'Y(s)', -14)])
    lines.append(f'    <text x="{W / 2:.1f}" y="{H - 12}" font-size="13.5" font-weight="bold" text-anchor="middle">{fmt_sub("系统信号流图（L_1 = −10K_L/(s+1)，L_2 = −10/[s(s+1)]）")}</text>')
    save_svg('data-src/2018/img/solution-201802-sfg.svg', svg_wrap(W, H, lines, '201802 信号流图'))


def fig_202002_sfg():
    W, H = 600, 370
    lines = []
    y1 = 80.0
    p1 = [(75, y1), (195, y1), (340, y1), (515, y1)]
    lines.append(f'    <text x="{W / 2:.1f}" y="24" font-size="13.5" font-weight="bold" text-anchor="middle">(a) 第 1 问系统信号流图</text>')
    _sfg_edge_straight(lines, p1[0], p1[1], '1', -11)
    _sfg_edge_straight(lines, p1[1], p1[2], '1', -11)
    _sfg_edge_straight(lines, p1[2], p1[3], '2/s', -11)
    _sfg_arc(lines, p1[3], p1[2], y1 + 60, '−K_d', 17)
    _sfg_arc(lines, p1[3], p1[1], y1 + 148, '−5', 17)
    _sfg_nodes(lines, [(p1[0][0], y1, 'R', -13), (p1[1][0], y1, 'E', -13), (p1[2][0], y1, 'X_1', -13), (p1[3][0], y1, 'Y', -13)])

    lines.append('    <line x1="36" y1="182" x2="564" y2="182" stroke="#ddd" stroke-width="1" stroke-dasharray="4 4"/>')

    y2 = 256.0
    p2 = [(75, y2), (195, y2), (355, y2), (515, y2)]
    lines.append(f'    <text x="{W / 2:.1f}" y="206" font-size="13.5" font-weight="bold" text-anchor="middle">{fmt_sub("(b) 第 2 问引入 G_c(s) = K_1/(s+5) 后的信号流图")}</text>')
    _sfg_edge_straight(lines, p2[0], p2[1], '1', -11)
    _sfg_edge_straight(lines, p2[1], p2[2], 'K_1/(s+5)', -11)
    _sfg_edge_straight(lines, p2[2], p2[3], '2/s', -11)
    _sfg_arc(lines, p2[3], p2[2], y2 + 60, '−K_d', 17)
    _sfg_arc(lines, p2[3], p2[1], y2 + 148, '−5', 17)
    _sfg_nodes(lines, [(p2[0][0], y2, 'R', -13), (p2[1][0], y2, 'E', -13), (p2[2][0], y2, 'X_1', -13), (p2[3][0], y2, 'Y', -13)])

    save_svg('data-src/2020/img/solution-202002-sfg.svg', svg_wrap(W, H, lines, '202002 信号流图'))


def fig_202102_sfg():
    W, H = 580, 230
    y = 95.0
    pts = [(65, y), (185, y), (320, y), (505, y)]
    lines = []
    _sfg_edge_straight(lines, pts[0], pts[1], '1', -12)
    _sfg_edge_straight(lines, pts[1], pts[2], '1', -12)
    _sfg_edge_straight(lines, pts[2], pts[3], '10/[s(s+1)]', -12)
    _sfg_arc(lines, pts[3], pts[2], y + 72, '−k_t', 18)
    _sfg_arc(lines, pts[3], pts[1], y + 165, '−1', 18)
    _sfg_nodes(lines, [(pts[0][0], y, 'R(s)', -14), (pts[1][0], y, 'E(s)', -14), (pts[2][0], y, 'X_1(s)', -14), (pts[3][0], y, 'Y(s)', -14)])
    lines.append(f'    <text x="{W / 2:.1f}" y="{H - 12}" font-size="13.5" font-weight="bold" text-anchor="middle">{fmt_sub("第 2 问信号流图（L_1 = −10k_t/[s(s+1)]，L_2 = −10/[s(s+1)]）")}</text>')
    save_svg('data-src/2021/img/solution-202102-sfg.svg', svg_wrap(W, H, lines, '202102 信号流图'))


def fig_202302_sfg():
    W, H = 620, 280
    y = 132.0
    pts = [(60, y), (175, y), (345, y), (540, y)]
    lines = []
    _sfg_edge_straight(lines, pts[0], pts[1], '1', -12)
    _sfg_edge_straight(lines, pts[1], pts[2], '1/(1.2s+1)', -12)
    _sfg_edge_straight(lines, pts[2], pts[3], '1/s', -12)
    _sfg_arc(lines, pts[0], pts[2], y - 135, 'G_c(s)', -10)
    _sfg_arc(lines, pts[3], pts[2], y + 78, '−K_t', 18)
    _sfg_arc(lines, pts[3], pts[1], y + 172, '−K_d', 18)
    _sfg_nodes(lines, [(pts[0][0], y, 'R(s)', 20), (pts[1][0], y, 'E(s)', -14), (pts[2][0], y, 'V(s)', -14, 14), (pts[3][0], y, 'Y(s)', -14)])
    lines.append(f'    <text x="{W / 2:.1f}" y="{H - 12}" font-size="13.5" font-weight="bold" text-anchor="middle">{fmt_sub("系统信号流图（前向通路 P_1, P_2；回路 L_1 = −K_t/s, L_2 = −K_d/[s(1.2s+1)]）")}</text>')
    save_svg('data-src/2023/img/solution-202302-sfg.svg', svg_wrap(W, H, lines, '202302 信号流图'))


def fig_202502_sfg():
    W, H = 640, 280
    y = 135.0
    pts = [(55, y), (155, y), (295, y), (435, y), (575, y)]
    lines = []
    _sfg_edge_straight(lines, pts[0], pts[1], '1', -12)
    _sfg_edge_straight(lines, pts[1], pts[2], 'K', -12)
    _sfg_edge_straight(lines, pts[2], pts[3], '1/s', -12)
    _sfg_edge_straight(lines, pts[3], pts[4], '1/(s+1)', -12)
    _sfg_arc(lines, pts[3], pts[2], y - 110, '−T_d', -10)
    _sfg_arc(lines, pts[4], pts[3], y + 74, '−1', 18)
    _sfg_arc(lines, pts[3], pts[1], y + 154, '−1', 18)
    _sfg_nodes(lines, [(pts[0][0], y, 'R(s)', -14), (pts[1][0], y, 'E(s)', -14), (pts[2][0], y, 'X_1(s)', 20), (pts[3][0], y, 'V(s)', -14, 16), (pts[4][0], y, 'C(s)', -14)])
    lines.append(f'    <text x="{W / 2:.1f}" y="{H - 12}" font-size="13.5" font-weight="bold" text-anchor="middle">{fmt_sub("系统信号流图（三条接触回路 L_1 = −K/s，L_2 = −T_d/s，L_3 = −1/(s+1)）")}</text>')
    save_svg('data-src/2025/img/solution-202502-sfg.svg', svg_wrap(W, H, lines, '202502 信号流图'))


def fig_202602_sfg():
    W, H = 620, 275
    y = 130.0
    pts = [(65, y), (220, y), (370, y), (545, y)]
    p_n = (370, 44.0)
    lines = []
    _sfg_edge_straight(lines, pts[0], pts[1], '1', -12)
    _sfg_edge_straight(lines, pts[1], pts[2], '1', -12)
    _sfg_edge_straight(lines, pts[2], pts[3], 'G(s)', -12)
    _sfg_edge_straight(lines, p_n, pts[2], '', 0)
    lines.append(f'    <text x="{p_n[0] + 16:.1f}" y="{(p_n[1] + y) / 2 + 4:.1f}" font-size="13">1</text>')
    _sfg_arc(lines, pts[0], pts[1], y + 100, '5H(s)', 18)
    _sfg_arc(lines, pts[3], pts[1], y + 148, '−H(s)', 18)
    _sfg_nodes(lines, [(pts[0][0], y, 'R(s)', -14), (pts[1][0], y, 'X_1(s)', -14), (pts[2][0], y, 'X_2(s)', 20), (pts[3][0], y, 'C(s)', -14), (p_n[0], p_n[1], 'N(s)', -12)])
    lines.append(f'    <text x="{W / 2:.1f}" y="{H - 12}" font-size="13.5" font-weight="bold" text-anchor="middle">{fmt_sub("系统信号流图（回路 L_1 = −G(s)H(s)；R→C 两通路 P_1=G, P_2=5GH）")}</text>')
    save_svg('data-src/2026/img/solution-202602-sfg.svg', svg_wrap(W, H, lines, '202602 信号流图'))


def main():
    fig_201604()
    fig_201606()
    fig_201806()
    fig_201906()
    fig_202106()
    fig_202204()
    fig_202306()
    fig_202404()
    fig_202506()
    fig_201706()
    fig_202005()
    fig_202205()
    fig_201602_sfg()
    fig_201802_sfg()
    fig_202002_sfg()
    fig_202102_sfg()
    fig_202302_sfg()
    fig_202502_sfg()
    fig_202602_sfg()


if __name__ == '__main__':
    main()
