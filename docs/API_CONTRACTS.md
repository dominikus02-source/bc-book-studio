# Kontrak API tahap 2

Sumber kontrak yang telah diimplementasikan: OpenAPI FastAPI otomatis di `/openapi.json` (endpoint docs UI dinonaktifkan). Saat ini:
- `GET /health`: status proses API, belum mencakup DB/Redis.
- `POST /api/v1/drafts`: memerlukan header `Authorization: Bearer <token>`; masukan `topic`, `grade`, `objectives`, `provider`; keluaran `status: perlu_tinjauan` dan `draft`.

Endpoint proyek, brief, rencana, agen, pekerjaan, approval, dokumen, penggunaan AI, dan audit masih **belum diimplementasikan**. Jangan menghubungkan UI simulasi seolah API tersebut tersedia. Tipe frontend dari OpenAPI belum dihasilkan.
