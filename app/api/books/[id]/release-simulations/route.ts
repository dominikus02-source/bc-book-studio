import {NextRequest,NextResponse} from "next/server";
import type {Prisma} from "@prisma/client";
import {z} from "zod";
import {db} from "@/lib/db";
import {sessionUser,deny} from "@/lib/auth";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
const fields=z.object({
 kind:z.enum(["PDF_METADATA","VENDOR_PREFLIGHT","OFFICIAL_DOCUMENT","PHYSICAL_PROOF","EPUB_READER","MANUAL_ACCESSIBILITY","DISTRIBUTOR","BAHASACERDAS"]),
 result:z.enum(["PENDING","SIMULATED_PASS","SIMULATED_FAIL"]),
 summary:z.string().trim().min(12).max(4000),
 target:z.string().trim().max(500),
});
const input=z.discriminatedUnion("action",[
 z.object({action:z.literal("create"),data:fields}).strict(),
 z.object({action:z.literal("update"),recordId:z.string().min(1),expectedVersion:z.string().datetime({offset:true}),data:fields}).strict(),
 z.object({action:z.enum(["archive","restore"]),recordId:z.string().min(1),expectedVersion:z.string().datetime({offset:true})}).strict(),
]);
const respond=(body:object,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
async function owner(req:NextRequest,id:string){
 const user=await sessionUser(req);
 if(!user)return null;
 return db.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},select:{id:true,ownerId:true,approvedAt:true,updatedAt:true}});
}
export async function GET(req:NextRequest,{params}:Context){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params,book=await owner(req,id);
 if(!book)return respond({error:"Buku tidak ditemukan."},404);
 const rows=await db.studioFormDraft.findMany({where:{ownerId:book.ownerId,module:"RELEASE_SIMULATION:"+id},orderBy:[{updatedAt:"desc"},{id:"desc"}],take:100});
 return respond({simulation:true,records:rows.map(row=>({id:row.id,version:row.updatedAt.toISOString(),...row.payload as object})),snapshot:book.approvedAt?.toISOString()??null});
}
export async function POST(req:NextRequest,{params}:Context){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params,parsed=input.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return respond({error:"Isian simulasi tidak valid."},400);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id=${id} AND "ownerId"=${user.id} AND "archivedAt" IS NULL FOR UPDATE`;
  const book=await tx.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},select:{id:true,approvedAt:true,updatedAt:true}});
  if(!book)return respond({error:"Buku tidak ditemukan."},404);
  const moduleKey="RELEASE_SIMULATION:"+id;
  const layout=book.approvedAt?await tx.bookLayout.findUnique({where:{bookId_approvedAt:{bookId:id,approvedAt:book.approvedAt}},select:{version:true}}):null;
  const binding={simulation:true,bookId:id,snapshot:book.approvedAt?.toISOString()??null,layoutVersion:layout?.version??0,sourceVersion:book.updatedAt.toISOString()};
  const command=parsed.data;
  if(command.action==="create"){
   if(await tx.studioFormDraft.count({where:{ownerId:user.id,module:moduleKey}})>=100)return respond({error:"Maksimal 100 catatan simulasi per buku."},429);
   const row=await tx.studioFormDraft.create({data:{ownerId:user.id,module:moduleKey,title:"SIMULASI "+command.data.kind,payload:{...command.data,...binding,archived:false}}});
   return respond({record:{id:row.id,version:row.updatedAt.toISOString(),...row.payload as object}},201);
  }
  const row=await tx.studioFormDraft.findFirst({where:{id:command.recordId,ownerId:user.id,module:moduleKey}});
  if(!row)return respond({error:"Catatan tidak ditemukan."},404);
  if(row.updatedAt.toISOString()!==command.expectedVersion)return respond({error:"Versi berubah. Muat ulang sebelum menyimpan."},409);
  const previous=row.payload as Record<string,unknown>;
  if(command.action==="update"&&previous.archived)return respond({error:"Pulihkan catatan sebelum menyunting."},409);
  const payload=command.action==="update"?{...command.data,...binding,archived:false}:{...previous,archived:command.action==="archive"};
  const saved=await tx.studioFormDraft.updateMany({where:{id:row.id,ownerId:user.id,module:moduleKey,updatedAt:row.updatedAt},data:{payload:payload as Prisma.InputJsonValue}});
  if(!saved.count)return respond({error:"Versi berubah. Muat ulang sebelum menyimpan."},409);
  const current=await tx.studioFormDraft.findUniqueOrThrow({where:{id:row.id}});
  return respond({record:{id:current.id,version:current.updatedAt.toISOString(),...current.payload as object}});
 });
}
