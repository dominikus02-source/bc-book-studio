# BC Book Studio — Stage 1–3 UIUX status cards and scope cleanup
Date: 2026-11-08 (Asia/Jakarta)
Branch: integration/unified-book-workflow-20261107
Workspace: F:/bc-book-import-export-20261106
QA DB: 127.0.0.1:55999/bookstudio_import_qa
Deployment: LOCAL only. No commit, push, or production changes.

## Requirement-to-evidence matrix

| Requirement | Code / source of truth | Test evidence | Result |
|---|---|---|---|
| Green completed / yellow in progress / red incomplete status on project and stage cards | lib/stage-card-status.ts, lib/workflow.ts, app/api/books/route.ts, components/beta-workspace.tsx | tests/stage123-card-status-ui-e2e.cjs | PASS local |
| Colors for chapters, subsections, bulk import rows and editor blocks | components/outline-workspace.tsx, components/outline-sections.tsx, components/bulk-outline-manager.tsx, components/draft-block-canvas.tsx | Stage UI/CRUD regressions and color E2E | PASS tested |
| Label remains readable without colors | app/globals.css and textual labels Lengkap/Dalam proses/Belum lengkap | Browser E2E, 6 viewports x light/dark | PASS subset |
| Stage 1 one metadata+brief form and one import flow | components/brief-gate.tsx, components/beta-workspace.tsx | Original brief CRUD and revised snapshot/transition regression | PASS |
| Stage 1 remove irrelevant print controls | components/beta-workspace.tsx | Page-size placed in collapsed advanced settings, no data loss | PASS |
| Stage 2 retain hierarchy, bulk, archive and revision controls | components/outline-workspace.tsx and outline-sections.tsx | Stage 2 and bulk25 API/UI tests | PASS |
| Stage 3 canonical block editor and asset CRUD visible; legacy tools optional | components/beta-workspace.tsx | E2E verifies canonical editor and collapsed advanced tools | PASS |
| Stage 3 read-only manuscript preview instead of production print/export controls | components/beta-workspace.tsx | New stage-status UI test, PDF button absent in Stage 3 | PASS |
| Backend/RBAC/CRUD alignment | GET /api/books computes stageReadiness using same logic as workflow transition. Existing owner-only mutation APIs unchanged | Stage 1/2/3 CRUD, bulk, review, 409-conflict, RBAC tests | PASS tested |

## Semantic statuses

GREEN: validation milestone complete and data saved, or on the local QA dashboard, specifically CRUD tested and passed. Not equivalent to official publishing certification.
YELLOW: current stage/row in progress, has partial data or unsaved changes.
RED: missing mandatory inputs, stage locked, invalid row or missing readiness evidence.
The labels are textual, in addition to background/border color. A card being green never bypasses backend transition requirements or grants Public/Premium reader entitlement.

## Actual changes

- lib/workflow.ts now exports stageReadiness, without changing transition rules. app/api/books/route.ts returns a per-book read-only readiness summary computed on the server, including existing approval and publication evidence.
- lib/stage-card-status.ts derives consistent visual statuses from the server snapshot. Project selection and three-stage navigation show status plus descriptions. Chapter and section badges use persisted content; bulk import rows distinguish invalid, edited and saved states; editor blocks show pending state until saved.
- components/brief-gate.tsx is simplified to missing-field checklist, history and server transition. Duplicate audience/goal input controls were removed; the single Stage 1 metadata form remains authoritative.
- Print size moved behind optional settings in Stage 1. Legacy Stage 3 authoring tools moved behind optional disclosure. Stage 3 has its own simple reading preview; PDF/DOCX/EPUB previews remain later in workflow.
- app/progress shows semantic QA cards and explicitly distinguishes local CRUD PASS from full stage certification.
- No Prisma migration was needed for this UI card-status change. The existing isolated database and worktree were preserved.

## Remaining risks and release hold

- Manual accessibility review on physical mobile/touch devices, screen readers and all contrast permutations is NOT RUN.
- Multi-book single-file import, actual Public/Premium entitlement rules, complete publication/ISBN validations remain separate tasks.
- QA results are local. Existing worktree contains preexisting unrelated uncommitted work. Production/staging rollout is HOLD until reviewed PR, green CI, backup+restore proof, rollout plan and explicit GO.


## 2026-11-08 — Perbaikan light mode, navigasi kartu, dan petunjuk EYD

**Ruang lingkup:** Stage 1 Ide, Stage 2 Rancang, Stage 3 Tulis. Database QA tetap 127.0.0.1:55999/bookstudio_import_qa. Tidak ada migrasi dan tidak ada perubahan produksi.

- **Light mode pastel lebih tegas:** hijau #BCECCD / border #16824C; kuning #FFE5A0 / border #AB6900; merah #FFC8D0 / border #BE344E. Dark mode yang telah diperbaiki tetap dipertahankan. Badge teks dan warna tetap dapat dibaca.
- **Kartu tahap kuning/merah dapat diklik:** Bila tahap terkunci, UI mengarahkan ke prasyarat terdekat yang boleh dibuka; tidak melewati workflow backend. Fokus otomatis berpindah ke isian penting (metadata Stage 1, tujuan bab Stage 2, naskah Stage 3). Navigasi kartu buku yang masih belum selesai menggunakan aturan yang sama.
- **Aksi status lebih spesifik:** Klik label status pada kartu bab membuka formulir kerangka; pada subbagian membuka isian subbagian; pada blok naskah memfokuskan editor; pada baris bulk memfokuskan input baris.
- **Petunjuk sesuai EYD:** Teks ringkas di awal setiap tahap menjelaskan tujuan, tindakan berurutan, impor XLSX/Markdown, peninjauan hasil, dan penyimpanan; mengurangi keterangan berulang pada Stage 2. Status error dan petunjuk prasyarat muncul dengan role=status.
- **Pengurangan UI tidak relevan:** Tombol membuat contoh Kelas VII dan panel ringkasan proyek yang mengulang brief dihapus dari tampilan. Metadata/brief satu form; opsi cetak dan peralatan lama tetap di panel tertutup, tanpa menghilangkan data pengguna atau memutus API.
- **Bukti:** tests/stage123-card-status-ui-e2e.cjs memeriksa latar aktual light/dark dan batas lebar 320/375/390/768/1024/1440, klik tahap terkunci, fokus isian Stage 1/2, klik status bab dan blok naskah, dan no overflow. Hasil PASS.
- **Regresi:** tests/workflow-rbac-ux-e2e.cjs PASS, tests/stage123-transfer-e2e.cjs PASS, tests/stage2-hierarchy-ui-e2e.cjs PASS, tests/bulk25-ui-e2e.cjs, tests/stage3-block-crud-e2e.cjs dan tests/approval-snapshot-e2e.cjs dijalankan ulang. Build Next.js 15.5.29 terisolasi PASS, 17/17 halaman statis.

**Batasan:** bukti browser otomatis bukan sertifikasi screen reader/WAAG perangkat fisik; status hijau bukan sertifikasi ISBN atau penerbitan. Production HOLD; branch tetap integration/unified-book-workflow-20261107 dan worktree mengandung perubahan lama yang belum dipilah untuk commit.

## 2026-11-08 — Batas kartu tunggal dan hover 3D ringan

Masalah: Kartu status Stage 1–3 semula menumpuk perimeter luar, garis warna inset, outline pilihan, dan border badge pada light/dark mode.

Perbaikan:
- Kartu agent-card, stage-step-card, chapter-status-card, dan draft-block-status: hanya satu border tipis; warna status hijau/kuning/merah dipertahankan, inset dan outline permanen ditiadakan.
- Badge status tidak lagi menggunakan border tersendiri. Outline keyboard tetap hanya muncul saat fokus.
- Hover desktop: perspective 900px, naik 4px, rotateX 2.5 derajat, rotateY -1.5 derajat, scale 1.006, shadow yang halus.
- Perangkat sentuh dan reduce-motion menonaktifkan transform/animasi.

Bukti: tests/stage123-card-status-ui-e2e.cjs memeriksa computed style perimeter satu border, outline none, tidak ada inset, hover matrix3d, reduced motion, serta warna 12 kombinasi layar/theme; PASS.
Regresi Stage 2 hierarchy UI dan Stage 3 block CRUD PASS. Scope CSS dan tes; database/backend tidak diubah; production HOLD.
