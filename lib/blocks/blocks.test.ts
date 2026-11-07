import { describe, expect, it } from "vitest";
import { blocksToPlainText, countWords, parseBlocks, renderBlocksToHtml } from "./index";

const id = "c123456789012345678901234";
const exercise = {
  id,
  type: "exercise",
  exerciseType: "isian",
  prompt: "Sebutkan ide pokok.",
  difficulty: 2,
};

describe("kontrak blok bab", () => {
  it("mempertahankan ID dan menghitung kata isi bab", () => {
    const blocks = parseBlocks([{ id, type: "paragraph", text: "Siswa membaca cerita." }]);
    expect(blocks[0].id).toBe(id);
    expect(blocksToPlainText(blocks)).toBe("Siswa membaca cerita.");
    expect(countWords(blocks)).toBe(3);
  });

  it("menolak tipe blok yang tidak dikenal dan ID ganda", () => {
    expect(() => parseBlocks([{ id, type: "script" }])).toThrow();
    const paragraph = { id, type: "paragraph", text: "Isi bab" };
    expect(() => parseBlocks([paragraph, paragraph])).toThrow();
  });

  it("mewajibkan kunci jawaban yang berisi teks", () => {
    expect(() => parseBlocks([exercise])).toThrow();
    expect(() => parseBlocks([{ ...exercise, answerKey: " " }])).toThrow();
    const blocks = parseBlocks([{ ...exercise, answerKey: "Gagasan utama" }]);
    expect(renderBlocksToHtml(blocks)).toContain(exercise.prompt);
    expect(renderBlocksToHtml(blocks)).not.toContain("Gagasan utama");
  });

  it("mewajibkan teks alternatif yang berisi teks dan ID aset aman", () => {
    const image = { id, type: "image", assetId: "aset-1" };
    expect(() => parseBlocks([image])).toThrow();
    expect(() => parseBlocks([{ ...image, alt: "   " }])).toThrow();
    expect(() => parseBlocks([{ ...image, assetId: "..", alt: "Skema" }])).toThrow();
    expect(renderBlocksToHtml(parseBlocks([{ ...image, alt: 'Skema "siklus air"' }])))
      .toContain('src="assets/aset-1" alt="Skema &quot;siklus air&quot;"');
  });

  it("menghasilkan markup aksesibel dan meloloskan teks HTML sebagai teks biasa", () => {
    const html = renderBlocksToHtml(parseBlocks([
      { id, type: "heading", level: 2, text: "<script>alert(1)</script>" },
      { id: "c223456789012345678901234", type: "table", headers: ["Istilah"], rows: [["Ejaan"]] },
    ]));
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('<th scope="col">Istilah</th>');
    expect(() => parseBlocks([{ id, type: "table", headers: ["Istilah"], rows: [[]] }])).toThrow();
  });
});
