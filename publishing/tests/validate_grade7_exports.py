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

def normalize_text(value: str) -> str:
    import html
    import unicodedata
    return " ".join(unicodedata.normalize("NFC", html.unescape(value)).split())

def epub_text(path: Path) -> tuple[str, dict]:
    import posixpath
    from urllib.parse import unquote, urlsplit
    container_ns = "{urn:oasis:names:tc:opendocument:xmlns:container}"
    opf_ns = "{http://www.idpf.org/2007/opf}"
    xhtml_ns = "{http://www.w3.org/1999/xhtml}"
    with zipfile.ZipFile(path) as z:
        bad = z.testzip()
        if bad:
            raise ValueError("EPUB ZIP rusak: " + bad)
        if z.read("mimetype") != b"application/epub+zip":
            raise ValueError("MIME EPUB tidak valid")
        container = ET.fromstring(z.read("META-INF/container.xml"))
        roots = container.findall(".//" + container_ns + "rootfile")
        if len(roots) != 1:
            raise ValueError("EPUB: rootfile tidak tunggal")
        opf_path = roots[0].attrib["full-path"]
        package = ET.fromstring(z.read(opf_path))
        manifest = package.find(opf_ns + "manifest")
        spine = package.find(opf_ns + "spine")
        if manifest is None or spine is None:
            raise ValueError("EPUB: manifest atau spine tidak tersedia")
        items = {item.attrib["id"]: item.attrib for item in manifest.findall(opf_ns + "item")}
        parts, paths = [], []
        for ref in spine.findall(opf_ns + "itemref"):
            item = items.get(ref.attrib.get("idref"))
            if item is None:
                raise ValueError("EPUB: idref spine tidak ditemukan")
            if item.get("media-type") != "application/xhtml+xml":
                raise ValueError("EPUB: spine bukan XHTML")
            href = unquote(urlsplit(item["href"]).path)
            if not href or href.startswith("/"):
                raise ValueError("EPUB: path tidak aman")
            name = posixpath.normpath(posixpath.join(posixpath.dirname(opf_path), href))
            if name == ".." or name.startswith("../"):
                raise ValueError("EPUB: path keluar arsip")
            root = ET.fromstring(z.read(name))
            body = root.find(".//" + xhtml_ns + "body")
            if body is None:
                raise ValueError("EPUB: XHTML tanpa body: " + name)
            # itertext membaca teks anak dan tail setelah elemen inline.
            parts.append(normalize_text(" ".join(body.itertext())))
            paths.append(name)
        if not parts:
            raise ValueError("EPUB: spine kosong")
        titles = [node.text for node in package.iter(DC + "title")]
        return normalize_text(" ".join(parts)), {"judul": titles, "dokumen_html": len(parts), "spine": paths}

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
            if marker.casefold() not in normalize_text(text).casefold():
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
