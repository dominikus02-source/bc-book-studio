# BC Book Studio

**Ekosistem Penerbitan Cerdas** — ruang kerja untuk merancang, menulis, menyunting, menilai, menata, dan menerbitkan buku pendidikan, literasi, sastra, serta referensi.

## Status
Tahap awal berfokus pada fondasi frontend dan spesifikasi multi-agen. Backend, basis data, antrean, eksekusi agen, penyedia AI, dan penerbitan berkas belum diaktifkan.

## Teknologi yang direncanakan
- Next.js App Router dan TypeScript strict untuk aplikasi web.
- Python FastAPI untuk layanan backend.
- PostgreSQL + pgvector untuk data dan memori.
- Redis + Celery untuk antrean dan pekerja.
- Penyimpanan kompatibel S3 untuk naskah dan aset.
- Gerbang penyedia AI terpisah dengan pencatatan biaya dan fallback.

## Arsitektur agen
Menggunakan 11 peran logis, 8 spesialisasi keilmuan, 12 profil kelas, dan tiga lingkup memori. Peran agen bukan proses permanen; orkestrator memilih agen sesuai tahap, jenjang, spesialisasi, risiko, dan anggaran.

Lihat `agents/AGENT_CATALOG.md`, `agents/agent-registry.json`, dan `agents/roles/`.

## Menjalankan frontend
Memerlukan Node.js 20.9 atau lebih baru.

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Pemeriksaan
```bash
npm run lint
npm run build
```

## Prinsip penting
- Persetujuan manusia wajib sebelum penerbitan.
- Tidak boleh mengarang sumber, kutipan, ISBN, atau klaim persetujuan resmi.
- Naskah dan aset memiliki versi serta jejak asal-usul.
- Kegagalan satu tahap tidak mengulang seluruh proyek.
- Rahasia penyedia AI hanya disimpan di lingkungan server.
- Status simulasi tidak boleh ditampilkan sebagai proses produksi nyata.

## Domain yang direncanakan
`studio.bahasacerdas.com` melalui Cloudflare setelah VPS terpisah siap.

## Dokumen
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/FRONTEND_SCOPE.md`
- `docs/FRONTEND_INFORMATION_ARCHITECTURE.md`
- `docs/BOOK_PRODUCTION_WORKFLOW.md`
- `docs/AI_AGENT_OPERATING_POLICY.md`
