# BC Book Studio — QA Verifikasi Lanjutan 8 November 2026

**Lingkungan**: F:/bc-book-import-export-20261106, database QA 127.0.0.1:55999/bookstudio_import_qa, Next dev 127.0.0.1:32979. **NO-GO produksi**.

## Matriks hasil terverifikasi
| Gate | Bukti | Status |
|---|---|---|
| TypeScript | npm run typecheck, exit 0 | PASS |
| Publishing readiness | tests/publishing-readiness-e2e.cjs, exit 0: ISBN, RBAC, evidence, invalidasi layout, panel responsive | PASS |
| Workflow RBAC/UX | tests/workflow-rbac-ux-e2e.cjs, exit 0: dua buku, URL, reviewer independen, 5 workspace x 6 viewport x 2 tema | PASS |
| Five-format secure downloads | tests/two-books-five-format-download-e2e.cjs, exit 0, dua buku QA | PASS |
| Approval snapshot | HTTP 500 alih-alih 404 pada run pertama; ECONNRESET pada run ulang | FAIL / UNSTABLE |
| Prisma generate | EPERM pada DLL query engine Windows yang dipakai proses Node | BLOCKED |
| Build final/CI remote | Tidak diperiksa untuk basis integrasi terbaru | NOT RUN |
| Persetujuan ISBN/Perpusnas, bibliografi, aksesibilitas nyata, validator semua format | Belum dibuktikan lengkap | NO-GO |

## Diagnostik
- Next.js sempat restart karena perubahan next.config.mjs pada worktree bersama saat tes berjalan.
- Pemeriksaan langsung pada dua URL /read dengan ID invalid/tidak terbit menghasilkan HTTP 404, namun suite approval snapshot masih belum exit 0 stabil.
- Worktree memiliki banyak perubahan paralel yang belum di-commit; tidak melakukan reset/force push/deploy.
- Dua commit sebelumnya: 3cd5c6d pengaman backend reviewer aktif dan temuan MAJOR/CRITICAL; 34309b0 pengaman UI reviewer dan penghitung bukti penerbitan.
- Route ISBN menggunakan modul schema terpisah dan typecheck saat ini lulus, tetapi perubahan ISBN merupakan pekerjaan paralel yang belum diintegrasikan melalui PR ini.

## Langkah wajib sebelum status PASS menyeluruh
1. Jalankan suite approval snapshot pada worktree/Next/Prisma yang terisolasi dan stabil.
2. Regenerasi Prisma Client tanpa engine terkunci, build Next.js dan CI seluruh repository.
3. Uji matriks RBAC, semua genre, aksesibilitas fisik dan validator DOCX/PDF/EPUB/HTML/Flipbook.
4. Verifikasi bibliografi/izin, ISBN bila berlaku dan bukti penerbit resmi, approval manusia, dan distribusi.
5. Review PR, backup/rollback, dan deploy hanya setelah seluruh gate hijau.

**Keputusan akhir: Stage 4 dan Stage 5 tetap PARTIAL; produksi HOLD.**