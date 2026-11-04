import tempfile
import unittest
from pathlib import Path
from publishing.svg_rasterize import SVGConversionError, svg_to_png

SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="blue"/></svg>'

class SVGTest(unittest.TestCase):
    def test_reject_unsafe_svg(self):
        with tempfile.TemporaryDirectory() as temp:
            d = Path(temp)
            for sample in [
                '<svg><script>alert(1)</script></svg>',
                '<!DOCTYPE svg><svg/>',
                '<svg><image href="file:///etc/passwd"/></svg>',
                '<svg><rect fill="url(https://example.org/x)"/></svg>',
            ]:
                p = d / 'input.svg'
                p.write_text(sample)
                with self.subTest(sample=sample), self.assertRaises(SVGConversionError):
                    svg_to_png(p, d / 'output.png')

    def test_resvg_rasterizes_without_cairo(self):
        try:
            import resvg_py
        except ImportError:
            self.skipTest('resvg_py not installed')
        with tempfile.TemporaryDirectory() as temp:
            d = Path(temp)
            p = d / 'input.svg'
            p.write_text(SVG)
            result = svg_to_png(p, d / 'output.png', width=160)
            self.assertEqual(result['width'], 160)
            self.assertGreater(result['sizeBytes'], 50)
            self.assertEqual((d/'output.png').read_bytes()[:8], b'\x89PNG\r\n\x1a\n')
