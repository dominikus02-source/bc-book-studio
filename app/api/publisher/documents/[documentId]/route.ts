import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
type C={params:Promise<{documentId:string}>};
export async function GET(req:NextRequest,{params}:C){
 const actor=await sessionUser(req);if(!actor)return deny();if(actor.role!=="ADMIN")return NextResponse.json({error:"Forbidden"},{status:403});
 const {documentId}=await params,document=await db.publisherDocument.findFirst({where:{id:documentId,publisherId:"bci-publisher",archivedAt:null}});
 if(!document)return NextResponse.json({error:"Not found"},{status:404});
 const bytes=Buffer.from(document.bytes);
 if(createHash("sha256").update(bytes).digest("hex")!==document.sha256)return NextResponse.json({error:"Integrity verification failed"},{status:503});
 return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="publisher-legal-'+documentId+'.pdf"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
export async function DELETE(req:NextRequest,{params}:C){
 const actor=await sessionUser(req);if(!actor)return deny();if(actor.role!=="ADMIN")return NextResponse.json({error:"Forbidden"},{status:403});
 const {documentId}=await params;
 const result=await db.publisherDocument.updateMany({where:{id:documentId,publisherId:"bci-publisher",archivedAt:null},data:{archivedAt:new Date()}});
 if(!result.count)return NextResponse.json({error:"Not found"},{status:404});
 return NextResponse.json({archived:true,message:"Legal evidence archived; original remains available for audit"},{headers:{"Cache-Control":"no-store"}});
}
