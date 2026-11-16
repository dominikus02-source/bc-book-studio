const { existsSync, readdirSync, statSync } = require("node:fs");
const { join } = require("node:path");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === ".next") continue;
    const path = join(dir, name);
    let info;
    try { info = statSync(path); } catch { continue; }
    if (info.isDirectory()) walk(path, out);
    else if (name.endsWith(".node")) out.push(path);
  }
  return out;
}

const canvasDir = join(process.cwd(), "node_modules", "@napi-rs");
if (existsSync(canvasDir)) {
  const banned = readdirSync(canvasDir).filter(name => name === "canvas" || name.startsWith("canvas-"));
  if (banned.length) fail("Native canvas is installed: " + banned.join(", "));
}

const roots = [
  join(process.cwd(), "node_modules", "@img"),
  join(process.cwd(), "node_modules", "sharp"),
  join(process.cwd(), "node_modules", ".prisma"),
  join(process.cwd(), "node_modules", "@prisma"),
  join(process.cwd(), "node_modules", "pdfjs-dist"),
  join(process.cwd(), ".next", "standalone", "node_modules"),
];
const natives = roots.flatMap(dir => walk(dir));
for (const file of natives) {
  if (file.includes(`${join("@napi-rs", "canvas")}`) || file.includes("canvas-linux") || /skia/i.test(file)) {
    fail("Refusing native canvas module " + file);
  }
  const lowered = file.toLowerCase();
  if (/sharp-|libvips/.test(lowered)) {
    console.log("left unloaded " + file);
    continue;
  }
  if (/darwin|win32|android|freebsd|arm64|armv7|riscv|ia32/.test(lowered) && !lowered.includes(process.arch)) continue;
  try {
    require(file);
    console.log("loaded " + file);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/illegal instruction|sigill/i.test(message)) fail(message);
    console.log("skipped " + file + ": " + message.split("\n")[0]);
  }
}

async function main() {
  const qr = require("qrcode");
  const png = await qr.toBuffer("https://www.youtube.com/watch?v=dQw4w9WgXcQ", { type: "png", width: 120, margin: 1, errorCorrectionLevel: "M" });
  if (png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) fail("QR output is not a pngjs PNG");
  await import("pdfjs-dist/legacy/build/pdf.mjs");
  await import("pdfjs-dist/build/pdf.mjs");
  console.log("pdf.js and pngjs QR loaded without canvas");
}

main().catch(error => fail(error instanceof Error ? error.stack || error.message : String(error)));
