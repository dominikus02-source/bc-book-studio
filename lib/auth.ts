import { timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const domain = process.env.CF_ACCESS_TEAM_DOMAIN || process.env.CF_ACCESS_ISSUER;
const audience = process.env.CF_ACCESS_AUD;
let verifier: ReturnType<typeof createRemoteJWKSet> | undefined;

async function verifiedIdentity(req: NextRequest): Promise<{sub:string;email:string} | null> {
  if (!domain || !audience || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain)) return null;
  const token = req.headers.get("cf-access-jwt-assertion");
  if (!token) return null;
  try {
    verifier ??= createRemoteJWKSet(new URL(domain + "/cdn-cgi/access/certs"));
    const { payload } = await jwtVerify(token, verifier, {
      issuer: domain, audience, algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "email"],
    });
    if (payload.type !== "app" || typeof payload.sub !== "string" || !payload.sub.trim()
      || typeof payload.email !== "string") return null;
    if (!payload.email.trim() || !payload.email.includes("@")) return null;
    return {sub:payload.sub,email:payload.email.trim().toLowerCase()};
  } catch { return null; }
}

export async function identity(req: NextRequest): Promise<string | null> {
  const who = await verifiedIdentity(req);
  if (!who) return null;
  const allowed = (process.env.CF_ACCESS_EDITOR_EMAILS || "").split(",").map(x=>x.trim().toLowerCase());
  return process.env.CF_ACCESS_PUBLIC_SIGNUP === "true" || allowed.includes(who.email) ? who.sub : null;
}
export async function administrator(req: NextRequest): Promise<string | null> {
  const who = await verifiedIdentity(req);
  if (!who) return null;
  const admins = (process.env.CF_ACCESS_ADMIN_EMAILS || process.env.CF_ACCESS_EDITOR_EMAILS || "").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  return admins.includes(who.email) ? who.sub : null;
}
export function reviewerAuthorized(req: NextRequest): boolean {
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = process.env.STUDIO_REVIEWER_API_KEY;
  if (!expected || expected.length < 24 || expected === process.env.STUDIO_API_KEY) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a,b);
}
export function deny() {
  return NextResponse.json({ error: "Sesi studio tidak valid. Masuk kembali melalui Cloudflare Access." }, {
    status: 401, headers: { "Cache-Control": "no-store" },
  });
}
