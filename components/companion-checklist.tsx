"use client";
import { useEffect, useState } from "react";

type Row = { kind: string; label: string; id: string | null; title: string | null; state: "kosong" | "sebagian" | "lengkap"; filled: number; total: number };
const label: Record<Row["state"], string> = { kosong: "Belum dibuat", sebagian: "Masih kurang", lengkap: "Lengkap" };

export default function CompanionChecklist({ bookId, onOpen }: { bookId: string; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function load() {
    const response = await fetch("/api/books/" + encodeURIComponent(bookId) + "/companions", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "Bahan pendamping gagal dimuat.");
    setRows(data.companions || []);
  }
  useEffect(() => { void load().catch(e => setError(e.message)); }, [bookId]);
  async function create(kind: string) {
    setBusy(kind); setError("");
    try {
      const response = await fetch("/api/books/" + encodeURIComponent(bookId) + "/companions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Gagal membuat bahan pendamping.");
      await load();
      onOpen(data.companion.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal membuat bahan pendamping."); }
    finally { setBusy(""); }
  }
  return <section className="panel senior-checklist" aria-label="Bahan pendamping">
    <h3>Bahan pendamping</h3>
    <p className="form-hint">LKS, panduan guru, dan kunci jawaban dibuat per bab dari naskah ini. Bahan pendamping tidak memakai ISBN. Sunting seperti buku biasa.</p>
    {error && <p role="alert">{error}</p>}
    <ul>{rows.map(row => <li key={row.kind}><strong>{row.label}</strong> · {label[row.state]}{row.total ? " (" + row.filled + " dari " + row.total + " bab)" : ""}
      {row.id
        ? <button type="button" className="secondary-button" onClick={() => onOpen(row.id!)}>Buka {row.label}</button>
        : <button type="button" className="primary-button" disabled={busy === row.kind} onClick={() => void create(row.kind)}>{busy === row.kind ? "Menyusun…" : "Buat " + row.label}</button>}
    </li>)}</ul>
  </section>;
}
