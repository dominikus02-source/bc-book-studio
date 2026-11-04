"""Secure-by-default rasterizer for *trusted generated* SVG, no native Cairo needed.

This is not a generic SVG sanitizer; data from untrusted sources must first be
screened by upstream asset intake, signed, and isolated. No remote resources.
"""
from __future__ import annotations
from io import BytesIO
from pathlib import Path
import re

MAX_SVG_BYTES = 2 * 1024 * 1024
MAX_PIXELS = 4096 * 4096
UNSAFE = re.compile(
    r"(?is)<!DOCTYPE|<!ENTITY|<\s*(?:script|foreignObject|iframe|image|use|animate|set)\b|"
    r"\b(?:href|src|onload|onclick|onerror)\s*=|url\s*\(|@import|<\s*style\b"
)

class SVGConversionError(ValueError):
    pass


def svg_to_png(source: Path, destination: Path, *, width: int = 900) -> dict:
    """Rasterize a reviewed, local SVG in a separate offline worker."""
    if type(width) is not int or not (16 <= width <= 4096):
        raise SVGConversionError("invalid requested output width")
    source = Path(source)
    if source.is_symlink() or not source.is_file() or source.suffix.lower() != ".svg":
        raise SVGConversionError("source must be local SVG file")
    raw = source.read_bytes()
    if not raw or len(raw) > MAX_SVG_BYTES:
        raise SVGConversionError("SVG size outside allowed range")
    try:
        text = raw.decode("utf-8")
    except UnicodeError as exc:
        raise SVGConversionError("SVG must be UTF-8") from exc
    if not re.search(r"<svg\b", text) or UNSAFE.search(text):
        raise SVGConversionError("unsafe or invalid SVG structure")
    destination = Path(destination)
    if destination.suffix.lower() != ".png" or destination.is_symlink() or destination.exists():
        raise SVGConversionError("destination must be new PNG file")
    try:
        import resvg_py
        from PIL import Image
        payload = resvg_py.svg_to_bytes(svg_string=text, width=width, resources_dir="")
        with Image.open(BytesIO(payload)) as img:
            if img.format != "PNG" or img.width * img.height > MAX_PIXELS:
                raise SVGConversionError("invalid or oversized PNG output")
            dimensions = [img.width, img.height]
        destination.write_bytes(payload)
    except SVGConversionError:
        raise
    except Exception as exc:
        raise SVGConversionError("resvg rasterization failed") from exc
    return {"path": str(destination), "width": dimensions[0], "height": dimensions[1], "sizeBytes": len(payload)}
