# GitHub Push Workflow — BC Book Studio

Setiap sesi pengembangan yang menghasilkan perubahan kode harus diakhiri dengan upaya **push ke GitHub** pada branch pekerjaan yang sesuai.

## Standar operasional
1. Identifikasi repository, branch aktif, dan perubahan yang terkait permintaan pengguna.
2. Jalankan pemeriksaan relevan (minimal `npm run typecheck`, `git diff --check`, serta tes fungsi bila tersedia). Jika gagal, laporkan dan jangan klaim rilis berhasil.
3. Stage hanya berkas yang termasuk satu pekerjaan yang sudah diperiksa. **Jangan gunakan `git add .` pada worktree bersama yang memiliki perubahan lain.**
4. Jangan commit .env, API keys, token, log diagnostik berisi informasi pribadi, dump database, data lokal QA, atau berkas sementara `tmp-*`.
5. Buat commit dengan pesan yang menjelaskan perubahan, lalu push branch tersebut ke `origin`. Jangan merge ke `main` atau deploy ke produksi otomatis.
6. Dalam respons, sertakan branch, commit SHA, tautan GitHub, hasil CI/QA, dan daftar kendala yang masih HOLD.
7. Jika tidak ada perubahan kode, jangan membuat empty commit. Jika push gagal (hak akses, konflik, CI), jelaskan apa yang masih lokal dan alasannya.

**Penting:** push GitHub adalah sinkronisasi kode, bukan persetujuan rilis produksi. Production gate, review dan backup tetap wajib.
