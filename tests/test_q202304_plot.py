import copy
import importlib.util
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from validate_data import validate_file

SPEC = importlib.util.spec_from_file_location('plot_q202304', ROOT / 'tools/plot_q202304.py')
plot = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(plot)
SOURCE = json.loads((ROOT / 'data-src/2023/questions.json').read_text())
QUESTION = next(q for q in SOURCE['questions'] if q['no'] == 4)
ASSET = ROOT / 'data-src/2023/img/solution-202304-bode.svg'
NS = {'s': 'http://www.w3.org/2000/svg'}


def plant(w):
    match = re.search(r'\\frac\{([\d.]+)\(s\+([\d.]+)\)\(s\+([\d.]+)\)\}\{s\(([\d.]+)s\+([\d.]+)\)\(s\+([\d.]+)\)\(s\+([\d.]+)\)\}', QUESTION['stem'])
    if not match:
        raise AssertionError('Stem transfer function changed: rederive the plot.')
    k, z1, z2, a, b, p1, p2 = map(float, match.groups())
    s = complex(0, w)
    return k*(s+z1)*(s+z2)/(s*(a*s+b)*(s+p1)*(s+p2))


class Q202304PlotTest(unittest.TestCase):
    def test_reproducible_static_vector_and_generated_copy(self):
        self.assertEqual(ASSET.read_text(), plot.render())
        self.assertEqual(ASSET.read_bytes(), (ROOT / 'public/img'/ASSET.name).read_bytes())
        root = ET.fromstring(ASSET.read_text())
        self.assertEqual(root.attrib['viewBox'], '0 0 720 810')
        self.assertNotRegex(ASSET.read_text(), r'<script|<foreignObject|\bon\w+=|href=')
        self.assertEqual(len(root.findall('.//s:polyline', NS)), 2)

    def test_every_drawn_curve_sample_matches_the_actual_stem(self):
        root = ET.fromstring(ASSET.read_text())
        for curve in root.findall('.//s:polyline', NS):
            kind = curve.attrib['data-kind']
            points = [tuple(map(float, point.split(','))) for point in curve.attrib['points'].split()]
            self.assertGreater(len(points), 5)
            for x, y in points:
                w = 10**((x-70)*4/620-1)
                if kind == 'phase-exact':
                    expected = math.degrees(math.atan2(plant(w).imag, plant(w).real))
                    actual = -45-(y-460)*140/250
                elif kind == 'magnitude-exact':
                    expected = 20*math.log10(abs(plant(w)))
                    actual = 40-(y-40)*110/200
                else:
                    if w < 2: amp = 3/w
                    elif w < 2.5: amp = 1.5
                    elif w < 3: amp = 3.75/w
                    elif w < 10: amp = 1.25
                    elif w < 50: amp = 12.5/w
                    else: amp = 625/(w*w)
                    expected, actual = 20*math.log10(amp), 40-(y-40)*110/200
                self.assertAlmostEqual(actual, expected, delta=1e-6)

    def test_corners_slopes_and_two_consistent_margin_pairs(self):
        corners = [2, 2.5, 3, 10, 50]
        for w, level in zip(corners, [3.5218251811, 3.5218251811, 1.9382002602, 1.9382002602, -12.0411998266]):
            self.assertAlmostEqual(plot.asymptote(w), level, places=8)
        for a, b, slope in [(.2, 1, -20), (2.1, 2.4, 0), (2.6, 2.9, -20), (4, 8, 0), (15, 40, -20), (100, 800, -40)]:
            self.assertAlmostEqual((plot.asymptote(b)-plot.asymptote(a))/math.log10(b/a), slope, places=10)
        wc = plot.crossover()
        self.assertAlmostEqual(abs(plant(wc)), 1, places=12)
        self.assertAlmostEqual(wc, 8.20007756910656, places=10)
        self.assertAlmostEqual(180+plot.phase(wc), 114.48756547787508, places=10)
        self.assertAlmostEqual(plot.asymptote(12.5), 0, places=12)
        self.assertAlmostEqual(180+plot.phase(12.5), 103.34748705856569, places=10)
        self.assertGreater(plot.phase(.001), -90)
        self.assertAlmostEqual(plot.phase(1), -73.65776546202656, places=10)
        self.assertAlmostEqual(plot.phase(1e12), -180, places=8)
        self.assertGreater(plot.phase(3), plot.phase(1))
        self.assertGreater(plot.phase(3), plot.phase(10))

    def fixture(self, base):
        folder = base/'2023'
        (folder/'img').mkdir(parents=True)
        source = copy.deepcopy(SOURCE)
        source['questions'] = [copy.deepcopy(QUESTION)]
        for image in QUESTION['answerImages']+['img/'+ASSET.name]:
            shutil.copyfile(ROOT/'data-src/2023'/image, folder/image)
        path = folder/'questions.json'
        path.write_text(json.dumps(source))
        return source, path

    def test_clean_build_copies_the_explanation_asset_from_canonical_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _, source = self.fixture(root/'data-src')
            self.assertEqual(validate_file(str(source), {}, {}), [])
            (root/'tools').mkdir()
            for tool in ['build_data.py', 'validate_data.py']:
                shutil.copyfile(ROOT/'tools'/tool, root/'tools'/tool)
            subprocess.run([sys.executable, str(root/'tools/build_data.py')], check=True, capture_output=True)
            self.assertEqual(ASSET.read_bytes(), (root/'public/img'/ASSET.name).read_bytes())
            generated = json.loads((root/'public/data/questions/202304.json').read_text())
            self.assertEqual(generated['explanation'], QUESTION['explanation'])
            self.assertEqual(len(generated['originalImages']), 2)

    def test_inline_solution_assets_reject_missing_remote_traversal_and_other_question_paths(self):
        for target in ['https://example.com/chart.svg', 'img/../escape.svg', 'img/solution-202303-bode.svg', 'img/solution-202304-missing.svg']:
            with self.subTest(target=target), tempfile.TemporaryDirectory() as directory:
                source, path = self.fixture(Path(directory))
                source['questions'][0]['explanation'] = f'![Bode|720]({target})'
                path.write_text(json.dumps(source))
                errors = validate_file(str(path), {}, {})
                self.assertTrue(any('explanation' in error and '图片' in error for error in errors), errors)


if __name__ == '__main__':
    unittest.main()
