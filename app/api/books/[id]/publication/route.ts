import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { sessionUser, deny } from "../../../../../lib/auth";
import { checkpointsFor } from "../../../../../lib/editorial";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };
const jsonError = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

async function readiness(id: string, ownerId: string) {
  const book = await db.book.findFirst({
    where: { id, ownerId },
    include: {
      chapters: { orderBy: { position: "asc" } },
      assignedReviewers: { select: { reviewerId: true } },
      reviews: { orderBy: { createdAt: "desc" } },
      reviewNotes: { where: { status: "OPEN", severity: "CRITICAL" }, select: { id: true } },
      publication: true,
      assets: { select: { id: true, altText: true, license: true } },
    },
  });
  if (!book) return null;
  const checks = (book.editorialChecks ?? {}) as Record<string, unknown>;
  const blockers: string[] = [];
  if (book.status !== "APPROVED" || !book.approvedAt) blockers.push("Independent editorial approval is required.");
  if (!book.title.trim() || !book.author.trim() || !book.description.trim()) blockers.push("Title, author, and book description are required.");
  if (book.chapters.length === 0) blockers.push("At least one chapter is required.");
  if (book.chapters.some(c => !c.title.trim() || !c.content.trim())) blockers.push("Every chapter requires a title and content.");
  const positions = book.chapters.map(c => c.position);
  if (new Set(positions).size !== positions.length) blockers.push("Chapter positions must be unique.");
  if (book.assignedReviewers.length === 0 || book.assignedReviewers.every(r => r.reviewerId === ownerId)) blockers.push("An independent reviewer must be assigned.");
  if (!book.reviews.some(r => r.decision === "approve")) blockers.push("A reviewer approval record is required.");
  if (book.reviewNotes.length > 0) blockers.push("Resolve all critical reviewer findings.");
  for (const item of checkpointsFor(book.bookType)) if (checks[item.key] !== true) blockers.push("Editorial checkpoint incomplete: " + item.label);
  if (book.assets.some(a => !a.altText.trim() || !a.license.trim())) blockers.push("Every embedded asset needs alt text and a rights declaration.");
  return { book, blockers };
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const user = await sessionUser(req);
  if (!user) return deny();
  const { id } = await params;
  const result = await readiness(id, user.id);
  if (!result) return jsonError("Book not found", 404);
  const publication = result.book.publication;
  return NextResponse.json({
    ready: result.blockers.length === 0,
    blockers: result.blockers,
    publication: publication ? { id: publication.id, version: publication.version, publishedAt: publication.publishedAt, unpublishedAt: publication.unpublishedAt, active: !publication.unpublishedAt } : null,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await sessionUser(req);
  if (!user) return deny();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || (body.action !== "publish" && body.action !== "unpublish") || Object.keys(body).some(k => k !== "action")) return jsonError("Expected action publish or unpublish", 400);

  // The transaction protects the readiness decision and publication snapshot from
  // concurrent edits. An external ISBN/catalog/distribution action is NOT performed.
  return db.$transaction(async tx => {
    const book = await tx.book.findFirst({
      where: { id, ownerId: user.id },
      include: {
        chapters: { orderBy: { position: "asc" } },
        assignedReviewers: true,
        reviews: { orderBy: { createdAt: "desc" } },
        reviewNotes: { where: { status: "OPEN", severity: "CRITICAL" } },
        assets: { select: { id: true, altText: true, license: true } },
        publication: true,
      },
    });
    if (!book) return jsonError("Book not found", 404);
    if (body.action === "unpublish") {
      if (!book.publication || book.publication.unpublishedAt) return jsonError("No active publication", 409);
      const result = await tx.bookPublication.update({ where: { bookId: id }, data: { unpublishedAt: new Date() } });
      return NextResponse.json({ published: false, version: result.version }, { headers: { "Cache-Control": "no-store" } });
    }
    if (book.publication && !book.publication.unpublishedAt) return jsonError("Book is already published", 409);
    const checks = (book.editorialChecks ?? {}) as Record<string, unknown>;
    if (book.status !== "APPROVED" || !book.approvedAt ||
      !book.title.trim() || !book.author.trim() || !book.description.trim() ||
      !book.chapters.length || book.chapters.some(ch => !ch.title.trim() || !ch.content.trim()) ||
      book.assignedReviewers.every(r => r.reviewerId === user.id) ||
      !book.reviews.some(r => r.decision === "approve") ||
      book.reviewNotes.length ||
      checkpointsFor(book.bookType).some(c => checks[c.key] !== true) ||
      book.assets.some(a => !a.altText.trim() || !a.license.trim())
    ) return jsonError("Publication requirements not met; GET this endpoint for a checklist", 409);

    const snapshot = {
      schemaVersion: 1,
      title: book.title, author: book.author, description: book.description,
      subject: book.subject, grade: book.grade, bookType: book.bookType,
      genre: book.genre, pageSize: book.pageSize,
      approvedAt: book.approvedAt.toISOString(),
      chapters: book.chapters.map(c => ({ id: c.id, position: c.position, title: c.title, content: c.content })),
      assets: book.assets.map(a => ({ id: a.id, altText: a.altText, license: a.license })),
      // Identifier issuance and third-party distribution are separate verified steps.
      distribution: "INTERNAL_ONLY",
    };
    const result = await tx.bookPublication.upsert({
      where: { bookId: id },
      create: { bookId: id, publishedById: user.id, snapshot, version: 1 },
      update: { publishedById: user.id, snapshot, publishedAt: new Date(), unpublishedAt: null, version: { increment: 1 } },
    });
    return NextResponse.json({ published: true, version: result.version, publicationId: result.id, distribution: "INTERNAL_ONLY" }, { status: 201, headers: { "Cache-Control": "no-store" } });
  });
}
