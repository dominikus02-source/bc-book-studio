import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {db} from "../../../../lib/db";
import {sessionUser,deny} from "../../../../lib/auth";
export const runtime="nodejs";
const kinds=["LEGAL_CERTIFICATE","NIB_KBLI","DEED","ISBN_MEMBERSHIP_SIGNED","CATALOG_EVIDENCE"] as const;
export async function GET(req:NextRequest){
 const actor=await sessionUser(req);if(!actor)return deny();
 if((actor.role!=="ADMIN"&&actor.role!=="SUPERADMIN"))return NextResponse.json({error:"Forbidden"},{status:403});
 const documents=await db.publisherDocument.findMany({where:{publisherId:"bci-publisher",archivedAt:null},select:{id:true,kind:true,filename:true,size:true,sha256:true,createdAt:true},orderBy:{createdAt:"desc"}});
 return NextResponse.json({documents},{headers:{"Cache-Control":"private, no-store"}});
}
export async function POST(req:NextRequest){
 const actor=await sessionUser(req);if(!actor)return deny();
 if((actor.role!=="ADMIN"&&actor.role!=="SUPERADMIN"))return NextResponse.json({error:"Forbidden"},{status:403});
 if(Number(req.headers.get("content-length")||0)>9*1024*1024)return NextResponse.json({error:"PDF max 8 MB"},{status:413});
 const form=await req.formData().catch(()=>null),file=form?.get("file"),kind=form?.get("kind");
 if(!(file instanceof File)||typeof kind!=="string"||!kinds.includes(kind as typeof kinds[number]))return NextResponse.json({error:"PDF and document type required"},{status:400});
 if(file.size<100||file.size>8*1024*1024||!file.name.toLowerCase().endsWith(".pdf"))return NextResponse.json({error:"PDF must be between 100B and 8 MB"},{status:413});
 const bytes=Buffer.from(await file.arrayBuffer());if(bytes.subarray(0,5).toString("ascii")!=="%PDF-")return NextResponse.json({error:"PDF signature invalid"},{status:400});
 if(/\/(?:JavaScript|JS|Launch|EmbeddedFiles|OpenAction)\b/.test(bytes.toString("latin1")))return NextResponse.json({error:"Active PDF content is not permitted"},{status:400});
 const exists=await db.publisherProfile.findUnique({where:{id:"bci-publisher"},select:{id:true}});
 if(!exists)return NextResponse.json({error:"Save publisher profile first"},{status:409});
 const sha256=createHash("sha256").update(bytes).digest("hex");
 const created=await db.publisherDocument.create({data:{publisherId:"bci-publisher",uploaderId:actor.id,kind,filename:file.name.slice(0,180),mime:"application/pdf",size:bytes.length,sha256,bytes},select:{id:true,kind:true,size:true,sha256:true,filename:true}});
 return NextResponse.json({document:created},{status:201,headers:{"Cache-Control":"no-store"}});
}
