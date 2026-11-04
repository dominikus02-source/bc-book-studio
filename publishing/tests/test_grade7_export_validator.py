"""Regresi ekstraksi EPUB: spine, elemen inline, Unicode, dan bab hilang."""
import tempfile
import unittest
import zipfile
from pathlib import Path

from publishing.tests.validate_grade7_exports import epub_text, normalize_text

CHAPTERS = ("Memahami Teks Deskripsi", "Memahami Teks Narasi", "Menulis dan Menyunting")
CONTAINER = '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'

def make_epub(path: Path, chapters=CHAPTERS, with_image=False):
    manifest = []
    spine = []
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        z.writestr("META-INF/container.xml", CONTAINER)
        for i, title in enumerate(chapters):
            name = f"chapter{i}.xhtml"
            manifest.append(f'<item id="c{i}" href="{name}" media-type="application/xhtml+xml"/>')
            spine.append(f'<itemref idref="c{i}"/>')
            z.writestr("OPS/" + name, f'<html xmlns="http://www.w3.org/1999/xhtml"><head><title>{title}</title></head><body><h1><span>{title}</span></h1><h2>Tujuan <em>Pembelajaran</em></h2><p>Berbahasa <strong>Indonesia</strong> dengan baik &amp; benar.</p><p>Refleksi</p></body></html>')
        manifest.append('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>')
        z.writestr("OPS/nav.xhtml", '<html xmlns="http://www.w3.org/1999/xhtml"><body><nav><ol><li>Daftar Isi</li></ol></nav></body></html>')
        if with_image:
            manifest.append('<item id="img" href="gambar.png" media-type="image/png"/>')
            z.writestr("OPS/gambar.png", b"image-test")
        z.writestr("OPS/package.opf", '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Buku Bahasa Indonesia</dc:title><dc:identifier id="uid">urn:uuid:test</dc:identifier></metadata><manifest>' + "".join(manifest) + '</manifest><spine>' + "".join(spine) + '</spine></package>')

class EpubExtractionTests(unittest.TestCase):
    def test_spine_multi_chapter_inline_and_navigation(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "buku.epub"
            make_epub(path, with_image=True)
            text, meta = epub_text(path)
            for title in CHAPTERS:
                self.assertIn(title, text)
            self.assertIn("Tujuan Pembelajaran", text)
            self.assertIn("Berbahasa Indonesia dengan baik & benar.", text)
            self.assertEqual(meta["dokumen_html"], 3)
            self.assertEqual(len(meta["spine"]), 3)
            self.assertNotIn("Daftar Isi", text)

    def test_missing_chapter_is_detected(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "hilang.epub"
            make_epub(path, chapters=CHAPTERS[:2])
            text, _ = epub_text(path)
            self.assertNotIn(CHAPTERS[2], text)
            with self.assertRaisesRegex(AssertionError, "Menulis dan Menyunting"):
                self.assertIn(CHAPTERS[2], text)

    def test_unicode_and_entities(self):
        self.assertEqual(normalize_text("  Bahasa&nbsp;Indonesia  —  baik  "), "Bahasa Indonesia — baik")

if __name__ == "__main__":
    unittest.main()
