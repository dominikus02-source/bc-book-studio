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
});
