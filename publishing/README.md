# BC Book Studio — Quarto Publishing Foundation

`qmd_pipeline.py` validates an approved, canonical SHA-256 snapshot and deterministically generates non-executing Quarto sources. **This is not a render service and does not publish books.** For preview use `generate(..., release=False)`, which emits a DRAFT notice. Keep preview artifacts segregated; watermark each rendered page in the future sandbox renderer.

## Supported non-fiction domain profiles

`mathematics`, `physics`, `biology`, `chemistry`, `pharmacy`, `engineering`, `astronomy`, `geology`, `health`, `economics`, `geography`, `sociology`, `social_sciences`, `natural_sciences`, `computer_science`, `statistics`, `environmental_science`, `general`. These are **metadata and validator routing profiles**, not claims of expert subject review. More discipline-specific checking must be implemented by editorial and expert QA. Quarto supports math syntax in prose and book references, but this pipeline does not yet guarantee tagged/validated accessible outputs.

## Input contract

Required: `bookId`, `snapshotHash`, `approvalStatus=approved`, `approvalId`, `orderedChapters:[{title,slug,content}]`, `metadata:{title,author,lang,bookType,discipline?}`, `targetFormats`, `assets:[{path,altText,license}]`. Snapshot hash is `sha256` of UTF-8 `json.dumps(payload,sort_keys=True,ensure_ascii=False,separators=(",",":"),allow_nan=False)`, excluding top-level `snapshotHash`, `approvalId`, `approvalStatus`. This is a **v1 explicit convention** for interoperability; canonicalization must match upstream and be revised with an explicit schema version.

## Run local tests

```bash
python -m unittest discover -s publishing/tests -v
```

To generate from a validated JSON object:

```python
from pathlib import Path
from publishing.qmd_pipeline import generate
generate(snapshot, Path("/sandbox/new-empty-job-directory"), release=True)
```

Never render untrusted user-supplied source on a privileged machine. Offline containers, CPU/memory/time/disk limits, file path restrictions, a durable queue, SHA checks of asset bytes, bibliography validation, full citation/reference analysis, and actual PDF/EPUB/DOCX checks remain prerequisites to enabling production.

## Dependencies and plugins

- Python generator: **stdlib only**, no new runtime pip dependency.
- Renderer: **Quarto CLI** with bundled Pandoc/Typst; do **not** install user-controlled extensions or execute embedded notebooks.
- Optional external validators: **epubcheck** (automatically installed and run in CI), **veraPDF** (not yet installed/verified; needs stable Java runtime), font inspection tools, PDF inspection (e.g., poppler). Install only in dedicated sandboxed CI/render image after version and license review.
- Scientific writing: Quarto/Pandoc math and cross-references; BibTeX/CSL and `refs.bib` from a reviewed source. Chemistry notation, units, diagrams, and domain-specific typesetting require selected, audited project-owned extensions and tested fixtures; do not install arbitrary packages or enable script execution.

A CI smoke test may test Quarto in a trusted ephemeral runner with **synthetic** fixture only. It does not replace a production sandbox security review.
