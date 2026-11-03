import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { authorized, reviewerAuthorized, deny } from "../../../../../lib/auth";
import { reviewInput, badInput } from "../../../../../lib/validation";
export const runtime = "nodejs";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action, note } = reviewInput.parse(await req.json());
    if (action === "submit" ? !authorized(req) : !reviewerAuthorized(req)) return deny();
    const book = await db.$transaction(async tx => {
      const current = await tx.book.findUnique({ where: { id }, include: { _count: { select: { chapters: true } } } });
      if (!current) throw new Error("NOT_FOUND");
      if (action === "submit" && (current.status !== "DRAFT" || current._count.chapters === 0)) throw new Error("INVALID_TRANSITION");
      if ((action === "approve" || action === "reject") && current.status !== "REVIEW") throw new Error("INVALID_TRANSITION");
      if (action === "approve" && !note.trim()) throw new Error("REVIEW_NOTE_REQUIRED");
      const status = action === "submit" ? "REVIEW" : action === "approve" ? "APPROVED" : "DRAFT";
      const updated = await tx.book.update({ where: { id }, data: { status, approvedAt: status === "APPROVED" ? new Date() : null } });
      await tx.review.create({ data: { bookId: id, decision: action, note } });
      return updated;
    });
    return NextResponse.json({ book });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(msg === "NOT_FOUND" ? { error: "Book not found" } : ["INVALID_TRANSITION","REVIEW_NOTE_REQUIRED"].includes(msg) ? { error: msg } : badInput(error), { status: msg === "NOT_FOUND" ? 404 : 409 });
  }
}
