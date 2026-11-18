import copy
import importlib.util
import json
import math
from pathlib import Path
import re
import sys
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))

SPEC = importlib.util.spec_from_file_location('plot_q202606', ROOT / 'tools/plot_q202606.py')
plot = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(plot)

ASSET = ROOT / 'data-src/2026/img/solution-202606-nyquist.svg'
NS = {'s': 'http://www.w3.org/2000/svg'}


class Q202606PlotTest(unittest.TestCase):
    def test_reproducible_static_vector_and_generated_copy(self):
        rendered = plot.render()
        self.assertEqual(ASSET.read_text(encoding='utf-8'), rendered)
        pub_asset = ROOT / 'public/img' / ASSET.name
        if pub_asset.is_file():
            self.assertEqual(ASSET.read_bytes(), pub_asset.read_bytes())
        root = ET.fromstring(rendered)
        self.assertEqual(root.attrib['viewBox'], '0 0 560 380')
        self.assertNotRegex(rendered, r'<script|<foreignObject|\bon\w+=|href=')

    def test_plant_frequency_response_and_critical_points(self):
        re0, im0 = plot.plant_eval(1e-9)
        self.assertAlmostEqual(re0, 2.5, places=4)
        self.assertAlmostEqual(im0, 0.0, places=4)

        re1, im1 = plot.plant_eval(1.0)
        self.assertAlmostEqual(re1, 0.0, places=5)
        self.assertAlmostEqual(im1, -1.5, places=5)

        w_crit = math.sqrt(11.0)
        rec, imc = plot.plant_eval(w_crit)
        self.assertAlmostEqual(rec, -0.25, places=5)
        self.assertAlmostEqual(imc, 0.0, places=5)

    def test_describing_function_and_limit_cycle(self):
        self.assertAlmostEqual(plot.describing_func(2.0 / math.pi), 4.0, places=5)
        self.assertAlmostEqual(-1.0 / plot.describing_func(2.0 / math.pi), -0.25, places=5)
        self.assertAlmostEqual(plot.describing_func(1000.0), 2.0, places=2)

    def test_svg_structure_and_kinds(self):
        root = ET.fromstring(ASSET.read_text(encoding='utf-8'))
        polylines = {p.attrib.get('data-kind') for p in root.findall('.//s:polyline', NS)}
        self.assertIn('nyquist-positive', polylines)
        self.assertIn('nyquist-negative', polylines)

        lines = {p.attrib.get('data-kind') for p in root.findall('.//s:line', NS)}
        self.assertIn('describing-function', lines)


if __name__ == '__main__':
    unittest.main()
