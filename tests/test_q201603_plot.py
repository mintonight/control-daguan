import importlib.util
import json
import math
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('plot_rl', ROOT / 'tools/plot_q201603.py')
plot = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(plot)
NS = {'s': 'http://www.w3.org/2000/svg'}

# Plant for each question, transcribed independently from the stem.  poles/zeros
# are the open-loop singularities; the characteristic equation is A(s)+K B(s)=0
# with A = poly(poles), B = poly(zeros).
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


class RootLocusPlotTest(unittest.TestCase):
    def test_each_asset_is_reproducible_from_the_generator(self):
        for qid in PLANTS:
            with self.subTest(qid=qid):
                asset = plot.asset_path(qid)
                self.assertTrue(asset.is_file(), asset)
                self.assertEqual(asset.read_text(encoding='utf-8'), plot.render(qid))
                self.assertEqual(asset.read_bytes(), (ROOT / 'public/img' / asset.name).read_bytes())
                root = ET.fromstring(asset.read_text(encoding='utf-8'))
                self.assertNotRegex(asset.read_text(encoding='utf-8'), r'<script|<foreignObject|\bon\w+=|href=')
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
                A = np.poly(np.array(poles, dtype=complex)) if poles else np.array([1.0])
                B = np.poly(np.array(zeros, dtype=complex)) if zeros else np.array([1.0])
                geo = plot.geometry(qid)
                root = ET.fromstring(plot.asset_path(qid).read_text(encoding='utf-8'))
                checked = 0
                for poly in root.findall('.//s:polyline', NS):
                    for xy in poly.attrib['points'].split():
                        x, y = map(float, xy.split(','))
                        s = complex(geo['ReMin'] + (x - geo['mL']) / geo['U'],
                                    geo['ImMax'] - (y - geo['mT']) / geo['U'])
                        if min([abs(s - p) for p in poles] + [abs(s - z) for z in zeros] or [1e9]) < 0.05:
                            continue  # too close to a pole/zero: pixel rounding is ill-conditioned there
                        av, bv = np.polyval(A, s), np.polyval(B, s)
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
                A = np.poly(np.array(poles, dtype=complex)) if poles else np.array([1.0])
                B = np.poly(np.array(zeros, dtype=complex)) if zeros else np.array([1.0])
                # Real-axis breakaway points solve dK/ds = 0  <=>  A'B - A B' = 0.
                P = np.polysub(np.polymul(np.polyder(A), B), np.polymul(A, np.polyder(B)))
                bp_roots = [r.real for r in np.roots(P) if abs(r.imag) < 1e-6]
                for (x, y) in plot.SPECS[qid]['dots']:
                    s = complex(x, y)
                    av, bv = np.polyval(A, s), np.polyval(B, s)
                    self.assertGreater(abs(av), 1e-6, (qid, s))
                    self.assertGreater(abs(bv), 1e-6, (qid, s))
                    val = av / bv
                    self.assertLess(abs(val.imag), 5e-2 * (1.0 + abs(val.real)), (qid, s, val))
                    self.assertLess(val.real, 0.0, (qid, s, val))
                    if abs(y) < 1e-9:
                        self.assertTrue(bp_roots, (qid, 'no real breakaway root'))
                        nearest = min(abs(s - r) for r in bp_roots)
                        self.assertLess(nearest, 2e-2, (qid, s, bp_roots))


if __name__ == '__main__':
    unittest.main()