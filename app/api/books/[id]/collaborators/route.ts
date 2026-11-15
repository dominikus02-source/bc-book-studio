import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {canManageCollaborators} from "../../../../../lib/manuscript-access";
import {isCollaboratorAccount} from "../../../../../lib/draft-access";
import {finishWithNotify,reviewMail,sendEach} from "../../../../../lib/notify";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
const fail=(error:string,status:number)=>NextResponse.json({error},{status});

export async function GET(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 const q=(req.nextUrl.searchParams.get("q")??"").trim().slice(0,120);
 const book=await db.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},select:{id:true,ownerId:true}});
 if(!book||!canManageCollaborators(user.id,book.ownerId))return fail("Buku tidak ditemukan.",404);
 const collaborators=await db.bookCollaborator.findMany({
  where:{bookId:id,archivedAt:null},
  include:{user:{select:{id:true,name:true,email:true,role:true,active:true}}},
  orderBy:{createdAt:"asc"},
 });
 const matches=q.length<2?[]:await db.studioUser.findMany({
  where:{
   active:true,
   role:{in:["EDITOR","ADMIN"]},
   id:{not:user.id},
   OR:[{name:{contains:q,mode:"insensitive"}},{email:{contains:q,mode:"insensitive"}}],
  },
  select:{id:true,name:true,email:true,role:true},
  orderBy:[{name:"asc"},{email:"asc"}],
  take:20,
 });
 return NextResponse.json({
  collaborators:collaborators.map(row=>({id:row.id,userId:row.userId,name:row.user.name,email:row.user.email,role:row.user.role,active:row.user.active,createdAt:row.createdAt})),
  matches,
 },{headers:{"Cache-Control":"no-store"}});
}

export async function POST(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 const body=z.object({email:z.string().email().max(254).optional(),userId:z.string().min(1).max(100).optional()}).strict().refine(value=>Boolean(value.email||value.userId)).safeParse(await req.json().catch(()=>null));
 if(!body.success)return fail("Pilih pengguna yang akan ditambahkan.",400);
 const outcome=await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${user.id} FOR UPDATE`;
  const book=await tx.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},select:{id:true,ownerId:true,title:true,status:true}});
  if(!book||!canManageCollaborators(user.id,book.ownerId))return {response:fail("Buku tidak ditemukan.",404),mail:null as (() => Promise<void>)|null};
  if(book.status!=="DRAFT")return {response:fail("Kolaborator hanya dapat diubah saat naskah masih draf.",409),mail:null};
  const person=body.data.userId
   ? await tx.studioUser.findUnique({where:{id:body.data.userId}})
   : await tx.studioUser.findUnique({where:{email:body.data.email!.toLowerCase().trim()}});
  if(!person||!isCollaboratorAccount(person))return {response:fail("Hanya akun editor atau admin yang aktif yang dapat ditambahkan.",404),mail:null};
  if(person.id===user.id||person.id===book.ownerId)return {response:fail("Penulis utama tidak dapat menambahkan dirinya.",409),mail:null};
  const reviewer=await tx.bookReviewer.findUnique({where:{bookId_reviewerId:{bookId:id,reviewerId:person.id}}});
  if(reviewer)return {response:fail("Peninjau buku ini tidak dapat menjadi kolaborator.",409),mail:null};
  const existing=await tx.bookCollaborator.findUnique({where:{bookId_userId:{bookId:id,userId:person.id}}});
  if(existing&&!existing.archivedAt)return {response:NextResponse.json({added:true,id:existing.id,unchanged:true}),mail:null};
  const row=existing
   ? await tx.bookCollaborator.update({where:{id:existing.id},data:{archivedAt:null,addedById:user.id,role:"EDITOR"}})
   : await tx.bookCollaborator.create({data:{bookId:id,userId:person.id,addedById:user.id,role:"EDITOR"}});
  await tx.review.create({data:{bookId:id,decision:"collaborator:add",note:person.id+" by "+user.id}});
  return {response:NextResponse.json({added:true,id:row.id},{status:201}),mail:()=>sendEach([person],target=>reviewMail("collaborator",target,book))};
 });
 return finishWithNotify(outcome.response,outcome.mail);
}

export async function DELETE(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id}=await params;
 const body=z.object({userId:z.string().min(1).max(100)}).strict().safeParse(await req.json().catch(()=>null));
 if(!body.success)return fail("Pilih kolaborator yang akan dihapus.",400);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${user.id} FOR UPDATE`;
  const book=await tx.book.findFirst({where:{id,ownerId:user.id,archivedAt:null},select:{id:true,ownerId:true,status:true}});
  if(!book||!canManageCollaborators(user.id,book.ownerId))return fail("Buku tidak ditemukan.",404);
  if(book.status!=="DRAFT")return fail("Kolaborator hanya dapat diubah saat naskah masih draf.",409);
  const removed=await tx.bookCollaborator.updateMany({where:{bookId:id,userId:body.data.userId,archivedAt:null},data:{archivedAt:new Date()}});
  if(!removed.count)return fail("Kolaborator tidak ditemukan.",404);
  await tx.review.create({data:{bookId:id,decision:"collaborator:remove",note:body.data.userId+" by "+user.id}});
  return NextResponse.json({removed:true});
 });
}
