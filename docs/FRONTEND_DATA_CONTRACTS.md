# Kontrak Data Antarmuka untuk Integrasi Backend

Status: rancangan awal. Bentuk final harus diselaraskan dengan skema basis data dan API saat backend dibangun.

## BookProjectDraft
- id: string
- title: string
- category: enum
- audience: string
- gradeProfileId?: string
- description: string
- status: idea | planning | in_production | review | approved | published | archived
- createdAt, updatedAt: ISO datetime

## ChapterDraft
- id, projectId: string
- title: string
- position: integer
- status: draft | in_review | approved
- content: structured document
- revision: integer

## ExerciseDraft
- id, projectId, chapterId?: string
- type: multiple_choice | multiple_select | true_false | matching | short_answer | essay | text_analysis | project
- objective: string
- stimulus?: string
- prompt: string
- options?: array
- answerKey?: structured value
- explanation?: string
- rubric?: structured value
- difficulty: introductory | intermediate | advanced
- reviewStatus: draft | needs_review | approved

## ReviewFinding
- id, artifactId: string
- domain: language | pedagogy | factuality | curriculum | copyright | layout
- severity: critical | high | medium | low
- location: string
- evidence: string
- recommendation: string
- resolutionStatus: open | fixed | accepted_with_reason

## ApprovalRecord
- id, artifactId, reviewerId: string
- decision: approved | rejected | needs_revision
- rationale: string
- createdAt: ISO datetime

## Prinsip integrasi
- ID dibuat server dan stabil.
- Semua perubahan memiliki nomor revisi.
- Simpan otomatis memakai versi optimistis dan idempotency key.
- UI harus menangani konflik versi, kegagalan jaringan, dan status simpan.
- Draft lokal tidak boleh dianggap tersimpan di server.
- Persetujuan adalah catatan audit yang tidak dapat diubah diam-diam.
