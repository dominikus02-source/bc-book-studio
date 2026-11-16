const { existsSync, readdirSync, rmSync } = require("node:fs");
const { join } = require("node:path");

/** pdf.js optionally depends on @napi-rs/canvas. That native build uses SSE4.2/AVX and SIGILLs on the production CPU. */
function strip(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === "canvas" || name.startsWith("canvas-")) {
      rmSync(join(dir, name), { recursive: true, force: true });
      console.log("removed " + join(dir, name));
    }
  }
}

const root = join(__dirname, "..", "node_modules", "@napi-rs");
strip(root);
const nested = join(__dirname, "..", "node_modules", "pdfjs-dist", "node_modules", "@napi-rs");
strip(nested);
