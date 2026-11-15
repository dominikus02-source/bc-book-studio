import { sendStudioMail } from "./account";

export type MailRecipient = { email: string; name: string; active: boolean };

export function notificationsEnabled() {
  const raw = process.env.NOTIFY_EMAIL_ENABLED;
  if (raw == null || raw.trim() === "") return true;
  return !["0", "false", "no", "off"].includes(raw.trim().toLowerCase());
}

/** Same public origin used by account email links. */
export function appOrigin() {
  const raw = process.env.APP_ORIGIN || process.env.STUDIO_PUBLIC_ORIGIN || "https://bcbookstudio.bahasacerdas.com";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://bcbookstudio.bahasacerdas.com";
  }
}

export function studioLink(module: string, bookId: string) {
  const url = new URL("/studio", appOrigin());
  url.searchParams.set("module", module);
  url.searchParams.set("bookId", bookId);
  return url.toString();
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));

export function notificationMessage(input: { name: string; title: string; intro: string; link: string; subject: string }) {
  const text = `Halo ${input.name}.\n\n${input.intro}\n\nBuku: ${input.title}\nBuka halaman: ${input.link}\n\nPesan otomatis dari BC Book Studio. Abaikan jika Anda tidak mengenali buku ini.`;
  const html = `<!doctype html><html lang="id"><body style="font-family:Arial,sans-serif;color:#172033;font-size:18px;line-height:1.6"><p>Halo ${escapeHtml(input.name)}.</p><p>${escapeHtml(input.intro)}</p><p><strong>${escapeHtml(input.title)}</strong></p><p><a href="${escapeHtml(input.link)}">Buka halaman</a></p><p style="color:#445066;font-size:14px">Pesan otomatis dari BC Book Studio.</p></body></html>`;
  return { subject: input.subject, text, html };
}

export function activeRecipients(people: MailRecipient[]) {
  return people.filter(person => person.active && person.email.includes("@"));
}

/** Fire-and-forget. A delivery failure is logged and never thrown to the request. */
export function runNotify(task: () => Promise<void>) {
  if (!notificationsEnabled()) return;
  void task().catch(error => {
    console.error("notification failed", error instanceof Error ? error.message : "unknown");
  });
}

export function finishWithNotify<T>(response: T, task: (() => Promise<void>) | null) {
  if (task) runNotify(task);
  return response;
}

export async function sendNotification(to: MailRecipient, message: { subject: string; text: string; html: string }) {
  if (!notificationsEnabled()) return;
  if (!to.active) return;
  await sendStudioMail(to.email, message.subject, message.text, message.html);
}

export async function sendEach(people: MailRecipient[], messageFor: (person: MailRecipient) => { subject: string; text: string; html: string }) {
  const recipients = activeRecipients(people);
  for (const person of recipients) await sendNotification(person, messageFor(person));
}

export function reviewMail(
  kind: "assigned" | "submitted" | "approved" | "returned" | "collaborator",
  person: MailRecipient,
  book: { id: string; title: string }
) {
  const link = studioLink(kind === "collaborator" ? "Proyek Buku" : "Review Naskah", book.id);
  const copy = {
    assigned: { subject: "Anda ditugaskan meninjau naskah", intro: "Anda ditugaskan meninjau naskah ini. Buka Review Naskah untuk membaca dan memberi keputusan." },
    submitted: { subject: "Naskah menunggu keputusan Anda", intro: "Penulis mengajukan naskah ini untuk ditinjau. Buka Review Naskah untuk membaca dan memberi keputusan." },
    approved: { subject: "Naskah Anda disetujui", intro: "Naskah ini disetujui. Buka halaman review untuk melihat catatan dan melanjutkan ke tata letak." },
    returned: { subject: "Naskah Anda dikembalikan", intro: "Naskah ini dikembalikan untuk diperbaiki. Persetujuan pada putaran ini tidak lagi berlaku." },
    collaborator: { subject: "Anda diajak menulis buku", intro: "Penulis utama menambahkan Anda sebagai kolaborator. Anda dapat membantu menulis selama naskah masih draf." },
  }[kind];
  return notificationMessage({ name: person.name, title: book.title, intro: copy.intro, link, subject: copy.subject });
}
