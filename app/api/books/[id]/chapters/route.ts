import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../../lib/db";
import { identity, deny } from "../../../../../lib/auth";
import { chapterInput, badInput } from "../../../../../lib/validation";
export const runtime = "nodejs";
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await identity(req);
  if (!ownerId) return deny();
  const {id}=await params;
  const book=await db.book.findFirst({
    where:{id,ownerId,archivedAt:null},select:{chapters:{
      where:{archivedAt:{not:null}}, orderBy:{archivedAt:"desc"},
      select:{id:true,title:true,outlineObjective:true,archivedAt:true,updatedAt:true},
    }},
  });
  return book ? NextResponse.json({archived:book.chapters},{headers:{"Cache-Control":"no-store"}})
    : NextResponse.json({error:"Book not found"},{status:404});
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await identity(req);
  if (!ownerId) return deny();
  try {
    const { id } = await params;
    const outline = z.object({title:z.string().trim().min(2).max(180),outlineObjective:z.string().trim().min(1).max(1500)}).strict();
    const input = z.union([outline,chapterInput]).parse(await req.json());
    const chapter = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${ownerId} FOR UPDATE`;
      const book = await tx.book.findFirst({ where: { id, ownerId, archivedAt:null }, include: { chapters: { where:{archivedAt:null}, orderBy: { position: "desc" }, take: 1 } } });
      if (!book) throw new Error("NOT_FOUND");
      if (book.status !== "DRAFT") throw new Error("LOCKED");
      if("outlineObjective" in input && !["OUTLINE","WRITING","EDITING"].includes(book.editorialStage))throw new Error("LOCKED");
      return tx.chapter.create({ data: { bookId: id, position: (book.chapters[0]?.position ?? 0) + 1, content:"", ...input } });
    });
    return NextResponse.json({ chapter }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    return NextResponse.json(msg === "NOT_FOUND" ? { error: "Book not found" } : msg === "LOCKED" ? { error: "Return book to draft before editing" } : badInput(error), { status: msg === "NOT_FOUND" ? 404 : msg === "LOCKED" ? 409 : 400 });
  }
}
