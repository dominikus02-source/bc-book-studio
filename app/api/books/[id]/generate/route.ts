import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../../lib/db";
import { authorized, deny } from "../../../../../lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  topic: z.string().trim().min(4).max(250),
  learningGoals: z.string().trim().min(10).max(2000),
  // optional override for this request only
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(req)) return deny();
  const { id } = await params;
  const book = await db.book.findUnique({ where: { id } });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  if (book.status !== "DRAFT") return NextResponse.json({ error: "Book must be a draft" }, { status: 409 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid generation request" }, { status: 400 });

  // Priority: request override > stored AiConfig > env
  const stored = await db.aiConfig.findUnique({ where: { id: "default" } });
  const apiKey = parsed.data.apiKey?.trim() || stored?.apiKey || process.env.AI_API_KEY;
  const model = parsed.data.model?.trim() || stored?.model || process.env.AI_MODEL;
  const endpoint = stored?.apiUrl || process.env.AI_API_URL || "https://api.openai.com/v1/chat/completions";

  if (!apiKey || !model) {
    return NextResponse.json({ error: "AI provider is not configured. Set it in Settings or environment." }, { status: 503 });
  }
  if (!endpoint.startsWith("https://")) {
    return NextResponse.json({ error: "AI endpoint must use HTTPS" }, { status: 503 });
  }

  const maxTokens = Math.min(3000, Math.max(300, Number(process.env.AI_MAX_OUTPUT_TOKENS) || 1800));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: "Anda asisten penulis buku pendidikan Indonesia. Tulis satu bab draf faktual, inklusif, sesuai tingkat kelas, dengan tujuan pembelajaran, penjelasan, contoh, latihan, dan referensi yang harus diperiksa editor. Jangan mengarang sumber. Jangan mengklaim naskah sudah tervalidasi.",
          },
          {
            role: "user",
            content: JSON.stringify({
              bookTitle: book.title,
              grade: book.grade,
              subject: book.subject,
              topic: parsed.data.topic,
              learningGoals: parsed.data.learningGoals,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "AI provider request failed" }, { status: 502 });
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) return NextResponse.json({ error: "AI returned empty content" }, { status: 502 });

    // Log usage
    const usage = payload.usage;
    if (usage?.total_tokens) {
      // Rough cost estimate (adjust per model; default ~ $0.002 / 1k tokens for many models)
      const estimatedCostUsd = (usage.total_tokens / 1000) * 0.002;
      await db.aiUsageLog.create({
        data: {
          bookId: id,
          model,
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          estimatedCostUsd,
        },
      }).catch(() => null); // don't fail generation if logging fails
    }

    return NextResponse.json(
      {
        draft: { title: parsed.data.topic, content },
        warning: "AI draft only. Verify facts, copyright, curriculum alignment and references before approval.",
        usage: usage ? { totalTokens: usage.total_tokens } : null,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "AI request timed out or failed" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
