"""Periksa struktur, metadata, dan konsistensi artefak buku uji.

Tidak menggantikan inspeksi visual atau persetujuan editor.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import subprocess
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

EXPECTED = ["Memahami Teks Deskripsi", "Memahami Teks Narasi", "Menulis dan Menyunting"]
MARKERS = ["Tujuan Pembelajaran", "Pertanyaan Pemantik", "Materi Inti",
           "Aktivitas Pembelajaran", "Latihan Bertingkat",
           "Pembahasan dan Pedoman Penilaian", "Refleksi", "Glosarium"]
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
DC = "{http://purl.org/dc/elements/1.1/}"

def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def docx_text(path: Path) -> str:
    with zipfile.ZipFile(path) as z:
        bad = z.testzip()
        if bad:
            raise ValueError("DOCX ZIP rusak: " + bad)
        document = ET.fromstring(z.read("word/document.xml"))
        return " ".join(node.text or "" for node in document.iter(W + "t"))

def epub_text(path: Path) -> tuple[str, dict]:
    with zipfile.ZipFile(path) as z:
        bad = z.testzip()
        if bad:
            raise ValueError("EPUB ZIP rusak: " + bad)
        names = z.namelist()
        if z.read("mimetype") != b"application/epub+zip":
            raise ValueError("MIME EPUB tidak valid")
        opf = [name for name in names if name.endswith(".opf")]
        if len(opf) != 1:
            raise ValueError("OPF EPUB tidak tunggal")
        meta = ET.fromstring(z.read(opf[0]))
        titles = [e.text for e in meta.iter(DC + "title")]
        parts = []
        for name in names:
            if name.endswith((".xhtml", ".html", ".htm")):
                tree = ET.fromstring(z.read(name))
                parts.extend(node.text for node in tree.iter() if node.text)
        return " ".join(parts), {"judul": titles, "dokumen_html": len([n for n in names if n.endswith((".xhtml", ".html", ".htm"))])}

def pdf_text(path: Path) -> tuple[str, dict]:
    info = subprocess.run(["pdfinfo", str(path)], capture_output=True, text=True, check=True)
    pages = re.search(r"(?m)^Pages:\s+(\d+)", info.stdout)
    size = re.search(r"(?m)^Page size:\s+(.+)", info.stdout)
    if not pages or int(pages.group(1)) < 3:
        raise ValueError("Jumlah halaman PDF tidak wajar")
    if not size or not re.search(r"595(?:\.\d+)? x 842|595\.\d+ x 841\.\d+", size.group(1)):
        raise ValueError("Ukuran PDF bukan A4: " + str(size.group(1) if size else "unknown"))
    text = subprocess.run(["pdftotext", "-layout", str(path), "-"], capture_output=True, text=True, check=True).stdout
    return text, {"halaman": int(pages.group(1)), "ukuran": size.group(1), "peringatan_metadata": "Suspects" in info.stderr}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    files = {}
    for suffix in (".docx", ".pdf", ".epub"):
        found = list(args.directory.glob("*" + suffix))
        if len(found) != 1:
            raise ValueError(f"Harus tepat satu {suffix}: {found}")
        files[suffix] = found[0]
    texts = {".docx": docx_text(files[".docx"])}
    texts[".pdf"], pdf_info = pdf_text(files[".pdf"])
    texts[".epub"], epub_info = epub_text(files[".epub"])
    failures = []
    for suffix, text in texts.items():
        for marker in EXPECTED + MARKERS:
            if marker.casefold() not in " ".join(text.split()).casefold():
                failures.append(f"{suffix}: bagian hilang: {marker}")
    epubcheck = subprocess.run(["epubcheck", str(files[".epub"])], capture_output=True, text=True)
    if epubcheck.returncode:
        failures.append("EPUBCheck gagal: " + (epubcheck.stdout + epubcheck.stderr)[-1500:])
    report = {"status": "GAGAL" if failures else "LULUS_PEMERIKSAAN_OTOMATIS",
              "catatan": "Tidak membuktikan kualitas visual, materi, atau persetujuan editorial.",
              "berkas": {k: {"nama": p.name, "sha256": sha(p), "byte": p.stat().st_size} for k, p in files.items()},
              "pdf": pdf_info, "epub": epub_info, "temuan": failures}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if failures:
        raise SystemExit("\n".join(failures))
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
