const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { PDFDocument, StandardFonts } = require("pdf-lib");

const WORKER_REL = "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs";
const PDF_REL = "node_modules/pdfjs-dist/legacy/build/pdf.mjs";
const distName = process.env.BC_QA_NEXT_DIST_DIR || ".next";
if (!/^\.[a-z0-9._-]+$/i.test(distName)) throw new Error("Invalid QA Next build directory");
const STANDALONE = path.resolve(distName, "standalone");

function pdfjsVersion(file) {
  const head = fs.readFileSync(file, "utf8").slice(0, 1200);
  const match = head.match(/pdfjsVersion = ([0-9.]+)/);
  assert.ok(match, "missing pdfjsVersion marker in " + file);
  return match[1];
}

test("standalone tracing keeps the pdf.js worker beside legacy/build/pdf.mjs", async () => {
  const config = (await import("../next.config.mjs")).default;
  assert.equal(config.output, "standalone");
  assert.ok(config.serverExternalPackages.includes("pdfjs-dist"));
  const patterns = Object.values(config.outputFileTracingIncludes || {}).flat().map(item => item.replace(/^\.\//, ""));
  assert.ok(patterns.includes(WORKER_REL), "outputFileTracingIncludes must list " + WORKER_REL);

  const route = fs.readFileSync("app/api/books/[id]/import-pdf/route.ts", "utf8");
  assert.match(route, /pdfjs-dist\/legacy\/build\/pdf\.mjs/);
  const pagination = fs.readFileSync("lib/pagination-output.ts", "utf8");
  assert.match(pagination, /pdfjs-dist\/legacy\/build\/pdf\.mjs/);

  const pdfEntry = path.join(STANDALONE, PDF_REL);
  const worker = path.join(STANDALONE, WORKER_REL);
  assert.ok(fs.existsSync(pdfEntry), "standalone is missing " + PDF_REL + "; run npm run build before this test");
  assert.ok(fs.existsSync(worker), "standalone omitted " + WORKER_REL + "; production import fails with Setting up fake worker failed");
  assert.equal(pdfjsVersion(worker), pdfjsVersion(pdfEntry));

  const traces = fs.globSync(distName + "/server/**/import-pdf/**/*.nft.json");
  assert.ok(traces.length > 0, "import-pdf route trace was not emitted");
  const traced = traces.some(file => fs.readFileSync(file, "utf8").includes("pdf.worker.mjs"));
  assert.equal(traced, true, "import-pdf nft trace does not include pdf.worker.mjs");

  const pdfjs = await import(pathToFileURL(pdfEntry).href);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([300, 144]);
  page.drawText("Halo naskah", { font, size: 18, x: 36, y: 72 });
  const bytes = new Uint8Array(await doc.save());
  const task = pdfjs.getDocument({ data: bytes, verbosity: 0 });
  try {
    const parsed = await task.promise;
    assert.equal(parsed.numPages, 1);
    const content = await (await parsed.getPage(1)).getTextContent();
    const text = content.items.map(item => item.str || "").join(" ");
    assert.match(text, /Halo naskah/);
  } finally {
    await task.destroy().catch(() => {});
  }
});
