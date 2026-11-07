# BC Book Studio

Independent educational book publishing studio for [BahasaCerdas](https://bahasacerdas.com).

Create, review, and publish books for grades 1–12 with a built-in quality gate.

## Features

- **Editorial workflow**: Draft → Review → Approval (exports blocked until approved)
- **AI-assisted drafting**: Optional chapter generation (human review required)
- **Export**: PDF and EPUB for approved books
- **Role separation**: Distinct tokens for editor and reviewer
- **Stack**: Next.js 15 + React 19 + TypeScript + Prisma + PostgreSQL

## Quick Start

**Requirements**: Node.js 22, PostgreSQL 16

```sh
cp .env.example .env
# Fill DATABASE_URL, STUDIO_API_KEY, and a different STUDIO_REVIEWER_API_KEY
# (each token ≥ 24 characters). Optionally add AI credentials.

npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://localhost:3000, enter your studio token, and create a book.

Before releasing:

```sh
npm run typecheck
npm run build
```

## Project Structure

- `app/` — Next.js app and API routes
- `prisma/` — Schema and migrations
- `docs/` — Deployment and vision documents
- `AGENTS.md` — Guidance for AI coding agents

## Documentation

- [Product vision](docs/VISION.md) — Direction for print + digital publishing
- [Deployment runbook](docs/DEPLOYMENT.md)
- [AGENTS.md](AGENTS.md) — Conventions for coding agents

## Current Limitations

This is an early functional MVP.

- AI produces chapter drafts only (not a full agent system)
- Tokens are not per-user identity
- PDF uses limited fonts (Unicode/Indonesian support needs a licensed font)
- No images, exercises pipeline, or automated curriculum checks yet
- Deployment to production VPS not yet verified

**Security notes**

- Never reuse the BahasaCerdas production database
- Never commit secrets

## License

Private / internal use for BahasaCerdas. Contact the maintainer for questions.

## Kontrak blok bab untuk CRUD editorial

`lib/blocks` menyediakan validasi Zod, konversi ke teks, hitung kata, dan
render HTML. Setiap blok memakai CUID unik dalam bab. `type` membedakan jenis
blok dan `exerciseType` membedakan jenis soal. Teks alternatif gambar dan
kunci jawaban wajib diisi. Renderer isi bab menyimpan kunci jawaban untuk
diolah terpisah oleh tahap ekspor. Referensi `assets/<assetId>` harus
dipetakan oleh pipeline ekspor ke aset buku.

Pemetaan mengacu pada `agents/AGENT_ROUTING_MATRIX.md` dan
`agents/PROMPT_TEMPLATE_STANDARD.md` di branch
`feat/agent-orchestrator-book-flow`. Penulis (`author`) mengusulkan blok
naskah, Latihan dan Asesmen (`exercise`) memasok soal beserta kunci, dan
Ilustrasi dan Visual (`visual`) memasok referensi aset serta teks alternatif.
Penjamin Mutu (`qa`) dapat memakai hasil validasi sebagai bukti struktur.
Tata Letak (`layout`) memakai hasil render ketika pipeline ekspor terhubung.
Persetujuan editorial tetap melalui alur review manusia yang sudah ada.

Jalankan `npm test` untuk memeriksa kontrak blok. CRUD bab lama masih memakai
teks. Langkah berikutnya adalah revisi append-only, migrasi isi lama, dan
penguncian versi sebelum blok dihubungkan ke penyimpanan.
