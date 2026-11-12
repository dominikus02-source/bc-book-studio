const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const page = fs.readFileSync(path.join(__dirname, "../app/page.tsx"), "utf8");
const header = fs.readFileSync(path.join(__dirname, "../components/landing-header.tsx"), "utf8");
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

test("landing page does not claim the studio issues ISBN", () => {
  assert.match(source, /tidak membuat ISBN/i);
  assert.match(source, /Perpusnas/);
  assert.doesNotMatch(source, /terbitkan(?:kan)? ISBN|nomor ISBN otomatis|generate ISBN|membuatkan ISBN/i);
  assert.doesNotMatch(source, /THE ART OF IDEAS|A NEW CHAPTER IN CREATIVE LEARNING/);
});
