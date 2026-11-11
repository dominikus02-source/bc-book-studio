import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import {createHash} from "node:crypto";
import {quartoExport} from "../../../../../lib/quarto";
import { db } from "../../../../../lib/db";
import { sessionUser, deny } from "../../../../../lib/auth";
import {applyLayout,storedLayout} from "../../../../../lib/book-layout";
import { approvedManuscript, referencedAssets } from "../../../../../lib/approval-snapshot";
import {resolvedPublishingPackage,publishingSequence} from "../../../../../lib/publishing-package";
import {publicationHtml,publicationReaderCsp} from "../../../../../lib/publishing-html";
import {DEFAULT_PAGINATION,paginationSchema} from "../../../../../lib/book-pagination";
import {paginatePdf} from "../../../../../lib/pagination-output";
import {addChapterFolios,addEntryFolios,markPdfEntries} from "../../../../../lib/book-index";
import {paginateDocx} from "../../../../../lib/pagination-docx";
import {paperSpec} from "../../../../../lib/paper-sizes";
import {bookLanguage} from "../../../../../lib/book-language";
import {renderPreviewDocx,renderPreviewEpub,renderPreviewPdf} from "../../../../../lib/preview-manuscript";
export const runtime = "nodejs";
export const maxDuration = 300;
function slug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0,60) || "buku"; }
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await sessionUser(req);
  if (!actor) return deny();
  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format");
  if (format !== "pdf" && format !== "epub" && format !== "docx" && format !== "html" && format !== "flipbook" && format !== "zip") return NextResponse.json({ error: "Choose pdf, epub, docx, html, or flipbook" }, { status: 400 });
  const preview = req.nextUrl.searchParams.get("preview") === "1";
  const source = await db.book.findFirst({ where: { id, archivedAt:null, OR: [{ownerId: actor.id}, {assignedReviewers: {some: {reviewerId: actor.id}}}] }, include: { chapters: { where:{archivedAt:null}, orderBy: { position: "asc" } } } });
  if (!source) return NextResponse.json({ error: "Book not found" }, { status: 404 });
  const paginationRow=await db.bookPagination.findUnique({where:{bookId:id}});
  const parsedPagination=paginationSchema.safeParse(paginationRow?.settings);
  const pagination=parsedPagination.success?parsedPagination.data:DEFAULT_PAGINATION;
  const selected=req.nextUrl.searchParams.get("snapshot");
  if(selected&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(selected))return NextResponse.json({error:"Identitas snapshot tidak valid"},{status:400});
  if(selected&&preview)return NextResponse.json({error:"Pilih snapshot final atau pratinjau draf, bukan keduanya."},{status:400});
  const approvalSource=selected?{id:source.id,approvedAt:new Date(selected)}:source;
  if (!preview && !selected && source.status !== "APPROVED") return NextResponse.json({ error: "Only approved books can be exported" }, { status: 409 });
  const layoutPreview=preview&&req.nextUrl.searchParams.get("layout")==="1"&&source.status==="APPROVED";
  const snapshot=(!preview||layoutPreview)?await approvedManuscript(db,approvalSource):null;
  if((!preview||layoutPreview)&&!snapshot)return NextResponse.json({error:"Approval snapshot missing; request a new review"},{status:409});
  const provenance={"X-Source-Snapshot":snapshot?source.id+":"+approvalSource.approvedAt!.toISOString():"DRAFT","X-Source-SHA256":snapshot?createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"):"DRAFT"};
  const approved=snapshot&&approvalSource.approvedAt
   ? applyLayout(snapshot,(await storedLayout(db,id,approvalSource.approvedAt,snapshot.chapters)).settings)
   : snapshot;
  const sourceLayout=snapshot&&approvalSource.approvedAt?await storedLayout(db,id,approvalSource.approvedAt,snapshot.chapters):null;
  Object.assign(provenance,{"X-Layout-Version":String(sourceLayout?.version??0),"X-Pagination-Version":String(paginationRow?.version??0)});
  const requestedSize=req.nextUrl.searchParams.get("size");
  if(requestedSize&&requestedSize!=="all"&&!paperSpec(requestedSize))return NextResponse.json({error:"Ukuran kertas tidak didukung"},{status:400});
  const book = { ...(approved ?? source), chapters: approved?.chapters ?? source.chapters, pageSize:requestedSize&&requestedSize!=="all"?requestedSize:((approved??source).pageSize||"a4") };
  const chapterId = preview&&!layoutPreview ? req.nextUrl.searchParams.get("chapterId") : null;
  if (chapterId) {
    if (!source.chapters.some(ch => ch.id === chapterId)) return NextResponse.json({error:"Chapter not found in this book"},{status:404});
    book.chapters = source.chapters.filter(ch => ch.id === chapterId);
  }
  if (book.chapters.length === 0) return NextResponse.json({ error: "Save at least one chapter before previewing" }, { status: 409 });
  // Final content is exclusively the immutable v2 approval, including front/back matter.
  const packageRow=preview&&!layoutPreview?await db.studioFormDraft.findFirst({where:{ownerId:source.ownerId,module:"PUBLISHING_PACKAGE:"+id},orderBy:{updatedAt:"desc"}}):null;
  const publishingParts=approved
   ? publishingSequence(approved.publishingPackage,book.chapters)
   : preview?publishingSequence(resolvedPublishingPackage(source,packageRow?.payload),book.chapters):null;
  const filename = slug(book.title) + (preview?"-DRAFT-PREVIEW":"") + "." + format;
  if(format==="zip")return NextResponse.json({error:"Ekspor ZIP menggunakan antrean /export-jobs; request sinkron dinonaktifkan."},{status:409});
  if(format==="html"||format==="flipbook"){
    const parts=publishingParts??book.chapters.map((c,i)=>({kind:"chapter-"+(i+1),title:c.title,content:c.content}));
    const refs=referencedAssets(publishingParts??book.chapters);
    if(refs.length>20)return NextResponse.json({error:"Terlalu banyak gambar"},{status:409});
    const imageRows=!approved&&refs.length?await db.bookAsset.findMany({where:{bookId:id,id:{in:refs}}}):[];
    const assets=approved?.assets??imageRows.map(row=>({id:row.id,mime:row.mime,data:Buffer.from(row.bytes).toString("base64"),altText:row.altText}));
    if(assets.length!==refs.length)return NextResponse.json({error:"Aset ilustrasi berlisensi tidak lengkap"},{status:409});
    const html=publicationHtml(book.title,parts,preview,format==="flipbook",book.pageSize||"a4",assets,pagination,{author:book.author,language:bookLanguage(approved?.language||book.language),description:book.description,snapshotId:provenance["X-Source-Snapshot"]});
    return new NextResponse(html,{headers:{"Content-Type":"text/html; charset=utf-8","Content-Disposition":(req.nextUrl.searchParams.get("view")==="1"?"inline":"attachment")+"; filename="+filename,...provenance,"Cache-Control":"no-store","Content-Security-Policy":publicationReaderCsp(),"X-Content-Type-Options":"nosniff"}});
  }
  if(process.env.QUARTO_WORKER_URL||process.env.QUARTO_BIN){
   try{
    const refs = referencedAssets(publishingParts??book.chapters);
    if (refs.length > 20) return NextResponse.json({error:"Too many embedded images"},{status:409});
    const files = !approved && refs.length ? await db.bookAsset.findMany({where:{bookId:id,id:{in:refs}}}) : [];
    const assets = approved?.assets ?? files.map(f=>({id:f.id,mime:f.mime,data:Buffer.from(f.bytes).toString("base64"),altText:f.altText}));
    if (assets.length !== refs.length) return NextResponse.json({error:"Missing licensed image asset"},{status:409});
    const chapters = preview ? [{title:"DRAF - PRATINJAU",content:"Naskah belum disetujui untuk diterbitkan."}, ...book.chapters] : book.chapters;
    const render=(source:{title:string;content:string}[])=>quartoExport({...book,publishingLayout:Boolean(publishingParts),chapters:source,assets},format);
    let output:Uint8Array;
    if(publishingParts&&format==="pdf"){
     const contents=publishingParts.find(part=>part.kind==="contentsIntro");
     let folios=new Map<string,string>();
     const sourceParts=publishingParts.map(part=>part.kind.startsWith("chapter-")&&pagination.autoUpdateToc?{...part,content:markPdfEntries(part.content,Number(part.kind.slice("chapter-".length)))}:part);
     let parts=sourceParts;
     let stable=false;
     output=new Uint8Array();
     for(let pass=0;pass<3;pass++){
      const measured=new Map<string,string>();
      output=await paginatePdf(await render(parts),parts,pagination,measured);
      if(!pagination.autoUpdateToc||!contents||measured.size===folios.size&&[...measured].every(([kind,folio])=>folios.get(kind)===folio)){
       stable=true;break;
      }
      folios=measured;
      parts=sourceParts.map(part=>({...part,content:addEntryFolios(part.kind,part===contents?addChapterFolios(contents.content,folios,publishingParts,pagination.listLeader):part.content,folios,pagination.listLeader)}));
     }
     if(!stable)throw Error("Daftar isi PDF belum mencapai nomor halaman yang stabil.");
    }else{
     const rendered=await render(publishingParts??chapters);
     output=publishingParts&&format==="docx"?await paginateDocx(rendered,publishingParts,pagination,book.title):rendered;
    }
    if(format==="pdf"){const pdf=await PDFDocument.load(output);pdf.setTitle(book.title);pdf.setAuthor(book.author);pdf.setSubject(book.subject);pdf.setLanguage(bookLanguage(approved?.language||book.language));output=await pdf.save();}
    return new NextResponse(Buffer.from(output),{headers:{"Content-Type":format==="pdf"?"application/pdf":format==="epub"?"application/epub+zip":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":'attachment; filename="'+filename+'"',...provenance,"Cache-Control":"no-store","X-Renderer":"Quarto"}});
   }catch(e){
    console.error("Quarto export unavailable",e instanceof Error?e.message:"unknown");
    return NextResponse.json({error:"Quarto rendering failed; publication export held"},{status:503});
   }
  }
  if(!preview)return NextResponse.json({error:"Final export requires the full-fidelity Quarto renderer; fallback unavailable."},{status:503});
  const previewBook={id:book.id,title:book.title,author:book.author,subject:book.subject,grade:book.grade,language:bookLanguage(book.language),description:book.description,pageSize:book.pageSize,chapters:book.chapters,preview:true};
  if(format==="pdf"){
    const bytes=await renderPreviewPdf(previewBook);
    return new NextResponse(Buffer.from(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="'+filename+'"',"Cache-Control":"no-store","X-Renderer":"preview-noto"}});
  }
  if(format==="docx"){
    const bytes=await renderPreviewDocx(previewBook);
    return new NextResponse(Buffer.from(bytes),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","Content-Disposition":'attachment; filename="'+filename+'"',"Cache-Control":"no-store","X-Renderer":"preview-docx"}});
  }
  const bytes=await renderPreviewEpub(previewBook);
  return new NextResponse(Buffer.from(bytes),{headers:{"Content-Type":"application/epub+zip","Content-Disposition":'attachment; filename="'+filename+'"',"Cache-Control":"no-store","X-Renderer":"preview-epub"}});
}
