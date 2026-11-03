import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
function matches(given: string, expected?: string): boolean {
  if (!expected || expected.length < 24) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function authorized(req: NextRequest): boolean {
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return matches(given, process.env.STUDIO_API_KEY);
}
export function reviewerAuthorized(req: NextRequest): boolean {
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const editor = process.env.STUDIO_API_KEY;
  const reviewer = process.env.STUDIO_REVIEWER_API_KEY;
  return Boolean(editor && reviewer && editor !== reviewer && matches(given, reviewer));
}
export function deny() {
  return NextResponse.json({ error: "Unauthorized. Supply a valid studio access token." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
