import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import JSZip from "jszip";
import QRCode from "qrcode";
import { paperSpec, mmToPt, mmToTwips } from "./paper-sizes";
import { parseMediaImage, parseVideo } from "./book-media";

export type RenderAsset = { id: string; mime: string; data: string; altText: string };
export type RenderChapter = { title: string; content: string; position?: number };
type Piece =
  | { type: "heading"; level: number; text: string }
  | { type: "text"; text: string }
  | { type: "image"; assetId: string; alt: string; caption: string }
  | { type: "video"; title: string; url: string };

const xml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char] || char));

export function exportPieces(markdown: string): Piece[] {
  const pieces: Piece[] = [];
  const pattern = /!\[[^\]]*\]\(asset:[a-z0-9]{6,100}\)(?:\{[^}\n]*\})?|\[Video: [^\]]+\]\(https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}\)\{[^}\n]*\}/gi;
  let cursor = 0;
  for (const match of markdown.matchAll(pattern)) {
    const index = match.index ?? 0;
    pushText(pieces, markdown.slice(cursor, index));
    const token = match[0];
    const image = parseMediaImage(token);
    if (image) {
      const caption = /data-bc-caption="([^"]*)"/.exec(token)?.[1] || "";
      pieces.push({ type: "image", assetId: image.assetId, alt: image.alt, caption });
    } else {
      const video = parseVideo(token);
      if (video) pieces.push({ type: "video", title: video.title, url: video.url });
    }
    cursor = index + token.length;
  }
  pushText(pieces, markdown.slice(cursor));
  return pieces;
}

function pushText(pieces: Piece[], raw: string) {
  for (const block of raw.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const text = block.trim();
    if (!text) continue;
    const heading = /^(#{1,6})\s+(.+)$/.exec(text);
    if (heading && !text.includes("\n")) pieces.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
    else pieces.push({ type: "text", text: text.replace(/^#{1,6}\s+/gm, "") });
  }
}

async function fonts() {
  const root = join(process.cwd(), "assets", "fonts");
  return {
    regular: await readFile(join(root, "NotoSans-Regular.ttf")),
    bold: await readFile(join(root, "NotoSans-Bold.ttf")),
  };
}

/** PNG comes from the qrcode package's pngjs renderer. Do not switch this to a Skia or native canvas binding. */
async function qrPng(url: string) {
  const png = await QRCode.toBuffer(url, { type: "png", width: 240, margin: 1, errorCorrectionLevel: "M" });
  if (png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) throw new Error("QR renderer did not return a PNG");
  return png;
}

function assetBytes(assets: RenderAsset[], id: string) {
  const row = assets.find(item => item.id === id);
  if (!row) return null;
  return { mime: row.mime, bytes: Buffer.from(row.data, "base64"), alt: row.altText };
}

export async function renderStudioPdf(input: { title: string; author: string; subject: string; grade: string; pageSize?: string; preview: boolean; chapters: RenderChapter[]; assets: RenderAsset[] }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const face = await fonts();
  const regular = await pdf.embedFont(face.regular, { subset: true });
  const bold = await pdf.embedFont(face.bold, { subset: true });
  const spec = paperSpec(input.pageSize) || paperSpec("a4")!;
  const width = mmToPt(spec.widthMm);
  const height = mmToPt(spec.heightMm);
  const margin = 48;
  let page = pdf.addPage([width, height]);
  let y = height - margin;
  const draw = (text: string, size: number, strong = false) => {
    const font = strong ? bold : regular;
    const words = text.split(/\s+/);
    let line = "";
    const flush = () => {
      if (y < margin + size * 2) { page = pdf.addPage([width, height]); y = height - margin; }
      if (line) page.drawText(line, { x: margin, y, size, font, color: rgb(0.07, 0.09, 0.14) });
      y -= size * 1.45;
      line = "";
    };
    for (const word of words) {
      const next = line ? line + " " + word : word;
      if (font.widthOfTextAtSize(next, size) > width - margin * 2 && line) { flush(); line = word; }
      else line = next;
    }
    flush();
  };
  draw(input.title, 20, true);
  if (input.preview) draw("DRAF — PRATINJAU, BELUM DISETUJUI", 11, true);
  draw((input.author || "") + " · " + input.subject + " · Kelas " + input.grade, 11);
  for (const [index, chapter] of input.chapters.entries()) {
    y -= 8;
    draw((chapter.position || index + 1) + ". " + chapter.title, 16, true);
    for (const piece of exportPieces(chapter.content)) {
      if (piece.type === "heading") draw(piece.text, 13, true);
      else if (piece.type === "text") draw(piece.text, 11);
      else if (piece.type === "video") {
        draw("Video: " + piece.title, 12, true);
        draw(piece.url, 10);
        const png = await pdf.embedPng(await qrPng(piece.url));
        if (y < margin + 140) { page = pdf.addPage([width, height]); y = height - margin; }
        page.drawImage(png, { x: margin, y: y - 120, width: 110, height: 110 });
        y -= 132;
        draw("Pindai kode untuk membuka video.", 10);
      } else {
        const file = assetBytes(input.assets, piece.assetId);
        draw(piece.caption || piece.alt, 11, true);
        if (file && (file.mime === "image/png" || file.mime === "image/jpeg")) {
          const image = file.mime === "image/png" ? await pdf.embedPng(file.bytes) : await pdf.embedJpg(file.bytes);
          const maxW = width - margin * 2;
          const scale = Math.min(1, maxW / image.width, 180 / image.height);
          const w = image.width * scale;
          const h = image.height * scale;
          if (y < margin + h) { page = pdf.addPage([width, height]); y = height - margin; }
          page.drawImage(image, { x: margin, y: y - h, width: w, height: h });
          y -= h + 14;
        } else draw("Gambar: " + piece.alt, 11);
      }
    }
  }
  pdf.setTitle(input.title);
  pdf.setAuthor(input.author || "BC Book Studio");
  pdf.setLanguage("id");
  return pdf.save();
}

function docxParagraph(text: string, style = "Normal") {
  return '<w:p><w:pPr><w:pStyle w:val="' + style + '"/></w:pPr><w:r><w:t xml:space="preserve">' + xml(text) + "</w:t></w:r></w:p>";
}

export async function renderStudioDocx(input: { title: string; subject: string; grade: string; pageSize?: string; preview: boolean; chapters: RenderChapter[]; assets: RenderAsset[] }) {
  const zip = new JSZip();
  const images: { name: string; bytes: Buffer; id: string }[] = [];
  let body = docxParagraph(input.title, "Heading1") + docxParagraph("Kelas " + input.grade + " · " + input.subject);
  if (input.preview) body += docxParagraph("DRAF — PRATINJAU, BELUM DISETUJUI");
  for (const [index, chapter] of input.chapters.entries()) {
    body += docxParagraph((chapter.position || index + 1) + ". " + chapter.title, "Heading1");
    for (const piece of exportPieces(chapter.content)) {
      if (piece.type === "heading") body += docxParagraph(piece.text, "Heading2");
      else if (piece.type === "text") body += docxParagraph(piece.text);
      else if (piece.type === "video") {
        const name = "qr-" + images.length + ".png";
        images.push({ name, bytes: Buffer.from(await qrPng(piece.url)), id: "rImg" + images.length });
        body += docxParagraph("Video: " + piece.title, "Heading2") + docxParagraph(piece.url) + imageParagraph("rImg" + (images.length - 1));
      } else {
        const file = assetBytes(input.assets, piece.assetId);
        body += docxParagraph(piece.caption || piece.alt);
        if (file) {
          const name = "img-" + images.length + (file.mime === "image/png" ? ".png" : ".jpg");
          images.push({ name, bytes: file.bytes, id: "rImg" + images.length });
          body += imageParagraph("rImg" + (images.length - 1));
        }
      }
    }
  }
  const spec = paperSpec(input.pageSize) || paperSpec("a4")!;
  body += '<w:sectPr><w:pgSz w:w="' + mmToTwips(spec.widthMm) + '" w:h="' + mmToTwips(spec.heightMm) + '"/></w:sectPr>';
  const overrides = images.map(image => '<Override PartName="/word/media/' + image.name + '" ContentType="' + (image.name.endsWith(".png") ? "image/png" : "image/jpeg") + '"/>').join("");
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' + overrides + "</Types>");
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/_rels/document.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' + images.map(image => '<Relationship Id="' + image.id + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + image.name + '"/>').join("") + "</Relationships>");
  zip.file("word/styles.xml", '<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style></w:styles>');
  zip.file("word/document.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>' + body + "</w:body></w:document>");
  for (const image of images) zip.file("word/media/" + image.name, image.bytes);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function imageParagraph(id: string) {
  return '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="3200000" cy="2400000"/><wp:docPr id="1" name="Gambar"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill><a:blip r:embed="' + id + '"/></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3200000" cy="2400000"/></a:xfrm></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>';
}

export async function renderStudioEpub(input: { id: string; title: string; author: string; chapters: RenderChapter[]; assets: RenderAsset[] }) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const manifest: string[] = [];
  const spine: string[] = [];
  const nav: string[] = [];
  const used = new Set<string>();
  for (const [index, chapter] of input.chapters.entries()) {
    const file = "chapter-" + (index + 1) + ".xhtml";
    let html = "";
    for (const piece of exportPieces(chapter.content)) {
      if (piece.type === "heading") html += "<h2>" + xml(piece.text) + "</h2>";
      else if (piece.type === "text") html += "<p>" + xml(piece.text) + "</p>";
      else if (piece.type === "video") {
        const name = "images/qr-" + index + "-" + used.size + ".png";
        zip.file("OEBPS/" + name, Buffer.from(await qrPng(piece.url)));
        const id = "img" + used.size;
        used.add(name);
        manifest.push('<item id="' + id + '" href="' + name + '" media-type="image/png"/>');
        html += "<h2>" + xml(piece.title) + "</h2><p>" + xml(piece.url) + '</p><p><img src="' + name + '" alt="Kode QR video"/></p>';
      } else {
        const fileAsset = assetBytes(input.assets, piece.assetId);
        html += "<p>" + xml(piece.caption || piece.alt) + "</p>";
        if (fileAsset) {
          const ext = fileAsset.mime === "image/png" ? "png" : "jpg";
          const name = "images/" + piece.assetId + "." + ext;
          if (!used.has(name)) {
            zip.file("OEBPS/" + name, fileAsset.bytes);
            manifest.push('<item id="asset-' + piece.assetId + '" href="' + name + '" media-type="' + fileAsset.mime + '"/>');
            used.add(name);
          }
          html += '<p><img src="' + name + '" alt="' + xml(piece.alt) + '"/></p>';
        }
      }
    }
    zip.file("OEBPS/" + file, '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="id"><head><title>' + xml(chapter.title) + "</title></head><body><h1>" + xml(chapter.title) + "</h1>" + html + "</body></html>");
    manifest.push('<item id="ch' + (index + 1) + '" href="' + file + '" media-type="application/xhtml+xml"/>');
    spine.push('<itemref idref="ch' + (index + 1) + '"/>');
    nav.push('<li><a href="' + file + '">' + xml(chapter.title) + "</a></li>");
  }
  zip.file("OEBPS/nav.xhtml", '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="id"><head><title>Daftar isi</title></head><body><nav epub:type="toc"><h1>Daftar isi</h1><ol>' + nav.join("") + "</ol></nav></body></html>");
  zip.file("OEBPS/content.opf", '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">urn:uuid:' + xml(input.id) + "</dc:identifier><dc:title>" + xml(input.title) + "</dc:title><dc:language>id</dc:language><dc:creator>" + xml(input.author || "BC Book Studio") + '</dc:creator><meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d{3}Z$/, "Z") + '</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' + manifest.join("") + "</manifest><spine>" + spine.join("") + "</spine></package>");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
