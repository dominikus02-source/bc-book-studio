"""Strictly typed trusted asset rendering; never execute arbitrary input code.

Run only with a separately reviewed spec inside an isolated, network-disabled
worker. The caller owns approval, license verification, resource limits and SHA.
"""
from __future__ import annotations
import argparse
import json
import math
import re
from pathlib import Path

class AssetSpecError(ValueError):
    pass

MAX_POINTS = 10000
SLUG = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")


def checked_file(root: Path, name: str, suffix: str) -> Path:
    if not isinstance(name, str) or not SLUG.fullmatch(name):
        raise AssetSpecError("invalid asset name")
    root = root.resolve(strict=True)
    return root / (name + suffix)


def create_asset(spec: dict, output: Path) -> Path:
    if not isinstance(spec, dict):
        raise AssetSpecError("spec must be object")
    kind = spec.get("kind")
    name = spec.get("id")
    if kind == "qr":
        # Only https URLs; external destination must be approved by upstream QA.
        from urllib.parse import urlsplit
        url = spec.get("url")
        if not isinstance(url, str) or len(url) > 2048:
            raise AssetSpecError("invalid QR URL")
        u = urlsplit(url)
        if u.scheme != "https" or not u.hostname or u.username or u.password or u.fragment:
            raise AssetSpecError("QR requires public reviewed https URL")
        if u.hostname == "localhost" or u.hostname.endswith(".local"):
            raise AssetSpecError("local addresses are forbidden")
        path = checked_file(output, name, ".svg")
        import segno
        qr = segno.make(url, error="h")
        qr.save(str(path), scale=8, border=4, dark="#111111", light="#ffffff")
    elif kind == "line_plot":
        x, y = spec.get("x"), spec.get("y")
        if not isinstance(x, list) or not isinstance(y, list) or len(x) != len(y) or not (2 <= len(x) <= MAX_POINTS):
            raise AssetSpecError("invalid plot series length")
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in x+y):
            raise AssetSpecError("plot coordinates must be finite numbers")
        title = spec.get("title", "")
        if not isinstance(title, str) or len(title) > 120:
            raise AssetSpecError("invalid title")
        path = checked_file(output, name, ".svg")
        import matplotlib
        matplotlib.use("Agg")
        from matplotlib import pyplot as plt
        fig, ax = plt.subplots(figsize=(7, 4))
        ax.plot(x, y)
        ax.set_title(title)
        ax.set_xlabel(str(spec.get("xLabel", ""))[:80])
        ax.set_ylabel(str(spec.get("yLabel", ""))[:80])
        ax.grid(alpha=0.2)
        fig.savefig(path, format="svg", bbox_inches="tight")
        plt.close(fig)
    elif kind == "molecule":
        smiles = spec.get("smiles")
        if not isinstance(smiles, str) or len(smiles) > 300 or any(ord(c)>127 for c in smiles):
            raise AssetSpecError("invalid molecule")
        from rdkit import Chem
        from rdkit.Chem import Draw
        molecule = Chem.MolFromSmiles(smiles)
        if molecule is None or molecule.GetNumAtoms() > 150:
            raise AssetSpecError("molecule cannot be parsed")
        path = checked_file(output, name, ".svg")
        svg = Draw.MolsToGridImage([molecule], molsPerRow=1, subImgSize=(560,360), useSVG=True)
        path.write_text(str(svg), encoding="utf-8")
    else:
        raise AssetSpecError("unsupported asset kind")
    return path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    if not args.output.is_dir() or args.output.is_symlink():
        parser.error("output must be an existing directory")
    if args.spec.stat().st_size > 100000:
        parser.error("spec too large")
    spec = json.loads(args.spec.read_text(encoding="utf-8"))
    path = create_asset(spec, args.output)
    print(json.dumps({"path": str(path), "sizeBytes": path.stat().st_size}))


if __name__ == "__main__":
    main()
