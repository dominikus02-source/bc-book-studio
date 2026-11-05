import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../../lib/db";
import { authorized, deny } from "../../../../../lib/auth";
import { askProvider, preferredProvider } from "../../../../../lib/ai-providers";

export const runtime = "nodejs";
const schema = z.object({
  topic: z.string().trim().min(4).max(250),
  learningGoals: z.string().trim().min(10).max(2000),
  providerId: z.string().uuid().optional()
});
const system = "Anda asisten penulis buku pendidikan Indonesia. Tulis satu bab draf faktual, inklusif, sesuai tingkat kelas, dengan tujuan pembelajaran, penjelasan, contoh, latihan, dan referensi yang harus diperiksa editor. Jangan mengarang sumber. Jangan mengklaim naskah sudah tervalidasi.";
const warning = "AI draft only. Verify facts, copyright, curriculum alignment and references before approval.";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorized(req))) return deny();
  const { id } = await params;
  const book = await db.book.findUnique({ where: { id } });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  if (book.status !== "DRAFT") return NextResponse.json({ error: "Book must be a draft" }, { status: 409 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid generation request" }, { status: 400 });
  const { topic, learningGoals, providerId } = parsed.data;
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: JSON.stringify({
      bookTitle: book.title, grade: book.grade, subject: book.subject, topic, learningGoals
    }) }
  ];
  try {
    // User-selected or default enabled DB configuration takes priority over legacy env.
    const provider = await preferredProvider(providerId);
    if (providerId && !provider) return NextResponse.json({ error: "AI provider not enabled or not found" }, { status: 409 });
    if (provider) {
      const content = await askProvider(provider, messages);
      return NextResponse.json({
        draft: { title: topic, content },
        provider: { id: provider.id, label: provider.label, model: provider.model },
        warning
      }, { headers: { "Cache-Control": "no-store" } });
    }
    // Compatibility with existing deployments until an administrator enters API keys.
    const apiKey = process.env.AI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Configure an AI provider in Settings before generating a book." }, { status: 503 });
    const model = process.env.AI_MODEL || "deepseek-flash";
    const endpoint = process.env.AI_API_URL || "https://api.deepseek.com/chat/completions";
    if (endpoint !== "https://api.deepseek.com/chat/completions") {
      return NextResponse.json({ error: "Legacy endpoint is not allowed; configure a provider in Settings." }, { status: 503 });
    }
    const response = await fetch(endpoint, {
      method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(45000),
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
      body: JSON.stringify({ model, messages, max_tokens: 1800, temperature: 0.4 })
    });
    if (!response.ok) throw new Error("AI_PROVIDER_FAILURE");
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error("AI_PROVIDER_EMPTY_RESPONSE");
    return NextResponse.json({ draft: { title: topic, content }, warning }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Never expose provider error bodies, API keys, or prompts to the caller.
    return NextResponse.json({ error: "AI provider request failed. Check the configured key, model, billing or provider status." }, { status: 502 });
  }
}
