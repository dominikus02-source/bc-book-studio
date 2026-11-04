"""Deterministic, non-executing Quarto source generator for approved BC Book Studio snapshots.

This module DOES NOT execute Quarto or publish books. Rendering requires a separate,
network-isolated worker with resource limits and durable jobs.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "1.0"
FORMATS = {"html", "typst", "epub", "docx", "pdf"}
DISCIPLINES = {
    "mathematics", "physics", "biology", "chemistry", "pharmacy",
    "engineering", "astronomy", "geology", "health", "economics",
    "geography", "sociology", "social_sciences", "natural_sciences",
    "computer_science", "statistics", "environmental_science", "general",
}
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
LABEL = re.compile(r"^(?:sec|fig|tbl|eq|lst|thm|lem|cor|prp|cnj|def|exm|exr|sol|rem|alg)-[a-z0-9]+(?:-[a-z0-9]+)*$")
REFERENCES = re.compile(r"(?<![\w@])@((?:sec|fig|tbl|eq|lst|thm|lem|cor|prp|cnj|def|exm|exr|sol|rem|alg)-[a-z0-9-]+)")
CITATIONS = re.compile(r"\[@([^\]]+)\]")
HEADINGS = re.compile(r"^#{1,6} ", re.MULTILINE)
FORBIDDEN = [
    (re.compile(r"(?m)^\s*---\s*$"), "embedded YAML delimiter"),
    (re.compile(r"(?im)^\s*\x60{3,}\s*\{"), "executable fence"),
    (re.compile(r"\{\{[<%]"), "shortcode/template"),
    (re.compile(r"(?im)^\s*(?:filters|include-(?:in|before|after)|_extensions|execute|jupyter|engine)\s*:"), "unsafe directive"),
    (re.compile(r"(?im)^\s*\x60{3,}\s*=\s*(?:html|latex|typst|javascript)"), "raw format"),
    (re.compile(r"(?im)^\s*:::.*\{\.(?:content-visible|content-hidden|include|cell)"), "untrusted conditional block"),
    (re.compile(r"(?i)<\s*/?\s*(?:script|iframe|object|embed|style|link|meta|img|svg|div|span|table|a|math)\b"), "raw HTML"),
    (re.compile(r"(?im)^\s*\\(?:input|include|write18|usepackage|documentclass|openout|read|catcode)\b"), "raw TeX"),
    (re.compile(r"(?im)^\s*#(?:import|include|let|set|show)\b"), "raw Typst"),
    (re.compile(r"(?im)^\s*!\[[^\]]*\]\((?:https?://|/|\.\.)"), "external/unsafe image"),
]
class PipelineError(ValueError):
    """Input must be rejected before a render job is created."""


def canonical_bytes(snapshot: dict[str, Any]) -> bytes:
    """Canonical snapshot payload excludes approval envelope and declared hash."""
    payload = {k: v for k, v in snapshot.items()
               if k not in {"snapshotHash", "approvalId", "approvalStatus"}}
    return json.dumps(payload, sort_keys=True, ensure_ascii=False,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def require_text(obj: dict, key: str) -> str:
    value = obj.get(key)
    if not isinstance(value, str) or not value.strip():
        raise PipelineError(f"missing or invalid {key}")
    return value.strip()


def safe_heading(obj: dict, key: str) -> str:
    value = require_text(obj, key)
    if ("\\n" in value or "\\r" in value or
            re.search(r"[<>`{}]", value) or
            value.startswith(("#", "!", "%", "@", "\\", "- ", "> "))):
        raise PipelineError(f"unsafe heading field: {key}")
    return value


def validate(snapshot: dict[str, Any], *, release: bool = True) -> None:
    if not isinstance(snapshot, dict):
        raise PipelineError("snapshot must be object")
    require_text(snapshot, "bookId")
    if release:
        if snapshot.get("approvalStatus") != "approved":
            raise PipelineError("release requires approved snapshot")
        require_text(snapshot, "approvalId")
    expected = require_text(snapshot, "snapshotHash")
    if not re.fullmatch("[a-f0-9]{64}", expected):
        raise PipelineError("invalid SHA256 hash")
    if digest(canonical_bytes(snapshot)) != expected:
        raise PipelineError("snapshot content changed or invalid hash")
    metadata = snapshot.get("metadata")
    if not isinstance(metadata, dict):
        raise PipelineError("metadata required")
    for key in ("title", "author"):
        safe_heading(metadata, key)
    for key in ("lang", "bookType"):
        require_text(metadata, key)
    if metadata["bookType"] not in ("fiction", "nonfiction"):
        raise PipelineError("bookType must be fiction or nonfiction")
    if metadata.get("discipline", "general") not in DISCIPLINES:
        raise PipelineError("unsupported discipline")
    if not re.fullmatch(r"[a-z]{2,3}(?:-[A-Za-z0-9]+)*", metadata["lang"]):
        raise PipelineError("invalid language")
    chapters = snapshot.get("orderedChapters")
    if not isinstance(chapters, list) or not chapters:
        raise PipelineError("orderedChapters must not be empty")
    if not isinstance(snapshot.get("targetFormats"), list) or not snapshot["targetFormats"] or any(
        fmt not in FORMATS for fmt in snapshot["targetFormats"]
    ):
        raise PipelineError("invalid target formats")
    assets = snapshot.get("assets")
    if not isinstance(assets, list):
        raise PipelineError("assets list required")
    for asset in assets:
        if not isinstance(asset, dict):
            raise PipelineError("invalid asset")
        for field in ("path", "altText", "license", "sha256"):
            require_text(asset, field)
        if not re.fullmatch(r"[a-f0-9]{64}", asset["sha256"]):
            raise PipelineError("invalid asset SHA256")
        path = asset["path"]
        if not re.fullmatch(r"assets/[a-zA-Z0-9._/-]+", path) or ".." in Path(path).parts:
            raise PipelineError("unsafe asset path")
    names = set()
    labels = set()
    citations = set()
    for chapter in chapters:
        if not isinstance(chapter, dict):
            raise PipelineError("invalid chapter")
        safe_heading(chapter, "title")
        slug = require_text(chapter, "slug")
        if not SLUG.fullmatch(slug) or slug in names:
            raise PipelineError("duplicate or invalid chapter slug")
        names.add(slug)
        body = require_text(chapter, "content")
        for pattern, why in FORBIDDEN:
            if pattern.search(body):
                raise PipelineError(f"{slug}: {why}")
        if "[PERLU SUMBER]" in body or "TODO" in body or "FIXME" in body:
            raise PipelineError(f"{slug}: unresolved placeholder")
        if re.search(r"(?m)^\s*\x60{3,}", body):
            # Literal code fences are safe, but disallow all source fences until
            # a tokenizer-based policy supports nested formats.
            raise PipelineError(f"{slug}: untrusted code fence")
        for match in re.finditer(r"\{#([^}]+)\}", body):
            label = match.group(1)
            if not LABEL.fullmatch(label) or label in labels:
                raise PipelineError(f"{slug}: invalid/duplicate cross-reference label")
            labels.add(label)
        citations.update(CITATIONS.findall(body))
    if citations:
        # Bibliography must be verified by QA against reviewed refs.bib.
        if not snapshot.get("bibliographyReviewed"):
            raise PipelineError("citations require reviewed bibliography")
    for chapter in chapters:
        for ref in REFERENCES.findall(chapter["content"]):
            if ref not in labels and ref not in {("sec-" + item["slug"]) for item in chapters}:
                raise PipelineError(f"unresolved reference {ref}")
    # Images only from reviewed asset manifest; reject remote and traversal paths.
    declared = {asset["path"] for asset in assets}
    for chapter in chapters:
        for path in re.findall(r"!\[[^\]]*\]\(([^)\s]+)", chapter["content"]):
            if path not in declared:
                raise PipelineError(f"unreviewed or missing image {path}")


def _q(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def generate(snapshot: dict[str, Any], root: Path, *, release: bool = True,
             asset_root: Path | None = None) -> dict:
    """Generate sources; returns structured reproducibility metadata.

    Caller must create a fresh sandboxed directory; never pass a shared output root.
    """
    validate(snapshot, release=release)
    root = Path(root)
    if root.exists() and any(root.iterdir()):
        raise PipelineError("output directory must be empty")
    root.mkdir(parents=True, exist_ok=True)
    if snapshot["assets"]:
        if asset_root is None:
            raise PipelineError("reviewed asset store is required for books with images")
        trusted = Path(asset_root).resolve(strict=True)
        for asset in snapshot["assets"]:
            relative = Path(asset["path"])
            source = (trusted / relative).resolve(strict=True)
            if not source.is_relative_to(trusted) or not source.is_file() or source.is_symlink():
                raise PipelineError("asset escapes approved store")
            if source.stat().st_size > 25 * 1024 * 1024:
                raise PipelineError("asset exceeds 25 MiB limit")
            data = source.read_bytes()
            if digest(data) != asset["sha256"]:
                raise PipelineError("asset hash mismatch")
            destination = root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)
    metadata = snapshot["metadata"]
    chapters = snapshot["orderedChapters"]
    chapter_files = []
    hashes = {}
    for number, chapter in enumerate(chapters, 1):
        filename = f"{number:02d}-{chapter['slug']}.qmd"
        text = f"# {chapter['title']} {{#sec-{chapter['slug']}}}\n\n{chapter['content'].strip()}\n"
        (root / filename).write_text(text, encoding="utf-8")
        hashes[chapter["slug"]] = digest(chapter["content"].encode("utf-8"))
        chapter_files.append(filename)
    title = metadata["title"]
    introduction = f"# {title} {{.unnumbered}}\n\n"
    if not release:
        introduction += "**DRAFT — BELUM DISETUJUI UNTUK TERBIT**\n\n"
    (root / "index.qmd").write_text(introduction, encoding="utf-8")
    config = [
        "project:", "  type: book", "book:",
        f"  title: {_q(title)}", f"  author: {_q(metadata['author'])}",
        "  chapters:", "    - index.qmd",
        *[f"    - {name}" for name in chapter_files],
        f"lang: {_q(metadata['lang'])}",
        "execute:", "  enabled: false",
        "format:",
    ]
    for fmt in dict.fromkeys(snapshot["targetFormats"]):
        config.append(f"  {fmt}: default")
    (root / "_quarto.yml").write_text("\n".join(config) + "\n", encoding="utf-8")
    source_hashes = {p.relative_to(root).as_posix(): digest(p.read_bytes())
                     for p in sorted(root.rglob("*")) if p.is_file()}
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "bookId": snapshot["bookId"],
        "snapshotHash": snapshot["snapshotHash"],
        "approvalId": snapshot.get("approvalId") if release else None,
        "releaseEligible": bool(release),
        "bookType": metadata["bookType"],
        "discipline": metadata.get("discipline", "general"),
        "targetFormats": list(dict.fromkeys(snapshot["targetFormats"])),
        "chapterHashes": hashes,
        "generatedSourceHashes": source_hashes,
        "renderStatus": "not_rendered",
        "qaStatus": "not_checked",
    }
    (root / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    return manifest
