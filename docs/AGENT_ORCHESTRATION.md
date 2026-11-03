# Orkestrasi agen

Katalog agen pada cabang frontend tetap dipertahankan. Backend saat ini memiliki gerbang AI dan worker Redis sederhana, **bukan** Chief Editor atau mesin orkestrasi produksi.

Desain target: brief → planner → task dependency DAG → antrean → worker → validator → checkpoint PostgreSQL → review manusia → dokumen terversi. Untuk setiap tugas: idempotency key, status, batas percobaan, batas token dan biaya, input/output tervalidasi, serta audit log. DLQ harus disertai re-drive yang dikontrol operator.

Worker awal menggunakan `BRPOP` dan hash hasil Redis; kegagalan proses di antara pengambilan dan penyimpanan dapat kehilangan pekerjaan. Tidak boleh dipakai untuk pekerjaan produksi sampai mekanisme pemulihan dan pengujian restart tersedia.
