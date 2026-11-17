import importlib.util
import math
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('plot_rl', ROOT / 'tools/plot_q201603.py')
plot = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(plot)
NS = {'s': 'http://www.w3.org/2000/svg'}

# Open-loop plant for each question, transcribed independently from the stem.
# The characteristic equation is A(s)+K B(s)=0 with A=poly(poles), B=poly(zeros).
PLANTS = {
    201603: ([0, -1, -10], []),
    201703: ([complex(-0.1, 0.995), complex(-0.1, -0.995)], [0]),
    201803: ([0, -1, -2], []),
    201903: ([0, -6, -7.5], []),
    202003: ([0, -2, -4], []),
    202103: ([0, -5, -10], [-2]),
    202203: ([0, 0, -5], [-3]),
    202303: ([0, -2, -15], [-4]),
    202403: ([0, -5, -12], []),
    202503: ([0, -2], [-4]),
    202603: ([0, -2], [-4, -6]),
}


def poly_mul(p, q):
    r = [0.0] * (len(p) + len(q) - 1)
    for i, a in enumerate(p):
        for j, b in enumerate(q):
            r[i + j] += a * b
    return r


def poly_sub(p, q):
    n = max(len(p), len(q))
    p = [0.0] * (n - len(p)) + list(p)
    q = [0.0] * (n - len(q)) + list(q)
    return [a - b for a, b in zip(p, q)]


class RootLocusPlotTest(unittest.TestCase):
    def test_each_asset_is_reproducible_from_the_generator(self):
        for qid in PLANTS:
            with self.subTest(qid=qid):
                asset = plot.asset_path(qid)
                self.assertTrue(asset.is_file(), asset)
                self.assertEqual(asset.read_text(encoding='utf-8'), plot.render(qid))
                self.assertEqual(asset.read_bytes(), (ROOT / 'public/img' / asset.name).read_bytes())
                text = asset.read_text(encoding='utf-8')
                self.assertNotRegex(text, r'<script|<foreignObject|\bon\w+=|href=')
                root = ET.fromstring(text)
                self.assertGreaterEqual(len(root.findall('.//s:polyline', NS)), 2)
                self.assertTrue(root.attrib['viewBox'])

    def test_plant_matches_the_question_stem(self):
        for qid, (poles, zeros) in PLANTS.items():
            with self.subTest(qid=qid):
                spec = plot.SPECS[qid]
                self.assertEqual(len(spec['poles']), len(poles))
                for got, want in zip(sorted(spec['poles'], key=lambda z: (z.real, z.imag)),
                                     sorted(poles, key=lambda z: (z.real, z.imag))):
                    self.assertAlmostEqual(got.real, want.real, places=6)
                    self.assertAlmostEqual(got.imag, want.imag, places=6)
                self.assertEqual(len(spec['zeros']), len(zeros))

    def test_every_drawn_point_satisfies_the_angle_condition(self):
        for qid, (poles, zeros) in PLANTS.items():
            with self.subTest(qid=qid):
                A = plot.poly_from_roots(poles) if poles else [1.0]
                B = plot.poly_from_roots(zeros) if zeros else [1.0]
                geo = plot.geometry(qid)
                root = ET.fromstring(plot.asset_path(qid).read_text(encoding='utf-8'))
                checked = 0
                for poly in root.findall('.//s:polyline', NS):
                    for xy in poly.attrib['points'].split():
                        x, y = map(float, xy.split(','))
                        s = complex(geo['ReMin'] + (x - geo['mL']) / geo['U'],
                                    geo['ImMax'] - (y - geo['mT']) / geo['U'])
                        if min([abs(s - p) for p in poles] + [abs(s - z) for z in zeros] or [1e9]) < 0.05:
                            continue  # near a pole/zero pixel rounding is ill-conditioned
                        av, bv = plot.polyval(A, s), plot.polyval(B, s)
                        if abs(av) < 1e-6 or abs(bv) < 1e-6:
                            continue
                        val = av / bv
                        self.assertLess(abs(val.imag), 1e-2 * (1.0 + abs(val.real)), (qid, s, val))
                        self.assertLess(val.real, 0.0, (qid, s, val))
                        checked += 1
                self.assertGreater(checked, 50)

    def test_feature_points_lie_on_the_locus(self):
        for qid, (poles, zeros) in PLANTS.items():
            with self.subTest(qid=qid):
                A = plot.poly_from_roots(poles) if poles else [1.0]
                B = plot.poly_from_roots(zeros) if zeros else [1.0]
                # Real-axis breakaway points solve dK/ds = 0  <=>  A'B - A B' = 0.
                P = poly_sub(poly_mul(plot.polyder(A), B), poly_mul(A, plot.polyder(B)))
                for (x, y) in plot.SPECS[qid]['dots']:
                    s = complex(x, y)
                    av, bv = plot.polyval(A, s), plot.polyval(B, s)
                    self.assertGreater(abs(av), 1e-6, (qid, s))
                    self.assertGreater(abs(bv), 1e-6, (qid, s))
                    val = av / bv
                    self.assertLess(abs(val.imag), 5e-2 * (1.0 + abs(val.real)), (qid, s, val))
                    self.assertLess(val.real, 0.0, (qid, s, val))
                    if abs(y) < 1e-9:
                        self.assertLess(abs(plot.polyval(P, s)), 5e-2 * (1.0 + abs(av)), (qid, s))


if __name__ == '__main__':
    unittest.main()
