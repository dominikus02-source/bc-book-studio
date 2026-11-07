import { createHash, randomBytes } from "node:crypto";
import type { Prisma, RevisionSource } from "@prisma/client";
import { blocksToPlainText, parseBlocks, type Block } from "./blocks";
import { db } from "./db";

type RevisionActor = { userId?: string; source: RevisionSource };
type RevisionInput = Block[] | { legacyText: string; title: string };

export class RevisionError extends Error {
  constructor(public readonly status: 404 | 409, message: string) {
    super(message);
  }
}

export function hashBlocks(blocks: readonly Block[]): string {
  const json = JSON.stringify(blocks, (_, value: unknown) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
  });
  return createHash("sha256").update(json).digest("hex");
}

export async function lockDraftBook(tx: Prisma.TransactionClient, bookId: string) {
  const [book] = await tx.$queryRaw<{ status: string }[]>`
    SELECT "status"::text FROM "Book" WHERE "id" = ${bookId} FOR UPDATE
  `;
  if (!book) throw new RevisionError(404, "Buku tidak ditemukan");
  if (book.status !== "DRAFT") throw new RevisionError(409, "Kembalikan buku ke draf sebelum mengubah bab");
}

export async function appendRevision(
  tx: Prisma.TransactionClient,
  chapterId: string,
  bookId: string,
  input: RevisionInput,
  actor: RevisionActor,
  expectedVersion?: number,
) {
  const chapter = await tx.chapter.findUnique({
    where: { id: chapterId, bookId },
    include: { currentRevision: true },
  });
  if (!chapter) throw new RevisionError(404, "Bab tidak ditemukan");

  const current = chapter.currentRevision;
  const version = current?.version ?? 0;
  if (expectedVersion !== undefined && expectedVersion !== version) {
    throw new RevisionError(409, "Bab telah berubah. Muat ulang sebelum menyimpan.");
  }

  const legacy = "legacyText" in input;
  const currentBlocks = current ? parseBlocks(current.blocks) : [];
  const previous = currentBlocks[0];
  if (legacy && current && (currentBlocks.length !== 1 || previous?.type !== "paragraph")) {
    throw new RevisionError(409, "Isi terstruktur harus disunting dengan editor blok.");
  }

  const blocks = legacy ? parseBlocks([{
    id: previous?.id ?? "c" + randomBytes(12).toString("hex"),
    type: "paragraph",
    text: input.legacyText,
  }]) : parseBlocks(input);
  const contentHash = hashBlocks(blocks);

  if (current?.contentHash === contentHash) {
    const updated = legacy && chapter.title !== input.title
      ? await tx.chapter.update({ where: { id: chapterId }, data: { title: input.title } })
      : chapter;
    return { chapter: updated, revision: current };
  }

  const revision = await tx.revision.create({
    data: { chapterId, version: version + 1, blocks, contentHash, authorId: actor.userId, source: actor.source },
  });
  const updated = await tx.chapter.update({
    where: { id: chapterId },
    data: {
      currentRevisionId: revision.id,
      content: legacy ? input.legacyText : blocksToPlainText(blocks),
      ...(legacy ? { title: input.title } : {}),
    },
  });
  return { chapter: updated, revision };
}

export async function saveRevision(
  chapterId: string,
  blocks: unknown,
  actor: RevisionActor,
  expectedVersion: number,
) {
  const parsed = parseBlocks(blocks);
  return db.$transaction(async (tx) => {
    const chapter = await tx.chapter.findUnique({ where: { id: chapterId }, select: { bookId: true } });
    if (!chapter) throw new RevisionError(404, "Bab tidak ditemukan");
    await lockDraftBook(tx, chapter.bookId);
    return (await appendRevision(tx, chapterId, chapter.bookId, parsed, actor, expectedVersion)).revision;
  });
}
