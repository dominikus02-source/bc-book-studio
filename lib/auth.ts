import { db } from "./db";
import { createHash } from "node:crypto";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRole, isReviewerRole } from "./rbac";
function matches(given: string, expected?: string): boolean {
  if (!expected || expected.length < 24) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function authorized(req: NextRequest): Promise<boolean> {
  if (await sessionUser(req)) return true;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return matches(given, process.env.STUDIO_API_KEY);
}
export async function reviewerAuthorized(req: NextRequest): Promise<boolean> {
  const user = await sessionUser(req);
  if (user && isReviewerRole(user.role)) return true;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const editor = process.env.STUDIO_API_KEY;
  const reviewer = process.env.STUDIO_REVIEWER_API_KEY;
  return Boolean(editor && reviewer && editor !== reviewer && matches(given, reviewer));
}
export async function sessionUser(req: NextRequest) {
  const token = req.cookies.get("bcstudio_session")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.studioSession.findUnique({where:{tokenHash:createHash("sha256").update(token).digest("hex")},include:{user:true}});
  if (!session || session.expiresAt <= new Date() || !session.user.active) return null;
  return {id:session.user.id,email:session.user.email,name:session.user.name,role:session.user.role};
}
export function deny() {
  return NextResponse.json({ error: "Unauthorized. Supply a valid studio access token." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

export async function identity(req: NextRequest): Promise<string|null>{
 const user=await sessionUser(req);
 return user?.id ?? null;
}
export async function administrator(req: NextRequest): Promise<string|null>{
 const user=await sessionUser(req);
 return user && isAdminRole(user.role) ? user.id : null;
}
