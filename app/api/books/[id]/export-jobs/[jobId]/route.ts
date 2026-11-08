import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../../../lib/db";
import {sessionUser,deny} from "../../../../../../lib/auth";
import {kickExportJobs} from "../../../../../../lib/export-job-runner";
export const runtime="nodejs";
type C={params:Promise<{id:string;jobId:string}>};
export async function GET(req:NextRequest,{params}:C){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id,jobId}=await params;
 const job=await db.exportJob.findFirst({where:{id:jobId,bookId:id,ownerId:actor.id}});
 if(!job)return NextResponse.json({error:"Not found"},{status:404});
 if(job.status==="QUEUED"||job.status==="RUNNING")kickExportJobs();
 return NextResponse.json({job:{id:job.id,status:job.status,progress:job.progress,currentStep:job.currentStep,cancellationRequested:job.cancellationRequested,sizes:job.sizes,resultBytes:job.resultBytes,resultSha256:job.resultSha256,error:job.error,createdAt:job.createdAt,finishedAt:job.finishedAt}},{headers:{"Cache-Control":"no-store"}});
}
export async function DELETE(req:NextRequest,{params}:C){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id,jobId}=await params;
 const job=await db.exportJob.findFirst({where:{id:jobId,bookId:id,ownerId:actor.id}});
 if(!job)return NextResponse.json({error:"Not found"},{status:404});
 if(!["QUEUED","RUNNING"].includes(job.status))return NextResponse.json({error:"Job already finished"},{status:409});
 await db.exportJob.update({where:{id:jobId},data:{cancellationRequested:true,...(job.status==="QUEUED"?{status:"CANCELLED",currentStep:"Cancelled",finishedAt:new Date()}:{} )}});
 return NextResponse.json({cancelRequested:true},{headers:{"Cache-Control":"no-store"}});
}