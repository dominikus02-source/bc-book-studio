# BC Book Studio — Vision

## Goal
A modern, fast educational book studio that produces high-quality content for both print and digital, while keeping the existing quality gate (Draft → Review → Approval).

## Core Strengths to Preserve
- Editorial approval workflow (separate editor and reviewer tokens).
- Focus on Indonesian educational content (grade + subject).
- AI as assistant only (human review required).

## Target Experience (inspired by modern ebook tools, adapted for education)

### 1. Smart Ingest
- Start from idea (AI outline + chapter drafts).
- Import DOCX / paste text / URL.
- Future: video/YouTube transcription → structured chapters (Indonesian).

### 2. Guided Design
- Simple education-focused templates (Modul, LKS, Buku Cerita, Ringkasan).
- Cover generator (title + grade + subject).
- Auto table of contents and page numbers.

### 3. Quality Gate
- Keep current DRAFT → REVIEW → APPROVED flow.
- Export (PDF / EPUB / future Flipbook) only after approval.

### 4. Multi-Output
- Print-ready PDF (with proper Unicode fonts).
- EPUB.
- Interactive Flipbook (HTML5, shareable link / embed).

## Suggested Phases

### Phase 1 (Quick wins)
- Modern dashboard with project cards and covers.
- Fix PDF font support for Indonesian.
- DOCX / paste import.
- 4–6 simple education templates.

### Phase 2
- Video-to-text ingestion.
- Basic Flipbook viewer.
- Cover generator.

### Phase 3
- Richer editor and media support.
- Advanced templates and 3D cover mockups.

## Technical Notes
- Stay on Next.js 15 + Prisma + PostgreSQL.
- Evolve schema incrementally (add optional template, coverUrl, etc.).
- Prefer Server Components and optimistic UI for speed.
- See AGENTS.md for coding agent guidance.
