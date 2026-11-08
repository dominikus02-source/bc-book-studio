/**
 * BC Editorial Review Agent
 * Multi-agent editorial review foundation that uses the existing provider orchestrator.
 * Findings are structured recommendations only; human reviewer must accept/reject/edit before any decision.
 */
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { activeProvider, invokeProvider } from "./providers";
import { recordAiUsage } from "./ai-usage";

export const reviewFocus = z.enum([
  "GENERAL",
  "STRUCTURAL",
  "LANGUAGE",
  "SUBJECT_MATTER",
  "CITATION",
  "ACCESSIBILITY"
]);

export type ReviewFocus = z.infer<typeof reviewFocus>;

export const findingSchema = z.object({
  category: z.enum(["CONTENT", "FACT", "CITATION", "LANGUAGE", "ACCESSIBILITY", "COPYRIGHT", "PEDAGOGY", "STRUCTURE"]),
  severity: z.enum(["CRITICAL", "MAJOR", "MINOR", "SUGGESTION"]),
  location: z.string().max(300).optional(),
  chapterTitle: z.string().max(200).optional(),
  excerpt: z.string().max(500).optional(),
  issue: z.string().min(5).max(2000),
  recommendation: z.string().min(5).max(2000),
  confidence: z.number().min(0).max(1).optional(),
  sourceAgent: z.string().max(80)
}).strict();

export type Finding = z.infer<typeof findingSchema>;

export const agentResultSchema = z.object({
  agent: z.string(),
  summary: z.string().max(1000),
  findings: z.array(findingSchema).max(40)
}).strict();

const systemPrompts: Record<ReviewFocus, string> = {
  GENERAL: "Anda adalah BC Editorial Review Agent. Lakukan review editorial profesional. Buat temuan berbasis kutipan naskah nyata. Jangan mengarang fakta atau referensi. Jangan menyatakan naskah disetujui. Tandai klaim yang butuh verifikasi manusia.",
  STRUCTURAL: "Anda Structural Reviewer. Periksa struktur buku, urutan bab, kelengkapan bagian, dan konsistensi outline. Temuan harus merujuk ke judul bab atau bagian yang ada.",
  LANGUAGE: "Anda Language Editor untuk bahasa Indonesia. Periksa ejaan, tata bahasa, konsistensi istilah, dan keterbacaan sesuai kaidah editorial. Kutip potongan singkat dari naskah.",
  SUBJECT_MATTER: "Anda Subject-Matter Reviewer. Tinjau ketepatan konsep berdasarkan konten yang tersedia. Tandai setiap klaim yang memerlukan verifikasi pakar. Jangan mengarang sumber.",
  CITATION: "Anda Citation & Integrity Reviewer. Periksa konsistensi kutipan dan referensi yang terlihat di naskah. Jangan menyatakan plagiarisme terbukti. Tandai sumber yang tampak tidak lengkap atau tidak dapat diverifikasi.",
  ACCESSIBILITY: "Anda Accessibility & Readability Reviewer. Periksa heading, struktur, alt text yang disebutkan, keterbacaan, dan kebutuhan pembaca dengan kemampuan berbeda."
};

export async function runEditorialAgent(
  focus: ReviewFocus,
  context: {
    title: string;
    grade?: string | null;
    subject?: string | null;
    chapters: { title: string; content: string }[];
  },
  options: { actorId: string; maxChapters?: number } 
) {
  const provider = await activeProvider().catch(() => null);
  if (!provider) throw new Error("AI_PROVIDER_UNAVAILABLE");

  const maxChapters = options.maxChapters ?? 8;
  const payload = {
    focus,
    title: context.title,
    grade: context.grade ?? undefined,
    subject: context.subject ?? undefined,
    chapters: context.chapters.slice(0, maxChapters).map(c => ({
      title: c.title,
      content: c.content.slice(0, 8000)
    }))
  };

  const raw = await invokeProvider(
    provider.provider,
    provider.model,
    provider.apiKey,
    [
      { role: "system", content: systemPrompts[focus] + "\n\nKembalikan HANYA JSON valid dengan bentuk: {\"summary\": \"findings\": \"agent\"}. Setiap finding wajib punya category, severity, issue, recommendation, sourceAgent." },
      { role: "user", content: JSON.stringify(payload) }
    ],
    {
      maxTokens: 2000,
      timeoutMs: 50000,
      onUsage: usage => recordAiUsage({
        credentialId: provider.id,
        provider: provider.provider,
        model: provider.model,
        purpose: "REVIEW",
        actorId: options.actorId,
        usage
      })
    }
  );

  // Best-effort parse; never invent findings if parse fails
  let parsed: unknown;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw);
  } catch {
    return {
      agent: focus,
      summary: "Model mengembalikan teks yang tidak dapat di-parse sebagai JSON. Gunakan sebagai saran manual.",
      findings: [] as Finding[],
      raw
    };
  }

  const result = agentResultSchema.safeParse({
    agent: (parsed as any)?.agent || focus,
    summary: (parsed as any)?.summary || "Ringkasan tidak tersedia",
    findings: Array.isArray((parsed as any)?.findings) ? (parsed as any).findings : []
  });

  if (!result.success) {
    return {
      agent: focus,
      summary: "Hasil AI tidak memenuhi skema temuan. Periksa manual.",
      findings: [] as Finding[],
      raw
    };
  }

  return { ...result.data, raw };
}

export async function runEditorialOrchestrator(
  context: {
    title: string;
    grade?: string | null;
    subject?: string | null;
    chapters: { title: string; content: string }[];
  },
  options: { actorId: string }
) {
  const focuses: ReviewFocus[] = ["STRUCTURAL", "LANGUAGE", "SUBJECT_MATTER", "CITATION", "ACCESSIBILITY"];
  const results = [];
  for (const focus of focuses) {
    try {
      const r = await runEditorialAgent(focus, context, options);
      results.push(r);
    } catch (e) {
      results.push({
        agent: focus,
        summary: e instanceof Error && e.message === "AI_PROVIDER_UNAVAILABLE"
          ? "Provider AI belum aktif"
          : "Agent gagal dijalankan",
        findings: [] as Finding[]
      });
    }
  }

  // Deduplicate roughly by issue text
  const seen = new Set<string>();
  const merged: Finding[] = [];
  for (const r of results) {
    for (const f of r.findings) {
      const key = (f.chapterTitle || "") + "|" + f.issue.slice(0, 120);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(f);
      }
    }
  }

  return {
    agents: results.map(r => ({ agent: r.agent, summary: r.summary, findingCount: r.findings.length })),
    findings: merged,
    warning: "Semua temuan adalah rekomendasi AI. Reviewer manusia harus menerima, menolak, atau menyunting sebelum disimpan sebagai keputusan editorial."
  };
}
