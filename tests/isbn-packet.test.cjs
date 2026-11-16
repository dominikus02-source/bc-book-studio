const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const JSZip = require("jszip");

function load(rel) {
  const abs = path.resolve(rel);
  const output = ts.transpileModule(fs.readFileSync(abs, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: abs }).outputText;
  const module = { exports: {} };
  const dirname = path.dirname(abs);
  function req(id) {
    if (id.startsWith(".")) return load(path.resolve(dirname, id.endsWith(".ts") ? id : id + ".ts"));
    return require(id);
  }
  new Function("exports", "module", "require", output)(module.exports, module, req);
  return module.exports;
}

const packet = load("lib/isbn-packet.ts");

test("publisher dossier is admin-only and book packet follows owner and collaborator rules", () => {
  assert.equal(packet.canEditPublisherDossier("ADMIN"), true);
  assert.equal(packet.canEditPublisherDossier("SUPERADMIN"), true);
  assert.equal(packet.canEditPublisherDossier("EDITOR"), false);
  assert.equal(packet.canEditPublisherDossier("REVIEWER"), false);
  const book = { ownerId: "owner", companionKind: null };
  assert.equal(packet.canEditIsbnPacket({ id: "owner", role: "EDITOR" }, book, false), true);
  assert.equal(packet.canEditIsbnPacket({ id: "partner", role: "EDITOR" }, book, true), true);
  assert.equal(packet.canEditIsbnPacket({ id: "reviewer", role: "REVIEWER" }, book, false), false);
  assert.equal(packet.canEditIsbnPacket({ id: "stranger", role: "EDITOR" }, book, false), false);
  assert.equal(packet.canEditIsbnPacket({ id: "admin", role: "ADMIN" }, book, false), false);
  assert.equal(packet.canEditIsbnPacket({ id: "root", role: "SUPERADMIN" }, book, false), true);
  assert.equal(packet.canEditIsbnPacket({ id: "root", role: "SUPERADMIN" }, { ...book, companionKind: "LKPD" }, false), false);
  assert.equal(packet.canEditIsbnPacket({ id: "owner", role: "EDITOR" }, { ...book, companionKind: "LKPD" }, false), false);
  assert.equal(packet.canEditIsbnPacket(null, book, true), false);
});

test("isbn packet round-trips and the zip marks missing fields", async () => {
  const saved = packet.isbnPacketSchema.parse({ title: "Siklus Air", authors: "Sari", synopsis: "Buku tentang air." });
  assert.equal(packet.isbnPacketSchema.parse(saved).title, "Siklus Air");
  const publisher = packet.publisherDossierSchema.parse({ imprintName: "Teras Kata", legalName: "PT Bahasa Cerdas Indonesia", signatoryName: "Sugeng Riyanto", signatoryTitle: "Direktur" });
  const bytes = await packet.isbnZip(publisher, saved, [{ title: "Bab Hujan" }]);
  const zip = await JSZip.loadAsync(bytes);
  const letter = await zip.file("01-surat-permohonan-isbn.docx").async("uint8array");
  assert.equal(Buffer.from(letter.subarray(0, 2)).toString(), "PK");
  const toc = await JSZip.loadAsync(await zip.file("08-daftar-isi.docx").async("nodebuffer"));
  const xml = await toc.file("word/document.xml").async("string");
  assert.match(xml, /Bab Hujan/);
  const verso = await JSZip.loadAsync(await zip.file("05-halaman-hak-cipta.docx").async("nodebuffer"));
  const versoXml = await verso.file("word/document.xml").async("string");
  assert.match(versoXml, /Teras Kata/);
  assert.match(versoXml, /BELUM DIISI/);
  for (const name of ["01-surat-permohonan-isbn", "02-spkk", "03-pernyataan-penerbit", "04-halaman-judul", "05-halaman-hak-cipta", "06-kdt", "07-kata-pengantar", "08-daftar-isi", "09-sinopsis", "10-biodata", "11-data-perpusnas", "12-checklist"]) {
    assert.ok(zip.file(name + ".docx"), name);
  }
});
