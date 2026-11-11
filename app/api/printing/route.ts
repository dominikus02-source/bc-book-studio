import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionUser, deny } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" } as const;
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
  return NextResponse.json({ error: e instanceof z.ZodError ? e.issues.map(i => i.message).join("; ") : "Permintaan tidak dapat diproses." }, { status: 400, headers: noStore });
}
function conflict() {
  return NextResponse.json({ error: "Pesanan sudah berubah. Muat ulang dan periksa perubahan terbaru." }, { status: 409, headers: noStore });
}
function sameInstant(expected: string | undefined, actual: Date) {
  if (!expected) return true;
  const parsed = Date.parse(expected);
  return Number.isFinite(parsed) && parsed === actual.getTime();
}
function asOrder(row: {
  id: string;
  bookId: string;
  printerName: string;
  contact: string;
  quantity: number;
  paper: string;
  binding: string;
  color: string;
  size: string;
  unitPrice: number;
  dueDate: string;
  notes: string;
  status: string;
  updatedAt: Date;
  book: { title: string };
}) {
  return {
    id: row.id,
    bookId: row.bookId,
    printerName: row.printerName,
    contact: row.contact,
    quantity: row.quantity,
    paper: row.paper,
    binding: row.binding,
    color: row.color,
    size: row.size,
    unitPrice: row.unitPrice,
    dueDate: row.dueDate,
    notes: row.notes,
    status: row.status,
    title: row.book.title,
    updatedAt: row.updatedAt,
  };
}
async function findBook(bookId: string, ownerId: string) {
  return db.book.findFirst({
    where: { id: bookId, ownerId, archivedAt: null },
    select: { id: true, title: true, author: true, pageSize: true, editorialStage: true, status: true, pagination: { select: { version: true, updatedAt: true } }, publication: { select: { unpublishedAt: true, publishedAt: true } } },
  });
}
function toRecord(data: z.infer<typeof inputSchema>) {
  return {
    bookId: data.bookId,
    printerName: data.printerName,
    contact: data.contact,
    quantity: data.quantity,
    paper: data.paper,
    binding: data.binding,
    color: data.color,
    size: data.size,
    unitPrice: Math.round(data.unitPrice),
    dueDate: data.dueDate,
    notes: data.notes,
    status: data.status,
  };
}

export async function GET(req: NextRequest) {
  const user = await sessionUser(req); if (!user) return deny();
  const bookId = req.nextUrl.searchParams.get("bookId");
  const books = await db.book.findMany({
    where: { ownerId: user.id, archivedAt: null },
    select: { id: true, title: true, author: true, pageSize: true, editorialStage: true, status: true, pagination: { select: { version: true, updatedAt: true } }, publication: { select: { unpublishedAt: true, publishedAt: true } } },
  });
  const rows = await db.printOrder.findMany({
    where: { ownerId: user.id, archivedAt: null, ...(bookId ? { bookId } : {}) },
    include: { book: { select: { title: true } } },
    orderBy: { updatedAt: "desc" },
    take: 500,
  });
  const permitted = new Set(books.map(book => book.id));
  const orders = rows.filter(row => permitted.has(row.bookId)).map(asOrder);
  return NextResponse.json({ orders, books }, { headers: noStore });
}

export async function POST(req: NextRequest) {
  const user = await sessionUser(req); if (!user) return deny();
  try {
    const data = inputSchema.parse(await req.json());
    const book = await findBook(data.bookId, user.id);
    if (!book) return NextResponse.json({ error: "Buku tidak ditemukan atau bukan milik Anda." }, { status: 403, headers: noStore });
    if (data.status !== "DRAFT") return NextResponse.json({ error: "Pesanan baru harus dimulai dari status Draf." }, { status: 409, headers: noStore });
    const row = await db.printOrder.create({
      data: { ownerId: user.id, ...toRecord(data) },
      include: { book: { select: { title: true } } },
    });
    return NextResponse.json({ order: asOrder(row) }, { status: 201, headers: noStore });
  } catch (e) { return error(e); }
}

export async function PATCH(req: NextRequest) {
  const user = await sessionUser(req); if (!user) return deny();
  try {
    const body = await req.json();
    const id = z.string().min(1).parse(body.id);
    const old = await db.printOrder.findFirst({ where: { id, ownerId: user.id, archivedAt: null } });
    if (!old) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404, headers: noStore });
    if (!sameInstant(z.string().datetime().optional().parse(body.expectedUpdatedAt), old.updatedAt)) return conflict();
    const book = await findBook(old.bookId, user.id);
    if (!book) return NextResponse.json({ error: "Buku terkait tidak tersedia." }, { status: 403, headers: noStore });
    const current = inputSchema.parse({
      bookId: old.bookId,
      printerName: old.printerName,
      contact: old.contact,
      quantity: old.quantity,
      paper: old.paper,
      binding: old.binding,
      color: old.color,
      size: old.size,
      unitPrice: old.unitPrice,
      dueDate: old.dueDate,
      notes: old.notes,
      status: old.status,
    });
    const data = inputSchema.parse({ ...current, ...body, bookId: old.bookId });
    if (!transitions[current.status].includes(data.status)) return NextResponse.json({ error: "Perubahan status tidak sesuai alur produksi." }, { status: 409, headers: noStore });
    if (["APPROVED", "IN_PRODUCTION", "COMPLETED"].includes(data.status) && (!data.printerName || !data.contact || data.unitPrice <= 0 || !data.dueDate)) {
      return NextResponse.json({ error: "Persetujuan/produksi membutuhkan mitra, kontak, harga, dan tanggal selesai." }, { status: 422, headers: noStore });
    }
    const row = await db.printOrder.update({
      where: { id: old.id, updatedAt: old.updatedAt },
      data: toRecord(data),
      include: { book: { select: { title: true } } },
    });
    return NextResponse.json({ order: asOrder(row) }, { headers: noStore });
  } catch (e) {
    if (typeof e === "object" && e && "code" in e && e.code === "P2025") return conflict();
    return error(e);
  }
}

export async function DELETE(req: NextRequest) {
  const user = await sessionUser(req); if (!user) return deny();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID wajib diisi." }, { status: 400, headers: noStore });
  const row = await db.printOrder.findFirst({ where: { id, ownerId: user.id, archivedAt: null } });
  if (!row) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404, headers: noStore });
  const expected = req.nextUrl.searchParams.get("expectedUpdatedAt") || undefined;
  if (!sameInstant(expected, row.updatedAt)) return conflict();
  if (["IN_PRODUCTION", "COMPLETED"].includes(row.status)) {
    return NextResponse.json({ error: "Pesanan dalam produksi atau selesai tidak dapat dihapus. Simpan sebagai arsip operasional." }, { status: 409, headers: noStore });
  }
  const archived = await db.printOrder.updateMany({
    where: { id, ownerId: user.id, archivedAt: null, updatedAt: row.updatedAt },
    data: { archivedAt: new Date() },
  });
  if (!archived.count) return conflict();
  return NextResponse.json({ deleted: true }, { headers: noStore });
}
