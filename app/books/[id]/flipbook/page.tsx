"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import HTMLFlipBook from "react-pageflip";

type Chapter = { id: string; title: string; content: string; position: number };
type Book = { id: string; title: string; grade: string; subject: string; chapters: Chapter[] };

type Widget = {
  id: string;
  type: "note" | "youtube" | "quiz" | "checklist";
  x: number;
  y: number;
  data: any;
};

export default function FlipbookPage() {
  const params = useParams();
  const id = params.id as string;
  const [book, setBook] = useState<Book | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [dragged, setDragged] = useState<Widget | null>(null);
  const bookRef = useRef<any>(null);

  useEffect(() => {
    const t = sessionStorage.getItem("bc-token") || "";
    setToken(t);
    if (!t) return;

    const saved = localStorage.getItem(`bc-progress-${id}`);
    if (saved) setProgress(JSON.parse(saved));

    const savedWidgets = localStorage.getItem(`bc-widgets-${id}`);
    if (savedWidgets) setWidgets(JSON.parse(savedWidgets));

    fetch(`/api/books/${id}`, {
      headers: { Authorization: "Bearer " + t },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.book) setBook(data.book);
        else setError(data.error || "Gagal memuat buku");
      })
      .catch(() => setError("Gagal memuat buku"));
  }, [id]);

  useEffect(() => {
    localStorage.setItem(`bc-progress-${id}`, JSON.stringify(progress));
  }, [progress, id]);

  useEffect(() => {
    localStorage.setItem(`bc-widgets-${id}`, JSON.stringify(widgets));
  }, [widgets, id]);

  function addWidget(type: Widget["type"]) {
    const w: Widget = {
      id: Date.now().toString(),
      type,
      x: 40,
      y: 40,
      data:
        type === "youtube"
          ? { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
          : type === "quiz"
          ? { question: "Contoh soal?", options: ["A", "B", "C"], answer: 0 }
          : type === "checklist"
          ? { items: ["Tugas 1", "Tugas 2"] }
          : { text: "Catatan saya" },
    };
    setWidgets((prev) => [...prev, w]);
  }

  function toggleProgress(chapterId: string) {
    setProgress((p) => ({ ...p, [chapterId]: !p[chapterId] }));
  }

  if (!token) return <p style={{ padding: 40 }}>Silakan masuk ke studio terlebih dahulu.</p>;
  if (error) return <p style={{ padding: 40, color: "#b91c1c" }}>{error}</p>;
  if (!book) return <p style={{ padding: 40 }}>Memuat flipbook...</p>;

  const doneCount = Object.values(progress).filter(Boolean).length;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at center, #1e293b 0%, #0f172a 70%)",
        color: "white",
        padding: "20px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 900, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, padding: "0 16px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>{book.title}</h1>
          <p style={{ opacity: 0.65, margin: "4px 0 0", fontSize: 13 }}>
            Kelas {book.grade} · {book.subject} · Progress: {doneCount}/{book.chapters.length}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => addWidget("note")} style={btnStyle}>+ Catatan</button>
          <button onClick={() => addWidget("youtube")} style={btnStyle}>+ YouTube</button>
          <button onClick={() => addWidget("quiz")} style={btnStyle}>+ Kuis</button>
          <button onClick={() => addWidget("checklist")} style={btnStyle}>+ Ceklist</button>
        </div>
      </div>

      <div style={{ position: "relative", filter: "drop-shadow(0 25px 40px rgba(0,0,0,.55))" }}>
        <HTMLFlipBook
          ref={bookRef}
          width={540}
          height={700}
          size="stretch"
          minWidth={320}
          maxWidth={680}
          minHeight={440}
          maxHeight={900}
          showCover={true}
          mobileScrollSupport={true}
          className="flipbook"
          style={{}}
          startPage={0}
          drawShadow={true}
          flippingTime={900}
          usePortrait={true}
          startZIndex={0}
          autoSize={true}
          maxShadowOpacity={0.7}
          showPageCorners={true}
          disableFlipByClick={false}
        >
          <div className="page cover" style={coverStyle}>
            <div style={{ fontSize: 13, letterSpacing: 2, opacity: 0.7 }}>BC BOOK STUDIO</div>
            <h2 style={{ fontSize: 32, margin: "12px 0", fontWeight: 700 }}>{book.title}</h2>
            <p>Kelas {book.grade} · {book.subject}</p>
          </div>

          {book.chapters.map((ch) => (
            <div key={ch.id} className="page" style={pageStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>Bab {ch.position}</div>
                  <h2 style={{ color: "#1e3a8a", margin: "4px 0 12px", fontSize: 20 }}>{ch.title}</h2>
                </div>
                <label style={{ fontSize: 13, color: "#0f766e", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={!!progress[ch.id]}
                    onChange={() => toggleProgress(ch.id)}
                    style={{ marginRight: 6 }}
                  />
                  Selesai
                </label>
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 15 }}>{ch.content}</div>
            </div>
          ))}

          <div className="page" style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 18 }}>Selesai Belajar</p>
              <p style={{ color: "#64748b" }}>{doneCount} dari {book.chapters.length} bab ditandai selesai</p>
            </div>
          </div>
        </HTMLFlipBook>

        {/* Draggable widgets overlay */}
        {widgets.map((w) => (
          <div
            key={w.id}
            draggable
            onDragStart={() => setDragged(w)}
            onDragEnd={() => setDragged(null)}
            style={{
              position: "absolute",
              left: w.x,
              top: w.y,
              background: "white",
              color: "#1e293b",
              padding: 10,
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(0,0,0,.2)",
              minWidth: 180,
              maxWidth: 260,
              cursor: "move",
              zIndex: 10,
              fontSize: 13,
            }}
          >
            {w.type === "note" && <div>{w.data.text}</div>}
            {w.type === "youtube" && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>YouTube</div>
                <iframe
                  width="220"
                  height="124"
                  src={`https://www.youtube.com/embed/${extractId(w.data.url)}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ border: 0, borderRadius: 4 }}
                />
              </div>
            )}
            {w.type === "quiz" && (
              <div>
                <div style={{ fontWeight: 600 }}>{w.data.question}</div>
                {w.data.options.map((opt: string, i: number) => (
                  <div key={i} style={{ marginTop: 4 }}>
                    <label>
                      <input type="radio" name={w.id} /> {opt}
                    </label>
                  </div>
                ))}
              </div>
            )}
            {w.type === "checklist" && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Ceklist</div>
                {w.data.items.map((item: string, i: number) => (
                  <label key={i} style={{ display: "block", marginTop: 2 }}>
                    <input type="checkbox" /> {item}
                  </label>
                ))}
              </div>
            )}
            <button
              onClick={() => setWidgets((prev) => prev.filter((x) => x.id !== w.id))}
              style={{ marginTop: 6, fontSize: 11, color: "#b91c1c", background: "none", border: 0, cursor: "pointer" }}
            >
              Hapus
            </button>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 20, opacity: 0.55, fontSize: 12 }}>
        Geser sudut untuk membalik · Drag widget · Progress tersimpan di perangkat ini
      </p>
    </div>
  );
}

function extractId(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : "dQw4w9WgXcQ";
}

const btnStyle: React.CSSProperties = {
  padding: "6px 10px",
  background: "#1e40af",
  color: "white",
  border: 0,
  borderRadius: 6,
  fontSize: 12,
  cursor: "pointer",
};

const pageStyle: React.CSSProperties = {
  background: "#fefefe",
  backgroundImage: "linear-gradient(to right, rgba(0,0,0,.03) 0%, transparent 8%, transparent 92%, rgba(0,0,0,.03) 100%)",
  color: "#1a1a1a",
  padding: "36px 32px",
  overflow: "auto",
};

const coverStyle: React.CSSProperties = {
  background: "linear-gradient(160deg, #1e3a8a 0%, #1e40af 40%, #2563eb 100%)",
  color: "white",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center",
  padding: 40,
  textAlign: "center",
};
