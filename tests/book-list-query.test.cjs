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

const query = load("lib/book-list-query.ts");

test("missing page and limit keeps the full list for existing callers", () => {
  const parsed = query.parseBookListQuery(new URLSearchParams(""));
  assert.equal(parsed.paginate, false);
  assert.equal(parsed.limit, null);
  assert.equal(parsed.page, 1);
  assert.deepEqual(query.bookListFilter(parsed), {});
  const page = query.bookListPage([1, 2, 3], parsed, 3);
  assert.equal(page.hasMore, false);
  assert.equal(page.pageSize, 3);
});

test("q, status, and stage are optional filters and pagination defaults to 20 with a max of 100", () => {
  const parsed = query.parseBookListQuery(new URLSearchParams("q=air&status=DRAFT&stage=WRITING&page=2"));
  assert.equal(parsed.q, "air");
  assert.equal(parsed.status, "DRAFT");
  assert.equal(parsed.stage, "WRITING");
  assert.equal(parsed.page, 2);
  assert.equal(parsed.limit, 20);
  assert.deepEqual(query.bookListFilter(parsed), {
    title: { contains: "air", mode: "insensitive" },
    status: "DRAFT",
    editorialStage: "WRITING",
  });
  const capped = query.parseBookListQuery(new URLSearchParams("limit=500"));
  assert.equal(capped.limit, 100);
  const page = query.bookListPage([1], parsed, 41);
  assert.equal(page.hasMore, true);
});

test("review and layout filters still match books saved before the stage was updated", () => {
  const review = query.bookListFilter(query.parseBookListQuery(new URLSearchParams("stage=REVIEW")));
  assert.deepEqual(review.OR, [{ editorialStage: "REVIEW" }, { status: "REVIEW" }]);
  const layout = query.bookListFilter(query.parseBookListQuery(new URLSearchParams("stage=LAYOUT")));
  assert.deepEqual(layout.OR, [{ editorialStage: "LAYOUT" }, { status: "APPROVED" }]);
});

test("unknown status or stage is rejected", () => {
  assert.equal(query.parseBookListQuery(new URLSearchParams("status=PUBLISHED")).error, "Status tidak dikenal.");
  assert.equal(query.parseBookListQuery(new URLSearchParams("stage=EXPORTED")).error, "Tahap tidak dikenal.");
});
