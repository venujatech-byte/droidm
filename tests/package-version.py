import json
from pathlib import Path
import runpy
import tempfile
import unittest


set_version = runpy.run_path(
    Path(__file__).resolve().parents[1] / '.github/scripts/package-version.py'
)["set_version"]


class PackageVersionTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.originals = {
            'Cargo.toml': '[package]\nname = "droidm"\nversion = "0.0.1"\n',
            'Cargo.lock': (
                'version = 4\n\n[[package]]\nname = "dependency"\nversion = "0.0.1"\n'
                '\n[[package]]\nname = "droidm"\nversion = "0.0.1"\n'
            ),
            'tauri.conf.json': '{"version": "0.0.1", "productName": "droidm"}\n',
        }
        for name, content in self.originals.items():
            (self.root / name).write_text(content)

    def test_updates_only_application_versions(self):
        set_version(self.root, '0.0.42')
        self.assertIn('version = "0.0.42"', (self.root / 'Cargo.toml').read_text())
        self.assertEqual(
            (self.root / 'Cargo.lock').read_text(),
            self.originals['Cargo.lock'].replace(
                'name = "droidm"\nversion = "0.0.1"',
                'name = "droidm"\nversion = "0.0.42"',
            ),
        )
        self.assertEqual(json.loads((self.root / 'tauri.conf.json').read_text()), {
            'version': '0.0.42', 'productName': 'droidm',
        })

    def test_rejects_invalid_or_unsupported_msi_versions(self):
        for version in ['0.0.0', '0.0.01', '0.0.65536', '1.0.1', 'invalid']:
            with self.subTest(version=version), self.assertRaises(ValueError):
                set_version(self.root, version)

    def test_missing_version_does_not_partially_update_files(self):
        (self.root / 'tauri.conf.json').write_text('{}')
        with self.assertRaises(ValueError):
            set_version(self.root, '0.0.2')
        for name in ['Cargo.toml', 'Cargo.lock']:
            self.assertEqual((self.root / name).read_text(), self.originals[name])


if __name__ == '__main__':
    unittest.main()
