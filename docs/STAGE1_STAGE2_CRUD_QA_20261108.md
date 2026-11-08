# BC Book Studio — Stage 1 and Stage 2 local CRUD acceptance

Date: 2026-11-08 (Asia/Jakarta). Project: F:\\bc-book-import-export-20261106. Branch: integration/unified-book-workflow-20261107. Runtime: http://127.0.0.1:32979. **LOCAL/PARTIAL**. Production unchanged and unverified.

## Requirements and evidence

| Requirement | Actual implemented change | Evidence | Status |
|---|---|---|---|
| Stage 1 Create/read | Existing book POST/GET retained, scoped to owner or assigned reviewer | stage1-crud-e2e, workflow RBAC | PASS local |
| Stage 1 Update | PATCH requires expectedVersion (ISO) and returns 428 missing / 409 stale; preserves old brief snapshot when altered | stage1-crud-e2e, typecheck | PASS local |
| Stage 1 Archive/recover | Book.archivedAt soft archive + restore endpoint; no cascade deletion of chapters or revisions | Prisma migration + stage1 API and UI | PASS local |
| Stage 1 isolation | Archived books omitted from default listing and blocked in book, workflow, chapter, reviewer, asset, layout, export, publication routes | stage1 API negative cases, branch inspection | PASS tested subset |
| Stage 1 genre coherence | Genre guide covers 8 genres; validate type/genre, author and supported page size at workflow gate, ISBN policy explanation without fabrication | lib/genre-policy.ts, lib/workflow.ts, brief-gate.tsx, typecheck | PASS implementation; human ISBN verification pending |
| Stage 1 UI/UX | Restore manager, confirm archive, status and errors; light/dark mobile 390 and desktop 1440 | stage1-ui-archive-e2e 4/4, progress QA | PASS tested subset |
| Stage 2 Outline CRUD | Existing create, read, edit, archive and restore of chapter outline/objectives | workflow regression; stage2-crud-e2e | PASS local |
| Stage 2 Reorder | expectedOrder mandatory (428); stale list returns 409, owner-scoped transactional reorder and audit; keyboard Up/Down and drag UI | stage2-crud-e2e; workflow regression | PASS local |
| Stage 2 Archive version check | Chapter DELETE now requires expectedVersion, returns 409 on stale form; restore preserves chapter content | stage2-crud-e2e | PASS local |
| Stage 2 genre guidance | Dynamic outline instruction per genre without altering saved content | lib/genre-policy.ts and OutlineWorkspace | PASS implementation |
| Global data and UX | Same bookId, prior stage validation, reviewer isolation; no browser errors/overflow in six viewports x both themes in earlier full regression | workflow-rbac-ux-e2e.cjs; approval-snapshot-e2e.cjs | PASS tested subset |

## Database and build

- New additive migration: prisma/migrations/20261108010000_book_archive/migration.sql, adds nullable archivedAt and owner/archivedAt index.
- Prisma migrate deploy: PASS on 127.0.0.1:55999/bookstudio_import_qa only, 13 total migrations (including new archive migration).
- Prisma generate: PASS after controlled restart of only local Next.js process bound to port 32979.
- Typecheck: PASS, exit code 0.
- Stage1 CRUD API negative and positive tests: PASS, exit code 0.
- Stage1 archive/restore browser tests: PASS 4/4 on light/dark, 390px/1440px.
- Stage2 CRUD API negative and positive tests: PASS, exit code 0.
- Existing workflow and approval-snapshot E2E: PASS, exit code 0 after test helpers were updated for expectedVersion.
- Isolated Next.js production build (F:\\tmp\\bc-workflow-build-20261108): PASS, exit code 0 after final archived-resource guards were synchronized. All 17 static page generations completed successfully.
- Git diff --check: PASS; line-ending warnings only.

## Release blockers and truthfulness

- **Not a full publisher release:** Stage 3–5 and full legal/delivery gates are not signed off.
- Stage 2 supports a flat chapter outline. Nested sections/hierarchical outline are not implemented or verified.
- Outline metadata audit history exists for reorder; complete append-only dedicated outline-revision browsing/undo remains a further enhancement.
- Full RBAC for every route, accessibility manual assistive technology testing, all eight genres end-to-end, full multi-user stress and reviewer workflow combinations still need evidence.
- International ISBN / Perpusnas are default compliance targets. No official ISBN was issued/verified, and no government action was automated.
- Production migrations, containers, Cloudflare, BahasaCerdas and JUMPA services untouched. No push/merge/production deploy performed; worktree includes unrelated earlier uncommitted changes and must be reviewed before PR.
- Access to the report at /progress is only available on the machine hosting the loopback server; it is not a public URL.

## Safe next sequence

1. Complete final isolated build and targeted rerun after archive guard changes.
2. Close Stage 2 hierarchical structure and outline revision/history gaps if required by constitution; test fixture E2E.
3. Stage 3 Tulis: blocks/autosave/revision, media, proofs, source citations and full authoring RBAC.
4. Stage 4 independent editorial review and immutable approved snapshot.
5. Stage 5 output validator profiles, Perpusnas eligibility evidence and human-approved distribution.
