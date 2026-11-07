import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../app/api/books/[id]/chapters/route";
import { PUT } from "../app/api/books/[id]/chapters/[chapterId]/route";
import { parseBlocks } from "./blocks";
import { db } from "./db";
import { hashBlocks, saveRevision } from "./revisions";

vi.mock("./db", async (importOriginal) => {
  const url = process.env.REVISION_TEST_DATABASE_URL;
  if (!url) return importOriginal();
  const { PrismaClient } = await import("@prisma/client");
  return { db: new PrismaClient({ datasourceUrl: url }) };
});

const blockId = "c123456789012345678901234";
const first = { id: blockId, type: "paragraph" as const, text: "Teks pertama" };
const second = { ...first, id: "c223456789012345678901234", text: "Teks kedua" };

it("mengabaikan urutan properti JSON dan mempertahankan urutan blok dalam hash", () => {
  expect(hashBlocks([first])).toBe(hashBlocks([{ text: first.text, type: first.type, id: first.id }]));
  expect(hashBlocks([first, second])).not.toBe(hashBlocks([second, first]));
});

describe.skipIf(!process.env.REVISION_TEST_DATABASE_URL)("revisi bab di PostgreSQL", () => {
  let bookId: string;
  const token = "studio-test-token-for-revisions";
  const actor = { source: "human" } as const;
  const text = "Siswa membaca cerita rakyat Indonesia.";

  beforeAll(async () => {
    vi.stubEnv("STUDIO_API_KEY", token);
    const book = await db.book.create({ data: { title: "Buku uji revisi", grade: "7", subject: "Bahasa Indonesia" } });
    bookId = book.id;
  });

  afterAll(async () => {
    try {
      if (bookId) await db.book.delete({ where: { id: bookId } });
    } finally {
      await db.$disconnect();
      vi.unstubAllEnvs();
    }
  });

  function request(method: string, body: object) {
    return new NextRequest("http://localhost/api/books", {
      method,
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("membuat revisi pertama dan menolak salah satu dari dua PUT dengan versi sama", async () => {
    const create = await POST(request("POST", { title: "Cerita rakyat", content: text }), { params: Promise.resolve({ id: bookId }) });
    expect(create.status).toBe(201);
    const { chapter } = await create.json();
    const params = Promise.resolve({ id: bookId, chapterId: chapter.id });
    const responses = await Promise.all(["A", "B"].map((suffix) =>
      PUT(request("PUT", { title: "Cerita rakyat", content: text + " " + suffix, expectedVersion: 1 }), { params }),
    ));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);

    const saved = await db.chapter.findUniqueOrThrow({
      where: { id: chapter.id },
      include: { currentRevision: true, revisions: { orderBy: { version: "asc" } } },
    });
    expect(saved.revisions.map((revision) => revision.version)).toEqual([1, 2]);
    const original = parseBlocks(saved.revisions[0].blocks)[0];
    expect(original).toMatchObject({ type: "paragraph", text });
    const current = parseBlocks(saved.currentRevision?.blocks);
    expect(current[0]).toMatchObject({ id: original.id, text: saved.content });
    expect((await saveRevision(chapter.id, current, actor, 2)).id).toBe(saved.currentRevisionId);
    await expect(saveRevision(chapter.id, current, actor, 1)).rejects.toMatchObject({ status: 409 });
    await expect(saveRevision(chapter.id, [{ id: blockId, type: "image", assetId: "gambar" }], actor, 2)).rejects.toThrow();
    expect(await db.revision.count({ where: { chapterId: chapter.id } })).toBe(2);
  });

  it("menolak penyimpanan revisi setelah buku masuk REVIEW", async () => {
    const chapter = await db.chapter.create({ data: { bookId, title: "Uji kunci", position: 99, content: text } });
    await db.book.update({ where: { id: bookId }, data: { status: "REVIEW" } });
    await expect(saveRevision(chapter.id, [first], actor, 0)).rejects.toMatchObject({ status: 409 });
    expect(await db.revision.count({ where: { chapterId: chapter.id } })).toBe(0);
  });
});
