import { z } from "zod";
import JSZip from "jszip";

export const blank = "[BELUM DIISI]";
export const show = (value: string) => value.trim() || blank;

export const publisherDossierSchema = z.object({
  legalName: z.string().trim().max(180).default("PT Bahasa Cerdas Indonesia"),
  imprintName: z.string().trim().max(180).default("Teras Kata"),
  nib: z.string().trim().max(80).default(""),
  standardCertificate: z.string().trim().max(180).default(""),
  address: z.string().trim().max(2000).default(""),
  npwp: z.string().trim().max(40).default(""),
  deedNumber: z.string().trim().max(180).default(""),
  ahuDecree: z.string().trim().max(180).default(""),
  signatoryName: z.string().trim().max(180).default(""),
  signatoryTitle: z.string().trim().max(180).default(""),
  email: z.string().trim().max(180).default(""),
  phone: z.string().trim().max(70).default(""),
  website: z.string().trim().max(300).default(""),
  logoNote: z.string().trim().max(300).default(""),
}).strict();
export type PublisherDossier = z.infer<typeof publisherDossierSchema>;

export const isbnPacketSchema = z.object({
  title: z.string().trim().max(250).default(""),
  subtitle: z.string().trim().max(250).default(""),
  authors: z.string().trim().max(300).default(""),
  edition: z.string().trim().max(40).default("1"),
  language: z.string().trim().max(40).default("Indonesia (id)"),
  pageCount: z.string().trim().max(20).default(""),
  trimSize: z.string().trim().max(40).default(""),
  mediaPrint: z.boolean().default(true),
  mediaElectronic: z.boolean().default(true),
  synopsis: z.string().trim().max(4000).default(""),
  preface: z.string().trim().max(8000).default(""),
  authorBio: z.string().trim().max(4000).default(""),
  ageBand: z.string().trim().max(120).default(""),
  copyrightYear: z.string().trim().max(12).default(""),
  city: z.string().trim().max(80).default(""),
  applicationDate: z.string().trim().max(40).default(""),
  spkkStatement: z.string().trim().max(2000).default(""),
  publisherStatement: z.string().trim().max(2000).default(""),
  isbnPlaceholder: z.string().trim().max(40).default("ISBN [BELUM DITERBITKAN PERPUSNAS]"),
  eisbnPlaceholder: z.string().trim().max(40).default("E-ISBN [BELUM DITERBITKAN PERPUSNAS]"),
  kdtNote: z.string().trim().max(1000).default(""),
  checklist: z.object({
    letterhead: z.boolean().default(false),
    signature: z.boolean().default(false),
    spkk: z.boolean().default(false),
    titlePage: z.boolean().default(false),
    verso: z.boolean().default(false),
    preface: z.boolean().default(false),
    toc: z.boolean().default(false),
    manuscript: z.boolean().default(false),
    rights: z.boolean().default(false),
  }).default({ letterhead: false, signature: false, spkk: false, titlePage: false, verso: false, preface: false, toc: false, manuscript: false, rights: false }),
}).strict();
export type IsbnPacketData = z.infer<typeof isbnPacketSchema>;

export function emptyPublisher(): PublisherDossier {
  return publisherDossierSchema.parse({});
}
export function emptyPacket(): IsbnPacketData {
  return isbnPacketSchema.parse({});
}

export function canEditPublisherDossier(role: string) {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export function canEditIsbnPacket(actor: { id: string; role: string } | null, book: { ownerId: string; companionKind?: string | null }, collaborating: boolean) {
  if (!actor || book.companionKind || actor.role === "REVIEWER") return false;
  if (actor.id === book.ownerId) return true;
  return collaborating && (actor.role === "EDITOR" || actor.role === "ADMIN");
}

const docx = (lines: string[]) => {
  const body = lines.map(line => '<w:p><w:r><w:t xml:space="preserve">' + line.replace(/[&<>]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char] || char)) + "</w:t></w:r></w:p>").join("");
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + body + "</w:body></w:document>";
};

async function packDocx(lines: string[]) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", docx(lines));
  return zip.generateAsync({ type: "nodebuffer" });
}

export function isbnDocuments(publisher: PublisherDossier, packet: IsbnPacketData, chapters: { title: string }[]) {
  const p = publisher;
  const b = packet;
  const toc = chapters.length ? chapters.map((chapter, index) => (index + 1) + ". " + chapter.title) : [blank];
  const media = [b.mediaPrint ? "Cetak" : "", b.mediaElectronic ? "Elektronik" : ""].filter(Boolean).join(" dan ") || blank;
  return [
    { file: "01-surat-permohonan-isbn", title: "Surat Permohonan ISBN", lines: ["SURAT PERMOHONAN ISBN", "Kepada Perpusnas RI", "Penerbit: " + show(p.legalName), "Imprint: " + show(p.imprintName), "Alamat: " + show(p.address), "NIB: " + show(p.nib), "NPWP: " + show(p.npwp), "Judul: " + show(b.title), "Penulis: " + show(b.authors), "Edisi: " + show(b.edition), "Kota dan tanggal: " + show(b.city) + ", " + show(b.applicationDate), "Penanggung jawab: " + show(p.signatoryName) + ", " + show(p.signatoryTitle)] },
    { file: "02-spkk", title: "Surat Pernyataan Keaslian Karya", lines: ["SURAT PERNYATAAN KEASLIAN KARYA", "Saya, " + show(b.authors) + ", menyatakan naskah \"" + show(b.title) + "\" adalah karya asli.", show(b.spkkStatement), "Pernyataan ini belum bermeterai sampai meterai fisik dibubuhkan."] },
    { file: "03-pernyataan-penerbit", title: "Surat Pernyataan Penerbit", lines: ["SURAT PERNYATAAN PENERBIT", show(p.legalName) + " bertanggung jawab atas penerbitan \"" + show(b.title) + "\".", "Imprint: " + show(p.imprintName), show(b.publisherStatement), "Penandatangan: " + show(p.signatoryName) + " (" + show(p.signatoryTitle) + ")"] },
    { file: "04-halaman-judul", title: "Halaman Judul", lines: [show(b.title), show(b.subtitle), "Penulis: " + show(b.authors), show(p.imprintName), show(p.legalName)] },
    { file: "05-halaman-hak-cipta", title: "Halaman Hak Cipta", lines: ["Hak cipta © " + show(b.copyrightYear) + " " + show(b.authors), "Diterbitkan oleh " + show(p.imprintName), "Badan hukum: " + show(p.legalName), "Peruntukan usia menurut UU No. 3 Tahun 2017: " + show(b.ageBand), show(b.isbnPlaceholder), show(b.eisbnPlaceholder), "ISBN dan E-ISBN hanya diisi setelah Perpusnas menerbitkannya."] },
    { file: "06-kdt", title: "KDT", lines: ["KATALOG DALAM TERBITAN", "Placeholder. KDT resmi hanya dari Perpusnas.", show(b.kdtNote), "Judul: " + show(b.title), "Penulis: " + show(b.authors)] },
    { file: "07-kata-pengantar", title: "Kata Pengantar", lines: ["KATA PENGANTAR", show(b.preface)] },
    { file: "08-daftar-isi", title: "Daftar Isi", lines: ["DAFTAR ISI", "Disusun dari bab yang tersimpan.", ...toc] },
    { file: "09-sinopsis", title: "Sinopsis", lines: ["SINOPSIS", show(b.synopsis)] },
    { file: "10-biodata", title: "Biodata Penulis", lines: ["BIODATA PENULIS", show(b.authors), show(b.authorBio)] },
    { file: "11-data-perpusnas", title: "Data Kelengkapan ISBN", lines: ["DATA KELENGKAPAN ISBN PERPUSNAS", "Judul: " + show(b.title), "Penulis: " + show(b.authors), "Edisi: " + show(b.edition), "Jumlah halaman: " + show(b.pageCount), "Ukuran: " + show(b.trimSize), "Jenis media: " + media, "Bahasa: " + show(b.language), show(b.isbnPlaceholder), show(b.eisbnPlaceholder)] },
    { file: "12-checklist", title: "Checklist persyaratan ISBN", lines: ["CHECKLIST PERSYARATAN ISBN", "Kop surat: " + (b.checklist.letterhead ? "Siap" : blank), "Tanda tangan berwenang: " + (b.checklist.signature ? "Siap" : blank), "SPKK: " + (b.checklist.spkk ? "Siap" : blank), "Halaman judul: " + (b.checklist.titlePage ? "Siap" : blank), "Halaman hak cipta: " + (b.checklist.verso ? "Siap" : blank), "Kata pengantar: " + (b.checklist.preface ? "Siap" : blank), "Daftar isi: " + (b.checklist.toc ? "Siap" : blank), "Naskah: " + (b.checklist.manuscript ? "Siap" : blank), "Hak: " + (b.checklist.rights ? "Siap" : blank), "Sertifikat standar penerbit: " + show(p.standardCertificate), "Akta: " + show(p.deedNumber), "SK AHU: " + show(p.ahuDecree), "Logo: " + show(p.logoNote)] },
  ];
}

export async function isbnZip(publisher: PublisherDossier, packet: IsbnPacketData, chapters: { title: string }[]) {
  const zip = new JSZip();
  for (const doc of isbnDocuments(publisher, packet, chapters)) zip.file(doc.file + ".docx", await packDocx([doc.title, ...doc.lines]));
  zip.file("BACA-SAYA.txt", "Draf kelengkapan ISBN. Kolom [BELUM DIISI] belum ada datanya. ISBN resmi hanya dari Perpusnas. Bahan pendamping tidak memakai paket ini.\n");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
