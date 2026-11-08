# Handoff pekerjaan lokal ke Grok — 8 November 2026

**Status: WORK IN PROGRESS (WIP), NOT RELEASE-READY.** Jangan merge ke `main` atau deploy produksi sebelum seluruh gate lulus.

## Asal pekerjaan
- Repo: `dominikus02-source/bc-book-studio`
- Local worktree: `F:\bc-book-import-export-20261106`
- Parent commit: `b11d59a` pada `feat/book-create-import-ai-20261108`.
- Branch handoff: `wip/grok-handoff-20261108`.
- Snapshot berisi gabungan perubahan lokal berbagai modul; ada banyak perubahan belum tervalidasi secara menyeluruh. Dokumen QA di `docs/` menjelaskan pemeriksaan sebelumnya, bukan jaminan semua gate lulus.

## Fitur tersentuh
- CRUD buku, outline/bab/subbab, editor naskah, stage workflow, import XLSX/Markdown, AI prompts, live preview.
- Layout & pagination, worker Quarto, export queue, kelima format penerbitan dan reader/flipbook.
- Publisher office, ISBN request, bukti dokumen dan RBAC.
- Provider AI, token monitoring, settings dashboard, progress tracking, migration Prisma, berbagai tes E2E.

## Diketahui masih perlu diverifikasi/diperbaiki
1. Regenerasi Prisma Client pernah terhalang file engine Windows `EPERM`; validasi schema/migration terhadap database QA terisolasi diperlukan.
2. TypeScript seluruh repository belum terkonfirmasi PASS, termasuk integrasi pagination dan modul lain.
3. Regresi browser navigasi multi-buku dan editor klasik pernah timeout.
4. Seluruh format PDF, DOCX, EPUB, HTML, flipbook, layout/pagination, dan file download memerlukan pengujian artefak riil.
5. Audit RBAC, restore database pada klon, responsivitas, kontras dark/light, aksesibilitas dan bukti ISBN resmi belum final.
6. `git diff --cached --check` pada snapshot awal menemukan whitespace issues; ini belum disapu karena checkpoint apa adanya.
7. Bandingkan dengan `origin/main` dan branch fitur lain sebelum melakukan merge; jangan timpa perubahan kontributor lain.

## Catatan keamanan data
File `.env`, secrets, backup data buku, `.data`, output `public/momentum-draft`, `publishing` hasil QA, cache `.next*`, dan script eksperimen `tmp-*` **sengaja tidak disertakan**.
Untuk menjalankan E2E bergantung data contoh, gunakan fixture sintetis dan konfigurasi lingkungan milik Grok sendiri.

## Instruksi kelanjutan
1. `git fetch origin`
2. `git switch -c grok/continue-bookstudio origin/wip/grok-handoff-20261108`
3. Audit diff, jalankan `npm ci`, `npx prisma generate`, `npx tsc --noEmit`, lint, test, build pada lingkungan terisolasi.
4. Fix kegagalan per modul, tambah regresi, lalu buka draft PR ke main hanya ketika cukup stabil.
5. Tidak melakukan force-push, migration ke production, deploy, ataupun merge otomatis.
