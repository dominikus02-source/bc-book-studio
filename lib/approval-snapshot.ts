import { z } from "zod";
import {packageSchema} from "./publishing-package";
import type { Prisma } from "@prisma/client";

const assetReference = /!\[[^\]]{1,200}\]\(asset:([a-z0-9]{6,100})\)/g;

export function referencedAssets(chapters: { content: string }[]) {
  return [...new Set(chapters.flatMap(({ content }) =>
    [...content.matchAll(assetReference)].map(match => match[1])
  ))];
}

export const snapshotSchema = z.object({
  schemaVersion: z.literal(2),
  language: z.string().min(2),
  publishingPackage: packageSchema,
  title: z.string(), author: z.string(), subject: z.string(), grade: z.string(),
  description: z.string(), bookType: z.string(), genre: z.string(), pageSize: z.string(),
  chapters: z.array(z.object({
    title: z.string(), content: z.string(), position: z.number().int(),
  })).min(1),
  assets: z.array(z.object({
    id: z.string(), mime: z.string(), data: z.string(), altText: z.string(),
    license: z.string(), sourceUrl: z.string().nullable(),
  })),
});

export async function approvedManuscript(
  tx: Prisma.TransactionClient, book: { id: string; approvedAt: Date | null },
) {
  if (!book.approvedAt) return null;
  const record = await tx.bookApprovalSnapshot.findUnique({
    where: { bookId_approvedAt: { bookId: book.id, approvedAt: book.approvedAt } },
  });
  const parsed = snapshotSchema.safeParse(record?.manuscript);
  return parsed.success ? { ...parsed.data, id: book.id } : null;
}
