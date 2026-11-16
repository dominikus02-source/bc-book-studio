"use client";
import { useEffect, useState } from "react";

type Dossier = Record<string, string>;
type Packet = Record<string, unknown> & { checklist: Record<string, boolean> };
const publisherFields: [keyof Dossier, string][] = [
  ["legalName", "Nama badan hukum"],
  ["imprintName", "Imprint"],
  ["nib", "NIB"],
  ["standardCertificate", "Sertifikat Standar"],
  ["address", "Alamat"],
  ["npwp", "NPWP"],
  ["deedNumber", "Nomor akta"],
  ["ahuDecree", "SK AHU"],
  ["signatoryName", "Nama penandatangan"],
  ["signatoryTitle", "Jabatan penandatangan"],
  ["email", "Email penerbit"],
  ["phone", "Telepon"],
  ["website", "Situs"],
  ["logoNote", "Catatan logo"],
];
const bookFields: [string, string][] = [
  ["title", "Judul"], ["subtitle", "Subjudul"], ["authors", "Penulis"], ["edition", "Edisi"],
  ["language", "Bahasa"], ["pageCount", "Jumlah halaman"], ["trimSize", "Ukuran"],
  ["copyrightYear", "Tahun hak cipta"], ["city", "Kota"], ["applicationDate", "Tanggal surat"],
  ["ageBand", "Peruntukan usia (UU 3/2017)"], ["isbnPlaceholder", "ISBN"], ["eisbnPlaceholder", "E-ISBN"],
];
const longFields: [string, string][] = [
  ["synopsis", "Sinopsis"], ["preface", "Kata pengantar"], ["authorBio", "Biodata penulis"],
  ["spkkStatement", "Pernyataan keaslian"], ["publisherStatement", "Pernyataan tanggung jawab penerbit"], ["kdtNote", "Catatan KDT"],
];
const checks: [string, string][] = [
  ["letterhead", "Kop surat"], ["signature", "Tanda tangan berwenang"], ["spkk", "SPKK"],
  ["titlePage", "Halaman judul"], ["verso", "Halaman hak cipta"], ["preface", "Kata pengantar"],
  ["toc", "Daftar isi"], ["manuscript", "Naskah"], ["rights", "Dokumen hak"],
];

export default function IsbnPacketForm({ bookId, role }: { bookId: string; role: string }) {
  const [publisher, setPublisher] = useState<Dossier | null>(null);
  const [packet, setPacket] = useState<Packet | null>(null);
  const [canEditBook, setCanEditBook] = useState(false);
  const [canEditPublisher, setCanEditPublisher] = useState(role === "ADMIN" || role === "SUPERADMIN");
  const [chapters, setChapters] = useState<string[]>([]);
  const [status, setStatus] = useState("Memuat…");
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setBlocked("");
    Promise.all([
      fetch("/api/publisher/dossier", { cache: "no-store", signal: controller.signal }).then(r => r.json()),
      fetch("/api/books/" + encodeURIComponent(bookId) + "/isbn-packet", { cache: "no-store", signal: controller.signal }).then(async r => ({ ok: r.ok, status: r.status, body: await r.json() })),
    ]).then(([dossier, book]) => {
      if (controller.signal.aborted) return;
      setPublisher(dossier.dossier);
      setCanEditPublisher(Boolean(dossier.canEdit));
      if (!book.ok) { setBlocked(book.body.error || "Kelengkapan ISBN tidak tersedia."); setPacket(null); setStatus(""); return; }
      setPacket(book.body.packet);
      setCanEditBook(Boolean(book.body.canEdit));
      setChapters(book.body.chapters || []);
      setStatus("Tersimpan otomatis");
    }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [bookId]);
  useEffect(() => {
    if (!packet || !canEditBook) return;
    const timer = window.setTimeout(() => {
      setStatus("Menyimpan…");
      void fetch("/api/books/" + encodeURIComponent(bookId) + "/isbn-packet", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(packet) })
        .then(async r => { if (!r.ok) throw Error((await r.json()).error || "Gagal menyimpan"); setStatus("Tersimpan otomatis"); })
        .catch(e => { setStatus("Gagal menyimpan — coba lagi"); setError(e.message); });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [packet, bookId, canEditBook]);
  useEffect(() => {
    if (!publisher || !canEditPublisher) return;
    const timer = window.setTimeout(() => {
      void fetch("/api/publisher/dossier", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(publisher) })
        .then(async r => { if (!r.ok) throw Error((await r.json()).error || "Data penerbit gagal disimpan"); })
        .catch(e => setError(e.message));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [publisher, canEditPublisher]);
  async function download() {
    const response = await fetch("/api/books/" + encodeURIComponent(bookId) + "/isbn-packet/download");
    if (!response.ok) { setError("Paket gagal diunduh."); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "paket-isbn.zip"; link.click();
    URL.revokeObjectURL(url);
  }
  if (blocked) return <section className="panel"><h2>Kelengkapan Penerbitan / ISBN</h2><p>{blocked}</p></section>;
  if (!packet || !publisher) return <p role="status">{error || "Memuat kelengkapan ISBN…"}</p>;
  return <section className="panel isbn-packet" aria-label="Kelengkapan Penerbitan dan ISBN">
    <h2>Kelengkapan Penerbitan / ISBN</h2>
    <p className="form-hint">Data penerbit diisi sekali dan dipakai semua buku. Data buku terisi dari naskah dan tetap bisa diubah. Kolom kosong menjadi [BELUM DIISI] di berkas. ISBN resmi hanya dari Perpusnas.</p>
    <p role="status">{status}</p>
    {error && <p role="alert">{error}</p>}
    <fieldset disabled={!canEditPublisher}><legend>Data penerbit</legend>
      {publisherFields.map(([key, label]) => <label className="studio-field" key={key}>{label}<input value={publisher[key] || ""} placeholder={key === "signatoryName" ? "misalnya Sugeng Riyanto" : ""} onChange={e => setPublisher({ ...publisher, [key]: e.target.value })} /></label>)}
      {!canEditPublisher && <p>Hanya admin penerbit yang dapat mengubah bagian ini.</p>}
    </fieldset>
    <fieldset disabled={!canEditBook}><legend>Data buku</legend>
      {bookFields.map(([key, label]) => <label className="studio-field" key={key}>{label}<input value={String(packet[key] ?? "")} onChange={e => setPacket({ ...packet, [key]: e.target.value })} /></label>)}
      <label className="studio-field"><input type="checkbox" checked={Boolean(packet.mediaPrint)} onChange={e => setPacket({ ...packet, mediaPrint: e.target.checked })} /> Media cetak</label>
      <label className="studio-field"><input type="checkbox" checked={Boolean(packet.mediaElectronic)} onChange={e => setPacket({ ...packet, mediaElectronic: e.target.checked })} /> Media elektronik</label>
      {longFields.map(([key, label]) => <label className="studio-field" key={key}>{label}<textarea value={String(packet[key] ?? "")} onChange={e => setPacket({ ...packet, [key]: e.target.value })} /></label>)}
      <h3>Daftar isi dari bab</h3>
      {chapters.length ? <ol>{chapters.map(title => <li key={title}>{title}</li>)}</ol> : <p>[BELUM DIISI] Belum ada bab.</p>}
      <h3>Checklist persyaratan</h3>
      {checks.map(([key, label]) => <label className="studio-field" key={key}><input type="checkbox" checked={Boolean(packet.checklist?.[key])} onChange={e => setPacket({ ...packet, checklist: { ...packet.checklist, [key]: e.target.checked } })} /> {label}</label>)}
      {!canEditBook && <p>Anda dapat membaca formulir ini. Perubahan dilakukan penulis atau kolaborator.</p>}
    </fieldset>
    <button type="button" className="primary-button" onClick={() => void download()}>Unduh paket ISBN (ZIP)</button>
  </section>;
}
