import copy
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from validate_data import validate_file


class FigureWidthsTest(unittest.TestCase):
    def validate_widths(self, widths, omit=False):
        source = json.loads((ROOT / 'data-src/2023/questions.json').read_text())
        question = copy.deepcopy(source['questions'][1])
        question.pop('figureWidths', None)
        if not omit:
            question['figureWidths'] = widths
        source['questions'] = [question]
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory) / '2023'
            (folder / 'img').mkdir(parents=True)
            for image in question['figures'] + question['answerImages']:
                shutil.copyfile(ROOT / 'data-src/2023' / image, folder / image)
            path = folder / 'questions.json'
            path.write_text(json.dumps(source))
            return validate_file(str(path), {}, {})

    def test_optional_positive_pixel_width(self):
        self.assertEqual(self.validate_widths([560]), [])
        self.assertEqual(self.validate_widths(None, omit=True), [])

    def test_invalid_widths_rejected_at_source_boundary(self):
        for widths in [[], [560, 200], ['560'], [True], [0], [-1], [1.5], [None], '560']:
            with self.subTest(widths=widths):
                errors = self.validate_widths(widths)
                self.assertTrue(errors)
                self.assertTrue(any('figureWidths' in error for error in errors), errors)


if __name__ == '__main__':
    unittest.main()
