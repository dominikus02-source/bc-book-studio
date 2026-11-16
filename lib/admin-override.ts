import type { Prisma, PrismaClient } from "@prisma/client";

/** Note prefix stored on Review rows when a superadmin acts on a book they do not own. */
export function adminOverrideNote(actor: { id: string; role: string }, ownerId: string, note: string) {
  if (actor.role === "SUPERADMIN" && actor.id !== ownerId) return "admin-override " + note;
  return note;
}

export async function overrideNoteFor(client: PrismaClient | Prisma.TransactionClient, actorId: string, ownerId: string, note: string) {
  const user = await client.studioUser.findUnique({ where: { id: actorId }, select: { role: true, active: true } });
  return adminOverrideNote({ id: actorId, role: user?.active ? user.role : "" }, ownerId, note);
}
