import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../../../../lib/db";
import {sessionUser,deny} from "../../../../../../../lib/auth";
import {createHash} from "node:crypto";
type C={params:Promise<{applicationId:string;documentId:string}>};
export async function GET(req:NextRequest,{params}:C){
 const a=await sessionUser(req);if(!a)return deny();if(a.role!=="ADMIN")return NextResponse.json({error:"Forbidden"},{status:403});
 const {applicationId,documentId}=await params;
 const doc=await db.isbnDocument.findFirst({where:{id:documentId,applicationId},select:{filename:true,bytes:true,sha256:true}});
 if(!doc)return NextResponse.json({error:"Not found"},{status:404});
 const data=Buffer.from(doc.bytes);
 if(createHash("sha256").update(data).digest("hex")!==doc.sha256)return NextResponse.json({error:"Integrity error"},{status:503});
 return new NextResponse(new Uint8Array(data),{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="isbn-evidence-'+documentId+'.pdf"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
export async function DELETE(req:NextRequest,{params}:C){
 const a=await sessionUser(req);if(!a)return deny();if(a.role!=="ADMIN")return NextResponse.json({error:"Forbidden"},{status:403});
 const {applicationId,documentId}=await params;
 const item=await db.isbnDocument.findFirst({where:{id:documentId,applicationId},include:{application:true}});
 if(!item)return NextResponse.json({error:"Not found"},{status:404});
 if(item.application.status!=="DRAFT")return NextResponse.json({error:"Only draft evidence can be removed"},{status:409});
 await db.$transaction([db.isbnDocument.delete({where:{id:documentId}}),db.isbnEvent.create({data:{applicationId,actorId:a.id,action:"DOCUMENT_DELETED",detail:{kind:item.kind,sha256:item.sha256,filename:item.filename}}})]);
 return NextResponse.json({deleted:true});
}
