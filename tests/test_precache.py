"""Deterministic generator contracts, isolated from the real public/ tree."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('precache', ROOT / 'tools/build_precache.py')
precache = importlib.util.module_from_spec(spec)
spec.loader.exec_module(precache)


class PrecacheTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = (ROOT / 'public/sw.js').read_text()
        (self.root / 'sw.js').write_text(self.source)
        for rel in [*precache.SHELL, 'src/a.js', 'icons/a.png', 'vendor/a.js']:
            path = self.root / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(rel.encode())

    def test_deterministic_idempotent_and_path_independent(self):
        first = precache.build(self.root)
        output = (self.root / 'sw.js').read_bytes()
        self.assertEqual(first, precache.build(self.root))
        self.assertEqual(output, (self.root / 'sw.js').read_bytes())
        other = self.root / 'copy'
        shutil.copytree(self.root, other)
        self.assertEqual(first, precache.build(other))
        self.assertEqual(output, (other / 'sw.js').read_bytes())

    def test_every_asset_revision_changes_worker_and_cache_version(self):
        original, manifest = precache.render(self.root, self.source)
        for url in manifest['files'][1:]:
            with self.subTest(url=url):
                path = self.root / url[2:]
                content = path.read_bytes()
                path.write_bytes(content + b' changed')
                new, changed = precache.render(self.root, original)
                self.assertNotEqual(new, original)
                self.assertNotEqual(changed['version'], manifest['version'])
                self.assertNotEqual(changed['integrity'][url], manifest['integrity'][url])
                path.write_bytes(content)

    def test_add_remove_and_logic_only_change_version(self):
        original, manifest = precache.render(self.root, self.source)
        extra = self.root / 'src/added.js'
        extra.write_text('new module')
        _, added = precache.render(self.root, original)
        self.assertIn('./src/added.js', added['files'])
        self.assertNotEqual(added['version'], manifest['version'])
        extra.unlink()
        self.assertEqual(precache.render(self.root, original)[0], original)
        (self.root / 'src/a.js').unlink()
        _, removed = precache.render(self.root, original)
        self.assertNotIn('./src/a.js', removed['files'])
        self.assertNotEqual(removed['version'], manifest['version'])
        _, changed = precache.render(self.root, original + '\n// logic revision\n')
        self.assertNotEqual(changed['version'], removed['version'])

    def test_generated_value_tampering_is_repaired_not_accepted_as_source(self):
        original, manifest = precache.render(self.root, self.source)
        tampered = precache.BLOCK.sub('const PRECACHE = {"version":"manual", "files":[]};', original)
        (self.root / 'sw.js').write_text(tampered)
        self.assertEqual(precache.build(self.root), manifest)
        self.assertEqual((self.root / 'sw.js').read_text(), original)
        with self.assertRaises(ValueError):
            precache.render(self.root, original + '\nconst PRECACHE = {};')

    def test_missing_required_shell_fails_without_writing_worker(self):
        (self.root / 'index.html').unlink()
        with self.assertRaises(FileNotFoundError):
            precache.build(self.root)
        self.assertEqual((self.root / 'sw.js').read_text(), self.source)

    def test_root_alias_hashes_actual_index_and_worker_is_not_self_cached(self):
        _, manifest = precache.render(self.root, self.source)
        import base64
        expected = 'sha256-' + base64.b64encode(hashlib.sha256((self.root / 'index.html').read_bytes()).digest()).decode()
        self.assertEqual(manifest['integrity']['./'], expected)
        self.assertEqual(manifest['integrity']['./index.html'], expected)
        self.assertEqual(manifest['files'], list(manifest['integrity']))
        self.assertNotIn('./sw.js', manifest['files'])
        self.assertNotIn('precache.json', json.dumps(manifest))


if __name__ == '__main__':
    unittest.main(verbosity=2)
