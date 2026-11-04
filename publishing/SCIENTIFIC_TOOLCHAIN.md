# Scientific Publishing Dependencies — implementation and installation

Status: source and tests added; container build and Quarto exports MUST be verified before declaring READY.

## Layer separation
1. `publishing/Dockerfile`: existing Quarto, Pandoc, Typst, EPUBCheck and font rendering. Do not run untrusted code or install scientific tools in this process.
2. `publishing/Dockerfile.science`: Python 3.12 + NumPy, SciPy, SymPy, Matplotlib, Segno, Pillow, CairoSVG, Pint, python-docx, RDKit and Pygments. Dedicated optional offline asset worker only.
3. `publishing/requirements-geo.txt`: optional larger GIS dependencies (GeoPandas, Shapely, Cartopy, PyProj). Run on independently provisioned geo worker only after size and license checks.
4. Additional technologies requiring separate governance: TikZ/PGFPlots, LuaLaTeX/TeX Live, Mermaid/Graphviz, JavaScript Plotly/3Dmol.js/Manim, PDF/X/CMYK ICC profile tooling, MathJax/mhchem, veraPDF. NOT silently enabled in core worker.

## Commands on an authorized test host with Docker
```sh
docker build -f publishing/Dockerfile.science -t bc-book-science:dev .
docker run --rm --network none --read-only --cap-drop ALL \
  --pids-limit 64 --memory 1g --cpus 1 --tmpfs /tmp:rw,noexec,nosuid,size=128m \
  --entrypoint python bc-book-science:dev -m unittest discover -s /opt/bc/publishing/tests -v
```

For trusted offline asset spec (operator provides reviewed JSON and writable output mount):
```sh
docker run --rm --network none --read-only --cap-drop ALL \
  --pids-limit 64 --memory 1g --cpus 1 --tmpfs /tmp:rw,noexec,nosuid,size=128m \
  -v "$PWD/spec.json:/work/spec.json:ro" -v "$PWD/output:/work/output:rw" \
  bc-book-science:dev --spec /work/spec.json --output /work/output
```

Example reviewed JSON: `{"kind":"line_plot","id":"parabola","title":"Grafik y=x²","x":[0,1,2],"y":[0,1,4]}`.
Renderer only supports allowlisted declarative QR/line_plot/molecule for now. More advanced diagrams/maps/video fallbacks require explicit implementation and verification; no arbitrary Python, notebook, LaTeX, shortcode, shell or remote URL execution from user data.

## Completion gates
- Run `python -m unittest discover -s publishing/tests -v` and capture failures/skips.
- Container build + dependency import matrix, offline asset generation smoke, SHA, SVG sanitize and output licensing review.
- Quarto/Typst/LuaLaTeX cross-format rendering via approved snapshot, EPUBCheck, DOCX media/styles inspection, Unicode font embedding and visual comparison.
- Pin exact package versions and hashes, scan vulnerabilities, document software/asset licenses, set worker resource limits and audit task provenance before production.
- Model provider gateway remains distinct; DeepSeek default is a policy, not an activated credential.

## Local Windows verification — 2026-11-04
- PC `DESKTOP-2NM1AUE`, isolated venv `F:\\bc-book-science-venv`: bounded core Python requirements installed successfully, no existing application/system Python modified.
- `python -m unittest discover -s publishing/tests -v`: **17 tests PASS, 0 skipped** after install, including real Segno QR and Matplotlib SVG.
- Quarto existing synthetic textbook exported DOCX, Typst/PDF (25 pages) and EPUB; PDF inspection printed `Syntax Error: Suspects object is wrong type (boolean)` while metadata inspection completed, so forensic PDF QA remains required.
- Windows import of `cairosvg`: **BLOCKED**, missing native Cairo DLL despite successful pip installation. Linux science image declares `libcairo2` but its build has not been executed. Windows native Cairo runtime must be installed separately before claiming CairoSVG support.
- No Docker CLI is installed on this PC; no container image build, isolated runtime validation or VPS deployment has occurred.

## Verification update — 2026-11-04, PC and GitHub CI
- **Windows SVG output unblocked via portable `resvg_py` (Rust):** `publishing/svg_rasterize.py` generates PNG without Cairo DLL; 2/2 tests PASS on PC. This is an intentional compatible alternative, **not** a claim that `import cairosvg` itself now works on Windows. CairoSVG still needs a native Cairo runtime there. Do not force MSYS2 upgrade: existing packages conflict.
- **GIS dependencies installed into isolated `F:\\bc-book-science-venv`:** GeoPandas, Shapely, PyProj, Cartopy, PyOgrio; real WGS84→Web Mercator transformation succeeded; optional GIS unit test PASS.
- **Docker proof:** GitHub Actions run `41871825738` **SUCCESS** for `science-docker-smoke`, `geo-docker-smoke`, and `quarto-docker-smoke`; both build and offline tests completed. Results prove ephemeral CI images, not deployment on VPS.
- **VPS audit via authorized `bcadmin` SSH:** `bc-book-studio-runtime-web-1` and `bc-book-studio-runtime-db-1` already running; production source `fix/bcbookstudio-live-20261104` has local uncommitted modifications. Never modify that worktree or disrupt other Compose projects. The host has 39 running containers; preflight measured 22.04 GiB free, 10.75 GiB memory available, load 6.33 on 16 CPUs. Image build **BLOCKED** by min 25 GiB disk admission limit.
- **Safe VPS preparation:** `publishing/ops/vps_preflight.py` checks resource and Docker access without mutation. `publishing/ops/prepare_vps_images.sh` only operates on a CLEAN separate feature-branch checkout, refuses active source locations, and never restarts web/db or exposes ports. With `--apply` it builds three isolated images and runs offline checks; it is intentionally not a durable queue integration or live release.
- **Remaining production gate:** provision resource headroom and clean separate checkout, build/test images under idle load, wire an approved job queue + immutable snapshot into durable sandboxed workers, complete format/visual QA, and obtain explicit human G9 release authorization; do not disable Cloudflare Access.
