export type StudioRole = "EDITOR" | "REVIEWER" | "ADMIN" | "SUPERADMIN";

export type StageGate = { name: string; complete: boolean; available: boolean; missing: string[] };

/** Visible stages. Stored editorialStage stays BRIEF | OUTLINE | WRITING | EDITING | REVIEW | LAYOUT. */
export const STAGE_PATH = [
  { name: "Ide", module: "Proyek Buku" },
  { name: "Rancang", module: "Rancang" },
  { name: "Tulis", module: "Studio Penulisan" },
  { name: "Review", module: "Review Naskah" },
  { name: "Terbit", module: "Tata Letak" },
] as const;

export function isManuscriptReviewerRole(role: string) {
  return role === "REVIEWER" || role === "ADMIN";
}

/** Owner, or a current REVIEWER/ADMIN who is still assigned. SUPERADMIN is not a manuscript reader of other people's books. */
export function canReadManuscript(actor: { id: string; role: string }, book: { ownerId: string }, assigned: boolean) {
  if (actor.id === book.ownerId) return true;
  return assigned && isManuscriptReviewerRole(actor.role);
}

/** Author cannot decide. Assignment and a live REVIEWER/ADMIN role are both required, and only while status is REVIEW. */
export function canDecideReview(actor: { id: string; role: string }, book: { ownerId: string; status: string }, assigned: boolean) {
  if (actor.id === book.ownerId) return false;
  if (book.status !== "REVIEW") return false;
  return assigned && isManuscriptReviewerRole(actor.role);
}

/** Flags already returned by GET /api/reviewer. */
export function showReviewDecision(role: string, book: { isOwner: boolean; canReview: boolean; status: string }) {
  return canDecideReview(
    { id: book.isOwner ? "owner" : "reviewer", role },
    { ownerId: book.isOwner ? "owner" : "author", status: book.status },
    book.canReview && !book.isOwner,
  );
}

export function showManuscriptBody(role: string, book: { isOwner: boolean; canReview: boolean }) {
  if (book.isOwner) return true;
  return isManuscriptReviewerRole(role) && book.canReview;
}

/** Next-button advance: BRIEF → OUTLINE, OUTLINE → WRITING. Ide cannot jump to Tulis. */
export function workflowAdvanceAllowed(current: string, to: "OUTLINE" | "WRITING", ready: boolean) {
  const required = to === "OUTLINE" ? "BRIEF" : "OUTLINE";
  return ready && current === required;
}

export function stageIndexFor(book: { status: string; editorialStage?: string }) {
  if (book.status === "APPROVED") return 4;
  if (book.status === "REVIEW") return 3;
  const stage = book.editorialStage || "BRIEF";
  if (stage === "BRIEF") return 0;
  if (stage === "OUTLINE") return 1;
  if (stage === "LAYOUT") return 4;
  return 2;
}

/** A later stage stays closed while any earlier stage is still unavailable. */
export function stageOpenAllowed(stages: { available: boolean }[], index: number) {
  if (index < 0 || index >= stages.length) return false;
  if (!stages[index]?.available) return false;
  return stages.slice(0, index).every(stage => stage.available);
}

export type BookWork = {
  status: string;
  editorialStage?: string;
  isOwner?: boolean;
  stageReadiness?: { stages: StageGate[] };
};

export type WorkAction = { label: string; detail: string; module: string; stageIndex: number };

export function bookWorkspaceAction(role: StudioRole, book: BookWork): WorkAction {
  const index = stageIndexFor(book);
  const stages = book.stageReadiness?.stages ?? [];
  const here = stages[index]?.missing?.[0] || "";
  if (book.isOwner === false) {
    if (showReviewDecision(role, { isOwner: false, canReview: true, status: book.status })) {
      return { label: "Beri keputusan", detail: "Bacalah dengan tenang, lalu setujui atau kembalikan.", module: "Review Naskah", stageIndex: index };
    }
    return { label: "Baca tinjauan", detail: "Naskah ini terbuka karena penugasan. Penulis yang mengubahnya.", module: "Review Naskah", stageIndex: index };
  }
  if (book.status === "REVIEW") {
    return { label: "Lihat catatan review", detail: "Peninjau yang ditugaskan yang memutuskan. Pengajuan tidak bisa ditarik dari sini.", module: "Review Naskah", stageIndex: index };
  }
  if (book.status === "APPROVED") {
    const open = stages[4]?.available !== false;
    return { label: open ? "Siapkan terbit" : "Lihat persetujuan", detail: here || "Naskah ini sudah disetujui. Tata letak menyusul.", module: open ? "Tata Letak" : "Review Naskah", stageIndex: index };
  }
  if ((book.editorialStage || "BRIEF") === "BRIEF") {
    return { label: "Lengkapi Ide", detail: here || "Isi gagasan ini, simpan, lalu lanjut ke kerangka. Tulis belum terbuka dari Ide.", module: "Proyek Buku", stageIndex: index };
  }
  if (book.editorialStage === "OUTLINE") {
    return { label: "Lengkapi Rancang", detail: here || "Susun bab di kerangka. Tulis dibuka dari halaman Rancang, bukan dari Ide.", module: "Rancang", stageIndex: index };
  }
  if (stages[2]?.complete && stages[3]?.available) {
    return { label: "Ajukan review", detail: here || "Naskah sudah cukup untuk diperiksa orang lain.", module: "Review Naskah", stageIndex: index };
  }
  return { label: "Lanjutkan menulis", detail: here || "Lanjutkan kalimat yang sedang berjalan.", module: "Studio Penulisan", stageIndex: index };
}

export function studioPrimaryNav(role: StudioRole) {
  const items: { label: string; title: string }[] = [
    { label: "Dasbor", title: "Beranda" },
    { label: "Proyek Buku", title: "Buku saya" },
    { label: "Review Naskah", title: role === "REVIEWER" ? "Antrean" : "Review" },
  ];
  if (role === "ADMIN" || role === "SUPERADMIN") items.push({ label: "ISBN & Legalitas", title: "Kantor penerbit" });
  if (role === "SUPERADMIN") items.push({ label: "Manajemen Akun", title: "Akun" });
  items.push({ label: "Pengaturan", title: "Pengaturan" }, { label: "Petunjuk Penggunaan", title: "Petunjuk" });
  return items;
}

export function roleHomeCopy(role: StudioRole) {
  if (role === "REVIEWER") return { title: "Lanjutkan naskah", lead: "Keputusan yang menunggu ada di antrean. Naskah milik Anda tetap berjalan dari Ide sampai Terbit." };
  if (role === "ADMIN") return { title: "Lanjutkan naskah", lead: "Buku Anda dan penugasan review ada di meja ini. Berkas ISBN disiapkan di kantor penerbit; ISBN, barcode, dan KDT diterbitkan Perpusnas." };
  if (role === "SUPERADMIN") return { title: "Kantor akun", lead: "Anda mengelola akun. Superadmin bukan peninjau naskah orang lain." };
  return { title: "Lanjutkan naskah", lead: "Satu naskah di depan Anda. Ide, Rancang, Tulis, Review, lalu Terbit — masing-masing membuka yang berikutnya." };
}

export function roleCaption(role: StudioRole) {
  if (role === "REVIEWER") return "Peninjau";
  if (role === "ADMIN") return "Admin penerbit";
  if (role === "SUPERADMIN") return "Superadmin";
  return "Editor";
}
