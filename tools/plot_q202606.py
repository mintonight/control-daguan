#!/usr/bin/env python3
"""Exam-style vector diagram generator for Q202606 (Nyquist & describing function).

Generates the standard exam-solution figure (Figure 13) for 2026 重大 844 第六题.
Conforms to:
  1. 考研做题规范：单幅复平面（Re, Im）图，严格按传递函数 G(jw) 解析表达式全程连续计算，
     无任何分段拼接或人工拐点。平滑展示起点 2.5、虚轴交点 -j1.5、负实轴交点 -0.25、
     第二象限渐近趋向原点，以及负实轴上的 -1/N(A) 负倒数轨迹 [-0.5, 0] 与自振工作点。
  2. 网站设计规范：纯净黑白工程制图（fill="white" 背景 + #111 线条与文字 + #888 负频对称虚线）；
     在系统浅色模式下为白底黑字，在深色模式下配合网站 CSS (.fig img { filter: invert(.9) hue-rotate(180deg) })
     自动平滑变为深灰底白线，不产生任何彩斑或色相失真。
  3. 题解融合：紧密嵌入题目第 1 问计算之后与第 2 问自振判别之前，作为推导结论的直接视觉载体。
"""
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_TARGET = ROOT / 'data-src/2026/img/solution-202606-nyquist.svg'
PUB_TARGET = ROOT / 'public/img/solution-202606-nyquist.svg'

# Canvas & coordinate layout
WIDTH, HEIGHT = 560, 380
OX, OY = 210.0, 175.0
SCALE = 90.0  # pixels per unit


def plant_eval(w):
    """Frequency response G(jw) = 15 / [(1 + jw)(2 + jw)(3 + jw)]."""
    denom = (1.0 + 1j * w) * (2.0 + 1j * w) * (3.0 + 1j * w)
    val = 15.0 / denom
    return val.real, val.imag


def describing_func(A, M=1.0):
    """Describing function N(A) = 4*M / (pi*A) + 2."""
    return 4.0 * M / (math.pi * A) + 2.0


def fx(re_val):
    return OX + re_val * SCALE


def fy(im_val):
    return OY - im_val * SCALE


def arrow_polygon(x, y, angle_rad, size=8.0, width_ratio=0.5):
    """Generate polygon points for an in-line directional arrow."""
    dx = math.cos(angle_rad)
    dy = math.sin(angle_rad)
    px = -dy * size * width_ratio
    py = dx * size * width_ratio
    p1 = (x - dx * size + px, y - dy * size + py)
    p2 = (x - dx * size - px, y - dy * size - py)
    return f'{x:.2f},{y:.2f} {p1[0]:.2f},{p1[1]:.2f} {p2[0]:.2f},{p2[1]:.2f}'


def generate_svg():
    w_crit = math.sqrt(11.0)

    # Sample G(jw) continuously from w=0 to w=3000 (100% exact mathematical evaluation)
    # Dense sampling in curved regions to ensure smooth rendering across the entire trajectory
    ws = []
    # 1. w from 0 to 1 (40 points)
    for i in range(40):
        ws.append(1.0 * ((i / 40.0) ** 1.3))
    # 2. w from 1 to w_crit (50 points, passes through w_crit at index 89)
    for i in range(50):
        ws.append(1.0 + (w_crit - 1.0) * (i / 50.0))
    # 3. w from w_crit to 15 (70 points, smoothly sweeps second quadrant)
    for i in range(70):
        ws.append(w_crit + (15.0 - w_crit) * ((i / 70.0) ** 1.3))
    # 4. w from 15 to 120 (30 points, converging smoothly into origin)
    for i in range(30):
        ws.append(15.0 + (120.0 - 15.0) * ((i / 30.0) ** 1.8))
    # 5. high frequency limit
    ws.extend([300.0, 1000.0, 5000.0])

    pos_pts = []
    for w in ws:
        re_val, im_val = plant_eval(w)
        pos_pts.append((fx(re_val), fy(im_val)))

    # Ensure last point reaches origin
    pos_pts.append((OX, OY))

    # Mirror for negative frequency branch (w < 0, symmetric across real axis)
    neg_pts = [(x, 2.0 * OY - y) for x, y in reversed(pos_pts)]

    pos_polyline = ' '.join(f'{x:.2f},{y:.2f}' for x, y in pos_pts)
    neg_polyline = ' '.join(f'{x:.2f},{y:.2f}' for x, y in neg_pts)

    # Direction arrows along G(jw):
    # Arrow 1: in 4th quadrant (w ≈ 0.35, sweeping down-left)
    idx1 = 18
    p1_a, p1_b = pos_pts[idx1 - 1], pos_pts[idx1 + 1]
    ang1 = math.atan2(p1_b[1] - p1_a[1], p1_b[0] - p1_a[0])
    arrow1 = arrow_polygon(pos_pts[idx1][0], pos_pts[idx1][1], ang1, size=8.5)

    # Arrow 2: in 3rd quadrant (w ≈ 2.0, sweeping up-left towards -0.25)
    idx2 = 66
    p2_a, p2_b = pos_pts[idx2 - 1], pos_pts[idx2 + 1]
    ang2 = math.atan2(p2_b[1] - p2_a[1], p2_b[0] - p2_a[0])
    arrow2 = arrow_polygon(pos_pts[idx2][0], pos_pts[idx2][1], ang2, size=8.5)

    # Arrow 3: on negative frequency branch in 1st quadrant (w ≈ -0.35, sweeping up-right)
    idx3 = len(neg_pts) - 19
    p3_a, p3_b = neg_pts[idx3 - 1], neg_pts[idx3 + 1]
    ang3 = math.atan2(p3_b[1] - p3_a[1], p3_b[0] - p3_a[0])
    arrow3 = arrow_polygon(neg_pts[idx3][0], neg_pts[idx3][1], ang3, size=8.0)

    # Arrow on -1/N(A) locus (pointing left along negative real axis)
    arrow_na = arrow_polygon(fx(-0.38), OY, math.pi, size=9.0)

    # Landmarks
    x_start = fx(2.5)
    x_cross = fx(-0.25)
    x_na_end = fx(-0.5)
    y_cross_im = fy(-1.5)

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}" role="img">',
        '  <rect width="100%" height="100%" fill="white"/>',
        '  <defs>',
        '    <marker id="ar" markerWidth="10" markerHeight="10" refX="7.5" refY="4" orient="auto-start-reverse" markerUnits="userSpaceOnUse">',
        '      <path d="M0 1.5L8 4L0 6.5Z" fill="#111"/>',
        '    </marker>',
        '  </defs>',
        '  <g font-family="Arial,\'PingFang SC\',\'Microsoft YaHei\',sans-serif" fill="#111">',
        '    <!-- Coordinate Axes -->',
        f'    <line x1="45.00" y1="{OY:.2f}" x2="520.00" y2="{OY:.2f}" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <line x1="{OX:.2f}" y1="340.00" x2="{OX:.2f}" y2="30.00" stroke="#111" stroke-width="1.4" marker-end="url(#ar)"/>',
        f'    <text x="518.00" y="{OY + 24:.2f}" font-size="16" font-style="italic" text-anchor="end">Re</text>',
        f'    <text x="{OX + 12:.2f}" y="42.00" font-size="16" font-style="italic">Im</text>',
        f'    <text x="{OX - 8:.2f}" y="{OY + 19:.2f}" font-size="13" text-anchor="end">0</text>',
        '',
        '    <!-- Negative frequency branch (symmetric dashed) -->',
        f'    <polyline points="{neg_polyline}" fill="none" stroke="#888" stroke-width="1.5" stroke-dasharray="5 4" stroke-linejoin="round" data-kind="nyquist-negative"/>',
        f'    <polygon points="{arrow3}" fill="#888"/>',
        '',
        '    <!-- Positive frequency branch G(jw) -->',
        f'    <polyline points="{pos_polyline}" fill="none" stroke="#111" stroke-width="2.3" stroke-linejoin="round" data-kind="nyquist-positive"/>',
        f'    <polygon points="{arrow1}" fill="#111"/>',
        f'    <polygon points="{arrow2}" fill="#111"/>',
        f'    <text x="325.00" y="325.00" font-size="15" font-weight="bold">G(jω)</text>',
        '',
        '    <!-- Negative reciprocal describing function -1/N(A) -->',
        f'    <line x1="{OX:.2f}" y1="{OY:.2f}" x2="{x_na_end:.2f}" y2="{OY:.2f}" stroke="#111" stroke-width="4.4" stroke-linecap="round" data-kind="describing-function"/>',
        f'    <polygon points="{arrow_na}" fill="#111"/>',
        f'    <circle cx="{x_na_end:.2f}" cy="{OY:.2f}" r="4.2" fill="#111"/>',
        f'    <text x="{x_na_end:.2f}" y="{OY + 22:.2f}" font-size="13" font-weight="bold" text-anchor="middle">−1/2</text>',
        f'    <text x="{fx(-0.42):.2f}" y="{OY - 16:.2f}" font-size="13" font-weight="bold" text-anchor="middle">−1/N(A)</text>',
        f'    <text x="{fx(-0.42):.2f}" y="{OY - 32:.2f}" font-size="11" fill="#444" text-anchor="middle">(A 增大方向)</text>',
        '',
        '    <!-- Intersection Point (-0.25, 0) -->',
        f'    <circle cx="{x_cross:.2f}" cy="{OY:.2f}" r="4.2" fill="#111"/>',
        f'    <circle cx="{x_cross:.2f}" cy="{OY:.2f}" r="7.5" fill="none" stroke="#111" stroke-width="1.3"/>',
        f'    <line x1="{x_cross:.2f}" y1="{OY:.2f}" x2="{x_cross:.2f}" y2="{OY + 32:.2f}" stroke="#111" stroke-width="1.0" stroke-dasharray="3 3"/>',
        f'    <text x="{x_cross:.2f}" y="{OY + 46:.2f}" font-size="13" font-weight="bold" text-anchor="middle">−0.25</text>',
        f'    <text x="{x_cross:.2f}" y="{OY + 62:.2f}" font-size="11" fill="#333" text-anchor="middle">(ω=√11, A=2M/π)</text>',
        '',
        '    <!-- Landmark: w=0 at Re=2.5 -->',
        f'    <circle cx="{x_start:.2f}" cy="{OY:.2f}" r="4.0" fill="#111"/>',
        f'    <text x="{x_start:.2f}" y="{OY + 22:.2f}" font-size="13" font-weight="bold" text-anchor="middle">2.5</text>',
        f'    <text x="{x_start:.2f}" y="{OY - 12:.2f}" font-size="11" fill="#444" text-anchor="middle">(ω=0)</text>',
        '',
        '    <!-- Landmark: w=1 at Im=-1.5 -->',
        f'    <line x1="{OX - 4.0:.2f}" y1="{y_cross_im:.2f}" x2="{OX + 4.0:.2f}" y2="{y_cross_im:.2f}" stroke="#111" stroke-width="1.4"/>',
        f'    <text x="{OX - 8.0:.2f}" y="{y_cross_im + 4.0:.2f}" font-size="13" text-anchor="end">−j1.5</text>',
        '',
        '    <!-- Landmark: w->+inf entering origin -->',
        f'    <text x="{OX + 8.0:.2f}" y="{OY - 16:.2f}" font-size="11" fill="#444">ω→+∞</text>',
        '',
        '    <!-- Caption -->',
        f'    <text x="{WIDTH / 2.0:.2f}" y="{HEIGHT - 16.0:.2f}" font-size="15" font-weight="bold" text-anchor="middle">图 13  奈氏图与负倒数轨迹</text>',
        '  </g>',
        '</svg>',
    ]
    return '\n'.join(lines) + '\n'


def render():
    return generate_svg()


def main():
    content = render()
    SRC_TARGET.parent.mkdir(parents=True, exist_ok=True)
    SRC_TARGET.write_text(content, encoding='utf-8')
    print(f'Wrote source SVG to: {SRC_TARGET}')

    PUB_TARGET.parent.mkdir(parents=True, exist_ok=True)
    PUB_TARGET.write_text(content, encoding='utf-8')
    print(f'Wrote public SVG to: {PUB_TARGET}')


if __name__ == '__main__':
    main()
