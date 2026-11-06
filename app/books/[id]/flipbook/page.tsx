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

  const pageStyle: React.CSSProperties = {
    background: "#fefefe",
    backgroundImage: "linear-gradient(to right, rgba(0,0,0,.03) 0%, transparent 8%, transparent 92%, rgba(0,0,0,.03) 100%)",
    color: "#1a1a1a",
    padding: "40px 36px",
    overflow: "auto",
    boxShadow: "inset 0 0 20px rgba(0,0,0,.04)",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at center, #1e293b 0%, #0f172a 70%)",
        color: "white",
        padding: "30px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontWeight: 600 }}>{book.title}</h1>
        <p style={{ opacity: 0.65, marginTop: 4 }}>
          Kelas {book.grade} · {book.subject}
        </p>
      </div>

      <div
        style={{
          filter: "drop-shadow(0 25px 40px rgba(0,0,0,.55))",
          borderRadius: 4,
        }}
      >
        <HTMLFlipBook
          width={520}
          height={680}
          size="stretch"
          minWidth={320}
          maxWidth={640}
          minHeight={440}
          maxHeight={860}
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
          {/* Cover */}
          <div
            className="page cover"
            style={{
              background: "linear-gradient(160deg, #1e3a8a 0%, #1e40af 40%, #2563eb 100%)",
              color: "white",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              padding: 48,
              textAlign: "center",
              boxShadow: "inset 0 0 60px rgba(0,0,0,.25)",
              borderRight: "1px solid rgba(255,255,255,.1)",
            }}
          >
            <div style={{ fontSize: 13, letterSpacing: 2, opacity: 0.7, marginBottom: 12 }}>BC BOOK STUDIO</div>
            <h2 style={{ fontSize: 34, margin: "8px 0 16px", lineHeight: 1.2, fontWeight: 700 }}>{book.title}</h2>
            <div style={{ width: 60, height: 2, background: "rgba(255,255,255,.4)", margin: "12px 0" }} />
            <p style={{ margin: "6px 0", fontSize: 18 }}>Kelas {book.grade}</p>
            <p style={{ margin: "4px 0", opacity: 0.85 }}>{book.subject}</p>
          </div>

          {/* Chapters */}
          {book.chapters.map((ch) => (
            <div key={ch.id} className="page" style={pageStyle}>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>Bab {ch.position}</div>
              <h2 style={{ color: "#1e3a8a", marginTop: 0, marginBottom: 16, fontSize: 22 }}>{ch.title}</h2>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 15 }}>{ch.content}</div>
            </div>
          ))}

          {/* Back cover */}
          <div
            className="page"
            style={{
              background: "linear-gradient(160deg, #1e3a8a 0%, #1e40af 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: 40,
            }}
          >
            <div>
              <p style={{ fontSize: 18, marginBottom: 8 }}>Selesai</p>
              <p style={{ opacity: 0.7, fontSize: 14 }}>BC Book Studio</p>
            </div>
          </div>
        </HTMLFlipBook>
      </div>

      <p style={{ textAlign: "center", marginTop: 28, opacity: 0.55, fontSize: 13 }}>
        Klik sudut halaman atau geser untuk membalik · Bayangan mengikuti gerakan halaman
      </p>
    </div>
  );
}
