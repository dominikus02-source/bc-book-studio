import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../../lib/db";
import {identity,deny} from "../../../../../lib/auth";

export const runtime="nodejs";
export const maxDuration=120;
type PdfTextItem={str?:string;transform?:number[];width?:number;height?:number;fontName?:string;hasEOL?:boolean};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
const clean=(s:string)=>s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"").replace(/\s+/g," ").trim();
const slugTitle=(name:string)=>name.replace(/\.pdf$/i,"").replace(/[_-]+/g," ").replace(/\s+/g," ").trim().slice(0,180);
function markdownFromPageItems(items:PdfTextItem[]){
 const lines=new Map<number,{x:number;text:string;size:number;font:string}[]>();
 for(const item of items){
  const value=clean(item.str||"");if(!value)continue;
  const t=item.transform||[0,0,0,0,0,0],y=Math.round((t[5]||0)/2)*2,x=t[4]||0;
  const row=lines.get(y)||[];
  row.push({x,text:value,size:Math.max(6,Math.min(48,Math.round(Math.hypot(t[0]||0,t[1]||0)*10)/10)),font:item.fontName||""});
  lines.set(y,row);
 }
 const ordered=[...lines.entries()].sort((a,b)=>b[0]-a[0]);
 const result:string[]=[];
 let previousY:number|undefined;
 for(const [y,row] of ordered){
  row.sort((a,b)=>a.x-b.x);
  const text=row.map(part=>{
   const escaped=part.text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
   const styled=/bold|black|semibold/i.test(part.font)?`**${escaped}**`:escaped;
   return part.size>=10&&part.size<=36?'<span style="font-size:'+part.size+'pt">'+styled+'</span>':styled;
  }).join(" ");
  const average=row.reduce((sum,item)=>sum+item.size,0)/row.length;
  const first=row[0];
  const isHeading=average>=15||(/^(BAB\s+\d+|[A-Z][.)]\s|\d+(?:\.\d+)*\s)/i.test(text)&&average>=11);
  if(previousY!==undefined&&Math.abs(previousY-y)>Math.max(20,average*2.3))result.push("");
  result.push(isHeading?"## "+text:text);
  previousY=y;
 }
 return result.join("\n").replace(/\n{3,}/g,"\n\n").trim();
}
function inferObjective(title:string,content:string){
 const opening=content.replace(/^#+\s.*$/gm,"").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim().slice(0,700);
 return ("Mempelajari dan memahami "+title.replace(/^Bab\s*\d*\s*[:.-]?\s*/i,"").toLowerCase()+". "+opening).slice(0,1450);
}
export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id}=await params;
 const form=await req.formData().catch(()=>null);
 if(!form)return fail("Form unggahan tidak valid.",400);
 const files=form.getAll("files").filter((v):v is File=>v instanceof File);
 if(!files.length)return fail("Pilih sedikitnya satu berkas PDF.",400);
 if(files.length>10)return fail("Maksimal 10 PDF dalam satu proses.",413);
 if(files.some(f=>!f.name.toLowerCase().endsWith(".pdf")||f.size<8||f.size>25*1024*1024))return fail("Setiap file harus PDF valid dengan ukuran maksimal 25 MB.",413);
 const parsed:{name:string;title:string;content:string;pages:number;subject:string;author:string}[]=[];
 try{
  const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");
  for(const file of files){
   const bytes=new Uint8Array(await file.arrayBuffer());
   if(String.fromCharCode(...bytes.subarray(0,5))!=="%PDF-")return fail("Berkas "+file.name+" bukan PDF yang valid.",400);
   const options={data:bytes,useSystemFonts:true,isEvalSupported:false};
   const task=pdfjs.getDocument(options);
   const pdf=await task.promise;
   if(pdf.numPages<1||pdf.numPages>500){await task.destroy();return fail("PDF "+file.name+" harus memiliki 1–500 halaman.",413);}
   const pageTexts:string[]=[];
   for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
    const page=await pdf.getPage(pageNo);
    const text=await page.getTextContent();
    pageTexts.push(markdownFromPageItems(text.items as PdfTextItem[]));
    page.cleanup();
   }
   const metadata=await pdf.getMetadata().catch(()=>null) as {info?:{Title?:string;Author?:string;Subject?:string}}|null;
   const full=pageTexts.map((page,index)=>page?"<!-- PDF page "+(index+1)+" -->\n\n"+page:"").filter(Boolean).join("\n\n---\n\n");
   await task.destroy();
   if(full.replace(/<[^>]*>/g,"").trim().length<80)return fail("Teks PDF "+file.name+" terlalu sedikit atau berupa hasil pindai. PDF hasil scan memerlukan OCR sebelum dapat diimpor.",422);
   const firstLines=pageTexts[0].split("\n").map(x=>x.replace(/<[^>]*>/g,"").replace(/[*_]/g,"").trim()).filter(Boolean);
   const title=clean(metadata?.info?.Title||firstLines.find(x=>/^(BAB\s+\d+|.+)$/i.test(x)&&x.length>3)||slugTitle(file.name))||slugTitle(file.name);
   parsed.push({name:file.name,title:title.slice(0,180),content:full.slice(0,200000),pages:pdf.numPages,subject:clean(metadata?.info?.Subject||""),author:clean(metadata?.info?.Author||"")});
  }
 }catch(error){return fail("Konversi PDF gagal: "+(error instanceof Error?error.message:"PDF tidak dapat dibaca."),422);}
 const result=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${ownerId} AND "archivedAt" IS NULL FOR UPDATE`;
  const book=await tx.book.findFirst({where:{id,ownerId,archivedAt:null}});
  if(!book)return {error:"Buku tidak ditemukan.",status:404 as const};
  if(book.status!=="DRAFT")return {error:"Hanya buku berstatus DRAFT yang dapat diimpor.",status:409 as const};
  const current=await tx.chapter.findMany({where:{bookId:id,archivedAt:null},select:{title:true,position:true}});
  let position=current.reduce((max,row)=>Math.max(max,row.position),0);
  const created:{id:string;title:string;pages:number;characters:number}[]=[];
  for(const item of parsed){
   let title=item.title;
   if(current.some(row=>row.title.toLowerCase()===title.toLowerCase())||created.some(row=>row.title.toLowerCase()===title.toLowerCase()))title=(title+" (Impor PDF)").slice(0,180);
   position++;
   const objective=inferObjective(title,item.content);
   const chapter=await tx.chapter.create({data:{bookId:id,position,title,outlineObjective:objective,content:item.content}});
   created.push({id:chapter.id,title:chapter.title,pages:item.pages,characters:item.content.length});
  }
  const first=parsed[0];
  const nextDescription=book.description.trim().length>=20?book.description:("Naskah diimpor dari "+parsed.map(x=>x.name).join(", ")+". "+first.content.replace(/<[^>]*>/g,"").slice(0,2500)).slice(0,12000);
  await tx.book.update({where:{id},data:{
   title:book.title.trim().length>=3?book.title:first.title.replace(/^BAB\s*\d+\s*[:.-]?\s*/i,"").slice(0,250),
   subject:book.subject.trim().length>=2?book.subject:(first.subject||"Bahasa Indonesia").slice(0,120),
   author:book.author.trim().length>=2&&book.author!=="BC Book Studio"?book.author:(first.author||book.author).slice(0,180),
   description:nextDescription,
   targetAudience:book.targetAudience.trim()||("Peserta didik kelas "+book.grade),
   writingGoal:book.writingGoal.trim()||"Mengembangkan pemahaman materi berdasarkan naskah sumber yang diimpor dan ditinjau secara editorial.",
   // Named shortcut, not workflow.transition: import may enter WRITING from Ide or Rancang.
   editorialStage:"WRITING",
  }});
  await tx.review.create({data:{bookId:id,decision:"pdf:import",note:"Impor "+parsed.length+" PDF menjadi "+created.length+" bab Markdown; sumber PDF diproses di memori dan tidak disimpan sebagai berkas."}});
  return {chapters:created,stage:"WRITING",files:parsed.length};
 });
 if(typeof result.error==="string")return fail(result.error,result.status);
 return NextResponse.json({ok:true,...result,message:"PDF berhasil dikonversi ke Markdown dan disimpan sebagai bab. File PDF sumber tidak disimpan di server."},{status:201,headers:{"Cache-Control":"no-store"}});
}
