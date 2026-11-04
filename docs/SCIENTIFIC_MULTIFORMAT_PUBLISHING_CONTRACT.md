# Scientific & Multiformat Publishing Contract

Version: 1.0.0 (proposal). Status: **design contract, NOT runtime verified**.
Owners: `editorial` (language), `visual` (media), `layout` (design), `qa` (gates), `publisher` (release). Technical sub-agent: `qmd-book-agent` **only via layout/qa/publisher**. No twelfth core agent.

## Canonical language and editorial rules
- Default `id-ID`, Indonesian EYD Edisi V and KBBI VI Daring as reference, with reference access date/version recorded. Recheck official updates; never promise automated KBBI scraping or redistribution rights.
- Editorial memory records glossary, preferred variants, foreign-word treatments, age/grade profile, and evidence for accepted changes.
- Corrections of spelling, punctuation, grammar, terminology, readability and scientific notation are suggestions with tracked before/after diffs. Never silently change facts, equations, citations or assessment answers.
- Allow bilingual/local-language publication only with declared language spans, licensed fonts, and qualified human review.

## Canonical content object contract
One immutable approved book snapshot supplies every output (HTML, PDF, EPUB3, DOCX); no format-specific rewriting of substantive prose.
Each scientific/media object MUST record `id, kind, source, altText, caption, provenance, license, dimensions, sha256, fallbackByFormat`.
Kinds: responsive images, SVG, QR, code listing, Math/LaTeX, chemical equations, molecular diagrams, physics diagrams, plots, charts, statistical tables, maps, Mermaid/Graphviz, videos, 3D assets and interactive simulations.
- HTML can be responsive and interactive where explicitly trusted.
- PDF/DOCX are static: YouTube/video embeds become captioned thumbnail or illustration + accessible URL/QR code; interactive plots, maps, 3D and simulations become reviewed static figures with explanatory text.
- EPUB readers vary: default safe reflowable markup with static fallback, navigable links and accessible descriptions; never assume JavaScript or remote video support.
- QR codes must have human-readable URL, contrast/quiet zone and an explicit safety/validity check. External links must be listed with access date.
- Code listings are inert and highlighted; never execute user/AI-authored source in publisher render. Verified scientific computations, if needed, execute upstream in isolated audited scientific workers and yield static trusted assets.
- Images: retain aspect ratio, editable crop/focal point, resolution at actual print dimensions, accessible text, asset rights, embedded exports, SVG sanitized/rasterized when required.
- Maths: equations and numbered cross-references; `mhchem` or validated LaTeX pathways for chemistry; rendered diagrams or MathML/accessible fallbacks as appropriate; physics units checked separately.
- Visuals: matplotlib, plotly, sympy, scipy, RDKit, Pint, GeoPandas, Shapely, Cartopy, Graphviz/Mermaid, Segno, Pillow/CairoSVG, TikZ/PGFPlots, 3Dmol.js, Manim are candidate tools, not guaranteed installed. Each requires pinned versions, license review, sandbox, format smoke tests; geographic scientific claims require sourced datasets and attributions.

## Design tokens & print requirements
- User-controlled presets A4, A5, B5, Letter plus validated custom width/height (mm), portrait/landscape, page margins, inner gutter, bleed/safe area, facing pages, headers/footers, numbering, front matter, TOC, index and cover/spine/back.
- Portrait and landscape mixed sections require verified renderer-specific handling; unsupported combinations return a clear blocker, not fabricated PASS.
- Independent font families for headings, body, code, math and multilingual spans; record font name/version/license/embedding rights. Prefer inspectable open-licensed fonts; ensure Indonesian glyphs and symbols.
- Templates for children, textbooks, scientific works, literary works, technical guides, and accessibility-first large print. Suggested pairings may include Noto families, Literata, EB Garamond, STIX Two Math, JetBrains Mono (license check mandatory).
- HTML image responsiveness is not the same as PDF/DOCX pagination. PDF/X, CMYK/ICC, print crop marks and bleed require dedicated toolchain support and third-party print preflight; do not claim automatic PDF/X validity.

## Export pipeline and verification
Canonical snapshot -> allowlisted structured source -> deterministic QMD generator -> Quarto/Pandoc -> HTML/PDF (LuaLaTeX or Typst)/EPUB3/DOCX via reference.docx -> per-format QA -> publisher manifest.
- Keep source immutable, workers offline and nonprivileged; disallow arbitrary executable markdown/raw HTML, LaTeX, includes, shortcodes, filters or untrusted extensions. Do not weaken the QMD agent sandbox to enable multimedia.
- Version-pin Quarto, Pandoc, TeX/Typst, EPUBCheck and any conversion/science libraries; verify actual installed features and licenses before enablement.
- Record conversion decision for each unsupported object, and compare substantive text/chapter order/table cells/equations/figures/citations across outputs.
- QA: PDF embedded fonts, Unicode, page overflow, print resolution, margins, blank pages, crossrefs, visual raster screenshots; DOCX headings, editable paragraphs, media relationships, TOC updates, paper/orientation; EPUBCheck/nav/spine/alt-text/Math fallback; HTML keyboard/accessibility and responsive checks.
- No PASS on existence of a file alone. Emit `completed|needs_review|blocked` with rendered command, tool versions, logs, evidence, hashes, warnings, and owner signoff.
- Release G9 requires human approval tied to snapshot hash and QA evidence. Existing G7/G8/G9 and data protection policies remain authoritative.

## Model-provider strategy (separate from exporting)
DeepSeek is the desired *configurable* default, with Qwen/OpenAI/Gemini and future adapters behind server-side provider gateway; model IDs/pricing/capabilities must be runtime-configured and tested. Provider fallback must respect consent, privacy, cost ceilings and idempotency, with auditable model choice. No API keys in repository or publishing artifact; no claim providers are configured until actual calls succeed.

## Acceptance fixtures (must be automated before READY)
1. Indonesian narrative with glossary, editorial suggestions and authoritative references.
2. Textbook with nested headings, citations, tables, figures, captions, exercises, answers and bilingual spans.
3. Mathematics, chemical reactions, physics notation, source-code listings, QR, maps, statistical plots, molecular figures, and YouTube fallback.
4. Custom paper sizes, portrait/landscape, wide tables, varied licensed fonts, illustrations with safe print resolution, full-bleed cover.
5. Snapshot tampering, missing rights/alt text, unsafe code/URLs, unapproved output, missing libraries and render failures all BLOCK release.
6. Actual HTML/PDF/EPUB/DOCX export and visual/content QA with tool-version logs and artifacts; no CI or test result is implied by this document.
