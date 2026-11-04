import tempfile
import unittest
from pathlib import Path
from publishing.scientific_assets import AssetSpecError, create_asset

class ScientificAssetsTest(unittest.TestCase):
    def test_reject_untrusted_specs_without_optional_libraries(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            for spec in [
                {"kind":"qr","id":"../bad","url":"https://example.org"},
                {"kind":"qr","id":"qr","url":"file:///etc/passwd"},
                {"kind":"qr","id":"qr","url":"https://localhost/test"},
                {"kind":"line_plot","id":"plot","x":[1,2],"y":[2,float("nan")]},
                {"kind":"line_plot","id":"plot","x":[1],"y":[1]},
                {"kind":"molecule","id":"m","smiles":"Δ"},
                {"kind":"python","id":"code","source":"print(1)"},
            ]:
                with self.subTest(spec=spec), self.assertRaises(AssetSpecError):
                    create_asset(spec,out)

    def test_molecule_renders_if_dependency_installed(self):
        try:
            from rdkit import Chem
        except ImportError:
            self.skipTest("rdkit not installed")
        with tempfile.TemporaryDirectory() as tmp:
            p=create_asset({"kind":"molecule","id":"water","smiles":"O"},Path(tmp))
            self.assertTrue(p.is_file())
            self.assertIn("<svg",p.read_text(encoding="utf-8"))
            self.assertGreater(p.stat().st_size,100)

    def test_qr_renders_if_dependency_installed(self):
        try:
            import segno
        except ImportError:
            self.skipTest("segno not installed")
        with tempfile.TemporaryDirectory() as tmp:
            p=create_asset({"kind":"qr","id":"sample","url":"https://example.org/book"},Path(tmp))
            self.assertIn("<svg",p.read_text(encoding="utf-8"))
            self.assertGreater(p.stat().st_size,100)

    def test_plot_renders_if_dependency_installed(self):
        try:
            import matplotlib
        except ImportError:
            self.skipTest("matplotlib not installed")
        with tempfile.TemporaryDirectory() as tmp:
            p=create_asset({"kind":"line_plot","id":"figure","x":[0,1,2],"y":[0,1,4],"title":"Grafik"},Path(tmp))
            self.assertTrue(p.is_file())
            self.assertGreater(p.stat().st_size,100)

if __name__=="__main__":
    unittest.main()
