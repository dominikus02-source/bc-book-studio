const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const auth = read("app/auth-panel.tsx");
const terms = read("app/syarat-ketentuan/page.tsx");
const header = read("components/public-header.tsx");
const toggle = read("components/theme-toggle.tsx");
const paths = read("lib/public-theme-paths.ts");
const layout = read("app/layout.tsx");
const pages = {
  login: read("app/login/page.tsx"),
  activate: read("app/activate/page.tsx"),
  forgot: read("app/forgot-password/page.tsx"),
  reset: read("app/reset-password/page.tsx"),
};

test("public account routes keep the existing auth modes", () => {
  assert.match(pages.login, /mode="login"/);
  assert.match(pages.activate, /mode="activate"/);
  assert.match(pages.forgot, /mode="forgot-password"/);
  assert.match(pages.reset, /mode="reset-password"/);
  assert.match(auth, /\/api\/auth\//);
  assert.match(auth, /request-activation/);
  assert.match(auth, /minLength=\{mode==="login"\?1:12\}/);
  assert.doesNotMatch(auth + terms, /Daftar gratis|Buat akun baru|sign up/i);
});

test("public pages share the landing theme control and boot", () => {
  for (const route of ["/", "/login", "/activate", "/forgot-password", "/reset-password", "/syarat-ketentuan"]) {
    assert.match(paths, new RegExp(route.replace("/", "\\/")));
  }
  assert.match(layout, /EDITORIAL_PUBLIC_PATHS/);
  assert.match(layout, /bcstudio-theme/);
  assert.match(layout, /prefers-color-scheme: dark/);
  assert.match(header, /ThemeToggle/);
  assert.match(toggle, /Terang/);
  assert.match(toggle, /Gelap/);
  assert.match(toggle, /bcstudio-theme/);
  assert.match(toggle, /bc-theme-change/);
  assert.match(toggle, /className="lp-theme"/);
  for (const source of Object.values(pages)) assert.match(source, /PublicHeader/);
  assert.match(terms, /PublicHeader/);
});

test("public copy stays inside known product limits", () => {
  assert.match(auth, /Masuk ke studio/);
  const transfer = read("tests/form-transfer-e2e.cjs");
  assert.match(transfer, /\/masuk ke studio\/i/);
  assert.match("Masuk ke studio", /masuk ke studio/i);
  assert.match("Masuk ke Studio", /masuk ke studio/i);
  assert.match(auth, /Aktivasi akun/);
  assert.match(auth, /Lupa kata sandi/);
  assert.match(auth, /30 menit/);
  assert.match(auth, /tidak memberitahu apakah email terdaftar/);
  assert.match(terms, /tidak membuat ISBN/i);
  assert.match(terms, /Perpusnas/);
  assert.match(terms, /pratinjau draf/i);
  assert.match(terms, /PT Bahasa Cerdas Indonesia/);
  assert.doesNotMatch(terms, /Jalan |NIB|nomor akta|ganti rugi/i);
});
