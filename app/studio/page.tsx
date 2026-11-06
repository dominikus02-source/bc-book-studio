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

type View = "books" | "new" | "templates" | "settings";

const Icon = {
  book: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  layout: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  logout: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
};

export default function StudioPage() {
  const [token, setToken] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [selected, setSelected] = useState("");
  const [view, setView] = useState<View>("books");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      setView("books");
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
    setView("new");
  }

  function startEditChapter(ch: Chapter) {
    setEditingChapter(ch.id);
    setChapterTitle(ch.title);
    setChapterText(ch.content);
  }

  const nav = [
    { id: "books" as View, label: "Buku", icon: Icon.book },
    { id: "new" as View, label: "Baru", icon: Icon.plus },
    { id: "templates" as View, label: "Template", icon: Icon.layout },
    { id: "settings" as View, label: "Setelan", icon: Icon.settings },
  ];

  if (!loggedIn) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8fafc", padding: 16 }}>
        <div style={{ background: "white", padding: 28, borderRadius: 16, width: "100%", maxWidth: 360, boxShadow: "0 4px 20px rgba(0,0,0,.08)" }}>
          <h1 style={{ marginTop: 0 }}>BC Book Studio</h1>
          <p style={{ color: "#64748b" }}>Masuk dengan token Editor atau Reviewer.</p>
          <input type="password" placeholder="Token" value={token} onChange={(e) => setToken(e.target.value)} style={input} />
          <button style={btn} disabled={busy || !token} onClick={login}>
            Masuk
          </button>
          {error && <p style={{ color: "#b91c1c", marginTop: 12 }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .studio-layout { display: flex; min-height: 100vh; background: #f8fafc; font-family: system-ui, sans-serif; }
        .sidebar { width: 200px; background: white; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; flex-shrink: 0; }
        .main { flex: 1; padding: 24px; overflow: auto; min-width: 0; }
        .mobile-header { display: none; }
        @media (max-width: 768px) {
          .studio-layout { flex-direction: column; }
          .sidebar { width: 100%; border-right: none; border-bottom: 1px solid #e2e8f0; display: ${sidebarOpen ? "flex" : "none"}; }
          .main { padding: 16px; }
          .mobile-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: white; border-bottom: 1px solid #e2e8f0; }
          .book-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div className="studio-layout">
        <div className="mobile-header">
          <strong>BC Studio</strong>
          <button onClick={() => setSidebarOpen((v) => !v)} style={{ ...btn, padding: "6px 10px" }}>
            Menu
          </button>
        </div>

        <aside className="sidebar">
          <div style={{ padding: "16px 12px", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, background: "#1e40af", borderRadius: 6, display: "grid", placeItems: "center", color: "white", fontWeight: 700, fontSize: 13 }}>
                B
              </div>
              <div>
                <div style={{ fontWeight: 650, fontSize: 13 }}>BC Studio</div>
                <div style={{ fontSize: 11, color: "#64748b" }}>Editor</div>
              </div>
            </div>
          </div>

          <nav style={{ padding: 8, flex: 1 }}>
            {nav.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setView(item.id);
                  setSidebarOpen(false);
                  if (item.id === "new") {
                    setEditingBook(false);
                    setTitle("");
                    setSelected("");
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 10px",
                  marginBottom: 2,
                  border: 0,
                  borderRadius: 6,
                  background: view === item.id ? "#eff6ff" : "transparent",
                  color: view === item.id ? "#1e40af" : "#334155",
                  cursor: "pointer",
                  textAlign: "left",
                  fontSize: 13,
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div style={{ padding: 8, borderTop: "1px solid #e2e8f0" }}>
            <button
              onClick={() => {
                setLoggedIn(false);
                setToken("");
                setBooks([]);
                sessionStorage.removeItem("bc-token");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 10px",
                border: 0,
                borderRadius: 6,
                background: "transparent",
                color: "#64748b",
                cursor: "pointer",
                textAlign: "left",
                fontSize: 13,
              }}
            >
              {Icon.logout}
              Keluar
            </button>
          </div>
        </aside>

        <main className="main">
          {view === "books" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <h2 style={{ margin: 0 }}>Daftar Buku</h2>
                <button style={btn} onClick={() => setView("new")}>
                  + Buku Baru
                </button>
              </div>

              {!selected && (
                <div style={{ display: "grid", gap: 12 }} className="book-grid">
                  {books.length === 0 && <p style={{ color: "#64748b" }}>Belum ada buku. Buat buku baru untuk memulai.</p>}
                  {books.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelected(b.id)}
                      style={{
                        ...card,
                        textAlign: "left",
                        cursor: "pointer",
                        border: b.id === selected ? "1px solid #bfdbfe" : "1px solid transparent",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{b.title}</div>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                        Kelas {b.grade} · {b.subject} · {b.status} · {b.chapters.length} bab
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {book && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <button onClick={() => setSelected("")} style={{ background: "none", border: 0, color: "#64748b", cursor: "pointer", marginBottom: 8 }}>
                        ← Kembali
                      </button>
                      <h2 style={{ margin: 0 }}>{book.title}</h2>
                      <p style={{ color: "#64748b", margin: "6px 0 0" }}>
                        Kelas {book.grade} · {book.subject} · <strong>{book.status}</strong>
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {book.status === "DRAFT" && (
                        <button style={btn} onClick={startEditBook}>
                          Edit
                        </button>
                      )}
                      <button style={{ ...btn, background: "#b91c1c" }} onClick={() => deleteBook(book.id)}>
                        Hapus
                      </button>
                    </div>
                  </div>

                  <h3>Bab</h3>
                  {book.chapters.map((ch) => (
                    <div key={ch.id} style={{ ...card, marginBottom: 12, padding: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <strong>
                          {ch.position}. {ch.title}
                        </strong>
                        {book.status === "DRAFT" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button style={smallBtn} onClick={() => startEditChapter(ch)}>
                              Edit
                            </button>
                            <button style={{ ...smallBtn, color: "#b91c1c" }} onClick={() => deleteChapter(ch.id)}>
                              Hapus
                            </button>
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
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button style={btn} disabled={busy || chapterTitle.length < 2} onClick={saveChapter}>
                          {editingChapter ? "Perbarui" : "Tambah"}
                        </button>
                        {editingChapter && (
                          <button
                            style={{ ...btn, background: "#64748b" }}
                            onClick={() => {
                              setEditingChapter(null);
                              setChapterTitle("");
                              setChapterText("");
                            }}
                          >
                            Batal
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 24 }}>
                    <h3>Fasilitas</h3>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {book.status === "DRAFT" && (
                        <button style={btn} disabled={busy || !book.chapters.length} onClick={() => review("submit")}>
                          Ajukan Review
                        </button>
                      )}
                      {book.status === "REVIEW" && (
                        <>
                          <textarea style={{ ...input, maxWidth: 300 }} placeholder="Catatan" value={note} onChange={(e) => setNote(e.target.value)} />
                          <button style={btn} disabled={busy || !note.trim()} onClick={() => review("approve")}>
                            Setujui
                          </button>
                          <button style={{ ...btn, background: "#64748b" }} disabled={busy} onClick={() => review("reject")}>
                            Kembalikan
                          </button>
                        </>
                      )}
                      {book.status === "APPROVED" && (
                        <>
                          <button style={btn} onClick={() => download("pdf")}>PDF</button>
                          <button style={btn} onClick={() => download("epub")}>EPUB</button>
                          <button style={btn} onClick={() => download("docx")}>DOCX</button>
                          <button style={btn} onClick={() => window.open(`/books/${book.id}/flipbook`, "_blank")}>
                            Flipbook
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {view === "new" && (
            <div style={card}>
              <h3>{editingBook ? "Edit Buku" : "Buku Baru"}</h3>
              <input style={input} placeholder="Judul" value={title} onChange={(e) => setTitle(e.target.value)} />
              <select style={input} value={grade} onChange={(e) => setGrade(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i}>{i + 1}</option>
                ))}
                <option>Referensi</option>
              </select>
              <input style={input} placeholder="Mata pelajaran" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={btn} disabled={busy || title.length < 2} onClick={saveBook}>
                  Simpan
                </button>
                <button style={{ ...btn, background: "#64748b" }} onClick={() => setView("books")}>
                  Batal
                </button>
              </div>
            </div>
          )}

          {view === "templates" && (
            <div>
              <h2>Template</h2>
              <p style={{ color: "#64748b" }}>Template pendidikan akan tersedia di fase berikutnya (Modul, LKS, Buku Cerita, Ringkasan).</p>
            </div>
          )}

          {view === "settings" && (
            <div>
              <h2>Pengaturan</h2>
              <p style={{ color: "#64748b" }}>Token aktif tersimpan di sesi browser ini.</p>
            </div>
          )}

          {error && <p style={{ color: "#b91c1c", marginTop: 16 }}>{error}</p>}
          {notice && <p style={{ color: "#166534", marginTop: 16 }}>{notice}</p>}
        </main>
      </div>
    </>
  );
}

const card: React.CSSProperties = {
  background: "white",
  padding: 20,
  borderRadius: 12,
  boxShadow: "0 1px 3px rgba(0,0,0,.06)",
  marginBottom: 16,
};
const input: React.CSSProperties = {
  width: "100%",
  padding: 10,
  marginBottom: 10,
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  boxSizing: "border-box",
};
const btn: React.CSSProperties = {
  padding: "8px 14px",
  background: "#1e40af",
  color: "white",
  border: 0,
  borderRadius: 8,
  cursor: "pointer",
};
const smallBtn: React.CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
};
