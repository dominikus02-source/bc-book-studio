import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {manuscriptVisibilityWhere} from "../../../../../lib/manuscript-access";
import {approvedManuscript} from "../../../../../lib/approval-snapshot";
import {storedLayout} from "../../../../../lib/book-layout";
import {PUBLISHING_EVIDENCE_KINDS,RELEASE_FORMATS,publicationReadiness,validIsbn13} from "../../../../../lib/publishing-readiness";
export const runtime="nodejs";
type Ctx={params:Promise<{id:string}>};
const headers={"Cache-Control":"no-store"};
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers});
const safeHttps=(url:string)=>{try{const u=new URL(url);return u.protocol==="https:"&&!u.username&&!u.password}catch{return false}};
const inputSchema=z.object({
 kind:z.string().refine(v=>PUBLISHING_EVIDENCE_KINDS.includes(v as typeof PUBLISHING_EVIDENCE_KINDS[number])),
 status:z.enum(["SUBMITTED","VERIFIED","REJECTED","NOT_APPLICABLE"]),
 snapshot:z.string().datetime({offset:true}),layoutVersion:z.number().int().nonnegative(),
 note:z.string().trim().min(12).max(4000),referenceUrl:z.string().trim().url().max(2000).refine(safeHttps,"Bukti harus memakai URL HTTPS yang aman.").optional(),
 isbn:z.string().trim().max(40).optional(),checksum:z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
 validator:z.string().trim().max(120).optional(),validatorVersion:z.string().trim().max(100).optional(),
 artifactBytes:z.number().int().positive().max(2_000_000_000).optional(),reviewedSubmissionId:z.string().max(50).optional()
}).strict();
const official=(url?:string)=>{try{if(!url)return false;const u=new URL(url);return u.protocol==="https:"&&u.hostname==="isbn.perpusnas.go.id"&&!u.username&&!u.password}catch{return false}};
async function load(id:string){
 const book=await db.book.findFirst({where:{id,archivedAt:null},include:{chapters:{where:{archivedAt:null}},publishingEvidence:{orderBy:[{createdAt:"desc"},{id:"desc"}],take:200}}});
 if(!book)return null;
 const manuscript=book.approvedAt?await approvedManuscript(db,book):null;
 const layout=book.approvedAt&&manuscript?await storedLayout(db,id,book.approvedAt,manuscript.chapters):{version:0,settings:null};
 return {book,readiness:publicationReadiness(book,{saved:Boolean(layout.settings),version:layout.version},Boolean(manuscript),book.publishingEvidence)};
}
export async function GET(req:NextRequest,{params}:Ctx){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id}=await params;
 if(!await db.book.findFirst({where:manuscriptVisibilityWhere(actor,{id}),select:{id:true}}))return fail("Buku tidak ditemukan.",404);
 const data=await load(id);if(!data)return fail("Buku tidak ditemukan.",404);
 return NextResponse.json({readiness:data.readiness,history:data.book.publishingEvidence,permissions:{canSubmit:data.book.ownerId===actor.id,canReview:actor.role==="ADMIN"&&actor.id!==data.book.ownerId&&Boolean(await db.bookReviewer.count({where:{bookId:id,reviewerId:actor.id}}))}},{headers});
}
export async function POST(req:NextRequest,{params}:Ctx){
 const actor=await sessionUser(req);if(!actor)return deny();
 const parsed=inputSchema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return fail("Bukti tidak valid: "+parsed.error.issues.map(e=>e.message).join("; "),400);
 const {id}=await params;const input=parsed.data;
 if(!await db.book.findFirst({where:manuscriptVisibilityWhere(actor,{id}),select:{id:true}}))return fail("Buku tidak ditemukan.",404);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id=${id} FOR UPDATE`;
  const book=await tx.book.findFirst({where:{id,archivedAt:null},include:{chapters:{where:{archivedAt:null}}}});
  if(!book)return fail("Buku tidak ditemukan.",404);
  if(book.status!=="APPROVED"||!book.approvedAt||book.approvedAt.toISOString()!==input.snapshot)return fail("Snapshot persetujuan sudah tidak berlaku.",409);
  const manuscript=await approvedManuscript(tx,book);
  if(!manuscript)return fail("Snapshot persetujuan tidak tersedia.",409);
  const layout=await storedLayout(tx,id,book.approvedAt,manuscript.chapters);
  if(input.layoutVersion!==layout.version||!layout.settings)return fail("Tata letak berubah atau belum disimpan. Muat ulang.",409);
  const reviewed=input.status!=="SUBMITTED";
  if(reviewed&&(actor.role!=="ADMIN"||actor.id===book.ownerId||!(await tx.bookReviewer.count({where:{bookId:id,reviewerId:actor.id}}))))return fail("Hanya ADMIN yang ditugaskan dan independen dapat memeriksa bukti.",403);
  if(!reviewed&&actor.id!==book.ownerId)return fail("Hanya pemilik buku dapat mengajukan bukti.",403);
  if(input.status==="NOT_APPLICABLE"&&input.kind!=="ISBN")return fail("Tidak berlaku hanya digunakan untuk ISBN.",400);
  if(input.isbn&&!validIsbn13(input.isbn))return fail("Checksum ISBN-13 tidak valid; ini bukan bukti penetapan.",400);
  if(input.kind==="ISBN"&&input.status==="VERIFIED"&&(!input.isbn||!official(input.referenceUrl)))return fail("ISBN memerlukan nomor valid dan URL bukti resmi Perpusnas.",400);
  if(input.kind==="ISBN"&&input.status==="NOT_APPLICABLE"&&(!input.referenceUrl||!official(input.referenceUrl)||input.note.trim().length<35))
   return fail("Keputusan ISBN tidak berlaku membutuhkan rujukan aturan resmi Perpusnas dan alasan penerapan yang lengkap.",400);
  if(reviewed&&input.status==="VERIFIED"&&input.kind==="KDT"&&!input.referenceUrl&&!input.checksum)return fail("Bukti KDT harus melampirkan URL HTTPS atau SHA-256 dokumen resmi.",400);
  if(reviewed&&input.status==="VERIFIED"&&input.kind==="BARCODE"&&(!input.checksum||!input.referenceUrl))return fail("Barcode ISBN memerlukan URL bukti dan SHA-256 gambar/berkas barcode.",400);
  if(reviewed&&input.status==="VERIFIED"&&input.kind==="PUBLISHER"&&!input.referenceUrl&&!input.checksum)return fail("Status penerbit harus didukung dokumen legal atau URL verifikasi.",400);
  if(reviewed&&input.status==="VERIFIED"&&["CATALOG","DISTRIBUTION_PLAN","DISTRIBUTION_RECEIPT","DEPOSIT_RECEIPT","RIGHTS"].includes(input.kind)&&!input.referenceUrl&&!input.checksum)
   return fail("Catatan verifikasi ini memerlukan URL bukti HTTPS atau checksum dokumen.",400);

  if(input.kind.startsWith("FORMAT_")&&reviewed){
   const format=input.kind.slice(7);
   if(!RELEASE_FORMATS.includes(format as typeof RELEASE_FORMATS[number]))return fail("Format belum mempunyai artefak/validator yang terbukti.",409);
   if(input.status==="VERIFIED"&&(!input.checksum||!input.validator||!input.validatorVersion||!input.artifactBytes||!input.referenceUrl))return fail("Lampirkan SHA-256, ukuran, validator/version, URL laporan.",400);
  }
  if(reviewed){
   if(!input.reviewedSubmissionId)return fail("Pilih ID pengajuan yang ditinjau.",400);
   const before=await tx.bookPublishingEvidence.findFirst({where:{id:input.reviewedSubmissionId,bookId:id,kind:input.kind,status:"SUBMITTED",approvedAt:book.approvedAt,layoutVersion:layout.version,actorId:book.ownerId}});
   if(!before)return fail("Pengajuan yang berlaku tidak ditemukan.",409);
   if(input.kind==="RELEASE_SIGNOFF"&&input.status==="VERIFIED"){
    const history=await tx.bookPublishingEvidence.findMany({where:{bookId:id,approvedAt:book.approvedAt,layoutVersion:layout.version}});
    const ready=publicationReadiness(book,{saved:true,version:layout.version},true,history);
    if(ready.problems.length||ready.checks.some(c=>c.requiredBeforePublish&&c.kind!=="RELEASE_SIGNOFF"&&!c.satisfied))return fail("Bukti belum lengkap. Persetujuan rilis ditolak.",409);
   }
  }
  const created=await tx.bookPublishingEvidence.create({data:{bookId:id,actorId:actor.id,kind:input.kind,status:input.status,approvedAt:book.approvedAt,layoutVersion:layout.version,note:input.note,referenceUrl:input.referenceUrl??null,isbn:input.isbn??null,checksum:input.checksum??null,validator:input.validator??null,validatorVersion:input.validatorVersion??null,artifactBytes:input.artifactBytes??null,reviewedSubmissionId:input.reviewedSubmissionId??null}});
  await tx.review.create({data:{bookId:id,decision:"evidence:"+input.kind+":"+input.status,note:"Evidence "+created.id+" by "+actor.id}});
  return NextResponse.json({id:created.id,kind:created.kind,status:created.status,snapshot:book.approvedAt.toISOString(),layoutVersion:layout.version},{status:201,headers});
 });
}
