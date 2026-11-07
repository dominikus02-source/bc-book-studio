import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { db } from "../../../../../lib/db";
import { authorized, deny } from "../../../../../lib/auth";

export const runtime = "nodejs";

function xml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "buku";
}

function wrap(text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, max: number, size: number) {
  const result: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      const candidate = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(candidate, size) > max && line) {
        result.push(line);
        line = word;
      } else line = candidate;
    }
    result.push(line);
  }
  return result;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!authorized(req)) return deny();
  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format");
  if (!format || !["pdf", "epub", "docx", "flipbook"].includes(format)) {
    return NextResponse.json({ error: "Choose pdf, epub, docx, or flipbook" }, { status: 400 });
  }

  const book = await db.book.findUnique({ where: { id }, include: { chapters: { orderBy: { position: "asc" } } } });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  if (book.status !== "APPROVED" || book.chapters.length === 0) {
    return NextResponse.json({ error: "Only approved books can be exported" }, { status: 409 });
  }

  const filename = slug(book.title) + (format === "flipbook" ? ".html" : "." + format);

  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595, 842]),
      y = 780;
    function line(s: string, size = 11, heading = false) {
      const f = heading ? bold : font;
      const safe = s.normalize("NFKD").replace(/[^\x20-\x7e\xA0-\xFF]/g, "?");
      for (const chunk of wrap(safe, f, 495, size)) {
        if (y < 70) {
          page = pdf.addPage([595, 842]);
          y = 780;
        }
        if (chunk) page.drawText(chunk, { x: 50, y, size, font: f });
        y -= size * 1.55;
      }
    }
    line(book.title, 22, true);
    line("Kelas " + book.grade + " | " + book.subject, 12);
    y -= 25;
    for (const chapter of book.chapters) {
      line(chapter.position + ". " + chapter.title, 16, true);
      y -= 10;
      line(chapter.content);
      y -= 25;
    }
    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "docx") {
    const children = [
      new Paragraph({
        text: book.title,
        heading: HeadingLevel.TITLE,
      }),
      new Paragraph({
        children: [new TextRun({ text: `Kelas ${book.grade} | ${book.subject}`, italics: true })],
      }),
    ];

    for (const chapter of book.chapters) {
      children.push(
        new Paragraph({
          text: `${chapter.position}. ${chapter.title}`,
          heading: HeadingLevel.HEADING_1,
        })
      );
      for (const para of chapter.content.split(/\n\s*\n/)) {
        if (para.trim()) {
          children.push(new Paragraph({ children: [new TextRun(para.trim())] }));
        }
      }
    }

    const doc = new Document({ sections: [{ children }] });
    const buffer = await Packer.toBuffer(doc);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (format === "flipbook") {
    const pages = book.chapters
      .map(
        (ch) => `
      <div class="page">
        <h2>${xml(ch.position + ". " + ch.title)}</h2>
        ${ch.content
          .split(/\n\s*\n/)
          .map((p) => `<p>${xml(p).replace(/\n/g, "<br>")}</p>`)
          .join("")}
      </div>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>${xml(book.title)} — Flipbook</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f1f5f9; margin: 0; padding: 20px; }
    .book { max-width: 800px; margin: auto; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.1); overflow: hidden; }
    .page { padding: 40px; min-height: 500px; border-bottom: 1px solid #e2e8f0; }
    .page:last-child { border-bottom: none; }
    h1 { text-align: center; margin: 20px 0; }
    h2 { color: #1e40af; }
  </style>
</head>
<body>
  <h1>${xml(book.title)}</h1>
  <p style="text-align:center;color:#64748b">Kelas ${xml(book.grade)} · ${xml(book.subject)}</p>
  <div class="book">${pages}</div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // EPUB (default fallback)
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
  );
  const items = book.chapters.map((c, i) => ({ id: "ch" + (i + 1), file: "chapter-" + (i + 1) + ".xhtml", chapter: c }));
  for (const item of items) {
    zip.file(
      "OEBPS/" + item.file,
      `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${xml(item.chapter.title)}</title></head><body><h1>${xml(item.chapter.title)}</h1>${item.chapter.content
        .split(/\n\s*\n/)
        .map((p) => "<p>" + xml(p).replace(/\n/g, "<br/>") + "</p>")
        .join("")}</body></html>`
    );
  }
  const manifest = items.map((i) => `<item id="${i.id}" href="${i.file}" media-type="application/xhtml+xml"/>`).join("");
  const spine = items.map((i) => `<itemref idref="${i.id}"/>`).join("");
  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">urn:uuid:${xml(book.id)}</dc:identifier><dc:title>${xml(book.title)}</dc:title><dc:language>id</dc:language><dc:creator>BC Book Studio</dc:creator><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}</meta></metadata><manifest>${manifest}</manifest><spine>${spine}</spine></package>`
  );
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/epub+zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
