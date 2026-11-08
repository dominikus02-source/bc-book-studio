import {NextRequest,NextResponse} from "next/server";
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
 if(!book)return NextResponse.json({error:"Buku tidak ditemukan atau tidak memiliki akses."},{status:404});
 const jobs=await db.exportJob.findMany({where:{bookId:id,ownerId:actor.id},orderBy:{createdAt:"desc"},take:15,select:{id:true,status:true,sizes:true,preview:true,progress:true,currentStep:true,cancellationRequested:true,resultBytes:true,resultSha256:true,error:true,createdAt:true,updatedAt:true}});
 kickExportJobs();
 return NextResponse.json({jobs},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:NextRequest,{params}:C){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id}=await params;
 const book=await db.book.findFirst({where:{id,ownerId:actor.id,archivedAt:null},select:{id:true,status:true,pageSize:true}});
 if(!book)return NextResponse.json({error:"Buku tidak ditemukan atau tidak memiliki akses."},{status:404});
 if(process.env.NODE_ENV==="production"&&(!process.env.QUARTO_WORKER_URL||!process.env.EXPORT_ARTIFACT_DIR||process.env.EXPORT_WORKER_ENABLED!=="true")){
  return NextResponse.json({error:"Layanan export worker, Quarto, dan volume artefak belum siap di produksi. Hubungi admin."},{status:503});
 }
 const body=await req.json().catch(()=>null);
 if(!body||typeof body!=="object")return NextResponse.json({error:"Body permintaan tidak valid."},{status:400});
 const preview=body.preview===true;
 if(!preview&&book.status!=="APPROVED")return NextResponse.json({error:"Buku belum disetujui. Hanya pratinjau yang diizinkan."},{status:409});
 if(!["all","single"].includes(body.scope))return NextResponse.json({error:"Scope harus 'all' atau 'single'."},{status:400});
 const paper=paperSpec(body.size||book.pageSize||"a4");
 if(body.scope==="single"&&!paper)return NextResponse.json({error:"Ukuran kertas tidak didukung."},{status:400});
 const active=await db.exportJob.count({where:{ownerId:actor.id,status:{in:["QUEUED","RUNNING"]}}});
 if(active>0)return NextResponse.json({error:"Masih ada pekerjaan ekspor aktif. Tunggu atau batalkan terlebih dahulu."},{status:409});
 const sizes=body.scope==="all"?paperSizes.map(x=>x.id):[paper!.id];
 const job=await db.exportJob.create({data:{bookId:id,ownerId:actor.id,preview,sizes,status:"QUEUED",currentStep:"Menunggu renderer"},select:{id:true,status:true,progress:true,currentStep:true}});
 kickExportJobs();
 return NextResponse.json({job},{status:202,headers:{"Cache-Control":"no-store"}});
}
