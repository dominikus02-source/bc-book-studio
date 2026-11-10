import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {approvedManuscript} from "../../../../../lib/approval-snapshot";
import {storedLayout} from "../../../../../lib/book-layout";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {paperSizes,paperSpec} from "../../../../../lib/paper-sizes";
import {kickExportJobs} from "../../../../../lib/export-job-runner";
export const runtime="nodejs";
type C={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:C){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id}=await params;
 const book=await db.book.findFirst({where:{id,ownerId:actor.id,archivedAt:null},select:{id:true}});
 if(!book)return NextResponse.json({error:"Book not found"},{status:404});
 const jobs=await db.exportJob.findMany({where:{bookId:id,ownerId:actor.id},orderBy:{createdAt:"desc"},take:15,select:{id:true,status:true,sizes:true,preview:true,progress:true,currentStep:true,cancellationRequested:true,resultBytes:true,resultSha256:true,error:true,createdAt:true,updatedAt:true}});
 kickExportJobs();
 return NextResponse.json({jobs},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:NextRequest,{params}:C){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id}=await params;
 const book=await db.book.findFirst({where:{id,ownerId:actor.id,archivedAt:null},select:{id:true,status:true,pageSize:true}});
 if(!book)return NextResponse.json({error:"Book not found"},{status:404});
 if(process.env.NODE_ENV==="production"&&(!process.env.QUARTO_WORKER_URL||!process.env.EXPORT_ARTIFACT_DIR||process.env.EXPORT_WORKER_ENABLED!=="true"))return NextResponse.json({error:"Aktifkan service export:worker terpisah, Quarto Worker v2 dan volume artefak persisten sebelum mengantrekan ZIP di produksi"},{status:503});
 const body=await req.json().catch(()=>null);
 const preview=body?.preview===true;
 if(!preview&&book.status!=="APPROVED")return NextResponse.json({error:"Buku belum disetujui untuk ekspor final"},{status:409});
 if(!["all","single"].includes(body?.scope))return NextResponse.json({error:"Invalid ZIP scope"},{status:400});
 const paper=paperSpec(body?.size||book.pageSize||"a4");
 if(body.scope==="single"&&!paper)return NextResponse.json({error:"Invalid paper size"},{status:400});
 const result=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "StudioUser" WHERE id = ${actor.id} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${actor.id} FOR UPDATE`;
  const current=await tx.book.findFirst({where:{id,ownerId:actor.id,archivedAt:null}});
  if(!current)return {error:"Book not found",status:404};
  if(!preview&&current.status!=="APPROVED")return {error:"Persetujuan berubah. Muat ulang sebelum ekspor.",status:409};
  if(await tx.exportJob.count({where:{ownerId:actor.id,status:{in:["QUEUED","RUNNING"]}}}))return {error:"Masih ada pekerjaan ekspor aktif.",status:409};
  const snapshot=!preview?await approvedManuscript(tx,current):null;
  if(!preview&&!snapshot)return {error:"Snapshot lengkap belum tersedia. Ajukan review ulang.",status:409};
  const layout=snapshot&&current.approvedAt?await storedLayout(tx,id,current.approvedAt,snapshot.chapters):null;
  const pagination=await tx.bookPagination.findUnique({where:{bookId:id}});
  const sizes=body.scope==="all"?paperSizes.map(x=>x.id):[paper!.id];
  const job=await tx.exportJob.create({data:{bookId:id,ownerId:actor.id,preview,sizes,status:"QUEUED",currentStep:"Menunggu renderer",
   sourceApprovedAt:snapshot?current.approvedAt:null,sourceSnapshotHash:snapshot?createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"):null,sourceLayoutVersion:layout?.version??0,sourcePaginationVersion:pagination?.version??0},select:{id:true,status:true,progress:true}});
  return {job,status:202};
 });
 if("error" in result)return NextResponse.json({error:result.error},{status:result.status});
 const job=result.job;
 kickExportJobs();
 return NextResponse.json({job},{status:202,headers:{"Cache-Control":"no-store"}});
}