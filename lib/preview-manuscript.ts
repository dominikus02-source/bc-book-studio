import {readFile} from "node:fs/promises";
import {join} from "node:path";
import {PDFDocument, rgb, type PDFFont} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import JSZip from "jszip";
import {docxBody, docxStyles, manuscriptBlocks, manuscriptHtml, escapeXml} from "./structured-manuscript";
import {paperSpec, mmToPt, mmToTwips} from "./paper-sizes";
import {bookLanguage, docxLanguage, languageLabel} from "./book-language";

export type PreviewChapter = {position?: number; title: string; content: string};
export type PreviewBook = {
 id: string;
 title: string;
 author?: string | null;
 subject?: string | null;
 grade?: string | null;
 language?: string | null;
 description?: string | null;
 pageSize?: string | null;
 chapters: PreviewChapter[];
 preview: boolean;
};

const fontBytes: {regular?: Uint8Array; bold?: Uint8Array} = {};
async function embeddedFonts() {
 if (!fontBytes.regular || !fontBytes.bold) {
  const root = join(process.cwd(), "assets", "fonts");
  const [regular, bold] = await Promise.all([
   readFile(join(root, "NotoSerif-Regular.ttf")),
   readFile(join(root, "NotoSerif-Bold.ttf")),
  ]);
  fontBytes.regular = regular;
  fontBytes.bold = bold;
 }
 return {regular: fontBytes.regular, bold: fontBytes.bold};
}

function meta(book: PreviewBook) {
 const language = bookLanguage(book.language);
 const author = (book.author || "").trim() || (language === "en" ? "Author to be confirmed" : "Penulis perlu dikonfirmasi");
 const draft = language === "en" ? "DRAFT — PREVIEW, NOT APPROVED" : "DRAF — PRATINJAU, BELUM DISETUJUI";
 const rights = language === "en"
  ? "ISBN is not assigned. This file is not an official publication or a Perpusnas registration."
  : "ISBN belum ditetapkan. Berkas ini bukan terbitan resmi dan bukan bukti pendaftaran Perpusnas.";
 return {language, author, draft, rights, subject: book.subject || "", grade: book.grade || ""};
}

function wrap(text: string, font: PDFFont, max: number, size: number) {
 const result: string[] = [];
 for (const paragraph of text.split(/\r?\n/)) {
  let line = "";
  for (const word of paragraph.split(/\s+/)) {
   if (!word) continue;
   const candidate = line ? line + " " + word : word;
   if (font.widthOfTextAtSize(candidate, size) > max && line) { result.push(line); line = word; }
   else line = candidate;
  }
  result.push(line);
 }
 return result.length ? result : [""];
}

export async function renderPreviewPdf(book: PreviewBook) {
 const info = meta(book);
 const spec = paperSpec(book.pageSize) || paperSpec("a4")!;
 const [w, h] = [mmToPt(spec.widthMm), mmToPt(spec.heightMm)];
 const margin = 54;
 const pdf = await PDFDocument.create();
 pdf.registerFontkit(fontkit);
 const files = await embeddedFonts();
 const body = await pdf.embedFont(files.regular, {subset: true});
 const strong = await pdf.embedFont(files.bold, {subset: true});
 pdf.setTitle(book.title);
 pdf.setAuthor(info.author);
 pdf.setSubject(info.subject);
 pdf.setLanguage(info.language);
 pdf.setCreator("BC Book Studio");
 pdf.setProducer("BC Book Studio preview (Noto Serif)");
 let page = pdf.addPage([w, h]);
 let y = h - margin;
 const pages = () => pdf.getPages();
 function ensure(size: number) {
  if (y < margin + size * 2) { page = pdf.addPage([w, h]); y = h - margin; }
 }
 function draw(text: string, size: number, bold = false, indent = 0) {
  const font = bold ? strong : body;
  for (const paragraph of text.split(/\r?\n/)) {
   for (const chunk of wrap(paragraph, font, w - margin * 2 - indent, size)) {
    ensure(size);
    if (chunk) page.drawText(chunk, {x: margin + indent, y, size, font, color: rgb(0.1, 0.12, 0.16)});
    y -= size * 1.45;
   }
  }
 }
 draw(book.title, 22, true);
 y -= 8;
 draw(info.author, 12);
 draw([info.subject, info.grade].filter(Boolean).join(" · "), 11);
 draw(languageLabel(info.language), 11);
 y -= 8;
 if (book.preview) { draw(info.draft, 11, true); y -= 6; }
 draw(info.rights, 10);
 y -= 16;
 for (const chapter of book.chapters) {
  ensure(40);
  draw((chapter.position ? chapter.position + ". " : "") + chapter.title, 16, true);
  y -= 8;
  for (const block of manuscriptBlocks(chapter.content)) {
   if (block.kind === "heading") { y -= 6; draw(block.text, Math.max(12, 16 - (block.level || 2)), true); y -= 4; }
   else if (block.kind === "bullet") draw("• " + block.text, 11, false, 14);
   else if (block.kind === "number") draw((block.level || 1) + ". " + block.text, 11, false, 14);
   else if (block.kind === "quote") draw(block.text, 11, false, 16);
   else if (block.kind === "table") { for (const row of block.cells || []) draw(row.join("  |  "), 9); y -= 4; }
   else if (block.kind === "rule") y -= 10;
   else if (block.kind === "code") draw(block.text, 9, false, 10);
   else { draw(block.text, 11); y -= 6; }
  }
  y -= 14;
 }
 const total = pages().length;
 pages().forEach((item, index) => {
  item.drawText(String(index + 1) + " / " + total, {x: w - margin - 42, y: 28, size: 9, font: body, color: rgb(0.3, 0.34, 0.4)});
  if (book.preview) item.drawText(info.draft, {x: margin, y: 28, size: 8, font: body, color: rgb(0.45, 0.32, 0.2)});
 });
 return pdf.save();
}

function xhtml(html: string) {
 return html.replace(/&nbsp;/g, "&#160;").replace(/<(br|hr)\s*\/?>/gi, "<$1/>");
}
function chapterFile(index: number) { return "chapter-" + (index + 1) + ".xhtml"; }

export async function renderPreviewEpub(book: PreviewBook) {
 const info = meta(book);
 const zip = new JSZip();
 const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
 const css = "body{font-family:serif;line-height:1.55;margin:1.2em;color:#1c2430}h1{font-size:1.45em;line-height:1.25}h2{font-size:1.2em}p,li{font-size:1em}blockquote{margin-left:1em;color:#334155}.draft{font-weight:700}.meta{color:#475569}";
 zip.file("mimetype", "application/epub+zip", {compression: "STORE"});
 zip.file("META-INF/container.xml", '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
 zip.file("OEBPS/style.css", css);
 const titlePage = `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${info.language}" lang="${info.language}"><head><title>${escapeXml(book.title)}</title><link rel="stylesheet" href="style.css"/></head><body><h1>${escapeXml(book.title)}</h1><p class="meta">${escapeXml(info.author)}</p><p class="meta">${escapeXml([info.subject, info.grade, languageLabel(info.language)].filter(Boolean).join(" · "))}</p>${book.preview ? `<p class="draft">${escapeXml(info.draft)}</p>` : ""}<p>${escapeXml(info.rights)}</p></body></html>`;
 zip.file("OEBPS/title.xhtml", titlePage);
 const chapters = book.chapters.map((chapter, index) => ({
  id: "ch" + (index + 1),
  file: chapterFile(index),
  title: chapter.title,
  body: xhtml(manuscriptHtml(chapter.content)),
 }));
 for (const chapter of chapters) {
  zip.file("OEBPS/" + chapter.file, `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${info.language}" lang="${info.language}"><head><title>${escapeXml(chapter.title)}</title><link rel="stylesheet" href="style.css"/></head><body><h1>${escapeXml(chapter.title)}</h1>${chapter.body}</body></html>`);
 }
 const navItems = [`<li><a href="title.xhtml">${escapeXml(book.title)}</a></li>`, ...chapters.map(chapter => `<li><a href="${chapter.file}">${escapeXml(chapter.title)}</a></li>`)].join("");
 zip.file("OEBPS/nav.xhtml", `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${info.language}" lang="${info.language}"><head><title>${escapeXml(info.language === "en" ? "Contents" : "Daftar isi")}</title><link rel="stylesheet" href="style.css"/></head><body><nav epub:type="toc" id="toc"><h1>${escapeXml(info.language === "en" ? "Contents" : "Daftar isi")}</h1><ol>${navItems}</ol></nav></body></html>`);
 const manifest = `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/><item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>` + chapters.map(chapter => `<item id="${chapter.id}" href="${chapter.file}" media-type="application/xhtml+xml"/>`).join("");
 const spine = `<itemref idref="title"/>` + chapters.map(chapter => `<itemref idref="${chapter.id}"/>`).join("");
 zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid" version="3.0" xml:lang="${info.language}"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">urn:uuid:${escapeXml(book.id)}</dc:identifier><dc:title>${escapeXml(book.title)}</dc:title><dc:language>${info.language}</dc:language><dc:creator>${escapeXml(info.author)}</dc:creator><dc:description>${escapeXml((book.description || info.subject || book.title).slice(0, 500))}</dc:description><meta property="dcterms:modified">${modified}</meta></metadata><manifest>${manifest}</manifest><spine>${spine}</spine></package>`);
 return zip.generateAsync({type: "uint8array", compression: "DEFLATE"});
}

export async function renderPreviewDocx(book: PreviewBook) {
 const info = meta(book);
 const spec = paperSpec(book.pageSize) || paperSpec("a4")!;
 const blocks = [
  {kind: "heading" as const, text: book.title, level: 1},
  {kind: "paragraph" as const, text: info.author},
  {kind: "paragraph" as const, text: [info.subject, info.grade, languageLabel(info.language)].filter(Boolean).join(" · ")},
  ...(book.preview ? [{kind: "paragraph" as const, text: info.draft}] : []),
  {kind: "paragraph" as const, text: info.rights},
  ...book.chapters.flatMap(chapter => [{kind: "heading" as const, text: (chapter.position ? chapter.position + ". " : "") + chapter.title, level: 1}, ...manuscriptBlocks(chapter.content)]),
 ];
 const margin = mmToTwips(spec.widthMm <= 148 ? 14 : 20);
 const sect = `<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="${mmToTwips(spec.widthMm)}" w:h="${mmToTwips(spec.heightMm)}"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;
 const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${docxBody(blocks)}${sect}</w:body></w:document>`;
 const lang = docxLanguage(info.language);
 const styles = docxStyles.replace(/(<w:styles[^>]*>)/, `$1<w:docDefaults><w:rPrDefault><w:rPr><w:lang w:val="${lang}"/></w:rPr></w:rPrDefault></w:docDefaults>`);
 const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t xml:space="preserve">${escapeXml(book.title)}</w:t></w:r></w:p></w:hdr>`;
 const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`;
 const stamp = new Date().toISOString();
 const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(book.title)}</dc:title><dc:creator>${escapeXml(info.author)}</dc:creator><dc:description>${escapeXml((book.description || info.rights).slice(0, 500))}</dc:description><dc:language>${lang}</dc:language><cp:lastModifiedBy>BC Book Studio</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified></cp:coreProperties>`;
 const zip = new JSZip();
 zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
 zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
 zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`);
 zip.file("word/document.xml", documentXml);
 zip.file("word/styles.xml", styles);
 zip.file("word/header1.xml", header);
 zip.file("word/footer1.xml", footer);
 zip.file("docProps/core.xml", core);
 return zip.generateAsync({type: "uint8array", compression: "DEFLATE"});
}
