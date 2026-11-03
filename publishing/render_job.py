"""Offline Quarto renderer for *prevalidated* generated sources.

This program is NOT a sandbox. It MUST be executed inside an externally enforced
unprivileged, network-disabled container with read-only source and resource limits.
It never contacts a backend or database and never makes a publication decision.
"""
from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

SUFFIXES = {"html": ".html", "typst": ".pdf", "epub": ".epub", "docx": ".docx", "pdf": ".pdf"}
MAX_SOURCE_BYTES = 60 * 1024 * 1024
MAX_FILE_COUNT = 400
RENDER_TIMEOUT_SECONDS = 180


class RenderJobError(RuntimeError):
    pass


def sha256(path: Path) -> str:
    with path.open("rb") as handle:
        hasher = hashlib.sha256()
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            hasher.update(chunk)
        return hasher.hexdigest()


def run_command(args: list[str], *, cwd: Path | None = None, timeout: int = 30) -> str:
    try:
        process = subprocess.run(args, cwd=cwd, stdout=subprocess.PIPE,
                                 stderr=subprocess.STDOUT, text=True,
                                 encoding="utf-8", errors="replace", timeout=timeout)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RenderJobError(f"command failed or timed out: {args[0]}") from exc
    if process.returncode:
        raise RenderJobError(
            f"command failed ({args[0]} exit={process.returncode}): {process.stdout[-3000:]}"
        )
    return process.stdout


def verify_inputs(source: Path) -> dict:
    if not source.is_dir() or source.is_symlink():
        raise RenderJobError("source must be a real directory")
    manifest_path = source / "manifest.json"
    if not manifest_path.is_file() or manifest_path.is_symlink():
        raise RenderJobError("missing verified input manifest")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("releaseEligible") is not True or not manifest.get("approvalId"):
        raise RenderJobError("renderer only accepts approved release artifacts")
    if not re.fullmatch(r"[a-f0-9]{64}", str(manifest.get("snapshotHash", ""))):
        raise RenderJobError("invalid snapshot hash")
    if manifest.get("renderStatus") != "not_rendered":
        raise RenderJobError("render input is not a fresh generator manifest")
    formats = manifest.get("targetFormats")
    if not isinstance(formats, list) or not formats or any(fmt not in SUFFIXES for fmt in formats):
        raise RenderJobError("invalid formats")
    expected = manifest.get("generatedSourceHashes")
    if not isinstance(expected, dict) or not expected:
        raise RenderJobError("missing source hashes")
    paths = [path for path in source.rglob("*") if path.is_file() or path.is_symlink()]
    if len(paths) > MAX_FILE_COUNT:
        raise RenderJobError("source file count exceeded")
    total_size = 0
    observed = set()
    for item in paths:
        if item.is_symlink() or not item.is_file():
            raise RenderJobError("symlink or invalid file in input")
        relative = item.relative_to(source).as_posix()
        if relative == "manifest.json":
            continue
        if relative not in expected:
            raise RenderJobError(f"unexpected input file {relative}")
        total_size += item.stat().st_size
        if total_size > MAX_SOURCE_BYTES:
            raise RenderJobError("source exceeds disk policy")
        if sha256(item) != expected[relative]:
            raise RenderJobError(f"source hash mismatch {relative}")
        observed.add(relative)
    if observed != set(expected):
        raise RenderJobError("missing files from source manifest")
    if "_quarto.yml" not in observed or "index.qmd" not in observed:
        raise RenderJobError("missing generated book sources")
    return manifest


def render_job(source_dir: Path, output_dir: Path) -> dict:
    """Render in a worker already constrained by network + mount + CPU/memory policy."""
    source = Path(source_dir).resolve(strict=True)
    output = Path(output_dir).resolve(strict=True)
    if source == output or output.is_relative_to(source) or source.is_relative_to(output):
        raise RenderJobError("source and output must not overlap")
    if any(output.iterdir()):
        raise RenderJobError("output must be empty")
    manifest = verify_inputs(source)
    quarto_version = run_command(["quarto", "--version"]).strip()
    timestamp = datetime.now(timezone.utc).isoformat()
    results = []
    logs = {}
    with tempfile.TemporaryDirectory(prefix="bc-qmd-render-") as temp:
        project = Path(temp) / "project"
        shutil.copytree(source, project, symlinks=False)
        for fmt in manifest["targetFormats"]:
            log = run_command(["quarto", "render", ".", "--to", fmt],
                              cwd=project, timeout=RENDER_TIMEOUT_SECONDS)
            if re.search(r"(?i)unresolved (?:cross-)?reference", log):
                raise RenderJobError(f"unresolved reference for {fmt}")
            logs[fmt] = {
                "warnings": len(re.findall(r"(?im)^.*(?:warning:|\[warning\]).*$", log)),
                "errors": 0,
                "command": f"quarto render . --to {fmt}",
            }
            bookdir = project / "_book"
            if not bookdir.is_dir():
                raise RenderJobError("missing Quarto output")
            produced = [p for p in bookdir.rglob("*") if p.is_file()]
            suffix = SUFFIXES[fmt]
            if not any(p.suffix == suffix and p.stat().st_size > 0 for p in produced):
                raise RenderJobError(f"missing {fmt} artifact")
            if fmt == "epub":
                epubs = [p for p in produced if p.suffix == ".epub"]
                for file in epubs:
                    run_command(["epubcheck", str(file)], timeout=120)
            if fmt == "typst" or fmt == "pdf":
                for file in produced:
                    if file.suffix == ".pdf":
                        run_command(["pdfinfo", str(file)])
            # Each output format uses a separate destination because Quarto
            # clears _book between subsequent renders.
            target = output / fmt
            target.mkdir()
            for path in produced:
                relpath = path.relative_to(bookdir)
                destination = target / relpath
                destination.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(path, destination)
                results.append({
                    "format": fmt, "path": (Path(fmt) / relpath).as_posix(),
                    "sha256": sha256(destination), "sizeBytes": destination.stat().st_size,
                })
    final = {
        "schemaVersion": "1.0",
        "bookId": manifest["bookId"],
        "snapshotHash": manifest["snapshotHash"],
        "approvalId": manifest["approvalId"],
        "chapterHashes": manifest["chapterHashes"],
        "quartoVersion": quarto_version,
        "renderTimestamp": timestamp,
        "renderStatus": "rendered_not_approved_for_publication",
        "qaStatus": "technical_checks_only",
        "technicalChecks": {
            "epubcheck": "executed" if "epub" in manifest["targetFormats"] else "not_requested",
            "pdfinfo": "executed" if any(x in manifest["targetFormats"] for x in ("pdf", "typst")) else "not_requested",
            "veraPDF": "not_executed",
        },
        "commandsAndWarnings": logs,
        "artifacts": results,
    }
    (output / "manifest.json").write_text(
        json.dumps(final, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8")
    return final


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: python -m publishing.render_job /input /output")
    result = render_job(Path(sys.argv[1]), Path(sys.argv[2]))
    print(json.dumps({"status": result["renderStatus"], "artifactCount": len(result["artifacts"])}))


if __name__ == "__main__":
    main()
