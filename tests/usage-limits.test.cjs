const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function loadUsage(queryRaw) {
  const source = fs.readFileSync("lib/usage.ts", "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }}).outputText;
  const module = { exports: {} };
  const calls = [];
  const context = {
    exports: module.exports, module, process, console,
    require: (id) => {
      if (id === "./db") return { db: { $queryRaw: async (...args) => { calls.push(args); return queryRaw ? queryRaw(args) : [{count:1}]; } } };
      if (id === "next/server") return { NextResponse: { json: (data, init) => ({ data, init }) } };
      return require(id);
    }
  };
  vm.runInNewContext(output, context);
  return { api: module.exports, calls };
}

test("unset, empty, or 0 daily AI limits are unlimited", () => {
  const { api } = loadUsage();
  assert.deepEqual(api.generationLimits({}), {user:0,global:0});
  assert.deepEqual(api.generationLimits({AI_DAILY_LIMIT_PER_USER:"",AI_DAILY_LIMIT_GLOBAL:"  "}), {user:0,global:0});
  assert.deepEqual(api.generationLimits({AI_DAILY_LIMIT_PER_USER:"0",AI_DAILY_LIMIT_GLOBAL:"0"}), {user:0,global:0});
  assert.deepEqual(api.generationLimits({AI_DAILY_LIMIT_PER_USER:"-5",AI_DAILY_LIMIT_GLOBAL:"abc"}), {user:0,global:0});
});

test("positive env values restore a later cap", () => {
  const { api } = loadUsage();
  assert.deepEqual(api.generationLimits({AI_DAILY_LIMIT_PER_USER:"30",AI_DAILY_LIMIT_GLOBAL:"200"}), {user:30,global:200});
  assert.equal(api.parseDailyLimit("AI_DAILY_LIMIT_PER_USER",{AI_DAILY_LIMIT_PER_USER:"12.9"}), 12);
});

test("canGenerate skips counters when limits are unlimited", async () => {
  const previousUser=process.env.AI_DAILY_LIMIT_PER_USER, previousGlobal=process.env.AI_DAILY_LIMIT_GLOBAL;
  delete process.env.AI_DAILY_LIMIT_PER_USER;
  delete process.env.AI_DAILY_LIMIT_GLOBAL;
  try {
    const { api, calls } = loadUsage(() => { throw Error("UsageCounter must not be written when unlimited"); });
    assert.equal(await api.canGenerate("user-1"), true);
    assert.equal(calls.length, 0);
  } finally {
    if (previousUser===undefined) delete process.env.AI_DAILY_LIMIT_PER_USER; else process.env.AI_DAILY_LIMIT_PER_USER=previousUser;
    if (previousGlobal===undefined) delete process.env.AI_DAILY_LIMIT_GLOBAL; else process.env.AI_DAILY_LIMIT_GLOBAL=previousGlobal;
  }
});

test("canGenerate enforces only the limits that are set", async () => {
  const previousUser=process.env.AI_DAILY_LIMIT_PER_USER, previousGlobal=process.env.AI_DAILY_LIMIT_GLOBAL;
  process.env.AI_DAILY_LIMIT_PER_USER="5";
  delete process.env.AI_DAILY_LIMIT_GLOBAL;
  try {
    let allowed=true;
    const { api, calls } = loadUsage(() => allowed ? [{count:1}] : []);
    assert.equal(await api.canGenerate("user-1"), true);
    assert.equal(calls.length, 1);
    allowed=false;
    assert.equal(await api.canGenerate("user-1"), false);
  } finally {
    if (previousUser===undefined) delete process.env.AI_DAILY_LIMIT_PER_USER; else process.env.AI_DAILY_LIMIT_PER_USER=previousUser;
    if (previousGlobal===undefined) delete process.env.AI_DAILY_LIMIT_GLOBAL; else process.env.AI_DAILY_LIMIT_GLOBAL=previousGlobal;
  }
});
