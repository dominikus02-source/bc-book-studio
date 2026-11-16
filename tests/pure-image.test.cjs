const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { PNG } = require("pngjs");

function load(rel) {
  const abs = path.resolve(rel);
  const output = ts.transpileModule(fs.readFileSync(abs, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: abs,
  }).outputText;
  const module = { exports: {} };
  const dirname = path.dirname(abs);
  function req(id) {
    if (id.startsWith(".")) return load(path.resolve(dirname, id.endsWith(".ts") ? id : id + ".ts"));
    return require(id);
  }
  new Function("exports", "module", "require", output)(module.exports, module, req);
  return module.exports;
}

const image = load("lib/pure-image.ts");

test("styled export images stay in pure JS png", () => {
  const png = new PNG({ width: 2, height: 2 });
  png.data.fill(255);
  const bytes = image.styleRaster("image/png", PNG.sync.write(png), { radius: 1, padding: 1 });
  assert.equal(bytes[0], 0x89);
  assert.equal(bytes[1], 0x50);
  const decoded = PNG.sync.read(bytes);
  assert.equal(decoded.width, 4);
  assert.equal(fs.readFileSync("lib/export-media.ts", "utf8").includes("sharp"), false);
});
