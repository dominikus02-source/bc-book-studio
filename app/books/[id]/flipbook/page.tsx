"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import HTMLFlipBook from "react-pageflip";

type Chapter = { id: string; title: string; content: string; position: number };
type Book = { id: string; title: string; grade: string; subject: string; chapters: Chapter[] };

export default function FlipbookPage() {
  const params = useParams();
  const id = params.id as string;
  const [book, setBook] = useState<Book | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const t = sessionStorage.getItem("bc-token") || "";
    setToken(t);
    if (!t) return;
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

  if (!token) return <p style={{ padding: 40 }}>Silakan masuk ke studio terlebih dahulu.</p>;
  if (error) return <p style={{ padding: 40, color: "#b91c1c" }}>{error}</p>;
  if (!book) return <p style={{ padding: 40 }}>Memuat flipbook...</p>;

  return (
    <div style={{ minHeight: "100vh", background: "#0f172a", color: "white", padding: "20px 0" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>{book.title}</h1>
        <p style={{ opacity: 0.7 }}>
          Kelas {book.grade} · {book.subject}
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <HTMLFlipBook
          width={500}
          height={650}
          size="stretch"
          minWidth={300}
          maxWidth={600}
          minHeight={400}
          maxHeight={800}
          showCover={true}
          mobileScrollSupport={true}
          className="flipbook"
          style={{}}
          startPage={0}
          drawShadow={true}
          flippingTime={800}
          usePortrait={true}
          startZIndex={0}
          autoSize={true}
          maxShadowOpacity={0.5}
          showPageCorners={true}
          disableFlipByClick={false}
        >
          <div className="page cover" style={{ background: "linear-gradient(135deg,#1e40af,#3b82f6)", color: "white", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 40, textAlign: "center" }}>
            <h2 style={{ fontSize: 32, marginBottom: 10 }}>{book.title}</h2>
            <p>Kelas {book.grade}</p>
            <p>{book.subject}</p>
          </div>

          {book.chapters.map((ch) => (
            <div key={ch.id} className="page" style={{ background: "white", color: "#1e293b", padding: 30, overflow: "auto" }}>
              <h2 style={{ color: "#1e40af", marginTop: 0 }}>{ch.position}. {ch.title}</h2>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{ch.content}</div>
            </div>
          ))}

          <div className="page" style={{ background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
            <p>Selesai</p>
          </div>
        </HTMLFlipBook>
      </div>

      <p style={{ textAlign: "center", marginTop: 20, opacity: 0.6, fontSize: 14 }}>
        Klik sudut halaman atau geser untuk membalik
      </p>
    </div>
  );
}
