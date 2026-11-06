import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../../lib/db";
import { identity, deny } from "../../../../../lib/auth";
import { canGenerate, quotaDenied } from "../../../../../lib/usage";
import { activeProvider, invokeProvider } from "../../../../../lib/providers";
export const runtime = "nodejs";
const schema = z.object({
  topic: z.string().trim().min(4).max(250),
  learningGoals: z.string().trim().min(10).max(2000),
  providerCredentialId: z.string().trim().min(1).max(80).optional(),
  bookType: z.enum(["FICTION","NONFICTION"]).default("NONFICTION"),
  genre: z.string().trim().max(80).default(""),
  targetAudience: z.string().trim().max(120).default("")
}).strict();
const dailyTokenLimit=()=>{const n=Number(process.env.STUDIO_DAILY_TOKEN_LIMIT);return Number.isInteger(n)&&n>0?Math.min(2_000_000,n):50000};
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await identity(req);
  if (!ownerId) return deny();
  const { id } = await params;
  const book = await db.book.findFirst({ where: { id, ownerId } });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  if (book.status !== "DRAFT") return NextResponse.json({ error: "Book must be a draft" }, { status: 409 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Permintaan penulisan tidak valid." }, { status: 400 });
  let provider;
  try { provider = await activeProvider(parsed.data.providerCredentialId); }
  catch { return NextResponse.json({error:"Konfigurasi AI tidak dapat dibaca. Hubungi pengelola."},{status:503}); }
  if (!provider) return NextResponse.json({error:"Model pilihan tidak tersedia. Pilih model lain atau hubungi pengelola."},{status:404});
  if (!await canGenerate(ownerId)) return quotaDenied();

  const today=new Date().toISOString().slice(0,10);
  const dailyLimit=dailyTokenLimit();
  const current=await db.usageEvent.aggregate({where:{userId:ownerId,createdAt:{gte:new Date(today+"T00:00:00.000Z")}},_sum:{totalTokens:true}});
  const used=current._sum.totalTokens??0;
  const remaining=Math.max(0,dailyLimit-used);
  if(remaining<64)return quotaDenied();
  const maxTokens=Math.min(provider.maxTokens,Number(process.env.AI_MAX_OUTPUT_TOKENS)||3000,remaining);
  const type=parsed.data.bookType;
  const system=type==="FICTION"
    ? "Anda editor dan penulis fiksi berbahasa Indonesia. Tulis satu bab cerita yang orisinal, koheren dengan premis dan genre, memiliki adegan konkret, karakter konsisten, konflik berkembang, dialog alami, serta akhir bab yang mendorong kelanjutan. Hindari meniru gaya penulis hidup. Jangan menyatakan naskah sudah lolos penyuntingan."
    : "Anda asisten penulis buku nonfiksi berbahasa Indonesia. Tulis satu bab yang jelas, akurat, sesuai pembaca, terstruktur dengan tujuan dan contoh. Tandai klaim yang perlu sumber; jangan mengarang referensi atau menyatakan fakta telah diverifikasi editor.";
  try {
    const result = await invokeProvider(provider.provider, provider.model, provider.apiKey, [
      {role:"system",content:system},
      {role:"user",content:JSON.stringify({
        bookTitle:book.title,bookType:type,genre:parsed.data.genre,
        targetAudience:parsed.data.targetAudience||book.grade,subject:book.subject,
        topic:parsed.data.topic,learningGoals:parsed.data.learningGoals
      })}
    ],{maxTokens,temperature:provider.temperature,timeoutMs:45000});
    await db.usageEvent.create({data:{
      userId:ownerId,credentialId:provider.id,provider:provider.provider,model:provider.model,
      inputTokens:result.usage.inputTokens,outputTokens:result.usage.outputTokens,
      totalTokens:result.usage.totalTokens,estimated:result.usage.estimated
    }});
    return NextResponse.json({
      draft:{title:parsed.data.topic,content:result.content},
      provider:{credentialId:provider.id,name:provider.provider,model:provider.model},
      usage:{...result.usage,remainingTokens:Math.max(0,remaining-result.usage.totalTokens),dailyLimit},
      warning:"Draf AI. Periksa fakta atau orisinalitas, kesesuaian pembaca, hak cipta, dan kualitas editorial sebelum menyetujui."
    },{headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:"Gagal menghubungi model. Periksa konfigurasi API, kuota, dan penagihan provider."},{status:502});
  }
}
