const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.join(__dirname, "../app/page.tsx"), "utf8");
const header = fs.readFileSync(path.join(__dirname, "../components/landing-header.tsx"), "utf8") + "\n" + fs.readFileSync(path.join(__dirname, "../components/theme-toggle.tsx"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "../app/landing.css"), "utf8");
const layout = fs.readFileSync(path.join(__dirname, "../app/layout.tsx"), "utf8");
const themeShell = fs.readFileSync(path.join(__dirname, "../app/theme-shell.tsx"), "utf8");
const publicPaths = fs.readFileSync(path.join(__dirname, "../lib/public-theme-paths.ts"), "utf8");
const source = page + "\n" + header;

test("landing page uses the existing auth entry points", () => {
  assert.match(source, /href="\/login"/);
  assert.match(source, /href="\/activate"/);
  assert.match(source, /Masuk ke studio/);
  assert.match(source, /Aktivasi akun/);
  assert.doesNotMatch(source, /Daftar gratis|Buat akun baru|sign up/i);
});

test("landing page names the real workflow and export formats", () => {
  for (const stage of ["Ide", "Rancang", "Tulis", "Review", "Terbit"]) assert.match(source, new RegExp(stage));
  for (const format of ["PDF", "DOCX", "EPUB", "HTML", "Flipbook"]) assert.match(source, new RegExp(format));
  assert.match(source, /PT Bahasa Cerdas Indonesia/);
  assert.match(source, /pratinjau draf/i);
  assert.match(source, /snapshot persetujuan/);
});

test("landing theme toggle uses the studio theme and stays on the page tokens", () => {
  assert.match(header, /Terang/);
  assert.match(header, /Gelap/);
  assert.match(header, /className="lp-theme"/);
  assert.match(header, /aria-pressed/);
  assert.match(header, /localStorage\.setItem\("bcstudio-theme"/);
  assert.match(header, /prefers-color-scheme: dark/);
  assert.match(header, /bc-theme-change/);
  assert.match(header, /dataset\.theme/);
  assert.match(layout, /bcstudio-theme/);
  assert.match(layout, /prefers-color-scheme: dark/);
  assert.match(layout, /EDITORIAL_PUBLIC_PATHS/);
  assert.match(publicPaths, /"\/"/);
  assert.match(themeShell, /pathname!=="\/studio"&&!isEditorialPublicPath\(pathname\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.lp-theme,\s*\.lp-menu\s*\{[^}]*min-height:\s*44px/);
  for (const line of css.split("\n")) {
    if (!line.includes("#")) continue;
    assert.match(line, /--lp-[a-z0-9-]+\s*:/);
  }
  assert.doesNotMatch(css, /rgba?\(|\bhsl/);
  for (const line of css.split("\n")) {
    if (!/font-size\s*:/.test(line)) continue;
    assert.match(line, /font-size:\s*var\(--lp-size-/);
  }
  assert.match(css, /--lp-size-kicker:\s*0\.75rem/);
  assert.match(css, /--lp-size-meta:\s*0\.875rem/);
  assert.match(css, /--lp-size-ui:\s*1rem/);
  assert.match(css, /--lp-size-body:\s*1\.0625rem/);
  assert.match(css, /--lp-size-h3:\s*1\.25rem/);
  assert.match(css, /--lp-size-h2:\s*clamp\(1\.75rem, 3vw, 2\.25rem\)/);
  assert.match(css, /--lp-size-h1:\s*clamp\(1\.875rem, 4\.2vw, 3rem\)/);
});

test("landing page does not claim the studio issues ISBN", () => {
  assert.match(source, /tidak membuat ISBN/i);
  assert.match(source, /Perpusnas/);
  assert.doesNotMatch(source, /terbitkan(?:kan)? ISBN|nomor ISBN otomatis|generate ISBN|membuatkan ISBN/i);
  assert.doesNotMatch(source, /THE ART OF IDEAS|A NEW CHAPTER IN CREATIVE LEARNING/);
});
