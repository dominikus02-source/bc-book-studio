import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../lib/db";
import {reviewerAccess} from "../../../../lib/reviewer-access";
export const runtime="nodejs";
const input=z.object({bookId:z.string().min(10),chapterId:z.string().nullable().optional(),category:z.enum(["CONTENT","FACT","CITATION","LANGUAGE","ACCESSIBILITY","COPYRIGHT","PEDAGOGY"]),severity:z.enum(["SUGGESTION","MAJOR","CRITICAL"]),content:z.string().trim().min(3).max(10000)}).strict();
export async function POST(req:NextRequest){
 const p=input.safeParse(await req.json().catch(()=>null));
 if(!p.success)return NextResponse.json({error:"Data catatan tidak valid. Periksa kategori, prioritas, dan isi (minimal 3 karakter)."},{status:400});
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${p.data.bookId} FOR UPDATE`;
  const access=await reviewerAccess(req,p.data.bookId,tx);
  if(!access)return NextResponse.json({error:"Akses ditolak. Pastikan Anda ditugaskan sebagai reviewer dan bukan pemilik buku."},{status:403});
  if(access.book.status!=="REVIEW")return NextResponse.json({error:"Buku tidak sedang dalam tahap REVIEW."},{status:409});
  if(p.data.chapterId&&!await tx.chapter.findFirst({where:{id:p.data.chapterId,bookId:p.data.bookId,archivedAt:null}}))return NextResponse.json({error:"Bab tidak ditemukan atau telah diarsipkan."},{status:400});
  const note=await tx.reviewerNote.create({data:{bookId:p.data.bookId,reviewerId:access.actor.id,chapterId:p.data.chapterId||null,category:p.data.category,severity:p.data.severity,content:p.data.content}});
  await tx.review.create({data:{bookId:p.data.bookId,decision:"note:create",note:note.id+" by "+access.actor.id}});
  return NextResponse.json({note},{status:201});
 });
}
