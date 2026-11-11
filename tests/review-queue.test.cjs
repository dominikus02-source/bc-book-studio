const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
require.extensions[".ts"] = function (mod, filename) {
 const source = fs.readFileSync(filename, "utf8");
 const result = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true}});
 mod._compile(result.outputText, filename);
};
const {openReviewQueue, reviewNextStep} = require("../lib/review-queue.ts");

test("open notes are ordered critical, major, then suggestion", () => {
 const queue = openReviewQueue([
  {id: "a", chapterId: "c1", severity: "SUGGESTION", status: "OPEN", category: "LANGUAGE", content: "Rapikan ejaan."},
  {id: "b", chapterId: null, severity: "CRITICAL", status: "OPEN", category: "COPYRIGHT", content: "Sumber gambar belum ada."},
  {id: "c", chapterId: "c1", severity: "MAJOR", status: "RESOLVED", category: "FACT", content: "Sudah diperbaiki."},
  {id: "d", chapterId: "c1", severity: "MAJOR", status: "OPEN", category: "FACT", content: "Angka populasi perlu sumber."},
 ]);
 assert.deepEqual(queue.map(note => note.id), ["b", "d", "a"]);
});

test("next step tells the owner to fix blockers and the reviewer when approval is open", () => {
 const owner = reviewNextStep({role: "owner", status: "DRAFT", openCritical: 1, openMajor: 2, openSuggestions: 0});
 assert.match(owner.headline, /Perbaiki temuan/);
 assert.match(owner.detail, /1 kritis, 2 mayor/);
 const reviewer = reviewNextStep({role: "reviewer", status: "REVIEW", openCritical: 0, openMajor: 0, openSuggestions: 3});
 assert.match(reviewer.headline, /Keputusan dapat dicatat/);
 const waiting = reviewNextStep({role: "owner", status: "REVIEW", openCritical: 0, openMajor: 0, openSuggestions: 0});
 assert.match(waiting.detail, /tidak dapat menyetujui/);
});
