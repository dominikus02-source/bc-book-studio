const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

const source = fs.readFileSync("lib/studio-home.ts", "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loaded = { exports: {} };
new Function("exports", "module", output)(loaded.exports, loaded);
const home = loaded.exports;

test("next advance cannot skip Ide or Rancang", () => {
  assert.equal(home.workflowAdvanceAllowed("BRIEF", "OUTLINE", true), true);
  assert.equal(home.workflowAdvanceAllowed("BRIEF", "WRITING", true), false);
  assert.equal(home.workflowAdvanceAllowed("OUTLINE", "WRITING", true), true);
  assert.equal(home.workflowAdvanceAllowed("OUTLINE", "WRITING", false), false);
  assert.equal(home.workflowAdvanceAllowed("WRITING", "WRITING", true), false);
});

test("a closed earlier stage keeps a later stage closed", () => {
  const stages = [{ available: true }, { available: false }, { available: true }, { available: false }, { available: false }];
  assert.equal(home.stageOpenAllowed(stages, 0), true);
  assert.equal(home.stageOpenAllowed(stages, 1), false);
  assert.equal(home.stageOpenAllowed(stages, 2), false);
});

test("review decisions follow assignment, role, and REVIEW status", () => {
  const reviewer = { id: "rev", role: "REVIEWER" };
  const book = { ownerId: "own", status: "REVIEW" };
  assert.equal(home.canDecideReview(reviewer, book, true), true);
  assert.equal(home.canDecideReview({ id: "own", role: "ADMIN" }, book, true), false);
  assert.equal(home.canDecideReview({ id: "sup", role: "SUPERADMIN" }, book, true), false);
  assert.equal(home.canDecideReview({ id: "ed", role: "EDITOR" }, book, true), false);
  assert.equal(home.canDecideReview(reviewer, book, false), false);
  assert.equal(home.canDecideReview(reviewer, { ...book, status: "DRAFT" }, true), false);
  assert.equal(home.showReviewDecision("REVIEWER", { isOwner: false, canReview: true, status: "REVIEW" }), true);
  assert.equal(home.showReviewDecision("SUPERADMIN", { isOwner: false, canReview: true, status: "REVIEW" }), false);
  assert.equal(home.showReviewDecision("ADMIN", { isOwner: true, canReview: false, status: "REVIEW" }), false);
});

test("manuscript body stays with the owner or a live reviewer assignment", () => {
  assert.equal(home.canReadManuscript({ id: "own", role: "EDITOR" }, { ownerId: "own" }, false), true);
  assert.equal(home.canReadManuscript({ id: "rev", role: "REVIEWER" }, { ownerId: "own" }, true), true);
  assert.equal(home.canReadManuscript({ id: "rev", role: "EDITOR" }, { ownerId: "own" }, true), false);
  assert.equal(home.canReadManuscript({ id: "sup", role: "SUPERADMIN" }, { ownerId: "own" }, true), false);
  assert.equal(home.showManuscriptBody("SUPERADMIN", { isOwner: false, canReview: true }), false);
  assert.equal(home.showManuscriptBody("ADMIN", { isOwner: false, canReview: true }), true);
});

test("owner next action does not offer a jump or a review withdrawal", () => {
  const ide = home.bookWorkspaceAction("EDITOR", { status: "DRAFT", editorialStage: "BRIEF", isOwner: true });
  assert.equal(ide.module, "Proyek Buku");
  assert.equal(ide.stageIndex, 0);
  assert.match(ide.detail, /Tulis belum terbuka/i);
  const outline = home.bookWorkspaceAction("EDITOR", { status: "DRAFT", editorialStage: "OUTLINE", isOwner: true });
  assert.equal(outline.module, "Rancang");
  assert.equal(outline.stageIndex, 1);
  const ready = home.bookWorkspaceAction("EDITOR", { status: "DRAFT", editorialStage: "WRITING", isOwner: true, stageReadiness: { stages: [{}, {}, { complete: true }, { available: true }, {}] } });
  assert.equal(ready.label, "Ajukan review");
  assert.equal(ready.stageIndex, 2);
  const waiting = home.bookWorkspaceAction("EDITOR", { status: "REVIEW", editorialStage: "WRITING", isOwner: true });
  assert.equal(waiting.module, "Review Naskah");
  assert.match(waiting.detail, /tidak bisa ditarik/i);
  const assigned = home.bookWorkspaceAction("REVIEWER", { status: "REVIEW", editorialStage: "WRITING", isOwner: false });
  assert.equal(assigned.label, "Beri keputusan");
  const superadmin = home.bookWorkspaceAction("SUPERADMIN", { status: "REVIEW", editorialStage: "WRITING", isOwner: false });
  assert.notEqual(superadmin.label, "Beri keputusan");
});

test("navigation keeps office tools off editor and reviewer sessions", () => {
  const editor = home.studioPrimaryNav("EDITOR").map(item => item.label);
  const reviewer = home.studioPrimaryNav("REVIEWER").map(item => item.label);
  const admin = home.studioPrimaryNav("ADMIN").map(item => item.label);
  const superadmin = home.studioPrimaryNav("SUPERADMIN").map(item => item.label);
  assert.equal(editor.includes("ISBN & Legalitas"), false);
  assert.equal(editor.includes("Manajemen Akun"), false);
  assert.equal(reviewer.includes("ISBN & Legalitas"), false);
  assert.equal(reviewer.includes("Manajemen Akun"), false);
  assert.equal(admin.includes("ISBN & Legalitas"), true);
  assert.equal(admin.includes("Manajemen Akun"), false);
  assert.equal(superadmin.includes("Manajemen Akun"), true);
  assert.equal(superadmin.includes("ISBN & Legalitas"), true);
  assert.match(home.roleHomeCopy("SUPERADMIN").lead, /bukan peninjau/i);
  assert.match(home.roleHomeCopy("ADMIN").lead, /Perpusnas/i);
});
