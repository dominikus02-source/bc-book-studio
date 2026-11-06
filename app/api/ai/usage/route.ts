import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { authorized, deny } from "../../../lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!authorized(req)) return deny();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [today, month, total] = await Promise.all([
    db.aiUsageLog.aggregate({
      where: { createdAt: { gte: startOfDay } },
      _sum: { totalTokens: true, estimatedCostUsd: true },
      _count: true,
    }),
    db.aiUsageLog.aggregate({
      where: { createdAt: { gte: startOfMonth } },
      _sum: { totalTokens: true, estimatedCostUsd: true },
      _count: true,
    }),
    db.aiUsageLog.aggregate({
      _sum: { totalTokens: true, estimatedCostUsd: true },
      _count: true,
    }),
  ]);

  const recent = await db.aiUsageLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      bookId: true,
      model: true,
      totalTokens: true,
      estimatedCostUsd: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    today: {
      requests: today._count,
      tokens: today._sum.totalTokens || 0,
      costUsd: today._sum.estimatedCostUsd || 0,
    },
    month: {
      requests: month._count,
      tokens: month._sum.totalTokens || 0,
      costUsd: month._sum.estimatedCostUsd || 0,
    },
    total: {
      requests: total._count,
      tokens: total._sum.totalTokens || 0,
      costUsd: total._sum.estimatedCostUsd || 0,
    },
    recent,
  }, { headers: { "Cache-Control": "no-store" } });
}
