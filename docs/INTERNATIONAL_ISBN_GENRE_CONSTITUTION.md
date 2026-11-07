# BC Book Studio — International / Perpusnas genre-aware publishing constitution

**Policy version:** 2026-11-08.1. **Default:** ON for all genres. **Status:** implementation candidate; do not treat a user checkbox as evidence that a regulation has been met.

## Authoritative reference hierarchy
1. Indonesian legal requirements: Perpustakaan Nasional Regulation No. 11 of 2025 on ISBN service; consult latest official regulation and agency decisions before release: https://isbn.perpusnas.go.id/landing_page/isbn_info and https://isbn.perpusnas.go.id/landing_page/home
2. International ISBN Agency: https://www.isbn-international.org/node/88 — distinct identifiers for separately marketed editions, languages and formats.
3. W3C EPUB Accessibility 1.1: https://www.w3.org/TR/epub-a11y/ — publication content and discoverability metadata.
4. Individual target market and distributor technical specifications (e.g. print-ready PDF and EPUB) only where applicable; do not claim a single universal international design certification exists.

## Critical legality decisions
- Route **all** manuscripts through ISBN **eligibility review**. Do not assume all submissions are eligible. Limited-circulation anthologies, some internal instructional materials, and other excluded categories must not receive fake ISBNs. Perpusnas makes the official determination.
- An ISBN is **not** a copyright registration, a quality certificate, or proof of legal ownership. Never produce a fabricated ISBN or barcode.
- Each distinguishable edition/language/product format needs separately evaluated ISBN assignment. Keep ISBN allocation status per edition and format, not one reusable book-level string.
- The publisher/applicant must qualify, maintain the official publisher catalog, and supply legitimate documentation. Submission and decisions occur through the official channel. Verify current application requirements before each application.
- If a non-eligible work is selected, allow private drafting and internal preview, but block the **ISBN-publication** claim; explain alternative distribution without an ISBN according to rules.

## Stage continuity and coherency invariants
| Stage | Data controlled | Must remain consistent with |
|---|---|---|
| 1. Concept | bookType, genre, title, author, target reader, purpose, edition formats | Policy profile; eligibility and intended use |
| 2. Outline | chapter sequence, thematic learning goals or narrative beats | Brief and genre expectations |
| 3. Writing | content, attribution, citations, illustrations | Outline and provenance |
| 4. Editing | evidence, language, style and versioned changes | Sources, audience, accessibility |
| 5. Independent review | reviewer identity, feedback, approval | Current approved manuscript snapshot only |
| 6. Design | front matter, interior, cover, rights, ISBN placement | Publication metadata and output edition |
| 7. ISBN preparation | publisher documents, manuscript PDF, catalog link, originals/translation permissions | Identical title/author/format across documents |
| 8. Preflight | PDF/EPUB/DOCX QA, accessibility, catalog metadata | Current edition/version and official ISBN evidence |
| 9. Distribution | verified ISBN/status where required, release artifact and catalog | Explicit permission and verified reader access |
| 10. Maintenance | corrections, errata, subsequent editions | Release history and new-ISBN decision for significant changes |

Changing any upstream book metadata, content, rights, or illustrations **must invalidate dependent approvals** and publication readiness. Re-review and re-render after edits. No workflow should silently skip a blocking prerequisite. When a genre or format changes, recompute all dependent checklists. These invalidation guards still require implementation and dedicated race-condition tests before production merge.

## Genre distinctions
- NOVEL / SHORT_STORY: narrative continuity, plot, originality, sensitivity and language editing.
- ANTHOLOGY: contributor identity, permissions and work-by-work attribution; limited-circulation eligibility needs specific Perpusnas review.
- POETRY: line integrity, layout and rights; check intended distribution.
- TEXTBOOK: curriculum alignment, learning goals, fact checking, examples, exercises and verified answer key.
- REFERENCE: sources, citation integrity, bibliographies and index.
- GUIDE: actionable factual accuracy and procedural safety.
- WORKBOOK: exercises/solutions and eligibility screening (do not conflate with excluded internal modules/practicum instructions).

## Current code scope
The policy module `lib/publishing-policy.ts` adds required **attestation controls** based on the actual stored genre. The internal publication endpoint denies publication without these attestations, owner authorization, independent reviewer approval and no critical findings. This endpoint **does not issue or verify an ISBN** and returns only internal publication. No public bookstore, Perpusnas API submission, official ISBN state, or printer/distributor handoff is implied.

## Required next implementation before external publication
Persist normalized edition/format records and verified ISBN evidence with audit metadata; validate ISBN-13 checksum only as a syntactic check (not issuance verification); enforce per-stage approval invalidation and render reproducibility; check deliverables with external validators; require human signoff on rights/publisher/ISBN; test all 8 genres, every role and all negative transitions on an isolated database. Finish exact SHA CI and backup/restore/rollback before touching production.
