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

const policy = load("lib/review-policy.ts");
const assigned = ["a", "b", "c"];

function verdict(name, approvers, extra = {}) {
  return policy.policyVerdict({ policy: name, assignedIds: assigned, approverIds: approvers, ...extra });
}

test("ANY is met by one approval and ALL waits for every assigned reviewer", () => {
  assert.equal(verdict("ANY", ["a"]).met, true);
  assert.equal(verdict("ANY", []).need, 1);
  assert.equal(verdict("ALL", ["a", "b"]).met, false);
  assert.equal(verdict("ALL", assigned).met, true);
  assert.match(verdict("ALL", ["a"]).label, /Persetujuan 1 dari 3/);
  assert.match(verdict("ALL", ["a"]).label, /Menunggu reviewer lain/);
});

test("MAJORITY means more than half", () => {
  assert.equal(verdict("MAJORITY", ["a"]).met, false);
  assert.equal(verdict("MAJORITY", ["a", "b"]).met, true);
  assert.equal(verdict("MAJORITY", ["a", "b"]).need, 2);
});

test("MIN_N uses the requested count within the assigned set", () => {
  assert.equal(verdict("MIN_N", ["a"], { minN: 2 }).met, false);
  assert.equal(verdict("MIN_N", ["a", "c"], { minN: 2 }).met, true);
  assert.equal(verdict("MIN_N", ["a", "c"], { minN: 2 }).need, 2);
});

test("LEAD is complete only when the designated reviewer approves", () => {
  const waiting = verdict("LEAD", ["a"], { leadReviewerId: "b" });
  assert.equal(waiting.met, false);
  assert.equal(waiting.waitingOnLead, true);
  assert.match(waiting.label, /reviewer utama/);
  assert.equal(verdict("LEAD", ["b"], { leadReviewerId: "b" }).met, true);
});

test("a return closes the round so earlier approvals do not carry over", () => {
  const newestFirst = [
    { decision: "approve", note: "baru [Reviewer: a]" },
    { decision: "reject", note: "kembali [Reviewer: b]" },
    { decision: "approve", note: "lama [Reviewer: a]" },
    { decision: "submit", note: "Submitted by owner" },
  ];
  assert.equal(policy.currentRoundApproverIds(newestFirst, assigned).size, 0);
  const resubmitted = [
    { decision: "submit", note: "Submitted by owner" },
    { decision: "reject", note: "kembali [Reviewer: b]" },
    { decision: "approve", note: "lama [Reviewer: a]" },
  ];
  assert.equal(policy.currentRoundApproverIds(resubmitted, assigned).size, 0);
  const open = [
    { decision: "approve", note: "ya [Reviewer: a]" },
    { decision: "approve", note: "ya [Reviewer: b]" },
    { decision: "submit", note: "Submitted by owner" },
  ];
  assert.deepEqual([...policy.currentRoundApproverIds(open, assigned)].sort(), ["a", "b"]);
});

test("unassign recalculates ALL and MAJORITY and refuses an impossible MIN_N or lead", () => {
  const all = policy.unassignKeepsPolicyPossible({ policy: "ALL", assignedIds: assigned, removeId: "c" });
  assert.equal(all.ok, true);
  assert.equal(policy.policyVerdict({ policy: "ALL", assignedIds: all.remaining, approverIds: ["a", "b"] }).met, true);
  const majority = policy.unassignKeepsPolicyPossible({ policy: "MAJORITY", assignedIds: assigned, removeId: "c" });
  assert.equal(policy.policyVerdict({ policy: "MAJORITY", assignedIds: majority.remaining, approverIds: ["a"] }).need, 2);
  assert.equal(policy.unassignKeepsPolicyPossible({ policy: "MIN_N", assignedIds: ["a", "b"], removeId: "b", minN: 2 }).ok, false);
  assert.equal(policy.unassignKeepsPolicyPossible({ policy: "LEAD", assignedIds: assigned, removeId: "b", leadReviewerId: "b" }).ok, false);
  assert.equal(policy.unassignKeepsPolicyPossible({ policy: "ANY", assignedIds: ["a"], removeId: "a" }).ok, false);
});
