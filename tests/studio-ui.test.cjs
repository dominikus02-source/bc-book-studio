const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

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

const fields = load("lib/brief-fields.ts");
const index = load("lib/book-index.ts");

test("gate messages focus the same Ide fields", () => {
  assert.equal(fields.briefFieldId("Sinopsis (minimal 20 karakter)"), "book-synopsis");
  assert.equal(fields.briefFieldId("Judul buku (minimal 3 karakter)"), "book-title");
  assert.equal(fields.briefFieldId("Pilih genre yang didukung."), "book-genre");
  assert.equal(fields.briefFieldId("Jenis buku dan genre tidak sesuai."), "book-type");
  assert.equal(fields.briefFieldId("Isi tujuan bab: Pendahuluan"), null);
});

test("outline keeps real headings and drops paragraph-length lines", () => {
  const long = "Kalimat ".repeat(30).trim();
  const indexed = index.indexChapter("Paragraf biasa tanpa tanda heading.\n\n## **Air** dan [sungai](https://example.test)\n\n### " + "Bagian yang agak panjang ".repeat(4) + "\n\n## " + long + "\n", 2);
  assert.equal(indexed.sections.length, 2);
  assert.equal(indexed.sections[0].title, "Air dan sungai");
  assert.equal(indexed.sections[0].number, "2.1");
  assert.ok(indexed.sections[1].title.endsWith("…"));
  assert.ok(indexed.sections[1].title.length <= 72);
});
