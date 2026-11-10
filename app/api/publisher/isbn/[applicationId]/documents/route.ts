import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {db} from "../../../../../../lib/db";
import {sessionUser,deny} from "../../../../../../lib/auth";
import {ISBN_DOCUMENTS} from "../../../../../../lib/isbn-office";
export const runtime="nodejs";
type C={params:Promise<{applicationId:string}>};
export async function POST(req:NextRequest,{params}:C){
 const actor=await sessionUser(req);if(!actor)return deny();if(actor.role!=="ADMIN")return NextResponse.json({error:"Forbidden"},{status:403});
 const {applicationId}=await params;const app=await db.isbnApplication.findUnique({where:{id:applicationId}});
 if(!app||app.archivedAt)return NextResponse.json({error:"Not found"},{status:404});
 if(!["DRAFT","CORRECTION_REQUIRED","DOCUMENTS_READY"].includes(app.status))return NextResponse.json({error:"Submitted application documents are locked"},{status:409});
 const length=Number(req.headers.get("content-length")||0);if(length>9*1024*1024)return NextResponse.json({error:"Maksimum upload 8 MB PDF"},{status:413});
 const form=await req.formData().catch(()=>null);const file=form?.get("file"),kind=form?.get("kind");
 if(!(file instanceof File)||typeof kind!=="string"||!ISBN_DOCUMENTS.some(x=>x[0]===kind))return NextResponse.json({error:"Valid PDF file and document kind required"},{status:400});
 if(file.size<100||file.size>5*1024*1024||!file.name.toLowerCase().endsWith(".pdf"))return NextResponse.json({error:"Dokumen PDF harus 100 byte sampai 5 MB"},{status:413});
 const bytes=Buffer.from(await file.arrayBuffer());
 if(bytes.subarray(0,5).toString("ascii")!=="%PDF-")return NextResponse.json({error:"PDF signature invalid"},{status:400});
 if(/\/(?:JavaScript|JS|Launch|EmbeddedFiles|OpenAction)\b/.test(bytes.toString("latin1")))return NextResponse.json({error:"PDF mengandung fitur aktif/embedded yang tidak diizinkan"},{status:400});
 const stampMode=String(form?.get("stampMode")||"NONE"),attested=form?.get("attested")==="true";
 if(!["NONE","PHYSICAL","ELECTRONIC"].includes(stampMode))return NextResponse.json({error:"Jenis meterai tidak valid"},{status:400});
 if(kind==="authenticity"&&(!attested||stampMode==="NONE"))return NextResponse.json({error:"SPKK membutuhkan deklarasi pemeriksaan dan meterai fisik atau elektronik"},{status:400});
 const sha256=createHash("sha256").update(bytes).digest("hex");
 const created=await db.$transaction(async tx=>{
  const doc=await tx.isbnDocument.create({data:{applicationId,uploaderId:actor.id,kind,filename:file.name.slice(0,180),mime:"application/pdf",bytes,size:bytes.length,sha256}});
  await tx.isbnEvent.create({data:{applicationId,actorId:actor.id,action:"DOCUMENT_UPLOADED",detail:{documentId:doc.id,kind,sha256,bytes:bytes.length,stampMode,attested}}});
  return {id:doc.id,kind,filename:doc.filename,sha256,size:doc.size};
 });
 return NextResponse.json({document:created},{status:201});
}
