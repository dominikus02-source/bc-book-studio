import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { authorized, deny } from "../../../lib/auth";
import { createBook, badInput } from "../../../lib/validation";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  if (!authorized(req)) return deny();
  const books = await db.book.findMany({ orderBy: { updatedAt: "desc" }, include: { chapters: { orderBy: { position: "asc" } }, reviews: { orderBy: { createdAt: "desc" } } } });
  return NextResponse.json({ books }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  if (!authorized(req)) return deny();
  try {
    const input = createBook.parse(await req.json());
    const book = await db.book.create({ data: input, include: { chapters: true, reviews: true } });
    return NextResponse.json({ book }, { status: 201 });
  } catch (error) { return NextResponse.json(badInput(error), { status: 400 }); }
}
