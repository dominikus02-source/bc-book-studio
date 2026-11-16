const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(rel) {
  const abs = path.resolve(rel);
  const output = ts.transpileModule(fs.readFileSync(abs, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: abs,
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", "require", output)(module.exports, module, require);
  return module.exports;
}

const note = load("lib/admin-override.ts");
const access = load("lib/manuscript-access.ts");

test("admin override is marked only when superadmin acts on someone else's book", () => {
  assert.equal(note.adminOverrideNote({ id: "root", role: "SUPERADMIN" }, "author", "Actor: root"), "admin-override Actor: root");
  assert.equal(note.adminOverrideNote({ id: "root", role: "SUPERADMIN" }, "root", "Actor: root"), "Actor: root");
  assert.equal(note.adminOverrideNote({ id: "admin", role: "ADMIN" }, "author", "Actor: admin"), "Actor: admin");
});

test("superadmin manages every book and cannot approve an authored or collaborated book", () => {
  const book = { ownerId: "author", status: "REVIEW", archivedAt: null };
  const draft = { ...book, status: "DRAFT" };
  const root = { id: "root", role: "SUPERADMIN" };
  assert.equal(access.canReadManuscript(root, book, false), true);
  assert.equal(access.canEditDraftContent(root.id, draft, false, root.role), true);
  assert.equal(access.canManageCollaborators(root.id, book.ownerId, root.role), true);
  assert.equal(access.canAssignReviewers(root.id, book.ownerId, root.role), true);
  assert.equal(access.canArchiveBook(root.id, book.ownerId, root.role), true);
  assert.equal(access.canSubmitReview(root.id, book.ownerId), false);
  assert.equal(access.canPublishBook(root.id, book.ownerId), false);
  assert.equal(access.canDecideReview(root, book, true, false), true);
  assert.equal(access.canDecideReview(root, book, false, false), false);
  assert.equal(access.canDecideReview(root, book, true, true), false);
  assert.equal(access.canDecideReview({ id: "author", role: "SUPERADMIN" }, book, true, false), false);
  const archived = access.manuscriptVisibilityWhere(root, { archived: true });
  assert.deepEqual(archived.archivedAt, { not: null });
  assert.equal(Object.hasOwn(archived, "ownerId"), false);
});

test("superadmin routes record override audits and review stage follows status", () => {
  const read = file => fs.readFileSync(file, "utf8");
  assert.match(read("lib/draft-access.ts"), /role = 'SUPERADMIN'/);
  assert.match(read("app/api/books/[id]/route.ts"), /editorial:checklist/);
  assert.match(read("app/api/books/[id]/route.ts"), /adminOverrideNote/);
  assert.match(read("app/api/books/[id]/restore/route.ts"), /adminOverrideNote/);
  assert.match(read("app/api/books/[id]/collaborators/route.ts"), /adminOverrideNote/);
  assert.match(read("app/api/books/[id]/reviewers/route.ts"), /adminOverrideNote/);
  assert.match(read("app/api/books/[id]/reviewers/route.ts"), /selfAdmin/);
  assert.match(read("app/api/books/[id]/chapters/[chapterId]/route.ts"), /outline:edit/);
  assert.match(read("app/api/books/[id]/chapters/[chapterId]/route.ts"), /chapter:revision-restore/);
  assert.match(read("app/api/books/[id]/assets/route.ts"), /asset:upload/);
  assert.match(read("app/api/books/[id]/review/route.ts"), /editorialStage:"REVIEW"/);
  assert.match(read("app/api/books/[id]/review/route.ts"), /editorialStage:"WRITING"/);
  assert.match(read("lib/review-decision.ts"), /editorialStage: "LAYOUT"/);
  assert.match(read("app/api/books/[id]/export/route.ts"), /export:download/);
  assert.match(read("components/book-query-bar.tsx"), /Semua buku/);
  assert.match(read("app/studio/dashboard.tsx"), /Semua buku/);
});
