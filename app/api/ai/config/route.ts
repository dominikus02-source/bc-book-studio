import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { authorized, deny } from "../../../lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!authorized(req)) return deny();
  const config = await db.aiConfig.findUnique({ where: { id: "default" } });
  return NextResponse.json({
    configured: Boolean(config?.apiKey),
    model: config?.model || process.env.AI_MODEL || null,
    apiUrl: config?.apiUrl || process.env.AI_API_URL || null,
    // Never return the raw key
    hasKey: Boolean(config?.apiKey || process.env.AI_API_KEY),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return deny();
  const body = await req.json().catch(() => ({}));
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : undefined;
  const model = typeof body.model === "string" ? body.model.trim() : undefined;
  const apiUrl = typeof body.apiUrl === "string" ? body.apiUrl.trim() : undefined;

  const data: any = {};
  if (apiKey !== undefined) data.apiKey = apiKey || null;
  if (model !== undefined) data.model = model || null;
  if (apiUrl !== undefined) data.apiUrl = apiUrl || null;

  const config = await db.aiConfig.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });

  return NextResponse.json({
    ok: true,
    configured: Boolean(config.apiKey),
    model: config.model,
    apiUrl: config.apiUrl,
  });
}
