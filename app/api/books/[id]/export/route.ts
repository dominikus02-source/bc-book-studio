import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
import JSZip from "jszip";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import {quartoExport} from "../../../../../lib/quarto";
import { db } from "../../../../../lib/db";
import { sessionUser, deny } from "../../../../../lib/auth";
import {applyLayout,storedLayout} from "../../../../../lib/book-layout";
import {manuscriptBlocks,manuscriptHtml,docxBody,docxStyles} from "../../../../../lib/structured-manuscript";
import { approvedManuscript, referencedAssets } from "../../../../../lib/approval-snapshot";
import {resolvedPublishingPackage,publishingSequence} from "../../../../../lib/publishing-package";
import {publicationHtml,publicationReaderCsp} from "../../../../../lib/publishing-html";
import {DEFAULT_PAGINATION,paginationSchema} from "../../../../../lib/book-pagination";
import {paginatePdf} from "../../../../../lib/pagination-output";
import {paginateDocx} from "../../../../../lib/pagination-docx";
import {paperSizes,paperSpec,mmToPt,mmToTwips} from "../../../../../lib/paper-sizes";
export const runtime = "nodejs";
export const maxDuration = 300;
function xml(s: string) { return s.replace(/[&<>"']/g, c => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "'" }[c] ?? c)); }
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
  const actor = await sessionUser(req);
  if (!actor) return deny();
  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format");
  if (format !== "pdf" && format !== "epub" && format !== "docx" && format !== "html" && format !== "flipbook" && format !== "zip") {
    return NextResponse.json({ error: "Format tidak didukung. Pilih: pdf, epub, docx, html, flipbook (atau zip via job queue)." }, { status: 400 });
  }
  const preview = req.nextUrl.searchParams.get("preview") === "1";
  const source = await db.book.findFirst({ where: { id, archivedAt:null, OR: [{ownerId: actor.id}, {assignedReviewers: {some: {reviewerId: actor.id}}}] }, include: { chapters: { where:{archivedAt:null}, orderBy: { position: "asc" } } } });
  if (!source) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  const paginationRow=await db.bookPagination.findUnique({where:{bookId:id}});
  const parsedPagination=paginationSchema.safeParse(paginationRow?.settings);
  const pagination=parsedPagination.success?parsedPagination.data:DEFAULT_PAGINATION;
  if (!preview && source.status !== "APPROVED") return NextResponse.json({ error: "Only approved books can be exported" }, { status: 409 });
  const layoutPreview=preview&&req.nextUrl.searchParams.get("layout")==="1"&&source.status==="APPROVED";
  const snapshot=(!preview||layoutPreview)?await approvedManuscript(db,source):null;
  if((!preview||layoutPreview)&&!snapshot)return NextResponse.json({error:"Approval snapshot missing; request a new review"},{status:409});
  const approved=snapshot&&source.approvedAt
   ? applyLayout(snapshot,(await storedLayout(db,id,source.approvedAt,snapshot.chapters)).settings)
   : snapshot;
  const requestedSize=req.nextUrl.searchParams.get("size");
  if(requestedSize&&requestedSize!=="all"&&!paperSpec(requestedSize))return NextResponse.json({error:"Ukuran kertas tidak didukung"},{status:400});
  const book = { ...(approved ?? source), chapters: approved?.chapters ?? source.chapters, pageSize:requestedSize&&requestedSize!=="all"?requestedSize:((approved??source).pageSize||"a4") };
  const chapterId = preview&&!layoutPreview ? req.nextUrl.searchParams.get("chapterId") : null;
  if (chapterId) {
    if (!source.chapters.some(ch => ch.id === chapterId)) return NextResponse.json({error:"Chapter not found in this book"},{status:404});
    book.chapters = source.chapters.filter(ch => ch.id === chapterId);
  }
  if (book.chapters.length === 0) return NextResponse.json({ error: "Save at least one chapter before previewing" }, { status: 409 });
  // Preview-only publishing metadata is never included in final approved snapshots.
  const packageRow=preview&&!layoutPreview&&source.ownerId===actor.id?await db.studioFormDraft.findFirst({where:{ownerId:actor.id,module:"PUBLISHING_PACKAGE:"+id},orderBy:{updatedAt:"desc"}}):null;
  const publishingParts=preview&&!layoutPreview&&source.ownerId===actor.id
   ? publishingSequence(resolvedPublishingPackage(source,packageRow?.payload),book.chapters):null;
  const filename = slug(book.title) + (preview?"-DRAFT-PREVIEW":"") + "." + format;
  if(format==="zip")return NextResponse.json({error:"Ekspor ZIP menggunakan antrean /export-jobs; request sinkron dinonaktifkan."},{status:409});
  if(format==="html"||format==="flipbook"){
    const parts=publishingParts??book.chapters.map((c,i)=>({kind:"chapter-"+(i+1),title:c.title,content:c.content}));
    const refs=referencedAssets(book.chapters);
    if(refs.length>20)return NextResponse.json({error:"Terlalu banyak gambar"},{status:409});
    const imageRows=!approved&&refs.length?await db.bookAsset.findMany({where:{bookId:id,id:{in:refs}}}):[];
    const assets=approved?.assets??imageRows.map(row=>({id:row.id,mime:row.mime,data:Buffer.from(row.bytes).toString("base64"),altText:row.altText}));
    if(assets.length!==refs.length)return NextResponse.json({error:"Aset ilustrasi berlisensi tidak lengkap"},{status:409});
    const html=publicationHtml(book.title,parts,preview,format==="flipbook",book.pageSize||"a4",assets,pagination);
    return new NextResponse(html,{headers:{"Content-Type":"text/html; charset=utf-8","Content-Disposition":(req.nextUrl.searchParams.get("view")==="1"?"inline":"attachment")+"; filename="+filename,"Cache-Control":"no-store","Content-Security-Policy":publicationReaderCsp(),"X-Content-Type-Options":"nosniff"}});
  }
  if(process.env.QUARTO_WORKER_URL||process.env.QUARTO_BIN){
   try{
    const refs = referencedAssets(book.chapters);
    if (refs.length > 20) return NextResponse.json({error:"Too many embedded images"},{status:409});
    const files = !approved && refs.length ? await db.bookAsset.findMany({where:{bookId:id,id:{in:refs}}}) : [];
    const assets = approved?.assets ?? files.map(f=>({id:f.id,mime:f.mime,data:Buffer.from(f.bytes).toString("base64"),altText:f.altText}));
    if (assets.length !== refs.length) return NextResponse.json({error:"Missing licensed image asset"},{status:409});
    const chapters = preview ? [{title:"DRAF - PRATINJAU",content:"Naskah belum disetujui untuk diterbitkan."}, ...book.chapters] : book.chapters;
    const rendered=await quartoExport({...book,publishingLayout:Boolean(publishingParts),chapters:publishingParts??chapters,assets},format);
    const output=publishingParts&&format==="pdf"?await paginatePdf(rendered,publishingParts,pagination):publishingParts&&format==="docx"?await paginateDocx(rendered,publishingParts,pagination,book.title):rendered;
    return new NextResponse(Buffer.from(output),{headers:{"Content-Type":format==="pdf"?"application/pdf":format==="epub"?"application/epub+zip":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":'attachment; filename="'+filename+'"',"Cache-Control":"no-store","X-Renderer":"Quarto"}});
   }catch(e){
    console.error("Quarto export unavailable",e instanceof Error?e.message:"unknown");
    return NextResponse.json({error:"Quarto rendering failed; publication export held. Fallback limited."},{status:503});
   }
  }
  if (format === "pdf") {
    console.warn("PDF export using limited StandardFonts fallback (Indonesian Unicode may be replaced with ?). Prefer Quarto worker for full support.");
    const pdf=await PDFDocument.create();
    const normal=await pdf.embedFont(StandardFonts.Helvetica);
    const strong=await pdf.embedFont(StandardFonts.HelveticaBold);
    const spec=paperSpec(book.pageSize)||paperSpec("a4")!;
    const [w,h]=[mmToPt(spec.widthMm),mmToPt(spec.heightMm)];
    const margin=48;
    let page=pdf.addPage([w,h]),y=h-margin;
    const win=(v:string)=>v.normalize("NFKD").replace(/[^\x20-\x7e\xA0-\xFF]/g,"?");
    function lines(text:string,size:number,bold=false,indent=0){
     const font=bold?strong:normal;
     for(const paragraph of text.split(/\r?\n/)){
      const chunks=wrap(win(paragraph),font,w-margin*2-indent,size);
      for(const chunk of chunks){
       if(y < margin+size*2){page=pdf.addPage([w,h]);y=h-margin}
       if(chunk)page.drawText(chunk,{x:margin+indent,y,size,font});
       y-=size*1.45;
      }
     }
    }
    lines(book.title,20,true);y-=9;
    if(preview){lines("DRAF - PRATINJAU, BELUM DISETUJUI",11,true);y-=6}
    lines(book.subject+" | Kelas "+book.grade,11);y-=20;
    for(const chapter of book.chapters){
     if(y<margin+80){page=pdf.addPage([w,h]);y=h-margin}
     lines(chapter.position+". "+chapter.title,17,true);y-=12;
     for(const block of manuscriptBlocks(chapter.content)){
      if(block.kind==="heading"){y-=8;lines(block.text,Math.max(11,17-(block.level||2)),true);y-=5}
      else if(block.kind==="bullet"){lines("- "+block.text,11,false,16);y-=2}
      else if(block.kind==="number"){lines((block.level||1)+". "+block.text,11,false,16);y-=2}
      else if(block.kind==="quote"){lines(block.text,10,false,15);y-=6}
      else if(block.kind==="table"){for(const row of block.cells||[]){lines(row.join("  |  "),9);y-=3}}
      else if(block.kind==="rule"){y-=12}
      else if(block.kind==="code"){lines(block.text,9,false,12);y-=7}
      else {lines(block.text,11);y-=9}
     }
     y-=16;
    }
    const pages=pdf.getPages();
    pages.forEach((p,i)=>p.drawText(String(i+1)+" / "+pages.length,{x:w-margin-36,y:25,size:9,font:normal}));
    return new NextResponse(Buffer.from(await pdf.save()),{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="'+filename+'"',"Cache-Control":"no-store","X-PDF-Fallback":"limited-fonts"}});
  }
  if (format === "docx") {
    const zip = new JSZip();
    const documentXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
     +'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
     +docxBody([{kind:"heading",text:book.title,level:1},{kind:"paragraph",text:"Kelas "+book.grade+" | "+book.subject},...(preview?[{kind:"paragraph" as const,text:"DRAF - PRATINJAU, BELUM DISETUJUI"}]:[]),
     ...book.chapters.flatMap(ch=>[{kind:"heading" as const,text:ch.position+". "+ch.title,level:1},...manuscriptBlocks(ch.content)])])
     +'<w:sectPr><w:pgSz w:w="'+mmToTwips((paperSpec(book.pageSize)||paperSpec("a4")!).widthMm)+'" w:h="'+mmToTwips((paperSpec(book.pageSize)||paperSpec("a4")!).heightMm)+'"/></w:sectPr></w:body></w:document>';
    zip.file("[Content_Types].xml",'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>');
    zip.file("_rels/.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file("word/_rels/document.xml.rels",'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>');
    zip.file("word/document.xml",documentXml);
    zip.file("word/styles.xml",docxStyles);
    const bytes=await zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"});
    return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":'attachment; filename="'+filename+'"',"Cache-Control":"no-store"}});
  }
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const items = book.chapters.map((c, i) => ({ id: "ch" + (i + 1), file: "chapter-" + (i + 1) + ".xhtml", chapter: c }));
  for (const item of items) zip.file("OEBPS/" + item.file, '<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>' + xml(item.chapter.title) + '</title></head><body><h1>' + xml(item.chapter.title) + '</h1>' + manuscriptHtml(item.chapter.content) + '</body></html>');
  zip.file("OEBPS/nav.xhtml",`<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Daftar isi</title></head><body><nav epub:type="toc" id="toc"><h1>Daftar isi</h1><ol>${items.map(i=>`<li><a href="${i.file}">${xml(i.chapter.title)}</a></li>`).join("")}</ol></nav></body></html>`);
  const manifest = items.map(i => '<item id="' + i.id + '" href="' + i.file + '" media-type="application/xhtml+xml"/>').join("");
  const spine = items.map(i => '<itemref idref="' + i.id + '"/>').join("");
  zip.file("OEBPS/content.opf", '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">urn:uuid:' + xml(book.id) + '</dc:identifier><dc:title>' + xml(book.title) + '</dc:title><dc:language>id</dc:language><dc:creator>BC Book Studio</dc:creator><meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d{3}Z$/, "Z") + '</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' + manifest + '</manifest><spine>' + spine + '</spine></package>');
  const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/epub+zip", "Content-Disposition": 'attachment; filename="' + filename + '"', "Cache-Control": "no-store" } });
}
