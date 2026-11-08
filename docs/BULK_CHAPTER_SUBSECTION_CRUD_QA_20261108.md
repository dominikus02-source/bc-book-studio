# BC Book Studio - Bulk Chapter/Subsection CRUD QA - 2026-11-08

Workspace: F:/bc-book-import-export-20261106
Branch: integration/unified-book-workflow-20261107
UI: http://127.0.0.1:32979/studio (login; choose Stage 2 Rancang)
QA PostgreSQL: 127.0.0.1:55999/bookstudio_import_qa
Release: LOCAL ONLY. No staging/production GitHub push, merge, or VPS change.

## Requirement-to-evidence matrix

| Contract | Implementation | Evidence | Status |
|---|---|---|---|
| Relational data | Book -> Chapter -> OutlineSection. Add content TEXT, genreTarget and accessTier via migration 20261108050000_bulk_section_metadata | Prisma validate, migrate deploy to isolated QA | PASS |
| Input schema | No; Chapter Title; Subsection Title; Sort Order; Content >=2 paragraphs; Genre Target; Access Tier | XLSX/MD template and parser | PASS |
| Bulk create/read/update | GET/POST /api/books/[id]/bulk-outline; up to 200 rows, current selected book only, all-or-none transaction | bulk25-crud-e2e.cjs | PASS |
| Individual edit/archive/restore | Existing Section PATCH/DELETE enriched with content, genreTarget, accessTier; soft archive and restore | bulk25-crud-e2e.cjs, bulk25-ui-e2e.cjs | PASS |
| Security + versioning | Owner session required, stage DRAFT gate, stale 409, Book row lock, duplicate name and sort-order rejection | Positive and negative API tests | PASS |
| Bulk UI | Editable table, XLSX and Markdown download/reupload, latest-value capture, loading race guard, archive/restore | Browser E2E, three consecutive runs + archive/restore run | PASS tested subset |
| Responsive + themes | Six widths 320/375/390/768/1024/1440 px x light/dark, no horizontal page overflow and JS errors in tested flow | Playwright 12 combinations | PASS |
| Build | TypeScript and isolated Next.js optimized build | Exit code 0 and 17/17 pages | PASS |

## Column-to-database mapping

- No = visual import row sequence, not a persistent primary key.
- Judul Bab = Chapter.title; new chapters belong to selected Book.id.
- Nama Subbagian = OutlineSection.title and chapterId.
- Urutan = OutlineSection.position, normalized to sibling order when merged.
- Konten Dummy = OutlineSection.content, text 80-12000 chars with 2 paragraphs.
- Genre Target = OutlineSection.genreTarget (FANTASY, ROMANCE, SCI_FI, NONFICTION, THRILLER).
- Peran Akses = OutlineSection.accessTier (PUBLIC, PREMIUM, DRAFT) only as content metadata, not StudioRole or real paywall permission.

Chapter.content is not overwritten when subsections are imported. Missing rows do not delete old data. Delete action in bulk editor removes a pending row; archive action soft-archives an already saved row. Import/update matches normalized chapter and subsection names, preserving row identities and history. No-op reimport is idempotent. Book changes and other jobs are unchanged.

## Acceptance and open risks

- 5 chapters, 25 subsections, five genres, three access labels: PASS.
- Owner-vs-foreign user, anonymous, duplicate order/name, invalid content, rollback and conflict: PASS.
- Update and archive/restore preserve content, history and DB relations: PASS.
- XLSX download/upload and Markdown download/reimport with edits: PASS.
- Source files parsed client-side and not stored by the server; approved JSON values only are sent to the database.
- Cross-book import per single file not implemented. Maximum 200 rows per batch / 2 MB client file.
- Screen reader and physical touch device audit, every genre/role combination, and actual PUBLIC/PREMIUM access enforcement not complete.
- Separate legacy Stage 3 manuscript autosave test has shown an intermittent timing failure in one combined regression; do not claim full product sign-off solely from the bulk tests.
- Dirty worktree with previous changes preserved. Production HOLD pending clean PR, CI, database backup/restore rehearsal and explicit GO.
