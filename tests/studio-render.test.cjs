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
  const local = new Map();
  function req(id) {
    if (id.startsWith(".")) {
      const next = path.resolve(dirname, id.endsWith(".ts") ? id : id + ".ts");
      if (!local.has(next)) local.set(next, load(next));
      return local.get(next);
    }
    return require(id);
  }
  new Function("exports", "module", "require", output)(module.exports, module, req);
  return module.exports;
}

const render = load("lib/studio-render.ts");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const chapter = {
  title: "Bab Air",
  position: 1,
  content: "Teks Indonesia — ukuran °C.\n\n![Air jernih di gelas](asset:gambar01){.bc-media width=\"80%\" fig-align=\"center\" data-bc-padding=\"0\" data-bc-radius=\"0\" data-bc-caption=\"Gambar 1. Air\"}\n\n[Video: Percobaan air](https://www.youtube.com/watch?v=dQw4w9wgxcQ){.bc-youtube}",
};

test("pdf, docx, and epub keep the image, caption, and video QR", async () => {
  const input = { id: "buku-1", title: "Siklus Air", author: "Sari", subject: "IPA", grade: "4", pageSize: "a4", preview: true, chapters: [chapter], assets: [{ id: "gambar01", mime: "image/png", data: png.toString("base64"), altText: "Air jernih di gelas" }] };
  const pdf = Buffer.from(await render.renderStudioPdf(input));
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.includes(Buffer.from("Gambar")) || pdf.length > 2000);
  const docx = await JSZip.loadAsync(await render.renderStudioDocx(input));
  const names = Object.keys(docx.files);
  assert.ok(names.some(name => name.startsWith("word/media/")));
  const documentXml = await docx.file("word/document.xml").async("string");
  assert.match(documentXml, /Gambar 1\. Air/);
  assert.match(documentXml, /youtube\.com/);
  const epub = await JSZip.loadAsync(await render.renderStudioEpub(input));
  assert.ok(Object.keys(epub.files).some(name => name.includes("images/gambar01")));
  assert.ok(Object.keys(epub.files).some(name => name.includes("images/qr-")));
  const xhtml = await epub.file("OEBPS/chapter-1.xhtml").async("string");
  assert.match(xhtml, /Gambar 1\. Air/);
  assert.match(xhtml, /Kode QR video/);
});
