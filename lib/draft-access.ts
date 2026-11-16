import { Prisma, type PrismaClient } from "@prisma/client";

/** Account roles that may be invited as a writing collaborator. */
export const COLLABORATOR_ACCOUNT_ROLES = ["EDITOR", "ADMIN"] as const;

export function isCollaboratorAccount(user: { active: boolean; role: string }) {
  return user.active && (COLLABORATOR_ACCOUNT_ROLES as readonly string[]).includes(user.role);
}

/** Owner, or an active EDITOR/ADMIN collaborator row. Reviewer assignment is a different path. */
/** SUPERADMIN edits any active book. Everyone else stays on the owner/collaborator scope. */
export async function participantWhere(client: PrismaClient | Prisma.TransactionClient, actorId: string): Promise<Prisma.BookWhereInput> {
  const user = await client.studioUser.findUnique({ where: { id: actorId }, select: { role: true, active: true } });
  if (user?.active && user.role === "SUPERADMIN") return {};
  return draftParticipantWhere(actorId);
}

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
      {
        parent: {
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
        OR EXISTS (
          SELECT 1 FROM "Book" parent
          INNER JOIN "BookCollaborator" c ON c."bookId" = parent.id
          INNER JOIN "StudioUser" u ON u.id = c."userId"
          WHERE parent.id = b."parentBookId"
            AND c."userId" = ${actorId}
            AND c."archivedAt" IS NULL
            AND c.role = 'EDITOR'
            AND u.active = true
            AND u.role IN ('EDITOR', 'ADMIN')
        )
        OR EXISTS (
          SELECT 1 FROM "Book" parent
          WHERE parent.id = b."parentBookId" AND parent."ownerId" = ${actorId}
        )
        OR EXISTS (
          SELECT 1 FROM "StudioUser" su
          WHERE su.id = ${actorId} AND su.role = 'SUPERADMIN' AND su.active = true
        )
      )
    FOR UPDATE OF b
  `;
  return rows[0] ?? null;
}

/** Owner lock, or an active superadmin managing someone else's book. */
export function managerLockSql(bookId: string, actorId: string) {
  return Prisma.sql`SELECT id FROM "Book" WHERE id = ${bookId} AND ("ownerId" = ${actorId} OR EXISTS (SELECT 1 FROM "StudioUser" su WHERE su.id = ${actorId} AND su.role = 'SUPERADMIN' AND su.active = true)) FOR UPDATE`;
}
