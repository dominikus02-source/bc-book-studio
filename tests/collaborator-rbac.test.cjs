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

const access = load("lib/manuscript-access.ts");
const draft = { ownerId: "owner", status: "DRAFT", archivedAt: null };
const review = { ownerId: "owner", status: "REVIEW", archivedAt: null };
const actions = ["read", "edit-draft", "submit", "decide", "publish", "collaborators", "archive-book", "assign-reviewer"];

function row(actor, book, flags) {
  return Object.fromEntries(actions.map(action => [action, access.stagePermission(actor, action, book, flags)]));
}

test("collaborator RBAC matrix stays owner-only for review, publish, and account management", () => {
  const owner = { id: "owner", role: "EDITOR" };
  const collaborator = { id: "partner", role: "EDITOR" };
  const reviewer = { id: "reviewer", role: "REVIEWER" };
  const other = { id: "other", role: "EDITOR" };
  const adminAssigned = { id: "admin", role: "ADMIN" };
  const adminLoose = { id: "admin2", role: "ADMIN" };
  assert.deepEqual(row(owner, draft, { assigned: false, collaborator: false }), {
    read: true, "edit-draft": true, submit: true, decide: false, publish: true, collaborators: true, "archive-book": true, "assign-reviewer": true,
  });
  assert.deepEqual(row(collaborator, draft, { assigned: false, collaborator: true }), {
    read: true, "edit-draft": true, submit: false, decide: false, publish: false, collaborators: false, "archive-book": false, "assign-reviewer": false,
  });
  assert.equal(access.stagePermission(collaborator, "edit-draft", review, { assigned: false, collaborator: true }), false);
  assert.equal(access.stagePermission(collaborator, "decide", review, { assigned: true, collaborator: true }), false);
  assert.deepEqual(row(reviewer, review, { assigned: true, collaborator: false }), {
    read: true, "edit-draft": false, submit: false, decide: true, publish: false, collaborators: false, "archive-book": false, "assign-reviewer": false,
  });
  const stranger = row(other, draft, { assigned: false, collaborator: false });
  assert.equal(stranger.read, false);
  assert.equal(stranger["edit-draft"], false);
  assert.equal(access.stagePermission(adminAssigned, "decide", review, { assigned: true, collaborator: false }), true);
  assert.equal(access.stagePermission(adminLoose, "decide", review, { assigned: false, collaborator: false }), false);
  assert.equal(access.stagePermission(null, "read", draft, { assigned: false, collaborator: false }), false);
  assert.equal(access.stagePermission(owner, "decide", draft, { assigned: true, collaborator: false }), false);
});
