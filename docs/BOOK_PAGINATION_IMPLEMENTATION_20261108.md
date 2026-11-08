# BC Book Studio — Pagination Contract and QA (8 November 2026)

## Default per-book settings

```json
{
  "frontMatter": "lowerRoman",
  "mainMatter": "arabicStart1",
  "backMatter": "continueArabic",
  "chapterStart": "recto",
  "chapterOpeningFolio": "bottom",
  "normalFolioPosition": "outer",
  "runningHeaders": true,
  "autoUpdateToc": true,
  "covers": "noPrintedFolio"
}
```

Cover/back cover have no printed folio. The preliminary matter uses lowercase Roman numerals; main matter starts at Arabic 1; back matter continues. Chapter opening folios are centered at the bottom by default, while subsequent pages use outside left/right positions. Blank pages inserted for recto chapter starts are counted but do not display a folio.

## Local implementation and QA

Worktree: `F:\bc-book-import-export-20261106` on Windows `DESKTOP-2NM1AUE`.

The local worktree contains:
- `BookPagination` Prisma schema and migration `20261108192500_book_pagination`.
- Secured GET, PATCH and DELETE API for per-book settings.
- Studio pagination settings page, linked from Pengaturan and Tata Letak.
- `lib/pagination-output.ts` for physical PDF folios and PDF PageLabels.
- `lib/pagination-docx.ts` for OOXML Word section breaks and PAGE fields.
- Integration with direct export, queued export, and publishing reader HTML/flipbook metadata.
- Quarto worker fix suppressing its own PDF footer numbers for publishing packages.

Evidence observed locally:
- Prisma schema validated and local QA migration applied to `127.0.0.1:55999/bookstudio_import_qa`.
- TypeScript typecheck passed.
- `tests/book-pagination-output.test.cjs`: 3/3 PASS.
- `tests/pagination-api-e2e.cjs`: authorization, data validation, version conflicts, reset: 11 assertions PASS.
- `tests/pagination-ui-e2e.cjs`: 390×844 mobile browser save → reload → reset PASS.
- `tests/pagination-worker-qa.cjs`: PDF, DOCX, EPUB, HTML, flipbook built.
- PDF text verification after Quarto footer fix: no printed cover/back-cover number; roman preliminary pages; Arabic chapter numbers; inserted verso blanks.

QA artifacts remain on the authorized Windows worktree at `artifacts/pagination-qa`.

## Remaining release gates

1. This GitHub branch currently contains the pagination contract and this document. The other implementation changes **remain local**, because the remote Windows connection became unresponsive before a safe curated Git push. Do not treat this branch as deployable.
2. Review and push the local backend/frontend/renderer files after remote access returns, with dependency resolution and full CI.
3. Run an actual Word-compatible visual render, extended multibook/page-size regressions, EPUBCheck, responsive and assistive-technology audits.
4. Final publishing must use an immutable approved front/back publishing package, not draft preview placeholders.
5. Reflowable EPUB and section-based HTML/flipbook do not have the same physical page coordinates as PDF; do not invent matching fixed folios.
6. Verify production DB backup, migration rehearsal, rollback plan, and no conflicting active release.

**Production: HOLD.** No production database migration or deployment was executed as part of this pagination task.
