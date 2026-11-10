import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { sessionUser } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }
  const user = await sessionUser(req);
  if (!user) return new Response(null, {
    status: 307,
    headers: { Location: "/login?module=Tata+Letak", "Cache-Control": "no-store" },
  });
  const source = await readFile(
    join(process.cwd(), "app", "studio", "layout-preview", "prototype.html"),
    "utf8",
  );
  const namespace = createHash("sha256").update(user.id).digest("hex");
  const embedded = req.nextUrl.searchParams.get("embedded") === "1";
  const dashboardTheme = `<style>
    :root{--ink:#17202b;--muted:#536173;--green:#243d6b;--lime:#edf2ff;--paper:#fff;--line:#e8ebef;--bg:#f5f6f8;--panel:#fff;--control:#fff;--canvas:#edf1f8;--notice:#fff2dc;--accent:#456de6}
    :root[data-theme=dark]{color-scheme:dark;--ink:#e5ecf7;--muted:#b6c4d7;--green:#304f87;--lime:#253c62;--line:#3c4758;--bg:#161e2b;--panel:#1e2939;--control:#253247;--canvas:#172232;--notice:#3f3025;--accent:#8da7df}
    body{font-family:ui-sans-serif,system-ui,sans-serif}h1{font:800 clamp(24px,4vw,35px)/1.14 ui-sans-serif,system-ui,sans-serif;letter-spacing:-.035em}
    header{background:linear-gradient(112deg,#172b4d,#294b79)}.mark{background:#edf2ff;color:#243d6b}.flag{color:#d4deee}
    button,.field input,.field select,.field textarea{background:var(--control);color:var(--ink)}
    .primary,button[aria-pressed=true]{background:var(--green);color:white}.canvas{background:var(--canvas);border-color:var(--line)}
    .panel{border-radius:15px}.badge{background:var(--lime)}.notice{background:var(--notice)}
    .sheet{color:#17202b}.sheet footer{color:#536173}.sheet .block-actions button{background:#fff;color:#243d6b}.sheet .block-actions button[aria-pressed=true]{background:#243d6b;color:white}
    .block[data-selected=true]{border-color:#456de6;background:#edf2ff}.block.over{border-top-color:#456de6}
    .graphic{background:#dce8ff;color:#243d6b}.exercise{background:#e8f1fc}.notes a{color:var(--accent)}
    button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline-color:var(--accent)}
    .pub-box{min-width:0}.pub-grid>*{min-width:0}
    html[data-embedded] body{background:transparent}html[data-embedded] header{display:none}html[data-embedded] .wrap{padding:10px 0 0}
    html[data-embedded] .intro h1{font-size:22px}
  </style>`;
  const html = source
    .replace("<header>", dashboardTheme+"<header>")
    .replace('<html lang="id">', embedded ? '<html lang="id" data-embedded>' : '<html lang="id">')
    .replace(/bc-layout-(demo|publisher)-v1/g, "$&:" + namespace)
    .replace("</header>", '<a href="/studio?module=Tata+Letak" style="color:white">Kembali ke Tata Letak</a></header>');
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; frame-ancestors 'self'; form-action 'none'; base-uri 'none'; sandbox allow-scripts allow-same-origin allow-modals allow-downloads allow-forms",
    },
  });
}
