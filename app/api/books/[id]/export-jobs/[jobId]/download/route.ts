import {NextRequest,NextResponse} from "next/server";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {db} from "../../../../../../../lib/db";
import {sessionUser,deny} from "../../../../../../../lib/auth";
import {artifactPath} from "../../../../../../../lib/export-job-runner";
export const runtime="nodejs";
type C={params:Promise<{id:string;jobId:string}>};
export async function GET(req:NextRequest,{params}:C){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id,jobId}=await params;
 const job=await db.exportJob.findFirst({where:{id:jobId,bookId:id,ownerId:actor.id,status:"COMPLETE"}});
 if(!job||!job.resultSha256)return NextResponse.json({error:"Arsip belum tersedia"},{status:404});
 let bytes:Buffer;
 try{bytes=await readFile(artifactPath(job.id))}catch{return NextResponse.json({error:"File arsip tidak tersedia di server ini"},{status:503})}
 if(bytes.length!==job.resultBytes||createHash("sha256").update(bytes).digest("hex")!==job.resultSha256)return NextResponse.json({error:"Integritas arsip gagal diverifikasi"},{status:503});
 return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":"application/zip","Content-Disposition":'attachment; filename="book-'+job.bookId+'-'+job.id+'.zip"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","X-Content-SHA256":job.resultSha256}});
}