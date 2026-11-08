# BC Book Studio — Integrated Stage 1–3 XLSX / Markdown / AI prompt CRUD QA

Date: 2026-11-08 (Asia/Jakarta). Local server: http://127.0.0.1:32979. Worktree: F:\\bc-book-import-export-20261106. Branch: integration/unified-book-workflow-20261107. QA database only: 127.0.0.1:55999/bookstudio_import_qa. **No production deployments or database changes.**

## Implemented

**Shared user workflow:** download XLSX/Markdown → edit offline or with AI → upload the same file → schema / field_id validation and change preview → Apply to form → further edits → explicit Save or existing autosave → verify persisted DB. Original upload bytes are never stored on server; parser works in browser memory (1 MB cap), with errors for unknown fields, invalid enum, invalid booleans, duplicate identifiers and unsafe workbook formulas.

1. Stage 1 metadata + brief: one full template covers title, subject, author, grade, bookType, genre, pageSize, description, targetAudience and writingGoal. Existing BriefGate includes an additional focused audience/goal template, historical revisions, and navigation gate. AI instructions carry previous stage context and genre. Save uses optimistic expectedVersion.
2. Stage 2 chapter outline: title, outlineObjective; upload flows into chapter Create or Update form depending on selected chapter, not instant database overwrite.
3. Stage 2 subsection: title and objective; users choose parent separately to support two-level outline. The template is scoped to one subsection, preserves same-chapter parent and backend guard rules, and supports update/restore/version conflicts.
4. Stage 3 manuscript: title + content Markdown imported directly into the canonical block editor; existing controls include block CRUD, manual Save, autosave, revisions, conflict 409, and restoring revisions. Prompt contains selected chapter and Section 2 outline context, with different fiction/nonfiction instructions.
5. Common FormTransfer: previews every imported field before Apply, supports XLSX and MD downloads, introduces Copy AI prompt when stage context is supplied. The original file is never uploaded to backend; only explicitly saved parsed fields reach owner-scoped APIs.
6. User interface: Stage 1–3 step navigation, with locked Stage 2/3 until workflow gates are satisfied. Consistent stage transfer panels, responsive controls and focus-visible, DM Sans/Manrope, dark/light styles.

## Evidence

- New `tests/stage123-transfer-e2e.cjs`: Stage 1 MD → form → database PASS, Stage 2 XLSX → form → database PASS, Stage 2 subsection MD → database PASS, Stage 3 MD → block editor → database PASS. Six viewport widths (320/375/390/768/1024/1440) in light/dark PASS, exit code 0.
- TypeScript typecheck: PASS.
- Existing workflow RBAC and snapshot E2E rerun: see terminal output for exact final exit codes.
- Isolated Next.js build at F:\\tmp\\bc-workflow-build-20261108: see terminal output for exact final exit code.

## Notes and limitations

- Stage 2 templates represent one chapter or subsection at a time; **bulk-import of many chapters/sections per single XLSX sheet has not been implemented**. This should be a separate atomic import with validation, preview, owner scoping, rollback and conflict resolution.
- Stage 3 canonical manuscript remains Markdown serialized into Chapter.content; independent relational CRUD of each block does not exist.
- AI prompts and templates are prepared locally. They do not automatically upload user content to an AI provider or invoke external AI APIs; user may manually upload/paste. Official ISBN/Perpusnas issuance is not claimed.
- Full accessibility manual screen-reader / touch device certification, complete genre / RBAC matrix, workflow review and output quality assurance remain outstanding.
- Previous dirty integration worktree was preserved. Do not merge or deploy without clean PR review, CI, QA DB backup/restore and explicit production approval.
