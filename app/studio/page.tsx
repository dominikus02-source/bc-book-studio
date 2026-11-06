"use client";

import { useCallback, useEffect, useState } from "react";

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

type Role = "editor" | "reviewer" | null;

export default function StudioPage() {
  const [token, setToken] = useState("");
  const [role, setRole] = useState<Role>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("1");
  const [subject, setSubject] = useState("Bahasa Indonesia");
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
      const res = await fetch("/api/books", {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) throw new Error("Token tidak valid");
      sessionStorage.setItem("bc-token", token);
      // Simple role detection: try reviewer endpoint behavior later; for now mark as editor
      setRole("editor");
      await refresh();
      setNotice("Masuk sebagai Editor");
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

  async function createBook() {
    await run(async () => {
      const response = await call("/books", {
        method: "POST",
        body: JSON.stringify({ title, grade, subject }),
      });
      const data = await response.json();
      setSelected(data.book.id);
      setTitle("");
      await refresh();
      setNotice("Buku dibuat.");
    });
  }

  async function addChapter() {
    if (!book) return;
    await run(async () => {
      await call("/books/" + book.id + "/chapters", {
        method: "POST",
        body: JSON.stringify({ title: chapterTitle, content: chapterText }),
      });
      setChapterTitle("");
      setChapterText("");
      await refresh();
      setNotice("Bab tersimpan.");
    });
  }

  async function review(action: "submit" | "approve" | "reject") {
    if (!book) return;
    await run(async () => {
      await call("/books/" + book.id + "/review", {
        method: "POST",
        headers: action === "submit" ? {} : { Authorization: "Bearer " + token },
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
      const response = await call("/books/" + book.id + "/export?format=" + format);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bc-${book.id}.${format === "flipbook" ? "html" : format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  if (!role) {
    return (
      <main style={container}>
        <h1>BC Book Studio</h1>
        <p>Masuk dengan token Editor atau Reviewer.</p>
        <input
          type="password"
          placeholder="Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          style={input}
        />
        <button style={btn} disabled={busy || !token} onClick={login}>
          Masuk
        </button>
        {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      </main>
    );
  }

  return (
    <main style={container}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Studio</h1>
          <p style={{ margin: "4px 0 0", color: "#64748b" }}>Role: {role === "editor" ? "Editor" : "Reviewer"}</p>
        </div>
        <button
          style={{ ...btn, background: "#64748b" }}
          onClick={() => {
            setRole(null);
            setToken("");
            setBooks([]);
            sessionStorage.removeItem("bc-token");
          }}
        >
          Keluar
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, marginTop: 20 }}>
        {/* Sidebar CRUD */}
        <aside style={card}>
          <h3>Buat Buku</h3>
          <input style={input} placeholder="Judul" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select style={input} value={grade} onChange={(e) => setGrade(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i}>{i + 1}</option>
            ))}
            <option>Referensi</option>
          </select>
          <input style={input} placeholder="Mapel" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <button style={btn} disabled={busy || title.length < 2} onClick={createBook}>
            Buat
          </button>

          <h3 style={{ marginTop: 24 }}>Daftar Buku</h3>
          {books.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelected(b.id)}
              style={{
                ...listBtn,
                background: b.id === selected ? "#e0e7ff" : "white",
              }}
            >
              <strong>{b.title}</strong>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                {b.status} · {b.chapters.length} bab
              </div>
            </button>
          ))}
        </aside>

        {/* Main */}
        <section style={card}>
          {!book ? (
            <p>Pilih buku di sebelah kiri.</p>
          ) : (
            <>
              <h2>{book.title}</h2>
              <p>
                Kelas {book.grade} · {book.subject} · <strong>{book.status}</strong>
              </p>

              {book.chapters.map((ch) => (
                <article key={ch.id} style={{ borderBottom: "1px solid #e2e8f0", marginBottom: 12, paddingBottom: 12 }}>
                  <h4>
                    {ch.position}. {ch.title}
                  </h4>
                  <p style={{ whiteSpace: "pre-wrap", maxHeight: 180, overflow: "auto" }}>{ch.content}</p>
                </article>
              ))}

              {book.status === "DRAFT" && (
                <>
                  <h3>Tambah Bab</h3>
                  <input style={input} placeholder="Judul bab" value={chapterTitle} onChange={(e) => setChapterTitle(e.target.value)} />
                  <textarea style={input} rows={6} placeholder="Isi bab" value={chapterText} onChange={(e) => setChapterText(e.target.value)} />
                  <button style={btn} disabled={busy || chapterTitle.length < 2} onClick={addChapter}>
                    Simpan Bab
                  </button>
                </>
              )}

              <h3 style={{ marginTop: 20 }}>Fasilitas</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {book.status === "DRAFT" && (
                  <button style={btn} disabled={busy || !book.chapters.length} onClick={() => review("submit")}>
                    Ajukan Review
                  </button>
                )}
                {book.status === "REVIEW" && (
                  <>
                    <textarea style={input} placeholder="Catatan" value={note} onChange={(e) => setNote(e.target.value)} />
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
                      Flipbook Interaktif
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {error && <p style={{ color: "#b91c1c", marginTop: 16 }}>{error}</p>}
      {notice && <p style={{ color: "#166534", marginTop: 16 }}>{notice}</p>}
    </main>
  );
}

const container: React.CSSProperties = { maxWidth: 1100, margin: "auto", padding: 24, fontFamily: "system-ui,sans-serif" };
const card: React.CSSProperties = { background: "white", padding: 20, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,.08)" };
const input: React.CSSProperties = { width: "100%", padding: 10, marginBottom: 8, border: "1px solid #cbd5e1", borderRadius: 8, boxSizing: "border-box" };
const btn: React.CSSProperties = { padding: "8px 14px", background: "#1e40af", color: "white", border: 0, borderRadius: 8, cursor: "pointer" };
const listBtn: React.CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: 10, marginBottom: 6, border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer" };
