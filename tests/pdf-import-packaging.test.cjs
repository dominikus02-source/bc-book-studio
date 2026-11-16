const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("PDF import points at the packaged worker and does not warn about canvas", async () => {
  assert.match(fs.readFileSync("app/api/books/[id]/import-pdf/route.ts", "utf8"), /pdf\.worker\.mjs/);
  assert.equal(fs.existsSync("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"), true);
  assert.equal(fs.existsSync("public/pdf.worker.min.mjs"), true);
  assert.match(fs.readFileSync("Dockerfile", "utf8"), /pdf\.worker\.mjs/);
  assert.match(fs.readFileSync("Dockerfile", "utf8"), /@napi-rs/);
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => { warnings.push(args.join(" ")); };
  try {
    await import("pdfjs-dist/legacy/build/pdf.mjs");
  } finally {
    console.warn = original;
  }
  assert.equal(warnings.some(line => /napi-rs\/canvas|DOMMatrix|Path2D/.test(line)), false);
});
