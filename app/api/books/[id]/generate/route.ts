import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../../lib/db";
import { identity, deny } from "../../../../../lib/auth";
import { canGenerate, quotaDenied } from "../../../../../lib/usage";
import { activeProvider, invokeProvider } from "../../../../../lib/providers";
export const runtime = "nodejs";
const schema = z.object({ topic: z.string().trim().min(4).max(250), learningGoals: z.string().trim().min(10).max(2000) });
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await identity(req);
  if (!ownerId) return deny();
  const { id } = await params;
  const book = await db.book.findFirst({ where: { id, ownerId } });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  if (book.status !== "DRAFT") return NextResponse.json({ error: "Book must be a draft" }, { status: 409 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid generation request" }, { status: 400 });
  let provider;
  try { provider = await activeProvider(); }
  catch { return NextResponse.json({error:"Konfigurasi AI tidak dapat dibaca. Hubungi pengelola."},{status:503}); }
  if (!provider) return NextResponse.json({error:"Layanan AI belum diaktifkan pengelola. Penulisan manual tetap tersedia."},{status:503});
  if (!await canGenerate(ownerId)) return quotaDenied();
  const maxTokens = Math.min(3000, Math.max(300, Number(process.env.AI_MAX_OUTPUT_TOKENS) || 1800));
  try {
    const content = await invokeProvider(provider.provider, provider.model, provider.apiKey, [
      {role:"system",content:"Anda asisten penulis buku pendidikan Indonesia. Tulis satu bab draf faktual, inklusif, sesuai tingkat kelas, dengan tujuan pembelajaran, penjelasan, contoh, latihan, dan referensi yang harus diperiksa editor. Jangan mengarang sumber. Jangan mengklaim naskah sudah tervalidasi."},
      {role:"user",content:JSON.stringify({
        bookTitle:book.title,grade:book.grade,subject:book.subject,
        topic:parsed.data.topic,learningGoals:parsed.data.learningGoals
      })}
    ],{maxTokens,timeoutMs:45000});
    return NextResponse.json({
      draft:{title:parsed.data.topic,content},
      provider:{name:provider.provider,model:provider.model},
      warning:"AI draft only. Verify facts, copyright, curriculum alignment and references before approval."
    },{headers:{"Cache-Control":"no-store"}});
  } catch {
    // Never return raw provider errors or credentials.
    return NextResponse.json({error:"Gagal menghubungi model. Periksa API key, model, saldo, dan status penyedia."},{status:502});
  }
}
