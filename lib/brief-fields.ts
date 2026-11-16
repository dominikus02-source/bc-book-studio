/** Maps a stage-gate message to the form control that can fix it. The description column stays `description`. */
export function briefFieldId(missing: string): string | null {
  if (missing.startsWith("Judul buku")) return "book-title";
  if (missing.startsWith("Bidang buku")) return "book-subject";
  if (missing.startsWith("Sinopsis")) return "book-synopsis";
  if (missing.startsWith("Pembaca sasaran")) return "book-audience";
  if (missing.startsWith("Tujuan penulisan")) return "book-goal";
  if (missing.startsWith("Identitas penulis") || missing.startsWith("Penulis")) return "book-author";
  if (missing.startsWith("Jenis buku")) return "book-type";
  if (missing.startsWith("Pilih genre") || missing.includes("genre tidak sesuai")) return "book-genre";
  if (missing.startsWith("Pilih format halaman")) return "book-page-size";
  return null;
}
