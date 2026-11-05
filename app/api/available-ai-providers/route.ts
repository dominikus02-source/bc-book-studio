import { NextRequest, NextResponse } from "next/server";
import { authorized, deny } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { publicProvider } from "../../../lib/ai-providers";

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return deny();
  const rows = await db.aiProviderCredential.findMany({
    where: { enabled: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }]
  });
  return NextResponse.json({
    providers: rows.map(row => {
      const { id, label, provider, model, isDefault } = publicProvider(row);
      return { id, label, provider, model, isDefault };
    })
  }, { headers: { "Cache-Control": "no-store" } });
}
