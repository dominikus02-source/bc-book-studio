import { timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
const domain = process.env.CF_ACCESS_TEAM_DOMAIN;
const aud = process.env.CF_ACCESS_AUD;
let verifier: ReturnType<typeof createRemoteJWKSet> | undefined;
export async function identity(req: NextRequest): Promise<string | null> {
  if (!domain || !aud || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain)) return null;
  const token = req.headers.get("cf-access-jwt-assertion");
  if (!token) return null;
  try {
    verifier ??= createRemoteJWKSet(new URL(domain + "/cdn-cgi/access/certs"));
    const { payload } = await jwtVerify(token, verifier, { issuer: domain, audience: aud, algorithms: ["RS256"] });
    if (typeof payload.sub !== "string" || !payload.sub.trim()) return null;
    return payload.sub;
  } catch { return null; }
}
export function reviewerAuthorized(req: NextRequest): boolean {
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = process.env.STUDIO_REVIEWER_API_KEY;
  if (!expected || expected.length < 24 || given.length !== expected.length) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a,b);
}
export function deny() {
  return NextResponse.json({ error: "Cloudflare Access authentication required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
