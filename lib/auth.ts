import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
export function authorized(req: NextRequest): boolean {
  const expected = process.env.STUDIO_API_KEY;
  if (!expected || expected.length < 24) return false;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function deny() {
  return NextResponse.json({ error: "Unauthorized. Supply the studio access token." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
