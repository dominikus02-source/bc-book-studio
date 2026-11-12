import type { Prisma } from "@prisma/client";

/** Roles that may read a manuscript they do not own, and only while assigned. */
export const MANUSCRIPT_REVIEW_ROLES = ["REVIEWER", "ADMIN"] as const;

export function isManuscriptReviewerRole(role: string): boolean {
  return (MANUSCRIPT_REVIEW_ROLES as readonly string[]).includes(role);
}

/**
 * Owner, or a session whose current role is still REVIEWER or ADMIN.
 * A stale BookReviewer row does not keep access after demotion or promotion
 * out of those roles. SUPERADMIN is an account administrator, not a reviewer.
 */
export function manuscriptVisibilityWhere(
  actor: { id: string; role: string },
  scope: { id?: string; archived?: boolean } = {}
): Prisma.BookWhereInput {
  if (scope.archived) {
    return { ...(scope.id ? { id: scope.id } : {}), ownerId: actor.id, archivedAt: { not: null } };
  }
  const or: Prisma.BookWhereInput[] = [{ ownerId: actor.id }];
  if (isManuscriptReviewerRole(actor.role)) {
    or.push({ assignedReviewers: { some: { reviewerId: actor.id } } });
  }
  return { ...(scope.id ? { id: scope.id } : {}), archivedAt: null, OR: or };
}

export function canReadManuscript(
  actor: { id: string; role: string },
  book: { ownerId: string },
  assignedToActor: boolean
): boolean {
  if (actor.id === book.ownerId) return true;
  return assignedToActor && isManuscriptReviewerRole(actor.role);
}

/** Author cannot approve or reject their own book. Assignment and a live review role are both required. */
export function canDecideReview(
  actor: { id: string; role: string },
  book: { ownerId: string },
  assignedToActor: boolean
): boolean {
  if (actor.id === book.ownerId) return false;
  return assignedToActor && isManuscriptReviewerRole(actor.role);
}
