import type { Prisma } from "@prisma/client";

/** Roles that may read a manuscript they do not own, and only while assigned. */
export const MANUSCRIPT_REVIEW_ROLES = ["REVIEWER", "ADMIN"] as const;

export function isManuscriptReviewerRole(role: string): boolean {
  return (MANUSCRIPT_REVIEW_ROLES as readonly string[]).includes(role);
}

/**
 * Owner, collaborator, or a session whose current role is still REVIEWER or ADMIN and assigned.
 * A stale BookReviewer row does not keep access after demotion out of those roles.
 * SUPERADMIN can list and open every book. Approval is a separate rule.
 */
export function manuscriptVisibilityWhere(
  actor: { id: string; role: string },
  scope: { id?: string; archived?: boolean; mine?: boolean } = {}
): Prisma.BookWhereInput {
  if (actor.role === "SUPERADMIN" && !scope.mine) {
    return {
      ...(scope.id ? { id: scope.id } : {}),
      archivedAt: scope.archived ? { not: null } : null,
    };
  }
  if (scope.archived) {
    return { ...(scope.id ? { id: scope.id } : {}), ownerId: actor.id, archivedAt: { not: null } };
  }
  const or: Prisma.BookWhereInput[] = [
    { ownerId: actor.id },
    {
      collaborators: {
        some: {
          userId: actor.id,
          archivedAt: null,
          role: "EDITOR",
          user: { active: true, role: { in: ["EDITOR", "ADMIN"] } },
        },
      },
    },
  ];
  const parentAccess: Prisma.BookWhereInput[] = [
    { ownerId: actor.id },
    {
      collaborators: {
        some: {
          userId: actor.id,
          archivedAt: null,
          role: "EDITOR",
          user: { active: true, role: { in: ["EDITOR", "ADMIN"] } },
        },
      },
    },
  ];
  if (isManuscriptReviewerRole(actor.role)) {
    or.push({ assignedReviewers: { some: { reviewerId: actor.id } } });
    parentAccess.push({ assignedReviewers: { some: { reviewerId: actor.id } } });
  }
  or.push({ parent: { archivedAt: null, OR: parentAccess } });
  return { ...(scope.id ? { id: scope.id } : {}), archivedAt: null, OR: or };
}

export function canReadManuscript(
  actor: { id: string; role: string },
  book: { ownerId: string },
  assignedToActor: boolean,
  collaborating = false
): boolean {
  if (actor.role === "SUPERADMIN") return true;
  if (actor.id === book.ownerId) return true;
  if (collaborating) return true;
  return assignedToActor && isManuscriptReviewerRole(actor.role);
}

/** Author and collaborator cannot approve. SUPERADMIN may decide only after being assigned, and never on their own or collaborated book. */
export function canDecideReview(
  actor: { id: string; role: string },
  book: { ownerId: string },
  assignedToActor: boolean,
  collaborating = false
): boolean {
  if (collaborating) return false;
  if (actor.id === book.ownerId) return false;
  if (!assignedToActor) return false;
  return isManuscriptReviewerRole(actor.role) || actor.role === "SUPERADMIN";
}

export function canManageCollaborators(actorId: string, ownerId: string, role?: string) {
  return role === "SUPERADMIN" || actorId === ownerId;
}

export function canEditDraftContent(
  actorId: string,
  book: { ownerId: string; status: string; archivedAt?: Date | null },
  collaborating: boolean,
  role?: string
) {
  if (book.archivedAt) return false;
  if (book.status !== "DRAFT") return false;
  if (role === "SUPERADMIN") return true;
  if (actorId === book.ownerId) return true;
  return collaborating;
}

export function canSubmitReview(actorId: string, ownerId: string) {
  return actorId === ownerId;
}

export function canAssignReviewers(actorId: string, ownerId: string, role?: string) {
  return role === "SUPERADMIN" || actorId === ownerId;
}

export function canArchiveBook(actorId: string, ownerId: string, role?: string) {
  return role === "SUPERADMIN" || actorId === ownerId;
}

export function canPublishBook(actorId: string, ownerId: string) {
  return actorId === ownerId;
}

export type StageAction = "read" | "edit-draft" | "submit" | "decide" | "publish" | "collaborators" | "archive-book" | "assign-reviewer";

/** Pure RBAC used by routes. `collaborating` means an active EDITOR/ADMIN collaborator row, not a reviewer assignment. */
export function stagePermission(
  actor: { id: string; role: string } | null,
  action: StageAction,
  book: { ownerId: string; status: string; archivedAt?: Date | null },
  flags: { assigned: boolean; collaborator: boolean }
) {
  if (!actor) return false;
  if (action === "read") return canReadManuscript(actor, book, flags.assigned, flags.collaborator);
  if (action === "edit-draft") return canEditDraftContent(actor.id, book, flags.collaborator, actor.role);
  if (action === "submit") return book.status === "DRAFT" && canSubmitReview(actor.id, book.ownerId);
  if (action === "decide") return book.status === "REVIEW" && canDecideReview(actor, book, flags.assigned, flags.collaborator);
  if (action === "publish") return canPublishBook(actor.id, book.ownerId);
  if (action === "collaborators") return canManageCollaborators(actor.id, book.ownerId, actor.role);
  if (action === "archive-book") return canArchiveBook(actor.id, book.ownerId, actor.role);
  return canAssignReviewers(actor.id, book.ownerId, actor.role);
}
