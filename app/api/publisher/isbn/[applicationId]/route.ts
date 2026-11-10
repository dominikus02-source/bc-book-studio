import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {payload} from "../../../../../lib/isbn-application-schema";
import {requiredForBasis,sanitizeIsbn,isbnValid,isPerpusnasEvidence,safeExternalUrl,ISBN_STATUSES} from "../../../../../lib/isbn-office";
export const runtime="nodejs";
type C={params:Promise<{applicationId:string}>};
const change=z.object({fields:payload.omit({bookId:true}).partial().optional(),status:z.enum(ISBN_STATUSES).optional(),externalReference:z.string().max(800).optional(),officialEvidenceUrl:z.string().max(800).refine(safeExternalUrl).optional(),isbn13:z.string().max(40).optional(),kdtReference:z.string().max(800).optional(),barcodeReference:z.string().max(800).optional()}).strict();
const allowed:Record<string,string[]>={
 DRAFT:["DOCUMENTS_READY","CANCELLED"],DOCUMENTS_READY:["DRAFT","SUBMITTED_EXTERNAL","CANCELLED"],
 SUBMITTED_EXTERNAL:["CORRECTION_REQUIRED","ISSUED","REJECTED"],
 CORRECTION_REQUIRED:["DOCUMENTS_READY","REJECTED"],ISSUED:["PUBLISHED"],PUBLISHED:[],REJECTED:[],CANCELLED:[]
};
export async function PATCH(req:NextRequest,{params}:C){
 const actor=await sessionUser(req);if(!actor)return deny();if((actor.role!=="ADMIN"&&actor.role!=="SUPERADMIN"))return NextResponse.json({error:"Forbidden"},{status:403});
 const {applicationId}=await params,parsed=change.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message},{status:400});
 const input=parsed.data;
 try{
 return await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "IsbnApplication" WHERE id=${applicationId} FOR UPDATE`;
  const app=await tx.isbnApplication.findUnique({where:{id:applicationId},include:{documents:{select:{kind:true}}}});
  if(!app||app.archivedAt)return NextResponse.json({error:"Not found"},{status:404});
  if(input.fields&&app.status!=="DRAFT"&&app.status!=="CORRECTION_REQUIRED")return NextResponse.json({error:"Edition metadata locked after submission; return to correction workflow."},{status:409});
  const next=input.status??app.status;
  if(next!==app.status&&!allowed[app.status]?.includes(next))return NextResponse.json({error:"Invalid status transition: "+app.status+" → "+next},{status:409});
  const externalReference=input.externalReference??app.externalReference;
  const officialEvidenceUrl=input.officialEvidenceUrl??app.officialEvidenceUrl;
  const isbn=sanitizeIsbn(input.isbn13??app.isbn13??"");
  const set=new Set(app.documents.map(x=>x.kind));
  const rights=input.fields?.rightsBasis??app.rightsBasis;
  const missing=requiredForBasis(rights).filter(x=>!set.has(x));
  const pub=await tx.publisherProfile.findUnique({where:{id:app.publisherId}});
  const linkedBook=await tx.book.findUnique({where:{id:app.bookId},select:{status:true,approvedAt:true}});
  if(next==="DOCUMENTS_READY"&&next!==app.status&&missing.length)return NextResponse.json({error:"Berkas belum lengkap: "+missing.join(", ")},{status:409});
  if(next==="SUBMITTED_EXTERNAL"&&next!==app.status&&(!pub||pub.perpusnasAccountStatus!=="ACTIVE"||!app.catalogUrl||!externalReference||missing.length||linkedBook?.status!=="APPROVED"||!linkedBook.approvedAt))return NextResponse.json({error:"Perlu naskah APPROVED, akun Perpusnas ACTIVE, URL katalog spesifik, berkas lengkap dan referensi pengiriman eksternal"},{status:409});
  if(next==="ISSUED"&&next!==app.status&&(!isbnValid(isbn)||(!isPerpusnasEvidence(officialEvidenceUrl)&&!set.has("isbn_result"))))return NextResponse.json({error:"ISBN-13 valid dan bukti resmi (PDF penetapan atau URL portal ISBN Perpusnas) wajib untuk status ISSUED"},{status:409});
  if(next==="PUBLISHED"&&next!==app.status&&(!isbnValid(isbn)||!app.issuedAt))return NextResponse.json({error:"Bukti terbit tidak dapat dicatat sebelum ISBN diterbitkan"},{status:409});
  if(input.isbn13&&!isbnValid(isbn))return NextResponse.json({error:"ISBN-13 check digit invalid"},{status:400});
  if(input.officialEvidenceUrl&&!isPerpusnasEvidence(input.officialEvidenceUrl))return NextResponse.json({error:"Evidence URL harus berasal dari portal resmi ISBN Perpusnas"},{status:400});
  const updated=await tx.isbnApplication.update({where:{id:app.id},data:{...input.fields,...(input.fields?.plannedPublicationYear===null?{plannedPublicationYear:null}:{}),status:next,externalReference,officialEvidenceUrl,isbn13:isbn||null,kdtReference:input.kdtReference??app.kdtReference,barcodeReference:input.barcodeReference??app.barcodeReference,...(next==="SUBMITTED_EXTERNAL"&&!app.submittedAt?{submittedAt:new Date()}:{}),...(next==="ISSUED"&&!app.issuedAt?{issuedAt:new Date()}:{}),...(next==="PUBLISHED"&&!app.publishedAt?{publishedAt:new Date()}:{} )}});
  await tx.isbnEvent.create({data:{applicationId:app.id,actorId:actor.id,action:next!==app.status?"STATUS_"+next:"UPDATED",detail:{previous:app.status,newStatus:next,fields:Object.keys(input.fields??{}),reference:externalReference}}});
  return NextResponse.json({application:updated},{headers:{"Cache-Control":"no-store"}});
 });
 }catch(e){return NextResponse.json({error:e instanceof Error&&e.message.includes("Unique constraint")?"ISBN already assigned to another edition":"Update failed"},{status:409})}
}
export async function DELETE(req:NextRequest,{params}:C){
 const actor=await sessionUser(req);if(!actor)return deny();if((actor.role!=="ADMIN"&&actor.role!=="SUPERADMIN"))return NextResponse.json({error:"Forbidden"},{status:403});
 const {applicationId}=await params,app=await db.isbnApplication.findUnique({where:{id:applicationId}});
 if(!app||app.archivedAt)return NextResponse.json({error:"Not found"},{status:404});
 if(!["DRAFT","CANCELLED","REJECTED"].includes(app.status))return NextResponse.json({error:"Submitted/issued records are immutable and cannot be deleted"},{status:409});
 await db.$transaction([db.isbnApplication.update({where:{id:applicationId},data:{archivedAt:new Date()}}),db.isbnEvent.create({data:{applicationId,actorId:actor.id,action:"ARCHIVED",detail:{status:app.status}}})]);
 return NextResponse.json({archived:true});
}
