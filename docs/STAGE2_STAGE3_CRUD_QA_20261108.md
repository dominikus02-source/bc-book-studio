# BC Book Studio — Stage 2 → Stage 3 CRUD and UI/UX acceptance (local QA)

Date: 2026-11-08 Asia/Jakarta. Runtime: http://127.0.0.1:32979. Workspace: F:\\bc-book-import-export-20261106; branch integration/unified-book-workflow-20261107. All changes remain uncommitted; deployment production unchanged. **STATUS: LOCAL / PARTIAL; STAGING+PRODUCTION HOLD.**

## Requirement-to-evidence matrix

| Contract | What was implemented | Evidence / limitations | Status |
|---|---|---|---|
| Stage 2 nested structure | OutlineSection canonical persisted table with two levels beneath a chapter: section and child section, parent check, same chapter ownership | Prisma migration 20261108020000, API hierarchy and UI | PASS local |
| Stage 2 hierarchy changes | Create/read/update, archive/recover; refuse parent archive if children active, reject cross-chapter parents; monotonic expectedVersion 409 | stage2-hierarchy-e2e.cjs | PASS local |
| Stage 2 ordering | Validated reorder within sibling group with expectedOrder and 409 on stale array; accessible Up/Down controls, trace revisions | stage2-hierarchy-e2e.cjs, stage2-hierarchy-ui-e2e.cjs | PASS local |
| Stage 2 chapter-level history | ChapterRevision retains outlineObjective; append prior value on outline edit; restore exact title/objective without replacing Stage 3 content | Migration 20261108040000, stage2-chapter-history-e2e.cjs | PASS local |
| Stage 2 persistence and UI | Lazy-load section editor only when expanded, keyboard buttons, clear headings, fonts DM Sans / Manrope, light/dark | stage2-hierarchy-ui-e2e, six widths x two themes; no overflow/error on tested flow | PASS tested |
| Stage 3 contextual coherence | Fetch Stage 2 sections inside selected manuscript chapter; explicit insertion of heading (no automatic overwrite) | stage3-block-crud-e2e.cjs | PASS local |
| Stage 3 block CRUD | Paragraphs, headings, image, exercise, lists, tables, quotes, code and Markdown; create/update/duplicate/reorder/delete via chapter text revisions | stage3-block-crud-e2e, preexisting approval-snapshot and recovery tests; block IDs are local to editor, canonical manuscript remains Markdown | PASS tested; structured independent block-DB records not implemented |
| Stage 3 persistence | Autosave, Save Now, chapter optimistic concurrency 428/409, session recovery, download fallback, append-only history and restore | stage3-block-crud-e2e, draft-canvas-recovery-e2e, approval-snapshot-e2e | PASS tested |
| Stage 3 asset CRUD | Upload, read, metadata update (alt/licence/URL/name), soft archive/recover, audit trail, reject archiving referenced asset and cross-user changes | Migration 20261108030000, stage3-asset-crud-e2e.cjs, stage3-asset-ui-e2e.cjs | PASS local |
| UI/UX and accessibility | Responsive six widths 320/375/390/768/1024/1440; light and dark; font consistency, min 44px actions, focus-visible, no horizontal overflow for tested workflows | Browser tests, typecheck; no manual screen-reader audit or full WCAG 2.2 AA conformance claim | PASS tested subset |
| Security and downstream integrity | Unauthorized users denied, archived book/chapters/assets excluded, approved snapshot remains immutable, no production DB touched | E2E ownership negatives, snapshot regression; all route matrix not exhaustively tested | PASS subset |
| Compliance and publication | Genre-specific guidance, ISBN eligibility checks planned; no automatic ISBN allocation, no claim of Perpusnas acceptance | Separate constitution and PR #25 | BLOCKED for official issuance and external publication |

## New/changed implementation

Database:
- `OutlineSection` and `OutlineSectionRevision`, FK hierarchy and cascade compatibility: migrations 20261108020000 and 20261108023000.
- `BookAsset.archivedAt`, `updatedAt`, and `BookAssetRevision`: migration 20261108030000.
- `ChapterRevision.outlineObjective` and new outline-restore workflow: migration 20261108040000.
- All migrations were executed only on the isolated QA PostgreSQL at 127.0.0.1:55999/bookstudio_import_qa. No production migration, restore or backup claimed.

Backend:
- `app/api/books/[id]/chapters/[chapterId]/sections/route.ts`
- `app/api/books/[id]/chapters/[chapterId]/sections/[sectionId]/route.ts`
- `app/api/books/[id]/chapters/[chapterId]/sections/reorder/route.ts`
- `app/api/books/[id]/chapters/[chapterId]/route.ts`
- `app/api/books/[id]/assets/route.ts`, `app/api/books/[id]/assets/[assetId]/route.ts`

Frontend:
- `components/outline-sections.tsx`, `components/outline-chapter-history.tsx`
- `components/outline-workspace.tsx`, `components/draft-block-canvas.tsx`
- `components/asset-manager.tsx`, `components/beta-workspace.tsx`
- `app/globals.css`, `app/progress/page.tsx`

## Release blockers and limitations

1. All work remains a dirty, uncommitted integration worktree containing other previously existing changes. Do not blindly merge/cherry-pick or claim the GitHub branch is current.
2. Two levels of subsections below chapter are supported; unrestricted arbitrary-depth nesting is not. This constraint must be communicated in the UI.
3. The canonical Stage 3 blocks are serialized to Markdown in Chapter.content with append-only chapter revisions, not standalone immutable block records.
4. Full citation/provenance management, AI provider permissions and quotas, media rights verification, keyboard-only & screen-reader manual signoff, end-to-end every genre, all RBAC role combinations, and load/concurrency stress have not all been independently verified.
5. PDF print, EPUB3 validation, DOCX, HTML and Flipbook release acceptance, ISBN/Perpusnas official allocation, publisher identity, and external distribution are not signed off.
6. This is local development. The /progress loopback page is accessible on the host running the service; it is not a public endpoint. Production remains HOLD pending reviewed PR, green CI, backup/restore proof, and explicit GO.

## Required release sequence

- Run full local regression and isolated Next.js build after all changes, record exact exit codes.
- Review small feature diffs and create a clean integration PR; do not commit unrelated secrets.
- Test migration upgrade/downgrade compatibility and DB clone restore. Validate accessibility manually and add per-genre editorial controls.
- Only then consider staging release, not production until every gate is verified.

## Latest end-to-end regression and release exception

- Stage 2 chapter outline history: PASS. The old chapter title and objective can be restored without changing Stage 3 manuscript content.
- Stage 2 nested hierarchy API/UI: PASS including ownership, version conflicts, two-level sections, restore and keyboard-accessible ordering buttons.
- Stage 3 block, manuscript recovery and asset metadata CRUD: PASS in targeted API/browser tests, including six viewports in light and dark and DM Sans font.
- Existing cross-workflow authorization and responsive test: PASS.
- **Regression FAIL, unresolved:** `tests/approval-snapshot-e2e.cjs` times out while waiting for `/chapters/reorder` after native Playwright drag-and-drop on a chapter restored from archive. A native dragstart and dragover occurred, but the drop/reorder request was not observed in the diagnostic browser run. Drag/drop cannot be claimed fully PASS. The independent move Up/Down UI and backend reordered successfully in other tests.
- This exception BLOCKS full Stage 2 UI sign-off, complete E2E acceptance and staging/production release; do not replace the failing test with only keyboard controls.
- Debug instrumentation in the test file was reverted, temporary helper scripts removed, existing unrelated worktree changes preserved.

## 2026-11-08 — Resolusi regresi drag-and-drop

- Root cause teramati: HTML native dragstart/dragover tidak konsisten mengeluarkan event drop pada layout bab setelah arsip/pemulihan, sehingga endpoint reorder tidak pernah terpanggil.
- Fix: Stage 2 outline menggunakan pointerdown/pointerup pada gagang Seret, identifikasi target melalui elementFromPoint, move lewat API reorder existing dengan expectedOrder, tanpa rerender dragstart. Kontrol Naik/Turun tetap tersedia untuk keyboard.
- Regression `tests/approval-snapshot-e2e.cjs`: PASS exit 0 setelah archive/restore, drag-to-first, refresh, lalu lanjut ke workflow penulisan/review/approval/publish.
- `tests/stage2-crud-e2e.cjs` dan `tests/stage2-hierarchy-e2e.cjs`: PASS exit 0.
- `npm run typecheck`: PASS. Isolated `next build`: PASS exit 0 (17/17 static pages).
- Catatan: pengujian drag touch pada perangkat fisik belum dilakukan; pengujian otomatis browser desktop PASS. Tidak ada deploy produksi atau push.
