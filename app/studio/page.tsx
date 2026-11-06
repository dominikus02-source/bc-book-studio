"use client";

import { useCallback, useState } from "react";

type Chapter = { id: string; title: string; content: string; position: number };
type Review = { id: string; decision: string; note: string; createdAt: string };
type Book = {
  id: string;
  title: string;
  grade: string;
  subject: string;
  status: "DRAFT" | "REVIEW" | "APPROVED";
  chapters: Chapter[];
  reviews: Review[];
};

export default function StudioPage() {
  const [token, setToken] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [editingBook, setEditingBook] = useState(false);
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("1");
  const [subject, setSubject] = useState("Bahasa Indonesia");

  const [editingChapter, setEditingChapter] = useState<string | null>(null);
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterText, setChapterText] = useState("");
  const [note, setNote] = useState("");

  const book = books.find((b) => b.id === selected);

  const call = useCallback(
    async (path: string, init?: RequestInit) => {
      const response = await fetch("/api" + path, {
        ...init,
        headers: {
          Authorization: "Bearer " + token,
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...init?.headers,
        },
        cache: "no-store",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(data.error || "HTTP " + response.status);
      }
      return response;
    },
    [token]
  );

  const refresh = useCallback(async () => {
    const response = await call("/books");
    const data = await response.json();
    setBooks(data.books);
  }, [call]);

  async function login() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/books", { headers: { Authorization: "Bearer " + token } });
      if (!res.ok) throw new Error("Token tidak valid");
      sessionStorage.setItem("bc-token", token);
      setLoggedIn(true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal masuk");
    } finally {
      setBusy(false);
    }
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setBusy(false);
    }
  }

  async function saveBook() {
    await run(async () => {
      if (editingBook && selected) {
        await call("/books/" + selected, { method: "PUT", body: JSON.stringify({ title, grade, subject }) });
        setNotice("Buku diperbarui.");
      } else {
        const res = await call("/books", { method: "POST", body: JSON.stringify({ title, grade, subject }) });
        const data = await res.json();
        setSelected(data.book.id);
        setNotice("Buku dibuat.");
      }
      setTitle("");
      setEditingBook(false);
      await refresh();
    });
  }

  async function deleteBook(id: string) {
    if (!confirm("Hapus buku ini?")) return;
    await run(async () => {
      await call("/books/" + id, { method: "DELETE" });
      if (selected === id) setSelected("");
      await refresh();
      setNotice("Buku dihapus.");
    });
  }

  async function saveChapter() {
    if (!book) return;
    await run(async () => {
      if (editingChapter) {
        await call(`/books/${book.id}/chapters/${editingChapter}`, {
          method: "PUT",
          body: JSON.stringify({ title: chapterTitle, content: chapterText }),
        });
        setNotice("Bab diperbarui.");
      } else {
        await call(`/books/${book.id}/chapters`, {
          method: "POST",
          body: JSON.stringify({ title: chapterTitle, content: chapterText }),
        });
        setNotice("Bab ditambahkan.");
      }
      setChapterTitle("");
      setChapterText("");
      setEditingChapter(null);
      await refresh();
    });
  }

  async function deleteChapter(chapterId: string) {
    if (!book || !confirm("Hapus bab ini?")) return;
    await run(async () => {
      await call(`/books/${book.id}/chapters/${chapterId}`, { method: "DELETE" });
      await refresh();
      setNotice("Bab dihapus.");
    });
  }

  async function review(action: "submit" | "approve" | "reject") {
    if (!book) return;
    await run(async () => {
      await call(`/books/${book.id}/review`, {
        method: "POST",
        body: JSON.stringify({ action, note }),
      });
      setNote("");
      await refresh();
      setNotice("Status diperbarui.");
    });
  }

  async function download(format: string) {
    if (!book) return;
    await run(async () => {
      const response = await call(`/books/${book.id}/export?format=${format}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bc-${book.id}.${format === "flipbook" ? "html" : format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  function startEditBook() {
    if (!book) return;
    setTitle(book.title);
    setGrade(book.grade);
    setSubject(book.subject);
    setEditingBook(true);
  }

  function startEditChapter(ch: Chapter) {
    setEditingChapter(ch.id);
    setChapterTitle(ch.title);
    setChapterText(ch.content);
  }

  if (!loggedIn) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc" }}>
        <div style={{ background: "white", padding: 32, borderRadius: 16, width: 360, boxShadow: "0 4px 20px rgba(0,0,0,.08)" }}>
          <h1 style={{ marginTop: 0 }}>BC Book Studio</h1>
          <p style={{ color: "#64748b" }}>Masuk dengan token Editor atau Reviewer.</p>
          <input type="password" placeholder="Token" value={token} onChange={(e) => setToken(e.target.value)} style={input} />
          <button style={btn} disabled={busy || !token} onClick={login}>Masuk</button>
          {error && <p style={{ color: "#b91c1c", marginTop: 12 }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc", fontFamily: "system-ui,sans-serif" }}>
      {/* Sidebar */}
      <aside style={{ width: 280, background: "white", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: 20, borderBottom: "1px solid #e2e8f0" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Studio</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Editor</p>
        </div>

        <div style={{ padding: 16, flex: 1, overflow: "auto" }}>
          <button style={{ ...btn, width: "100%", marginBottom: 16 }} onClick={() => { setEditingBook(false); setTitle(""); setSelected(""); }}>
            + Buku Baru
          </button>

          {books.map((b) => (
            <div key={b.id} style={{ marginBottom: 6 }}>
              <button
                onClick={() => setSelected(b.id)}
                style={{
                  ...listBtn,
                  background: b.id === selected ? "#eff6ff" : "transparent",
                  borderColor: b.id === selected ? "#bfdbfe" : "transparent",
                }}
              >
                <div style={{ fontWeight: 600 }}>{b.title}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {b.status} · {b.chapters.length} bab
                </div>
              </button>
            </div>
          ))}
        </div>

        <div style={{ padding: 16, borderTop: "1px solid #e2e8f0" }}>
          <button style={{ ...btn, background: "#64748b", width: "100%" }} onClick={() => { setLoggedIn(false); setToken(""); setBooks([]); sessionStorage.removeItem("bc-token"); }}>
            Keluar
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, padding: 28, overflow: "auto" }}>
        {!selected && !editingBook && (
          <div style={{ color: "#64748b", marginTop: 40 }}>
            <p>Pilih buku di sidebar atau buat buku baru.</p>
          </div>
        )}

        {(editingBook || (!selected && title !== undefined)) && (
          <div style={card}>
            <h3>{editingBook ? "Edit Buku" : "Buku Baru"}</h3>
            <input style={input} placeholder="Judul" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select style={input} value={grade} onChange={(e) => setGrade(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => <option key={i}>{i + 1}</option>)}
              <option>Referensi</option>
            </select>
            <input style={input} placeholder="Mata pelajaran" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btn} disabled={busy || title.length < 2} onClick={saveBook}>Simpan</button>
              <button style={{ ...btn, background: "#64748b" }} onClick={() => { setEditingBook(false); setTitle(""); }}>Batal</button>
            </div>
          </div>
        )}

        {book && !editingBook && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2 style={{ margin: 0 }}>{book.title}</h2>
                <p style={{ color: "#64748b", margin: "6px 0 0" }}>
                  Kelas {book.grade} · {book.subject} · <strong>{book.status}</strong>
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {book.status === "DRAFT" && (
                  <button style={btn} onClick={startEditBook}>Edit</button>
                )}
                <button style={{ ...btn, background: "#b91c1c" }} onClick={() => deleteBook(book.id)}>Hapus</button>
              </div>
            </div>

            <div style={{ marginTop: 24 }}>
              <h3>Bab</h3>
              {book.chapters.map((ch) => (
                <div key={ch.id} style={{ ...card, marginBottom: 12, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{ch.position}. {ch.title}</strong>
                    {book.status === "DRAFT" && (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={smallBtn} onClick={() => startEditChapter(ch)}>Edit</button>
                        <button style={{ ...smallBtn, color: "#b91c1c" }} onClick={() => deleteChapter(ch.id)}>Hapus</button>
                      </div>
                    )}
                  </div>
                  <p style={{ whiteSpace: "pre-wrap", margin: "8px 0 0", maxHeight: 120, overflow: "auto", color: "#334155" }}>{ch.content}</p>
                </div>
              ))}

              {book.status === "DRAFT" && (
                <div style={card}>
                  <h4>{editingChapter ? "Edit Bab" : "Tambah Bab"}</h4>
                  <input style={input} placeholder="Judul bab" value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} />
                  <textarea style={input} rows={5} placeholder="Isi bab" value={chapterText} onChange={(e) => setChapterText(e.target.value)} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={btn} disabled={busy || chapterTitle.length < 2} onClick={saveChapter}>
                      {editingChapter ? "Perbarui" : "Tambah"}
                    </button>
                    {editingChapter && (
                      <button style={{ ...btn, background: "#64748b" }} onClick={() => { setEditingChapter(null); setChapterTitle(""); setChapterText(""); }}>
                        Batal
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 24 }}>
              <h3>Fasilitas</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {book.status === "DRAFT" && (
                  <button style={btn} disabled={busy || !book.chapters.length} onClick={() => review("submit")}>Ajukan Review</button>
                )}
                {book.status === "REVIEW" && (
                  <>
                    <textarea style={{ ...input, maxWidth: 300 }} placeholder="Catatan" value={note} onChange={(e) => setNote(e.target.value)} />
                    <button style={btn} disabled={busy || !note.trim()} onClick={() => review("approve")}>Setujui</button>
                    <button style={{ ...btn, background: "#64748b" }} disabled={busy} onClick={() => review("reject")}>Kembalikan</button>
                  </>
                )}
                {book.status === "APPROVED" && (
                  <>
                    <button style={btn} onClick={() => download("pdf")}>PDF</button>
                    <button style={btn} onClick={() => download("epub")}>EPUB</button>
                    <button style={btn} onClick={() => download("docx")}>DOCX</button>
                    <button style={btn} onClick={() => window.open(`/books/${book.id}/flipbook`, "_blank")}>Flipbook</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {error && <p style={{ color: "#b91c1c", marginTop: 16 }}>{error}</p>}
        {notice && <p style={{ color: "#166534", marginTop: 16 }}>{notice}</p>}
      </main>
    </div>
  );
}

const card: React.CSSProperties = { background: "white", padding: 20, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,.06)", marginBottom: 16 };
const input: React.CSSProperties = { width: "100%", padding: 10, marginBottom: 10, border: "1px solid #cbd5e1", borderRadius: 8, boxSizing: "border-box" };
const btn: React.CSSProperties = { padding: "8px 14px", background: "#1e40af", color: "white", border: 0, borderRadius: 8, cursor: "pointer" };
const smallBtn: React.CSSProperties = { padding: "4px 10px", background: "transparent", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer", fontSize: 13 };
const listBtn: React.CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: 10, border: "1px solid", borderRadius: 8, cursor: "pointer", background: "transparent" };
