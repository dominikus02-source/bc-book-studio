import type { Prisma } from "@prisma/client";
import { referencedAssets } from "./approval-snapshot";
import { publishingSequence, resolvedPublishingPackage } from "./publishing-package";
import { COUNTED_REVIEWER_ROLES, currentRoundApproverIds, policyVerdict, type ReviewPolicyName } from "./review-policy";

type ApprovalBook = {
  id: string;
  ownerId: string;
  status: string;
  title: string;
  author: string;
  subject: string;
  grade: string;
  description: string;
  bookType: string;
  genre: string;
  pageSize: string;
  targetAudience?: string;
  writingGoal?: string;
  reviewPolicy: ReviewPolicyName;
  reviewMinApprovals: number | null;
  leadReviewerId: string | null;
};

export async function roundState(tx: Prisma.TransactionClient, book: ApprovalBook) {
  const assigned = await tx.bookReviewer.findMany({
    where: { bookId: book.id, reviewer: { active: true, role: { in: [...COUNTED_REVIEWER_ROLES] } } },
    select: { reviewerId: true },
  });
  const assignedIds = assigned.map(row => row.reviewerId);
  const reviews = await tx.review.findMany({
    where: { bookId: book.id, decision: { in: ["submit", "approve", "reject"] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { decision: true, note: true },
  });
  const approverIds = currentRoundApproverIds(reviews, assignedIds);
  const verdict = policyVerdict({
    policy: book.reviewPolicy,
    assignedIds,
    approverIds,
    leadReviewerId: book.leadReviewerId,
    minN: book.reviewMinApprovals,
  });
  const blockers = await tx.reviewerNote.count({
    where: { bookId: book.id, severity: { in: ["MAJOR", "CRITICAL"] }, status: "OPEN" },
  });
  return { assignedIds, approverIds, verdict, blockers };
}

/** Creates the immutable approval snapshot only when the caller has already checked the policy threshold. */
export async function completeApproval(tx: Prisma.TransactionClient, book: ApprovalBook, reviewerId: string) {
  if (book.status !== "REVIEW") return { ok: false as const, error: "Invalid transition", status: 409 };
  const approvedAt = new Date();
  const chapters = await tx.chapter.findMany({
    where: { bookId: book.id, archivedAt: null },
    orderBy: { position: "asc" },
    select: { title: true, content: true, position: true },
  });
  if (!chapters.length || chapters.some(chapter => chapter.content.trim().length < 20)) {
    return { ok: false as const, error: "Approval requires complete chapter content", status: 409 };
  }
  const packageRow = await tx.studioFormDraft.findFirst({
    where: { ownerId: book.ownerId, module: "PUBLISHING_PACKAGE:" + book.id },
    orderBy: { updatedAt: "desc" },
  });
  const publishingPackage = resolvedPublishingPackage(book, packageRow?.payload);
  const refs = referencedAssets(publishingSequence(publishingPackage, chapters));
  if (refs.length > 20) return { ok: false as const, error: "Too many embedded images", status: 409 };
  const files = refs.length ? await tx.bookAsset.findMany({ where: { bookId: book.id, id: { in: refs } } }) : [];
  if (files.length !== refs.length) return { ok: false as const, error: "Restore missing images before approval", status: 409 };
  const assets = files.map(({ id, mime, bytes, altText, license, sourceUrl }) => ({
    id, mime, data: Buffer.from(bytes).toString("base64"), altText, license, sourceUrl,
  }));
  const { title, author, subject, grade, description, bookType, genre, pageSize } = book;
  const updated = await tx.book.updateMany({
    where: { id: book.id, status: "REVIEW" },
    data: { status: "APPROVED", editorialStage: "LAYOUT", approvedAt },
  });
  if (!updated.count) return { ok: false as const, error: "Invalid transition", status: 409 };
  await tx.bookApprovalSnapshot.create({
    data: {
      bookId: book.id, approvedAt, reviewerId,
      manuscript: { schemaVersion: 2, language: "id", publishingPackage, title, author, subject, grade, description, bookType, genre, pageSize, chapters, assets },
    },
  });
  return { ok: true as const, book: await tx.book.findUniqueOrThrow({ where: { id: book.id } }) };
}
