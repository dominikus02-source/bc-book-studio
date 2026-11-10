import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../lib/db";
import {sessionUser,deny} from "../../../lib/auth";
import {safeExternalUrl} from "../../../lib/isbn-office";
export const runtime="nodejs";
const noStore={"Cache-Control":"no-store"};
const schema=z.object({
 legalName:z.string().trim().min(5).max(180),
 imprintName:z.string().trim().min(2).max(180),
 directorName:z.string().trim().max(180),
 legalAddress:z.string().trim().max(2000),
 correspondenceAddress:z.string().trim().max(2000),
 email:z.union([z.literal(""),z.string().email()]),
 phone:z.string().max(70),
 officialWebsite:z.string().max(600).refine(safeExternalUrl),
 catalogWebsite:z.string().max(600).refine(safeExternalUrl),
 nib:z.string().max(80),kbli:z.string().max(60),
 decreeNumber:z.string().max(180),deedNumber:z.string().max(180),
 perpusnasAccountStatus:z.enum(["NOT_REGISTERED","DRAFT","SUBMITTED_EXTERNAL","ACTIVE","CORRECTION_REQUIRED"]),
 perpusnasReference:z.string().max(600),
 approvalNote:z.string().max(2000)
}).strict();
async function admin(req:NextRequest){const actor=await sessionUser(req);return actor?.role==="ADMIN"?actor:null}
export async function GET(req:NextRequest){
 const actor=await admin(req);if(!actor)return (await sessionUser(req))?NextResponse.json({error:"Only publisher ADMIN can access legal records"},{status:403}):deny();
 const profile=await db.publisherProfile.findUnique({where:{id:"bci-publisher"}});
 const [books,applications]=await Promise.all([db.book.findMany({where:{archivedAt:null},select:{id:true,title:true,author:true,subject:true,pageSize:true,status:true},orderBy:{updatedAt:"desc"},take:500}),db.isbnApplication.findMany({where:{archivedAt:null},select:{id:true,status:true},take:1000})]);
 return NextResponse.json({profile:profile??{id:"bci-publisher",legalName:"PT Bahasa Cerdas Indonesia",imprintName:"Bahasa Cerdas Indonesia"},books,summary:{total:applications.length,draft:applications.filter(x=>x.status==="DRAFT").length,submitted:applications.filter(x=>x.status==="SUBMITTED_EXTERNAL").length,issued:applications.filter(x=>x.status==="ISSUED").length}},{headers:noStore});
}
export async function PUT(req:NextRequest){
 const actor=await admin(req);if(!actor)return NextResponse.json({error:"Forbidden"},{status:403});
 const parsed=schema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message??"Invalid profile"},{status:400});
 if(parsed.data.legalName.toLowerCase()!=="pt bahasa cerdas indonesia")return NextResponse.json({error:"Nama legal PT harus sama dengan akta. Perubahan badan hukum perlu verifikasi independen."},{status:409});
 const data={...parsed.data,updatedById:actor.id};
 const profile=await db.publisherProfile.upsert({where:{id:"bci-publisher"},create:{id:"bci-publisher",...data},update:data});
 return NextResponse.json({profile},{headers:noStore});
}
