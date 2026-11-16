const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(rel) {
  const abs = path.resolve(rel);
  const output = ts.transpileModule(fs.readFileSync(abs, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: abs }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", "require", output)(module.exports, module, require);
  return module.exports;
}

const companions = load("lib/companions.ts");

test("each companion kind is generated per chapter and starts incomplete until filled", () => {
  const chapter = { title: "Hujan", outlineObjective: "Mengenal hujan", content: "Air jatuh dari awan ke tanah dan mengisi sungai serta danau di sekitar sekolah." };
  for (const kind of companions.COMPANION_KINDS) {
    const draft = companions.companionChapterDraft(kind, "Siklus Air", chapter, 0);
    assert.match(draft.title, new RegExp(companions.COMPANION_LABEL[kind]));
    assert.ok(draft.content.length >= 20);
  }
  assert.equal(companions.companionCompleteness([]).state, "kosong");
  assert.equal(companions.companionCompleteness([{ content: "pendek" }, { content: "x".repeat(20) }]).state, "sebagian");
  assert.equal(companions.companionCompleteness([{ content: "x".repeat(20) }]).state, "lengkap");
  assert.deepEqual([...companions.COMPANION_KINDS], ["LKPD", "PANDUAN_GURU", "KUNCI_BUKU", "KUNCI_LKS"]);
});

test("companion routes stay on the draft editor lock and skip ISBN", () => {
  const route = fs.readFileSync("app/api/books/[id]/companions/route.ts", "utf8");
  const isbn = fs.readFileSync("app/api/books/[id]/isbn-packet/route.ts", "utf8");
  const checklist = fs.readFileSync("components/companion-checklist.tsx", "utf8");
  assert.match(route, /lockDraftEditor/);
  assert.match(route, /companion:create/);
  assert.match(route, /Hanya penulis atau kolaborator/);
  assert.match(isbn, /Bahan pendamping tidak memakai ISBN/);
  assert.match(checklist, /tidak memakai ISBN/);
  assert.match(checklist, /Buat /);
  for (const label of ["LKS / LKPD", "Buku Panduan Guru", "Kunci Jawaban Buku", "Kunci Jawaban LKS"]) {
    assert.equal(Object.values(companions.COMPANION_LABEL).includes(label), true);
  }
});
