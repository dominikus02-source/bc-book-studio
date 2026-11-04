"""Validate grade VII manuscript and render each format from one source.

Runs only in trusted CI with Quarto, EPUBCheck and pdfinfo installed.
"""
import json
import shutil
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path
from publishing.tests.build_grade7_fixture import build, CHAPTERS
from publishing.render_job import verify_inputs

class Grade7FixtureTest(unittest.TestCase):
    def test_manuscript_and_manifest(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "source"
            manifest = build(root)
            self.assertFalse(manifest["releaseEligible"])
            self.assertEqual(len(manifest["chapterHashes"]), 3)
            for _, slug, text in CHAPTERS:
                self.assertGreater(len(text), 1500, slug)
                for section in ("Tujuan Pembelajaran", "Pertanyaan Pemantik", "Materi Inti",
                                "Aktivitas Pembelajaran", "Latihan Bertingkat",
                                "Pembahasan dan Pedoman Penilaian", "Refleksi"):
                    self.assertIn(section, text)
            self.assertEqual(len(manifest["generatedSourceHashes"]), len(list(root.glob("*.qmd"))) + 1)
            # Render worker must refuse a preview without verified human approval.
            from publishing.render_job import RenderJobError
            with self.assertRaises(RenderJobError):
                verify_inputs(root)

    @unittest.skipUnless(shutil.which("quarto"), "Quarto not installed")
    def test_three_exports_and_content(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "source"
            build(root)
            artifacts = {}
            for fmt, suffix in (("docx", ".docx"), ("typst", ".pdf"), ("epub", ".epub")):
                subprocess.run(["quarto", "render", ".", "--to", fmt], cwd=root, check=True, timeout=240)
                matches = list((root / "_book").glob("*" + suffix))
                self.assertEqual(len(matches), 1, (fmt, matches))
                self.assertGreater(matches[0].stat().st_size, 1000)
                copy = Path(tmp) / ("buku" + suffix)
                shutil.copyfile(matches[0], copy)
                artifacts[fmt] = copy
            if shutil.which("pdfinfo"):
                subprocess.run(["pdfinfo", str(artifacts["typst"])], check=True, timeout=30)
            if shutil.which("epubcheck"):
                subprocess.run(["epubcheck", str(artifacts["epub"])], check=True, timeout=120)
            with zipfile.ZipFile(artifacts["docx"]) as docx:
                document = docx.read("word/document.xml").decode("utf-8")
                for title, _, _ in CHAPTERS:
                    self.assertIn(title, document)
            with zipfile.ZipFile(artifacts["epub"]) as epub:
                text = " ".join(epub.read(p).decode("utf-8", "ignore") for p in epub.namelist() if p.endswith((".xhtml", ".html")))
                for title, _, _ in CHAPTERS:
                    self.assertIn(title, text)

if __name__ == "__main__":
    unittest.main()
