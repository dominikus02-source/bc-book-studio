# BC Editorial Review Agent — Foundation Status
Date: 2026-11-08
Branch: feat/editorial-review-agent-20261108
Base: feat/p0-backend-export-queue-20261108

## What is implemented
- `lib/editorial-review-agent.ts`
  - Multi-agent foundation (Structural, Language, Subject-Matter, Citation, Accessibility)
  - Structured finding schema (category, severity, location, excerpt, issue, recommendation, confidence, sourceAgent)
  - Orchestrator that runs agents sequentially and deduplicates findings
  - Uses existing `activeProvider` + `invokeProvider` (no fake responses)
  - Explicit warning that AI output is recommendation only

- `app/api/reviewer/ai/route.ts`
  - Supports `mode: "single" | "orchestrator"`
  - Supports new focuses including STRUCTURAL / SUBJECT_MATTER / CITATION
  - Returns structured results when possible
  - Preserves existing RBAC via `reviewerAccess`

## What is still required (local / frontend / further backend)
- Dashboard UI for Review Naskah (ringkasan, temuan, per-bab, riwayat, keputusan)
- Full CRUD expansions (paragraph comments, track changes, attachments)
- Upload XLSX/DOCX/MD/PDF parser + template download
- Real-time autosave with optimistic concurrency
- Snapshot on approval that Publishing stage reads
- Full unit / integration / E2E tests
- Human verification of AI findings against real manuscript

## Tests
NOT RUN in this remote session. Local recommended:
```bash
git checkout feat/editorial-review-agent-20261108
npm run db:generate
npm run typecheck
npm run build
```

## Security
No secrets added. AI cannot approve or publish. All endpoints still require reviewer assignment.

Status: **PARTIAL** — foundation for multi-agent editorial review is in place and wired to the existing AI provider. Full end-to-end feature requires frontend and local verification.
