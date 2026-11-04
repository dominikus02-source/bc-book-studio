# Panduan deployment — rancangan, belum dieksekusi

Target Ubuntu 24.04 LTS, Docker Compose, Nginx, PostgreSQL dan Redis mandiri. Hindari Vercel dan Supabase.

1. Siapkan VPS atau isolasi host terpisah dari layanan produksi BahasaCerdas.
2. Siapkan domain/subdomain, TLS, firewall, DNS, backup dan akses SSH terbatas.
3. Buat secrets di lingkungan server atau GitHub Environment, bukan di repositori.
4. Jalankan migrasi PostgreSQL setelah backup dan pengujian staging.
5. Bangun image frontend/backend; jalankan pemeriksaan kesehatan dan smoke test.
6. Gunakan strategi rilis dengan versi image tetap, readiness check, dan rollback ke image sebelumnya.
7. Aktifkan deployment otomatis hanya setelah CI, test, audit dependensi, dan persetujuan environment lulus.

Belum tersedia: alamat server yang diverifikasi untuk studio, user deploy, image registry, secret deployment, dan tes staging. Jangan menargetkan host produksi BahasaCerdas tanpa isolasi dan persetujuan eksplisit.
