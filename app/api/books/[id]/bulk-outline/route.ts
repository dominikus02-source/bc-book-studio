import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import type {Prisma} from "@prisma/client";
import {z} from "zod";
import {db} from "../../../../../lib/db";
import {identity,deny} from "../../../../../lib/auth";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
const genre=z.enum(["FANTASY","ROMANCE","SCI_FI","NONFICTION","THRILLER"]);
const tier=z.enum(["PUBLIC","PREMIUM","DRAFT"]);
const row=z.object({
 chapterTitle:z.string().trim().min(2).max(180),
 subsectionTitle:z.string().trim().min(2).max(180),
 sortOrder:z.number().int().min(1).max(1000),
 content:z.string().trim().min(80).max(12000).refine(v=>v.split(/\n\s*\n/).filter(x=>x.trim()).length>=2,"Konten harus memiliki dua paragraf"),
 genreTarget:genre,
 accessTier:tier
}).strict();
const payload=z.object({expectedVersion:z.string().min(32).max(128),rows:z.array(row).min(1).max(200)}).strict();
const fail=(error:string,status:number,code?:string)=>NextResponse.json({error,...code?{code}:{}},{status,headers:{"Cache-Control":"no-store"}});
function key(s:string){return s.trim().replace(/\s+/g," ").toLocaleLowerCase("id-ID")}
async function snapshot(tx:Prisma.TransactionClient,id:string){
 const chapters=await tx.chapter.findMany({where:{bookId:id,archivedAt:null},orderBy:[{position:"asc"},{id:"asc"}],select:{
  id:true,title:true,position:true,updatedAt:true,
  outlineSections:{where:{archivedAt:null},orderBy:[{position:"asc"},{id:"asc"}],select:{id:true,title:true,content:true,genreTarget:true,accessTier:true,position:true,parentId:true,updatedAt:true}}
 }});
 const version=createHash("sha256").update(JSON.stringify(chapters)).digest("hex");
 return {chapters,version};
}
export async function GET(req:NextRequest,{params}:Ctx){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id}=await params;
 const book=await db.book.findFirst({where:{id,ownerId,archivedAt:null},select:{id:true,title:true,status:true,editorialStage:true}});
 if(!book)return fail("Book not found",404);
 const state=await db.$transaction(async tx=>snapshot(tx,id));
 const archived=await db.outlineSection.findMany({where:{bookId:id,archivedAt:{not:null},parentId:null,chapter:{archivedAt:null}},select:{id:true,chapterId:true,title:true,updatedAt:true,chapter:{select:{title:true}}},orderBy:{archivedAt:"desc"}});
 const rows=state.chapters.flatMap(ch=>ch.outlineSections.filter(s=>!s.parentId).map(sec=>({
  id:sec.id,chapterId:ch.id,chapterTitle:ch.title,subsectionTitle:sec.title,sortOrder:sec.position,
  content:sec.content,genreTarget:sec.genreTarget,accessTier:sec.accessTier,updatedAt:sec.updatedAt
 })));
 return NextResponse.json({book,version:state.version,rows,archivedRows:archived.map(s=>({id:s.id,chapterId:s.chapterId,chapterTitle:s.chapter.title,subsectionTitle:s.title,updatedAt:s.updatedAt}))},{headers:{"Cache-Control":"private, no-store"}});
}
export async function POST(req:NextRequest,{params}:Ctx){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id}=await params;
 const raw=await req.json().catch(()=>null);
 const parsed=payload.safeParse(raw);
 if(!parsed.success)return fail(parsed.error.issues.map(issue=>issue.path.join(".")+": "+issue.message).join("; "),400);
 const {rows,expectedVersion}=parsed.data;
 const chaptersByName=new Map<string,{title:string;seen:Set<string>;orders:Set<number>}>();
 for(const item of rows){
  const chapterKey=key(item.chapterTitle),sectionKey=key(item.subsectionTitle);
  let group=chaptersByName.get(chapterKey);
  if(!group){group={title:item.chapterTitle,seen:new Set(),orders:new Set()};chaptersByName.set(chapterKey,group)}
  if(group.seen.has(sectionKey))return fail("Nama subbagian ganda pada bab "+group.title,400);
  if(group.orders.has(item.sortOrder))return fail("Nomor urut ganda pada bab "+group.title,400);
  group.seen.add(sectionKey);group.orders.add(item.sortOrder);
 }
 try{
 return await db.$transaction(async tx=>{
  const [locked]=await tx.$queryRaw<{id:string;status:string;editorialStage:string}[]>`SELECT id,status,"editorialStage" FROM "Book" WHERE id=${id} AND "ownerId"=${ownerId} AND "archivedAt" IS NULL FOR UPDATE`;
  if(!locked)return fail("Book not found",404);
  if(locked.status!=="DRAFT"||!["OUTLINE","WRITING","EDITING"].includes(locked.editorialStage))return fail("Stage Rancang belum aktif atau buku terkunci",409);
  const current=await snapshot(tx,id);
  if(expectedVersion!==current.version)return fail("Data berubah dari sesi lain. Muat ulang sebelum impor.",409,"BULK_VERSION_CONFLICT");
  const allChapters=await tx.chapter.findMany({where:{bookId:id},orderBy:{position:"asc"}});
  const map=new Map(current.chapters.map(ch=>[key(ch.title),ch]));
  let nextChapterOrder=Math.max(0,...allChapters.map(x=>x.position));
  let createdChapters=0,createdSections=0,updatedSections=0,unchanged=0,reorderedSections=0;
  // One transaction: partial bulk writes are never committed.
  for(const [chapterKey,group] of chaptersByName){
   const chapterRows=rows.filter(r=>key(r.chapterTitle)===chapterKey).sort((a,b)=>a.sortOrder-b.sortOrder);
   const chapter=map.get(chapterKey)??await (async()=>{
    const made=await tx.chapter.create({data:{bookId:id,title:group.title,position:++nextChapterOrder,outlineObjective:"Susun tujuan bab dan verifikasi struktur.",content:""}});
    createdChapters++;return {...made,outlineSections:[]};
   })();
   const existing=await tx.outlineSection.findMany({where:{bookId:id,chapterId:chapter.id,archivedAt:null,parentId:null},orderBy:[{position:"asc"},{createdAt:"asc"}]});
   const used=new Set<string>();
   const merged=new Map(existing.map(s=>[key(s.title),s]));
   // Keep old sections not mentioned in the sheet, append after the imported rows.
   let index=0;
   for(const item of chapterRows){
    const label=key(item.subsectionTitle);
    const currentRow=merged.get(label);
    if(currentRow){
     used.add(currentRow.id);
     const changes={title:item.subsectionTitle,content:item.content,genreTarget:item.genreTarget,accessTier:item.accessTier,position:++index};
     const same=Object.entries(changes).every(([k,v])=>(currentRow as unknown as Record<string,unknown>)[k]===v);
     if(same){unchanged++;continue}
     await tx.outlineSectionRevision.create({data:{sectionId:currentRow.id,actorId:ownerId,action:"BULK_UPDATE",snapshot:{title:currentRow.title,objective:currentRow.objective,content:currentRow.content,genreTarget:currentRow.genreTarget,accessTier:currentRow.accessTier,position:currentRow.position}}});
     await tx.outlineSection.update({where:{id:currentRow.id},data:changes});updatedSections++;
    }else{
     const newSection=await tx.outlineSection.create({data:{bookId:id,chapterId:chapter.id,parentId:null,position:++index,title:item.subsectionTitle,objective:"Tinjau tujuan dan keterkaitan subbagian.",content:item.content,genreTarget:item.genreTarget,accessTier:item.accessTier}});
     await tx.outlineSectionRevision.create({data:{sectionId:newSection.id,actorId:ownerId,action:"BULK_CREATE",snapshot:{title:newSection.title,content:newSection.content,position:newSection.position,genreTarget:newSection.genreTarget,accessTier:newSection.accessTier}}});
     createdSections++;
    }
   }
   for(const stale of existing.filter(s=>!used.has(s.id))){
    if(stale.position===++index)continue;
    await tx.outlineSectionRevision.create({data:{sectionId:stale.id,actorId:ownerId,action:"BULK_REORDER",snapshot:{position:stale.position,title:stale.title}}});
    await tx.outlineSection.update({where:{id:stale.id},data:{position:index}});reorderedSections++;
   }
  }
  if(createdChapters||createdSections||updatedSections||reorderedSections)await tx.review.create({data:{bookId:id,decision:"outline:bulk_import",note:"Actor: "+ownerId+"; rows: "+rows.length+"; chapters: "+createdChapters+"; created sections: "+createdSections+"; updated sections: "+updatedSections+"; reordered: "+reorderedSections}});
  const after=await snapshot(tx,id);
  return NextResponse.json({ok:true,createdChapters,createdSections,updatedSections,reorderedSections,unchanged,version:after.version},{headers:{"Cache-Control":"no-store"}});
 },{timeout:30000});
 }catch(e){console.error("Bulk import transaction failed",e);return fail("Bulk import gagal; transaksi dibatalkan tanpa menyimpan sebagian data",500)}
}
