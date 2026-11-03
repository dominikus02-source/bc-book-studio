import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from publishing.qmd_pipeline import PipelineError, canonical_bytes, digest, generate, validate


def fixture(book_type="nonfiction", discipline="mathematics"):
    data = {
        "bookId": "example-math",
        "approvalId": "human-approval-123",
        "approvalStatus": "approved",
        "metadata": {
            "title": "Pengantar Sains", "author": "Penulis Uji",
            "lang": "id", "bookType": book_type, "discipline": discipline
        },
        "orderedChapters": [
            {"title": "Dasar", "slug": "dasar", "content": "Persamaan $E=mc^2$ dan tabel pengamatan."},
            {"title": "Lanjutan", "slug": "lanjutan", "content": "Lihat @sec-dasar untuk pengantar."}
        ],
        "targetFormats": ["html", "typst", "epub", "docx"],
        "assets": [],
    }
    data["snapshotHash"] = digest(canonical_bytes(data))
    return data


class TestQmdPipeline(unittest.TestCase):
    def test_cross_discipline(self):
        from publishing.qmd_pipeline import DISCIPLINES
        for discipline in DISCIPLINES:
            data = fixture(discipline=discipline)
            with tempfile.TemporaryDirectory() as tmp:
                result = generate(data, Path(tmp) / "book")
                self.assertEqual(result["discipline"], discipline)
                self.assertIn("enabled: false", (Path(tmp) / "book" / "_quarto.yml").read_text())
        for kind in ("fiction", "nonfiction"):
            validate(fixture(book_type=kind))

    def test_deterministic_sources(self):
        data = fixture()
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            x = generate(data, Path(a) / "book")
            y = generate(data, Path(b) / "book")
            self.assertEqual(x, y)
            self.assertEqual((Path(a) / "book" / "01-dasar.qmd").read_bytes(),
                             (Path(b) / "book" / "01-dasar.qmd").read_bytes())

    def test_approval_and_tampering(self):
        data = fixture()
        data["approvalStatus"] = "draft"
        with self.assertRaises(PipelineError):
            validate(data)
        data = fixture()
        data["orderedChapters"][0]["content"] = "changed"
        with self.assertRaises(PipelineError):
            validate(data)

    def test_preview_watermark(self):
        data = fixture()
        data.pop("approvalId")
        data["approvalStatus"] = "draft"
        with tempfile.TemporaryDirectory() as tmp:
            generate(data, Path(tmp) / "book", release=False)
            self.assertIn("DRAFT", (Path(tmp) / "book" / "index.qmd").read_text())

    def test_reject_injection_and_unreviewed_assets(self):
        samples = [
            "```{python}\nprint(1)\n```", "{{< include /etc/passwd >}}",
            "<script>alert(1)</script>", "\\input{secrets}",
            "![](https://example.org/a.png)", "![](../../secret.png)",
            "[PERLU SUMBER]", "filters: [evil.lua]",
            "```{=html}\n<script>x</script>\n```",
        ]
        for sample in samples:
            data = fixture()
            data["orderedChapters"][0]["content"] = sample
            data["snapshotHash"] = digest(canonical_bytes(data))
            with self.subTest(sample=sample), self.assertRaises(PipelineError):
                validate(data)

    def test_reject_bad_labels(self):
        for content in ("Dua {#fig-a} {#fig-a}", "Label {#fig_BAD}", "Lihat @fig-tidak-ada"):
            data = fixture()
            data["orderedChapters"][0]["content"] = content
            data["snapshotHash"] = digest(canonical_bytes(data))
            with self.assertRaises(PipelineError):
                validate(data)


if __name__ == "__main__":
    unittest.main()
