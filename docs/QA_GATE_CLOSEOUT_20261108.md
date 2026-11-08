# BC Book Studio — QA Gate Closeout (2026-11-08)

Environment: DESKTOP-2NM1AUE, worktree F:\bc-book-import-export-20261106, QA database 127.0.0.1:55999/bookstudio_import_qa.
Branch: integration/unified-book-workflow-20261107.
**Decision: TECHNICAL QA PARTIAL PASS; OFFICIAL RELEASE HOLD.** No production deploy, official ISBN assignment, or legal sign-off is implied.

## Newly verified PASS
- `npm run typecheck`: exit 0 after Prisma Client regeneration/reconciliation of source.
- `npx next build`, using isolated `BC_QA_NEXT_DIST_DIR=.next-qa-pdfworker`: exit 0; 23 static routes compiled.
- `prisma validate`: exit 0; `prisma migrate status`: database reports 24 applied / no pending.
- QA database: pg_dump custom format (186299 bytes), isolated pg_restore rehearsal, eight Book records verified, clone removed, exit 0.
- `scripts/verify-two-draft-books.cjs`: 10/10 real draft artifacts (2 books x PDF/DOCX/EPUB/HTML/Flipbook) PASS, SHA-256 verified.
- `scripts/validate-two-book-release-qa.cjs`: all ten artefact structures PASS, EPUBCheck PASS for both; reports kept in ignored artifacts folder. Release decision remains NO_GO.
- `tests/two-books-five-format-download-e2e.cjs`: secure owner download PASS and unauthorized denial PASS.
- `tests/epub-language-validation-e2e.cjs`: Indonesian metadata and EPUBCheck PASS (0 errors/warnings).
- `tests/publishing-accessibility-browser-e2e.cjs`: HTML/Flipbook browser smoke, 390px and 1280px, contrast/no JS errors PASS.
- `tests/isbn-office-e2e.cjs`: publisher RBAC, ISBN application CRUD, invalid ISBN prevention, PDF/DOCX letter templates, document integrity, archive audit PASS.
- `tests/export-job-queue-e2e.cjs`: queued job, real five-format ZIP, authenticated download, SHA-256 for five outputs PASS.
- `tests/export-job-cancellation-e2e.cjs`: cancellation and cancelled-download denial PASS.

## Repairs completed locally
- Next.js serverExternalPackages keeps pdfjs-dist worker out of vendor chunks.
- PDF page numbering now embeds open font files using @pdf-lib/fontkit instead of unembedded standard Helvetica.
- Next.js API publisher documents route no longer exports unsupported `kinds` constant.
- ISBN office QA fixture corrected `kbI` to actual `kbli` field contract.
- Standalone validator validates Flipbook HTML structure and keeps unrun audits separate.
- Added 2-book validator report runner; source and per-artifact hashes checked.
- Migration SQL for `PublisherDocument` restored to a previously empty local migrations folder.

## Outstanding release blockers — do not mark PASS
- **Historical migration checksum discrepancy:** the current local `20261108181000_publisher_document_vault/migration.sql` hash does not match its recorded applied QA migration hash. Retrieve exact applied SQL from the original migration author/backups and reconcile safely. Do not rewrite `_prisma_migrations` checksum to conceal drift.
- Full production-like staging migration/rollback sign-off and review of all unrelated uncommitted worktree changes.
- Real production document/ISBN evidence, publisher legal documents and official Perpusnas registration verification; application does not issue ISBNs.
- Word/LibreOffice editable round-trip, veraPDF PDF/A or PDF/UA conformance, Ace by DAISY EPUB Accessibility 1.1, assistive screen reader/touch device manual acceptance, print proofs and rights clearance.
- Final approved immutable-snapshot release, publisher human sign-off, public publish/read/revoke and deposit/distribution evidence not certified in this pass.

QA reports: `artifacts/20261108-two-book-draft-previews/TWO_BOOKS_RELEASE_QA.json` and per-book `*-RELEASE_QA.json`.
Release rule: NO_GO unless all mandatory compliance proofs are attached and independently reviewed.
