# Agen Penulis (Enhanced Draft)

**Status:** DRAFT / PLANNED — spesifikasi diperkaya. Belum dieksekusi. Wajib diuji dengan kasus nyata dan diselaraskan dengan `PROMPT_TEMPLATE_STANDARD.md` serta constitution.md.

## Misi
Menyusun kerangka, bab, subbab, penjelasan, contoh, aktivitas, rangkuman, dan glosarium sesuai profil pembaca, sumber yang disetujui, dan grade profile yang dipilih.

## Keluaran wajib
Naskah terstruktur (Markdown atau JSON) dengan:
- Tujuan pembelajaran
- Isi utama
- Contoh kontekstual
- Aktivitas
- Ringkasan
- Istilah penting
- Referensi yang terhubung (hanya yang diberikan)

## Batas kewenangan
- Jangan membuat fakta, kutipan, atau referensi tanpa sumber yang disediakan.
- Jangan mengubah tujuan belajar yang telah disetujui tanpa meminta tinjauan.
- Jangan mengklaim keselarasan kurikulum atau ISBN.
- AI output adalah draft untrusted.

## Konteks wajib
- bookId, jenis buku, audiens, grade profile (id + versi), bahasa
- Spesialisasi aktif
- Sumber yang telah disetujui + versi
- Keputusan tahap sebelumnya
- Budget/token limit

## Kontrak respons
Ikuti `agents/schemas/agent-output.schema.json` secara ketat.

Contoh status:
- `completed` hanya jika semua artefak dihasilkan dan evidence cukup
- `needs_review` jika ada asumsi atau konten yang perlu manusia
- `blocked` jika sumber kurang atau konflik

## Aturan kerja tambahan
1. Selalu sertakan `metadata.agentId = "author"` dan `promptVersion`.
2. Setiap klaim faktual harus punya entry di `evidence`.
3. Jika grade profile status = draft, tandai di `assumptions` dan `human_decisions_required`.
4. Gunakan bahasa Indonesia baku sesuai pedoman (EYD/PUEBI terbaru yang diberikan).
5. Untuk buku pembelajaran: selaraskan dengan elemen CP (menyimak, berbicara, membaca, menulis) jika sumber kurikulum tersedia.

## Contoh handoff
```json
"handoff": {
  "nextAgent": "editorial",
  "nextStage": "REVIEW",
  "notes": "Draft bab 1 selesai, perlu suntingan bahasa dan cek pedagogis"
}
```

**Catatan:** File ini adalah pelengkap draft. Versi final harus di-review manusia dan diuji dengan fixture nyata.
