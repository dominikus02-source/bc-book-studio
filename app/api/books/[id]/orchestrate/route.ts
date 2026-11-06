import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../../../lib/db";
import { identity, deny } from "../../../../../lib/auth";
import { canGenerate, quotaDenied } from "../../../../../lib/usage";
import { activeProvider, invokeProvider } from "../../../../../lib/providers";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await identity(req);
  if (!ownerId) return deny();

  const { id } = await params;
  const book = await db.book.findFirst({ where: { id, ownerId }, include: { chapters: true } });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  if (book.status !== "DRAFT") return NextResponse.json({ error: "Only draft books can be orchestrated" }, { status: 409 });
  if (book.chapters.length > 0) return NextResponse.json({ error: "Book already has chapters. Clear them first or use chapter generation." }, { status: 409 });

  let provider;
  try { provider = await activeProvider(); }
  catch { return NextResponse.json({ error: "Konfigurasi AI tidak dapat dibaca." }, { status: 503 }); }
  if (!provider) return NextResponse.json({ error: "Layanan AI belum diaktifkan pengelola." }, { status: 503 });
  if (!await canGenerate(ownerId)) return quotaDenied();

  const brief = book.description || `Judul: ${book.title}\nKelas: ${book.grade}\nMata pelajaran: ${book.subject}`;

  const results: { step: string; status: string; detail?: string }[] = [];

  try {
    // Step 1: Outline / Structure (Chief Editor + Author)
    results.push({ step: "outline", status: "running" });
    const outlineRaw = await invokeProvider(provider.provider, provider.model, provider.apiKey, [
      {
        role: "system",
        content: `Anda Pemimpin Redaksi dan Penulis senior di BC Book Studio.\nTugas: dari brief/prompt produksi di bawah, buat kerangka buku yang jelas.\nKeluarkan HANYA JSON valid dengan format:\n{\n  "titleSuggestion": "judul yang lebih baik jika perlu",\n  "chapters": [\n    { "position": 1, "title": "Judul Bab 1", "summary": "Ringkasan 1-2 kalimat apa yang dibahas", "learningGoals": "Tujuan pembelajaran" }\n  ]\n}\nBuat 4-8 bab. Jangan mengarang sumber. Fokus pada pendidikan Indonesia.`
      },
      { role: "user", content: brief }
    ], { maxTokens: 2000, timeoutMs: 60000 });

    let outline: { titleSuggestion?: string; chapters: { position: number; title: string; summary: string; learningGoals?: string }[] };
    try {
      const jsonMatch = outlineRaw.match(/\{[\s\S]*\}/);
      outline = JSON.parse(jsonMatch ? jsonMatch[0] : outlineRaw);
      if (!Array.isArray(outline.chapters) || outline.chapters.length === 0) throw new Error("invalid outline");
    } catch {
      results[results.length - 1] = { step: "outline", status: "failed", detail: "Gagal parse outline" };
      return NextResponse.json({ error: "Gagal menghasilkan kerangka buku", results }, { status: 502 });
    }
    results[results.length - 1] = { step: "outline", status: "done", detail: `${outline.chapters.length} bab` };

    // Optional: update title if suggested
    if (outline.titleSuggestion && outline.titleSuggestion.trim() && outline.titleSuggestion !== book.title) {
      await db.book.update({ where: { id }, data: { title: outline.titleSuggestion.trim() } });
    }

    // Step 2: Generate each chapter (Author agent)
    const created: { position: number; title: string }[] = [];
    for (const ch of outline.chapters.slice(0, 8)) {
      results.push({ step: `chapter-${ch.position}`, status: "running", detail: ch.title });
      const chapterContent = await invokeProvider(provider.provider, provider.model, provider.apiKey, [
        {
          role: "system",
          content: `Anda Penulis buku pendidikan Indonesia di BC Book Studio.\nTulis draf bab yang faktual, inklusif, sesuai tingkat kelas, dengan tujuan pembelajaran, penjelasan, contoh, dan latihan singkat.\nJangan mengarang sumber. Tandai bagian yang perlu dicek editor.\nFormat: teks biasa, judul bab di baris pertama.`
        },
        {
          role: "user",
          content: JSON.stringify({
            bookTitle: outline.titleSuggestion || book.title,
            grade: book.grade,
            subject: book.subject,
            chapterTitle: ch.title,
            chapterSummary: ch.summary,
            learningGoals: ch.learningGoals || "Sesuai brief",
            overallBrief: brief.slice(0, 1500)
          })
        }
      ], { maxTokens: 2500, timeoutMs: 90000 });

      await db.chapter.create({
        data: {
          bookId: id,
          position: ch.position,
          title: ch.title,
          content: chapterContent.trim()
        }
      });
      created.push({ position: ch.position, title: ch.title });
      results[results.length - 1] = { step: `chapter-${ch.position}`, status: "done" };
    }

    return NextResponse.json({
      ok: true,
      message: `Orkestrasi selesai. ${created.length} bab dibuat oleh agen Penulis.`,
      chapters: created,
      results
    });
  } catch (err) {
    console.error("Orchestrate error", err);
    return NextResponse.json({
      error: "Orkestrasi gagal di tengah jalan. Beberapa bab mungkin sudah tersimpan.",
      results
    }, { status: 502 });
  }
}
