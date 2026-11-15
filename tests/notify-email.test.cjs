const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function load(rel, extra = {}) {
  const abs = path.resolve(rel);
  const output = ts.transpileModule(fs.readFileSync(abs, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: abs,
  }).outputText;
  const module = { exports: {} };
  const dirname = path.dirname(abs);
  function req(id) {
    if (Object.prototype.hasOwnProperty.call(extra, id)) return extra[id];
    if (id.startsWith(".")) return load(path.resolve(dirname, id.endsWith(".ts") ? id : id + ".ts"), extra);
    return require(id);
  }
  new Function("exports", "module", "require", "process", output)(module.exports, module, req, process);
  return module.exports;
}

test("notification failure does not fail the request, and the kill switch defaults to on", async () => {
  const previous = process.env.NOTIFY_EMAIL_ENABLED;
  try {
    process.env.NOTIFY_EMAIL_ENABLED = "true";
    const calls = [];
    const notify = load("lib/notify.ts", {
      "./account": { sendStudioMail: async () => { calls.push("send"); throw new Error("smtp down"); } },
    });
    const response = { ok: true };
    assert.equal(notify.finishWithNotify(response, async () => { throw new Error("smtp down"); }), response);
    await new Promise(resolve => setTimeout(resolve, 30));
    await assert.rejects(notify.sendNotification({ email: "a@b.c", name: "A", active: true }, { subject: "S", text: "T", html: "H" }), /smtp down/);
    await notify.sendNotification({ email: "a@b.c", name: "A", active: false }, { subject: "S", text: "T", html: "H" });
    assert.equal(calls.length, 1);
    delete process.env.NOTIFY_EMAIL_ENABLED;
    assert.equal(notify.notificationsEnabled(), true);
    process.env.NOTIFY_EMAIL_ENABLED = "false";
    assert.equal(notify.notificationsEnabled(), false);
    await notify.sendNotification({ email: "a@b.c", name: "A", active: true }, { subject: "S", text: "T", html: "H" });
    assert.equal(calls.length, 1);
    const message = notify.reviewMail("assigned", { email: "a@b.c", name: "Sari", active: true }, { id: "book-1", title: "Siklus Air" });
    assert.match(message.subject, /ditugaskan/);
    assert.match(message.text, /Siklus Air/);
    assert.match(message.text, /Review Naskah/);
    assert.match(message.html, /Buka halaman/);
  } finally {
    if (previous === undefined) delete process.env.NOTIFY_EMAIL_ENABLED;
    else process.env.NOTIFY_EMAIL_ENABLED = previous;
  }
});

test("review and collaborator routes notify only after the transaction helper returns", () => {
  for (const file of ["app/api/books/[id]/review/route.ts", "app/api/books/[id]/reviewers/route.ts", "app/api/books/[id]/collaborators/route.ts"]) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /const outcome=await db\.\$transaction/);
    assert.match(source, /return finishWithNotify\(outcome\.response,outcome\.mail\)/);
  }
  const dashboard = fs.readFileSync("app/studio/dashboard.tsx", "utf8");
  assert.equal(dashboard.includes('role !== "REVIEWER"'), false);
  assert.match(dashboard, /Menunggu keputusan Anda/);
  assert.match(dashboard, /Buka Review Naskah/);
});
