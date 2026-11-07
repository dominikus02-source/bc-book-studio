import { z } from "zod";

const text = z.string().refine((value) => value.trim().length > 0, "Teks wajib diisi");
const base = z.object({ id: z.cuid() });

const blockSchema = z.discriminatedUnion("type", [
  base.extend({ type: z.literal("heading"), level: z.union([z.literal(2), z.literal(3), z.literal(4)]), text }),
  base.extend({ type: z.literal("paragraph"), text }),
  base.extend({ type: z.literal("list"), kind: z.enum(["ordered", "bullet"]), items: z.array(text).min(1) }),
  base.extend({ type: z.literal("example"), text }),
  base.extend({
    type: z.literal("exercise"),
    prompt: text,
    exerciseType: z.enum(["pilihan_ganda", "isian", "esai"]),
    options: z.array(text).min(1).optional(),
    answerKey: text,
    explanation: text.optional(),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }),
  base.extend({ type: z.literal("callout"), kind: z.enum(["tip", "warning", "note"]), text }),
  base.extend({ type: z.literal("image"), assetId: z.string().regex(/^[a-zA-Z0-9_-]+$/), alt: text, caption: text.optional() }),
  base.extend({ type: z.literal("glossary_term"), term: text, definition: text }),
  base.extend({ type: z.literal("table"), headers: z.array(text).min(1), rows: z.array(z.array(z.string())) }),
]);

export const blocksSchema = z.array(blockSchema).superRefine((blocks, ctx) => {
  const ids = new Set<string>();
  for (const [index, block] of blocks.entries()) {
    if (ids.has(block.id)) {
      ctx.addIssue({ code: "custom", path: [index, "id"], message: "ID blok harus unik dalam satu bab" });
    }
    ids.add(block.id);
    if (block.type === "table" && block.rows.some((row) => row.length !== block.headers.length)) {
      ctx.addIssue({ code: "custom", path: [index, "rows"], message: "Jumlah sel harus sama dengan jumlah kolom tabel" });
    }
  }
});

export type Block = z.infer<typeof blockSchema>;

export function parseBlocks(json: unknown): Block[] {
  return blocksSchema.parse(json);
}

export function blocksToPlainText(blocks: readonly Block[]): string {
  return blocks.map((block) => {
    switch (block.type) {
      case "list": return block.items.join("\n");
      case "exercise": return [block.prompt, ...(block.options ?? [])].join("\n");
      case "image": return block.caption ?? "";
      case "glossary_term": return `${block.term}: ${block.definition}`;
      case "table": return [block.headers, ...block.rows].map((row) => row.join("\t")).join("\n");
      default: return block.text;
    }
  }).filter(Boolean).join("\n\n");
}

export function countWords(blocks: readonly Block[]): number {
  const segmenter = new Intl.Segmenter("id", { granularity: "word" });
  return Array.from(segmenter.segment(blocksToPlainText(blocks))).filter((segment) => segment.isWordLike).length;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderBlocksToHtml(blocks: readonly Block[]): string {
  return blocks.map((block) => {
    const id = `id="${escapeHtml(block.id)}"`;
    switch (block.type) {
      case "heading":
        return `<h${block.level} ${id}>${escapeHtml(block.text)}</h${block.level}>`;
      case "paragraph":
        return `<p ${id}>${escapeHtml(block.text)}</p>`;
      case "list": {
        const tag = block.kind === "ordered" ? "ol" : "ul";
        return `<${tag} ${id}>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</${tag}>`;
      }
      case "example":
        return `<div ${id} class="example"><p>${escapeHtml(block.text)}</p></div>`;
      case "exercise": {
        const options = block.options?.map((option) => `<li>${escapeHtml(option)}</li>`).join("");
        return `<div ${id} class="exercise"><p>${escapeHtml(block.prompt)}</p>${options ? `<ol>${options}</ol>` : ""}</div>`;
      }
      case "callout":
        return `<aside ${id} class="callout-${block.kind}"><p>${escapeHtml(block.text)}</p></aside>`;
      case "image": {
        const caption = block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : "";
        return `<figure ${id}><img src="assets/${encodeURIComponent(block.assetId)}" alt="${escapeHtml(block.alt)}">${caption}</figure>`;
      }
      case "glossary_term":
        return `<dl ${id}><dt>${escapeHtml(block.term)}</dt><dd>${escapeHtml(block.definition)}</dd></dl>`;
      case "table": {
        const headers = block.headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("");
        const rows = block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("");
        return `<table ${id}><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
      }
    }
  }).join("\n");
}
