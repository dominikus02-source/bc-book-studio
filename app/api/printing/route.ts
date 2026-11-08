import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionUser, deny } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";
const statuses = ["DRAFT", "QUOTED", "APPROVED", "IN_PRODUCTION", "COMPLETED", "CANCELLED"] as const;
const inputSchema = z.object({
  bookId: z.string().min(1),
  printerName: z.string().trim().max(160).default(""),
  contact: z.string().trim().max(160).default(""),
  quantity: z.number().int().min(1).max(100000),
  paper: z.string().trim().min(1).max(80),
  binding: z.string().trim().min(1).max(80),
  color: z.enum(["BW", "COLOR", "MIXED"]),
  size: z.string().trim().min(1).max(60),
  unitPrice: z.number().finite().min(0).max(1e9),
  dueDate: z.string().refine(s => !s || /^\d{4}-\d{2}-\d{2}$/.test(s), "Format tanggal tidak valid").default(""),
  notes: z.string().max(3000).default(""),
  status: z.enum(statuses).default("DRAFT"),
});
const transitions: Record<(typeof statuses)[number], readonly string[]> = {
  DRAFT: ["DRAFT", "QUOTED", "CANCELLED"],
  QUOTED: ["QUOTED", "DRAFT", "APPROVED", "CANCELLED"],
  APPROVED: ["APPROVED", "QUOTED", "IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["IN_PRODUCTION", "COMPLETED", "CANCELLED"],
  COMPLETED: ["COMPLETED"],
  CANCELLED: ["CANCELLED", "DRAFT"],
};
function error(e: unknown) {
  return NextResponse.json({ error: e instanceof z.ZodError ? e.issues.map(i => i.message).join("; ") : "Permintaan tidak dapat diproses." }, { status: 400 });
}
async function findBook(bookId: string, ownerId: string) {
  return db.book.findFirst({
    where: { id: bookId, ownerId, archivedAt: null },
    select: { id: true, title: true, author: true, pageSize: true, editorialStage: true, status: true, pagination: { select: { version: true, updatedAt: true } }, publication: { select: { unpublishedAt: true, publishedAt: true } } },
  });
}
export async function GET(req: NextRequest) {
  const user = await sessionUser(req); if (!user) return deny();
  const bookId = req.nextUrl.searchParams.get("bookId");
  const books = await db.book.findMany({ where: { ownerId: user.id, archivedAt: null }, select: { id: true, title: true, author: true, pageSize: true, editorialStage: true, status: true, pagination: { select: { version: true, updatedAt: true } }, publication: { select: { unpublishedAt: true, publishedAt: true } } } });
  const permittedIds = new Set(books.map(book => book.id));
  const rows = await db.studioFormDraft.findMany({ where: { ownerId: user.id, module: "PRINT_ORDER" }, orderBy: { updatedAt: "desc" }, take: 500 });
  const orders = rows.map(row => ({ id: row.id, title: row.title, ...(row.payload as object), updatedAt: row.updatedAt })).filter(row => {
    const id = (row as {bookId?:string}).bookId;
    return id && permittedIds.has(id) && (!bookId || id === bookId);
  });
  return NextResponse.json({ orders, books }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  const user = await sessionUser(req); if (!user) return deny();
  try {
    const data = inputSchema.parse(await req.json());
    const book = await findBook(data.bookId, user.id);
    if (!book) return NextResponse.json({ error: "Buku tidak ditemukan atau bukan milik Anda." }, { status: 403 });
    if (data.status !== "DRAFT") return NextResponse.json({ error: "Pesanan baru harus dimulai dari status Draf." }, { status: 409 });
    const row = await db.studioFormDraft.create({ data: { ownerId: user.id, module: "PRINT_ORDER", title: book.title, payload: data } });
    return NextResponse.json({ order: { id: row.id, title: row.title, ...data, updatedAt: row.updatedAt } }, { status: 201 });
  } catch (e) { return error(e); }
}
export async function PATCH(req: NextRequest) {
  const user = await sessionUser(req); if (!user) return deny();
  try {
    const body = await req.json();
    const id = z.string().min(1).parse(body.id);
    const old = await db.studioFormDraft.findFirst({ where: { id, ownerId: user.id, module: "PRINT_ORDER" } });
    if (!old) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    const saved = inputSchema.parse(old.payload);
    const book = await findBook(saved.bookId, user.id);
    if (!book) return NextResponse.json({ error: "Buku terkait tidak tersedia." }, { status: 403 });
    const data = inputSchema.parse({ ...saved, ...body, bookId: saved.bookId });
    if (!transitions[saved.status].includes(data.status)) return NextResponse.json({ error: "Perubahan status tidak sesuai alur produksi." }, { status: 409 });
    if (["APPROVED", "IN_PRODUCTION", "COMPLETED"].includes(data.status) && (!data.printerName || !data.contact || data.unitPrice <= 0 || !data.dueDate)) return NextResponse.json({ error: "Persetujuan/produksi membutuhkan mitra, kontak, harga, dan tanggal selesai." }, { status: 422 });
    const row = await db.studioFormDraft.update({ where: { id }, data: { title: book.title, payload: data } });
    return NextResponse.json({ order: { id: row.id, title: row.title, ...data, updatedAt: row.updatedAt } });
  } catch (e) { return error(e); }
}
export async function DELETE(req: NextRequest) {
  const user = await sessionUser(req); if (!user) return deny();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400 });
  const row = await db.studioFormDraft.findFirst({ where: { id, ownerId: user.id, module: "PRINT_ORDER" } });
  if (!row) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
  const saved = inputSchema.safeParse(row.payload);
  if (saved.success && ["IN_PRODUCTION", "COMPLETED"].includes(saved.data.status)) return NextResponse.json({ error: "Pesanan dalam produksi atau selesai tidak dapat dihapus. Simpan sebagai arsip operasional." }, { status: 409 });
  await db.studioFormDraft.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
