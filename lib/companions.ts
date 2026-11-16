export const COMPANION_KINDS = ["LKPD", "PANDUAN_GURU", "KUNCI_BUKU", "KUNCI_LKS"] as const;
export type CompanionKind = (typeof COMPANION_KINDS)[number];

export const COMPANION_LABEL: Record<CompanionKind, string> = {
  LKPD: "LKS / LKPD",
  PANDUAN_GURU: "Buku Panduan Guru",
  KUNCI_BUKU: "Kunci Jawaban Buku",
  KUNCI_LKS: "Kunci Jawaban LKS",
};

export function isCompanionKind(value: string): value is CompanionKind {
  return (COMPANION_KINDS as readonly string[]).includes(value);
}

export function companionGenre(kind: CompanionKind) {
  return kind === "PANDUAN_GURU" || kind === "KUNCI_BUKU" ? "GUIDE" : "WORKBOOK";
}

type SourceChapter = { title: string; outlineObjective: string; content: string };

function excerpt(content: string) {
  return content.replace(/!\[[^\]]*\]\([^)]+\)/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200);
}

export function companionChapterDraft(kind: CompanionKind, bookTitle: string, chapter: SourceChapter, index: number) {
  const title = COMPANION_LABEL[kind] + " — Bab " + (index + 1) + ": " + chapter.title;
  const goal = chapter.outlineObjective.trim() || "Tujuan bab belum diisi di buku utama.";
  const body = excerpt(chapter.content) || "Isi bab belum cukup. Lengkapi buku utama, lalu sunting bahan pendamping ini.";
  const content = kind === "LKPD"
    ? ["## Tujuan kegiatan", goal, "## Bahan dari buku", body, "## Latihan", "1. Jawab sesuai bacaan bab ini.", "2. Tuliskan satu contoh sendiri.", "## Ruang jawaban", "Nama: ....................", "Jawaban:"].join("\n\n")
    : kind === "PANDUAN_GURU"
      ? ["## Fokus bab", goal, "## Ringkasan untuk guru", body, "## Saran mengajar", "Bahas contoh di kelas, lalu minta peserta mengerjakan LKS.", "## Yang perlu dicek", "Pastikan istilah dan gambar sesuai naskah buku " + bookTitle + "."].join("\n\n")
      : kind === "KUNCI_BUKU"
        ? ["## Tujuan yang dinilai", goal, "## Kunci dan pembahasan", "Sesuaikan kunci ini dengan latihan pada bab \"" + chapter.title + "\".", body, "## Catatan penilai", "Terima jawaban setara yang alasannya benar."].join("\n\n")
        : ["## Kunci LKS bab ini", goal, "## Jawaban yang diharapkan", body, "## Rubrik singkat", "Lengkap: alasan dan contoh ada.", "Sebagian: jawaban benar tanpa alasan.", "Belum: tidak sesuai bacaan."].join("\n\n");
  return { title: title.slice(0, 180), outlineObjective: goal.slice(0, 1500), content };
}

export function companionCompleteness(chapters: { content: string }[]) {
  if (!chapters.length) return { state: "kosong" as const, filled: 0, total: 0 };
  const filled = chapters.filter(chapter => chapter.content.trim().length >= 20).length;
  return { state: filled === chapters.length ? "lengkap" as const : "sebagian" as const, filled, total: chapters.length };
}
