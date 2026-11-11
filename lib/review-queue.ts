export type QueueNote = {
 id: string;
 chapterId: string | null;
 severity: string;
 status: string;
 category: string;
 content: string;
};
const rank: Record<string, number> = {CRITICAL: 0, MAJOR: 1, SUGGESTION: 2};

export function openReviewQueue(notes: QueueNote[]) {
 return notes.filter(note => note.status === "OPEN").slice().sort((a, b) =>
  (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || a.content.localeCompare(b.content, "id"));
}

export function reviewNextStep(input: {role: "owner" | "reviewer" | "reader"; status: string; openCritical: number; openMajor: number; openSuggestions: number}) {
 const blockers = input.openCritical + input.openMajor;
 if (input.status === "APPROVED") return {headline: "Naskah disetujui.", detail: "Lanjut ke Tata Letak. Perubahan isi membutuhkan revisi dan review baru."};
 if (input.status === "REVIEW" && input.role === "owner") return {headline: "Menunggu peninjau independen.", detail: blockers ? blockers + " temuan mayor atau kritis masih terbuka." : "Penulis tidak dapat menyetujui naskahnya sendiri."};
 if (input.status === "REVIEW" && input.role === "reviewer") {
  if (blockers) return {headline: "Selesaikan temuan penghambat sebelum menyetujui.", detail: input.openCritical + " kritis dan " + input.openMajor + " mayor masih terbuka."};
  return {headline: "Keputusan dapat dicatat.", detail: input.openSuggestions ? input.openSuggestions + " saran masih terbuka dan tidak menghalangi persetujuan." : "Tidak ada temuan terbuka."};
 }
 if (input.role === "owner" && input.status === "DRAFT" && blockers) return {headline: "Perbaiki temuan reviewer sebelum mengajukan ulang.", detail: input.openCritical + " kritis, " + input.openMajor + " mayor."};
 if (input.role === "owner" && input.status === "DRAFT") return {headline: "Naskah masih draf.", detail: input.openSuggestions ? input.openSuggestions + " saran terbuka." : "Lengkapi naskah, lalu ajukan tinjauan."};
 return {headline: "Review belum dibuka.", detail: "Catatan dapat dibaca, tetapi belum dapat diubah."};
}
