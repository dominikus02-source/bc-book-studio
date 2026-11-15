import type { Prisma } from "@prisma/client";

/** Account roles that may be invited as a writing collaborator. */
export const COLLABORATOR_ACCOUNT_ROLES = ["EDITOR", "ADMIN"] as const;

export function isCollaboratorAccount(user: { active: boolean; role: string }) {
  return user.active && (COLLABORATOR_ACCOUNT_ROLES as readonly string[]).includes(user.role);
}

/** Owner, or an active EDITOR/ADMIN collaborator row. Reviewer assignment is a different path. */
export function draftParticipantWhere(actorId: string): Prisma.BookWhereInput {
  return {
    OR: [
      { ownerId: actorId },
      {
        collaborators: {
          some: {
            userId: actorId,
            archivedAt: null,
            role: "EDITOR",
            user: { active: true, role: { in: [...COLLABORATOR_ACCOUNT_ROLES] } },
          },
        },
      },
    ],
  };
}

export type LockedDraftBook = { id: string; status: string; editorialStage: string; ownerId: string };

/** Row lock for a draft the actor may edit. Does not grant archive, review, or publish. */
export async function lockDraftEditor(tx: Prisma.TransactionClient, bookId: string, actorId: string) {
  const rows = await tx.$queryRaw<LockedDraftBook[]>`
    SELECT b.id, b.status, b."editorialStage", b."ownerId"
    FROM "Book" b
    WHERE b.id = ${bookId}
      AND b."archivedAt" IS NULL
      AND (
        b."ownerId" = ${actorId}
        OR EXISTS (
          SELECT 1 FROM "BookCollaborator" c
          INNER JOIN "StudioUser" u ON u.id = c."userId"
          WHERE c."bookId" = b.id
            AND c."userId" = ${actorId}
            AND c."archivedAt" IS NULL
            AND c.role = 'EDITOR'
            AND u.active = true
            AND u.role IN ('EDITOR', 'ADMIN')
        )
      )
    FOR UPDATE OF b
  `;
  return rows[0] ?? null;
}
