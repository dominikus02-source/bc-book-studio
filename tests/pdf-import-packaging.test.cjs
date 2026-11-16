const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

test("PDF import does not ship or load @napi-rs/canvas", () => {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.dependencies["@napi-rs/canvas"], undefined);
  assert.match(fs.readFileSync("app/api/books/[id]/import-pdf/route.ts", "utf8"), /pdf\.worker\.mjs/);
  assert.equal(fs.existsSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"), true);
  assert.equal(fs.existsSync("public/pdf.worker.min.mjs"), true);
  assert.doesNotMatch(fs.readFileSync("Dockerfile", "utf8"), /@napi-rs\/canvas/);
  assert.doesNotMatch(fs.readFileSync("next.config.mjs", "utf8"), /@napi-rs\/canvas/);
  assert.equal(fs.existsSync("node_modules/@napi-rs/canvas"), false);
  const probe = spawnSync(process.execPath, ["-e", "import('pdfjs-dist/legacy/build/pdf.mjs').then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"], { encoding: "utf8" });
  assert.equal(probe.status, 0, probe.stderr);
  assert.doesNotMatch(probe.stderr, /illegal instruction/i);
});
