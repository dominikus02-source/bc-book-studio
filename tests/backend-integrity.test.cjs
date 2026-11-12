const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadTs(rel, extraRequire = {}) {
  const abs = path.resolve(rel);
  const source = fs.readFileSync(abs, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: abs,
  }).outputText;
  const module = { exports: {} };
  const dirname = path.dirname(abs);
  const local = new Map();
  function req(id) {
    if (Object.prototype.hasOwnProperty.call(extraRequire, id)) return extraRequire[id];
    if (id.startsWith(".")) {
      const next = path.resolve(dirname, id.endsWith(".ts") ? id : id + ".ts");
      if (!local.has(next)) local.set(next, loadTs(next, extraRequire));
      return local.get(next);
    }
    return require(id);
  }
  vm.runInNewContext(output, {
    exports: module.exports,
    module,
    process,
    console,
    Buffer,
    require: req,
  }, { filename: abs });
  return module.exports;
}

const access = loadTs("lib/manuscript-access.ts");
const stages = loadTs("lib/stage-guard.ts");

test("assigned readers keep access only while their current role is reviewer or admin", () => {
  const book = { ownerId: "owner" };
  assert.equal(access.canReadManuscript({ id: "owner", role: "EDITOR" }, book, false), true);
  assert.equal(access.canReadManuscript({ id: "editor", role: "EDITOR" }, book, true), false);
  assert.equal(access.canReadManuscript({ id: "former", role: "SUPERADMIN" }, book, true), false);
  assert.equal(access.canReadManuscript({ id: "reviewer", role: "REVIEWER" }, book, true), true);
  assert.equal(access.canReadManuscript({ id: "reviewer", role: "REVIEWER" }, book, false), false);
  assert.equal(access.canReadManuscript({ id: "admin", role: "ADMIN" }, book, true), true);

  const editorWhere = access.manuscriptVisibilityWhere({ id: "editor", role: "EDITOR" }, { id: "book-1" });
  assert.equal(editorWhere.id, "book-1");
  assert.equal(editorWhere.archivedAt, null);
  assert.equal(editorWhere.OR.length, 1);
  assert.equal(editorWhere.OR[0].ownerId, "editor");
  const reviewerWhere = access.manuscriptVisibilityWhere({ id: "reviewer", role: "REVIEWER" });
  assert.equal(reviewerWhere.OR.length, 2);
  assert.equal(reviewerWhere.OR[1].assignedReviewers.some.reviewerId, "reviewer");
  const archived = access.manuscriptVisibilityWhere({ id: "editor", role: "ADMIN" }, { archived: true });
  assert.equal(archived.ownerId, "editor");
  assert.equal(archived.archivedAt.not, null);
  assert.equal(Object.hasOwn(archived, "OR"), false);
});

test("authors cannot decide their own review, and a stale assignment is not enough", () => {
  const book = { ownerId: "author" };
  assert.equal(access.canDecideReview({ id: "author", role: "ADMIN" }, book, true), false);
  assert.equal(access.canDecideReview({ id: "author", role: "REVIEWER" }, book, true), false);
  assert.equal(access.canDecideReview({ id: "editor", role: "EDITOR" }, book, true), false);
  assert.equal(access.canDecideReview({ id: "super", role: "SUPERADMIN" }, book, true), false);
  assert.equal(access.canDecideReview({ id: "reviewer", role: "REVIEWER" }, book, false), false);
  assert.equal(access.canDecideReview({ id: "reviewer", role: "REVIEWER" }, book, true), true);
  assert.equal(access.canDecideReview({ id: "admin", role: "ADMIN" }, book, true), true);
});

test("workflow next-button cannot skip Ide or Rancang", () => {
  assert.equal(stages.stageRequiredBefore("OUTLINE"), "BRIEF");
  assert.equal(stages.stageRequiredBefore("WRITING"), "OUTLINE");
  assert.equal(stages.workflowAdvanceAllowed("BRIEF", "WRITING", true), false);
  assert.equal(stages.workflowAdvanceAllowed("BRIEF", "OUTLINE", false), false);
  assert.equal(stages.workflowAdvanceAllowed("BRIEF", "OUTLINE", true), true);
  assert.equal(stages.workflowAdvanceAllowed("OUTLINE", "WRITING", true), true);
  assert.equal(stages.workflowAdvanceAllowed("WRITING", "WRITING", true), false);
  assert.equal(stages.isKnownEditorialStage("LAYOUT"), true);
  assert.equal(stages.isKnownEditorialStage("EXPORTED"), false);
});

test("transition refuses a direct jump from Ide to Tulis", async () => {
  const updates = [];
  const book = {
    editorialStage: "BRIEF",
    status: "DRAFT",
    title: "Buku Uji",
    subject: "Bahasa",
    description: "Sinopsis yang cukup panjang untuk lolos gerbang ide.",
    targetAudience: "Kelas 7",
    writingGoal: "Memahami teks",
    author: "Penulis Uji",
    genre: "REFERENCE",
    bookType: "NONFICTION",
    pageSize: "A4",
    updatedAt: new Date("2026-11-12T00:00:00.000Z"),
    publication: null,
    approvalSnapshots: [],
    chapters: [{ title: "Bab 1", outlineObjective: "Tujuan bab", content: "Isi bab yang sudah cukup panjang." }],
  };
  const tx = {
    $queryRaw: async () => [],
    book: {
      findFirst: async () => book,
      updateMany: async (args) => { updates.push(args); return { count: 1 }; },
    },
    review: { create: async () => ({}) },
  };
  const workflow = loadTs("lib/workflow.ts", { "./db": { db: { $transaction: async (fn) => fn(tx) } } });
  const skipped = await workflow.transition("book-1", "WRITING", { id: "owner" });
  assert.equal(skipped.status, 409);
  assert.equal(updates.length, 0);
  const advanced = await workflow.transition("book-1", "OUTLINE", { id: "owner" });
  assert.equal(advanced.status, 200);
  assert.equal(advanced.body.stage, "OUTLINE");
  assert.equal(updates[0].data.editorialStage, "OUTLINE");
  assert.equal(updates[0].where.editorialStage, "BRIEF");
});

test("login verification does not accept a missing or inactive account, and recovery replies match", () => {
  const account = loadTs("lib/account.ts", { "./db": { db: {} } });
  const hash = account.passwordHash("correct-horse-battery");
  assert.equal(account.loginPasswordAccepted({ active: true, passwordHash: hash }, "correct-horse-battery"), true);
  assert.equal(account.loginPasswordAccepted({ active: true, passwordHash: hash }, "wrong-password-value"), false);
  assert.equal(account.loginPasswordAccepted(null, "correct-horse-battery"), false);
  assert.equal(account.loginPasswordAccepted({ active: false, passwordHash: hash }, "correct-horse-battery"), false);
  assert.equal(account.loginPasswordAccepted({ active: true, passwordHash: null }, "correct-horse-battery"), false);
  assert.deepEqual(account.accountRecoveryResult(true), account.accountRecoveryResult(false));
  assert.equal(account.accountRecoveryResult(true).status, 200);
  assert.match(account.accountRecoveryResult().body.message, /Jika alamat email terdaftar/);
});

test("missing-account login still runs password hashing", () => {
  const account = loadTs("lib/account.ts", { "./db": { db: {} } });
  const hash = account.passwordHash("another-valid-secret");
  const wrongStarted = Date.now();
  account.loginPasswordAccepted({ active: true, passwordHash: hash }, "not-the-password");
  const wrongMs = Date.now() - wrongStarted;
  const missingStarted = Date.now();
  account.loginPasswordAccepted(null, "not-the-password");
  const missingMs = Date.now() - missingStarted;
  assert.ok(wrongMs >= 15, "expected scrypt on a real hash, saw " + wrongMs + "ms");
  assert.ok(missingMs >= 15, "missing account returned before scrypt (" + missingMs + "ms)");
});

test("account recovery no longer confirms a registered address when mail fails", () => {
  const auth = fs.readFileSync("app/api/auth/[action]/route.ts", "utf8");
  const recovery = auth.slice(auth.indexOf('action==="request-activation"'), auth.indexOf('action==="activate"'));
  const catchBody = recovery.match(/catch\(e\)\{([\s\S]*?)\n\s*\}/);
  assert.ok(catchBody);
  assert.equal(catchBody[1].includes("return"), false);
  assert.ok(recovery.indexOf("smtpConfigured") < recovery.indexOf("findUnique"));
  assert.match(auth, /v\.length>=12&&v\.length<=128/);
  const activate = auth.slice(auth.indexOf('action==="activate"'));
  const tx = activate.indexOf("$transaction");
  assert.ok(tx > 0);
  assert.ok(activate.indexOf("studioAuthToken.updateMany") > tx);
  assert.ok(activate.indexOf("passwordHash:nextHash") > tx);
});

test("sensitive manuscript reads use the shared visibility predicate", () => {
  const files = [
    "app/api/books/route.ts",
    "app/api/books/[id]/route.ts",
    "app/api/books/[id]/export/route.ts",
    "app/api/books/[id]/publication/route.ts",
    "app/api/books/[id]/publishing-package/route.ts",
    "app/api/books/[id]/revision/route.ts",
    "app/api/books/[id]/assets/[assetId]/route.ts",
    "app/api/reviewer/route.ts",
  ];
  for (const file of files) {
    assert.match(fs.readFileSync(file, "utf8"), /manuscriptVisibilityWhere/);
  }
  assert.match(fs.readFileSync("app/api/books/[id]/publishing-readiness/route.ts", "utf8"), /manuscriptVisibilityWhere/);
  assert.match(fs.readFileSync("app/api/books/[id]/review/route.ts", "utf8"), /canDecideReview/);
  assert.match(fs.readFileSync("lib/workflow.ts", "utf8"), /workflowAdvanceAllowed/);
});

test("print-order updates use a compound conditional write", () => {
  const printing = fs.readFileSync("app/api/printing/route.ts", "utf8");
  assert.match(printing, /studioFormDraft\.updateMany\(\{ where: \{ id, ownerId: user\.id, module: "PRINT_ORDER", updatedAt: old\.updatedAt \}/);
  assert.equal(printing.includes("studioFormDraft.update("), false);
});

test("integrity migration is additive and does not rewrite rows", () => {
  const sql = fs.readFileSync("prisma/migrations/20261112040000_backend_integrity_guards/migration.sql", "utf8");
  const executable = sql.split("\n").filter((line) => !line.trim().startsWith("--")).join("\n");
  assert.doesNotMatch(executable, /\bDROP TABLE\b|\bDELETE FROM\b|\bTRUNCATE\b|\bDROP COLUMN\b|\bUPDATE\s+"/i);
  assert.match(executable, /Book_editorialStage_known/);
  assert.match(executable, /Book_approval_pointer_consistent/);
  assert.match(executable, /book_reviewer_not_owner/);
  assert.match(executable, /outline_section_matches_chapter/);
  assert.match(executable, /BookReviewer_assignedById_fkey/);
  assert.equal((executable.match(/NOT VALID/g) || []).length >= 8, true);
});
