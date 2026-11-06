import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import {quartoExport} from "../../../../../lib/quarto";
import { db } from "../../../../../lib/db";
import { identity, deny } from "../../../../../lib/auth";
export const runtime = "nodejs";
function xml(s: string) { return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c] ?? c)); }
function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0,60) || "buku"; }
function wrap(text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, max: number, size: number) {
  const result: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      const candidate = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(candidate, size) > max && line) { result.push(line); line = word; } else line = candidate;
    }
    result.push(line);
  }
  return result;
}
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await identity(req);
  if (!ownerId) return deny();
  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format");
  if (format !== "pdf" && format !== "epub" && format !== "docx") return NextResponse.json({ error: "Choose pdf, epub or docx" }, { status: 400 });
  const book = await db.book.findFirst({ where: { id, ownerId }, include: { chapters: { orderBy: { position: "asc" } } } });
  if (!book) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  if (book.status !== "APPROVED" || book.chapters.length === 0) return NextResponse.json({ error: "Only approved books can be exported" }, { status: 409 });
  const filename = slug(book.title) + "." + format;
  if(process.env.QUARTO_WORKER_URL||process.env.QUARTO_BIN){
   try{
    const manuscript=book.chapters.map(ch=>ch.content).join("\n");
    const refs=[...new Set([...manuscript.matchAll(/!\[[^\]]{1,200}\]\(asset:([a-z0-9]{6,100})\)/g)].map(m=>m[1]))];
    if(refs.length>20)return NextResponse.json({error:"Too many embedded images"},{status:409});
    const files=refs.length?await db.bookAsset.findMany({where:{bookId:id,id:{in:refs}}}):[];
    if(files.length!==refs.length)return NextResponse.json({error:"Missing licensed image asset"},{status:409});
    const assets=files.map(f=>({id:f.id,mime:f.mime,data:Buffer.from(f.bytes).toString("base64"),altText:f.altText}));
    const output=await quartoExport({...book,assets},format);
    return new NextResponse(Buffer.from(output),{headers:{"Content-Type":format==="pdf"?"application/pdf":format==="epub"?"application/epub+zip":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":'attachment; filename="'+filename+'"',"Cache-Control":"no-store","X-Renderer":"Quarto"}});
   }catch(e){
    console.error("Quarto export unavailable",e instanceof Error?e.message:"unknown");
    return NextResponse.json({error:"Quarto rendering failed; publication export held"},{status:503});
   }
  }
  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595, 842]), y = 780;
    function line(s: string, size = 11, heading = false) {
      const f = heading ? bold : font;
      // Standard PDF fonts only support WinAnsi; replace unsupported characters.
      const safe = s.normalize("NFKD").replace(/[^\x20-\x7e\xA0-\xFF]/g, "?");
      for (const chunk of wrap(safe, f, 495, size)) {
        if (y < 70) { page = pdf.addPage([595, 842]); y = 780; }
        if (chunk) page.drawText(chunk, { x: 50, y, size, font: f });
        y -= size * 1.55;
      }
    }
    line(book.title, 22, true); line("Kelas " + book.grade + " | " + book.subject, 12); y -= 25;
    for (const chapter of book.chapters) { line(chapter.position + ". " + chapter.title, 16, true); y -= 10; line(chapter.content); y -= 25; }
    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="' + filename + '"', "Cache-Control": "no-store" } });
  }
  if (format === "docx") {
    const zip = new JSZip();
    const paragraph = (text: string) => '<w:p><w:r><w:t xml:space="preserve">' + xml(text) + '</w:t></w:r></w:p>';
    const sections = [book.title, 'Kelas ' + book.grade + ' | ' + book.subject];
    for (const chapter of book.chapters) {
      sections.push(chapter.position + '. ' + chapter.title);
      sections.push(...chapter.content.split(/\r?\n/));
    }
    const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
      + sections.map(paragraph).join('')
      + '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>';
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '</Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + '</Relationships>');
    zip.file('word/document.xml', documentXml);
    const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    return new NextResponse(new Uint8Array(bytes), { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'attachment; filename="' + filename + '"',
      "Cache-Control": "no-store"
    } });
  }
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const items = book.chapters.map((c, i) => ({ id: "ch" + (i + 1), file: "chapter-" + (i + 1) + ".xhtml", chapter: c }));
  for (const item of items) zip.file("OEBPS/" + item.file, '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>' + xml(item.chapter.title) + '</title></head><body><h1>' + xml(item.chapter.title) + '</h1>' + item.chapter.content.split(/\n\s*\n/).map(p => "<p>" + xml(p).replace(/\n/g, "<br/>") + "</p>").join("") + '</body></html>');
  const manifest = items.map(i => '<item id="' + i.id + '" href="' + i.file + '" media-type="application/xhtml+xml"/>').join("");
  const spine = items.map(i => '<itemref idref="' + i.id + '"/>').join("");
  zip.file("OEBPS/content.opf", '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">urn:uuid:' + xml(book.id) + '</dc:identifier><dc:title>' + xml(book.title) + '</dc:title><dc:language>id</dc:language><dc:creator>BC Book Studio</dc:creator><meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d{3}Z$/, "Z") + '</meta></metadata><manifest>' + manifest + '</manifest><spine>' + spine + '</spine></package>');
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/epub+zip", "Content-Disposition": 'attachment; filename="' + filename + '"', "Cache-Control": "no-store" } });
}
