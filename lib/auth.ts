import { createRemoteJWKSet, jwtVerify } from "jose";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
function matches(given: string, expected?: string): boolean {
  if (!expected || expected.length < 24) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksIssuer = "";
export async function accessEmail(req: NextRequest): Promise<string | null> {
  const issuer = process.env.CF_ACCESS_ISSUER;
  const audience = process.env.CF_ACCESS_AUD;
  const token = req.headers.get("cf-access-jwt-assertion");
  if (!issuer || !audience || !token) return null;
  try {
    if (!jwks || jwksIssuer !== issuer) {
      if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)) return null;
      jwks = createRemoteJWKSet(new URL(issuer + "/cdn-cgi/access/certs"));
      jwksIssuer = issuer;
    }
    const { payload } = await jwtVerify(token, jwks, {
      issuer, audience, algorithms: ["RS256"], requiredClaims: ["exp", "iat", "email", "sub"],
    });
    if (payload.type !== "app" || typeof payload.email !== "string" || !payload.sub) return null;
    const email = payload.email.toLowerCase();
    const allowed = (process.env.CF_ACCESS_EDITOR_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
    return allowed.includes(email) ? email : null;
  } catch { return null; }
}
export async function authorized(req: NextRequest): Promise<boolean> {
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return matches(given, process.env.STUDIO_API_KEY) || Boolean(await accessEmail(req));
}
export function reviewerAuthorized(req: NextRequest): boolean {
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const editor = process.env.STUDIO_API_KEY;
  const reviewer = process.env.STUDIO_REVIEWER_API_KEY;
  return Boolean(editor && reviewer && editor !== reviewer && matches(given, reviewer));
}
export function deny() {
  return NextResponse.json({ error: "Sesi studio tidak valid. Silakan masuk kembali melalui email dan OTP." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
