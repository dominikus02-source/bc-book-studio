"use client";
import {useEffect, useState} from "react";
import {openReviewQueue, reviewNextStep, type QueueNote} from "../lib/review-queue";

const severityLabel: Record<string, string> = {CRITICAL: "Kritis", MAJOR: "Mayor", SUGGESTION: "Saran"};
const categoryLabel: Record<string, string> = {CONTENT: "Isi", FACT: "Fakta", CITATION: "Sitasi", LANGUAGE: "Bahasa", ACCESSIBILITY: "Aksesibilitas", COPYRIGHT: "Hak cipta", PEDAGOGY: "Pedagogi"};

export default function OpenReviewNotes({bookId, chapterId}: {bookId: string; chapterId?: string}) {
 const [notes, setNotes] = useState<QueueNote[]>([]);
 const [status, setStatus] = useState("");
 const [role, setRole] = useState<"owner" | "reviewer" | "reader">("reader");
 const [chapters, setChapters] = useState<{id: string; title: string}[]>([]);
 useEffect(() => {
  let cancel = false;
  fetch("/api/reviewer?bookId=" + encodeURIComponent(bookId), {credentials: "same-origin", cache: "no-store"})
   .then(response => response.ok ? response.json() : null)
   .then(data => {
    if (cancel || !data?.assignments?.[0]?.book) return;
    const book = data.assignments[0].book;
    setNotes(openReviewQueue(book.reviewNotes || []));
    setStatus(book.status || "");
    setRole(book.isOwner ? "owner" : book.canReview ? "reviewer" : "reader");
    setChapters(book.chapters || []);
   })
   .catch(() => {});
  return () => { cancel = true; };
 }, [bookId]);
 const visible = notes.filter(note => !chapterId || !note.chapterId || note.chapterId === chapterId);
 if (!visible.length) return null;
 const step = reviewNextStep({
  role, status,
  openCritical: notes.filter(note => note.severity === "CRITICAL").length,
  openMajor: notes.filter(note => note.severity === "MAJOR").length,
  openSuggestions: notes.filter(note => note.severity === "SUGGESTION").length,
 });
 return <section className="panel" aria-label="Catatan review yang terbuka">
  <h3>Catatan review</h3>
  <p role="status"><strong>{step.headline}</strong> {step.detail}</p>
  <ul>{visible.map(note => <li key={note.id}><strong>{severityLabel[note.severity] || note.severity} · {categoryLabel[note.category] || note.category}.</strong> {note.chapterId ? (chapters.find(chapter => chapter.id === note.chapterId)?.title || "Bab") + " — " : "Seluruh buku — "}{note.content}</li>)}</ul>
  <p className="form-hint">Catatan ini tidak mengubah naskah. Penulis memperbaiki teks, lalu peninjau menandai temuan selesai.</p>
 </section>;
}
