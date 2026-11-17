#!/usr/bin/env python3
"""Rebuild the Q202304 solution diagram using only Python's standard library."""
import html
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'data-src/2023/img/solution-202304-bode.svg'
LEFT, RIGHT = 70, 690
TOP, HEIGHT = 40, 200
PHASE_TOP, PHASE_HEIGHT = 460, 250


def magnitude(w):
    return 500 * math.hypot(w, 2) * math.hypot(w, 3) / (w * math.hypot(.8*w, 2) * math.hypot(w, 10) * math.hypot(w, 50))


def phase(w):
    return -90 + math.degrees(math.atan(w/2)+math.atan(w/3)-math.atan(w/2.5)-math.atan(w/10)-math.atan(w/50))


def asymptote(w):
    return 20*math.log10(3/w) + sum(sign*20*math.log10(max(1, w/corner)) for corner, sign in [(2, 1), (2.5, -1), (3, 1), (10, -1), (50, -1)])


def crossover():
    lo, hi = 1., 100.
    for _ in range(100):
        mid = (lo+hi)/2
        if magnitude(mid) > 1:
            lo = mid
        else:
            hi = mid
    return (lo+hi)/2


def x(w):
    return LEFT + (math.log10(w)+1)*(RIGHT-LEFT)/4


def amplitude_y(db):
    return TOP + (40-db)*HEIGHT/110


def phase_y(degrees):
    return PHASE_TOP + (-45-degrees)*PHASE_HEIGHT/140


def render():
    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="720" height="810" viewBox="0 0 720 810" role="img" aria-labelledby="title desc">',
           '<title id="title">Q202304 exam-style Bode diagram</title>',
           '<desc id="desc">Logarithmic frequency in rad/s. Black magnitude asymptotes with corners 2,2.5,3,10,50. Slopes -20,0,-20,0,-20,-40 dB/dec. Phase initially rises from -90 degrees, then tends to -180 degrees. Dashed constructions use the asymptotic crossover 12.5 and its phase margin 103.3 degrees.</desc>',
           '<defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse"><path d="M0 0L6 3L0 6Z" fill="#222"/></marker></defs>',
           '<rect width="720" height="810" fill="white"/>',
           '<g font-family="Arial,sans-serif" font-size="16" fill="#222">']
    def line(x1, y1, x2, y2, color='#d9dde3', extra=''):
        out.append(f'<line x1="{x1:.3f}" y1="{y1:.3f}" x2="{x2:.3f}" y2="{y2:.3f}" stroke="{color}" {extra}/>')
    def text(px, py, label, extra=''):
        out.append(f'<text x="{px:.3f}" y="{py:.3f}" {extra}>{html.escape(label)}</text>')
    def poly(kind, samples, value, ordinate):
        points = ' '.join(f'{x(w):.6f},{ordinate(value(w)):.6f}' for w in samples)
        out.append(f'<polyline data-kind="{kind}" points="{points}" fill="none" stroke="#222" stroke-width="2.3"/>')
    for start, height, ordinate, ticks in [(TOP, HEIGHT, amplitude_y, [40, 20, 0, -20, -40, -60]), (PHASE_TOP, PHASE_HEIGHT, phase_y, [-60, -90, -120, -150, -180])]:
        for tick in ticks:
            yy = ordinate(tick)
            if tick in [0, -90, -180]:
                line(LEFT, yy, RIGHT, yy, '#939aa4', 'stroke-dasharray="5 5"' if tick else '')
            text(LEFT-10, yy+5, str(tick), 'text-anchor="end"')
        for w, label in [(.1, '0.1'), (1, '1'), (10, '10'), (100, '100'), (1000, '1000')]:
            line(x(w), start+height, x(w), start+height+6, '#555')
            text(x(w), start+height+25, label, 'text-anchor="middle"')
        line(LEFT, start, LEFT, start+height, '#555')
        line(LEFT, start+height, RIGHT, start+height, '#555')
        text(RIGHT, start+height+78, 'ω / (rad/s)', 'text-anchor="end"')
    text(LEFT, 23, 'Lₐ(ω) / dB')
    text(LEFT, 443, 'φ(ω) / °')
    poly('magnitude-asymptote', [.1, 2, 2.5, 3, 10, 12.5, 50, 1000], asymptote, amplitude_y)
    samples = sorted(set([10**(-1+4*i/600) for i in range(601)]+[1., 3., 10., 12.5, 50.]))
    poly('phase-exact', samples, phase, phase_y)
    for w in [2, 2.5, 3, 10, 50]:
        yy = amplitude_y(asymptote(w))
        line(x(w), yy, x(w), TOP+HEIGHT, '#939aa4', 'stroke-dasharray="4 4"')
    for w, offset in [(2, 51), (2.5, 76), (3, 51), (50, 25)]:
        line(x(w), TOP+HEIGHT, x(w), TOP+HEIGHT+offset-17, '#939aa4')
        text(x(w), TOP+HEIGHT+offset, f'{w:g}', 'text-anchor="middle"')
    text(LEFT, 350, 'm / (dB/dec)')
    text(LEFT, 377, 'ω')
    text(LEFT, 404, 'm')
    for col, interval, slope in zip(range(6), ['(0, 2)', '(2, 2.5)', '(2.5, 3)', '(3, 10)', '(10, 50)', '(50, ∞)'], ['−20', '0', '−20', '0', '−20', '−40']):
        xx = 195+90*col
        text(xx, 377, interval, 'text-anchor="middle" font-size="15"')
        text(xx, 404, slope, 'text-anchor="middle"')
    wc = 12.5
    zero = amplitude_y(0)
    line(x(wc), zero, x(wc), TOP+HEIGHT, '#555', 'stroke-dasharray="5 4"')
    line(x(wc), TOP+HEIGHT, x(wc), TOP+HEIGHT+34, '#939aa4')
    text(x(wc), TOP+HEIGHT+51, '12.5', 'text-anchor="middle"')
    py, base = phase_y(phase(wc)), phase_y(-180)
    line(x(wc), py, RIGHT, py, '#939aa4', 'stroke-dasharray="4 5"')
    text(RIGHT-4, py-9, '−76.65°', 'text-anchor="end"')
    line(x(wc), py+4, x(wc), base-4, '#222', 'marker-start="url(#arrow)" marker-end="url(#arrow)"')
    line(x(wc), base, x(wc), PHASE_TOP+PHASE_HEIGHT+34, '#939aa4', 'stroke-dasharray="4 4"')
    text(x(wc), PHASE_TOP+PHASE_HEIGHT+51, '12.5', 'text-anchor="middle"')
    mid = (py+base)/2
    out.append(f'<text x="{x(wc)+20:.3f}" y="{mid:.3f}" transform="rotate(-90 {x(wc)+20:.3f} {mid:.3f})" text-anchor="middle">γ ≈ 103.3°</text>')
    out += ['</g>', '</svg>']
    return '\n'.join(out)+'\n'


if __name__ == '__main__':
    TARGET.write_text(render(), encoding='utf-8')
    print(TARGET.relative_to(ROOT))
