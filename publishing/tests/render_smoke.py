"""Trusted CI-only smoke test. NEVER render arbitrary or user supplied snapshots here."""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from publishing.qmd_pipeline import canonical_bytes, digest, generate


def main():
    if not shutil.which("quarto"):
        raise RuntimeError("quarto CLI not installed by setup action")
    fixture = {
        "bookId": "synthetic-science",
        "approvalId": "SYNTHETIC-FIXTURE-NOT-REAL-APPROVAL",
        "approvalStatus": "approved",
        "metadata": {
            "title": "Dasar Matematika dan Fisika",
            "author": "BC Book Studio CI",
            "lang": "id",
            "bookType": "nonfiction",
            "discipline": "physics"
        },
        "orderedChapters": [
            {"title": "Persamaan Dasar", "slug": "persamaan-dasar",
             "content": "Hubungan massa dan energi dinyatakan $E=mc^2$.\n\n$$\na^2+b^2=c^2\n$$ {#eq-pythagoras}\n\nLihat @eq-pythagoras."},
            {"title": "Metode Ilmiah", "slug": "metode-ilmiah",
             "content": "Bab sebelumnya dijelaskan pada @sec-persamaan-dasar.\n\n| Parameter | Nilai |\n|---|---:|\n| Sampel | 3 |"}
        ],
        "targetFormats": ["html", "typst", "epub", "docx"],
        "assets": []
    }
    fixture["snapshotHash"] = digest(canonical_bytes(fixture))
    with tempfile.TemporaryDirectory(prefix="bc-quarto-ci-") as tmp:
        root = Path(tmp) / "synthetic"
        manifest = generate(fixture, root)
        assert manifest["renderStatus"] == "not_rendered"
        versions = subprocess.run(["quarto", "--version"], check=True, capture_output=True, text=True)
        print("Quarto version:", versions.stdout.strip(), flush=True)
        for target in fixture["targetFormats"]:
            print("Rendering trusted fixture:", target, flush=True)
            subprocess.run(["quarto", "render", ".", "--to", target], cwd=root, check=True, timeout=240)
            output = root / "_book"
            assert output.exists(), "missing output directory"
            produced = list(output.rglob("*"))
            extensions = {"html": ".html", "typst": ".pdf", "epub": ".epub", "docx": ".docx"}
            assert any(p.is_file() and p.suffix == extensions[target] and p.stat().st_size > 0 for p in produced), (
                f"no {target} artifact in {output}: {produced}"
            )
        print("Trusted multi-format fixture render completed", flush=True)


if __name__ == "__main__":
    main()
