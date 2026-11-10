import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../lib/db";
import {sessionUser,deny} from "../../../../lib/auth";
import {requiredForBasis} from "../../../../lib/isbn-office";
import {payload} from "../../../../lib/isbn-application-schema";
export const runtime="nodejs";
const clean={"Cache-Control":"no-store"};

export async function GET(req:NextRequest){
 const actor=await sessionUser(req);if(!actor)return deny();
 if((actor.role!=="ADMIN"&&actor.role!=="SUPERADMIN"))return NextResponse.json({error:"Publisher ADMIN only"},{status:403});
 const applications=await db.isbnApplication.findMany({where:{archivedAt:null},include:{book:{select:{title:true,status:true}},documents:{select:{id:true,kind:true,filename:true,size:true,sha256:true,createdAt:true}},events:{orderBy:{createdAt:"desc"},take:10,select:{id:true,action:true,detail:true,createdAt:true}}},orderBy:{updatedAt:"desc"},take:300});
 return NextResponse.json({applications:applications.map(a=>({...a,requirements:requiredForBasis(a.rightsBasis)}))},{headers:clean});
}
export async function POST(req:NextRequest){
 const actor=await sessionUser(req);if(!actor)return deny();
 if((actor.role!=="ADMIN"&&actor.role!=="SUPERADMIN"))return NextResponse.json({error:"Publisher ADMIN only"},{status:403});
 const parsed=payload.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:parsed.error.issues[0]?.message},{status:400});
 const profile=await db.publisherProfile.findUnique({where:{id:"bci-publisher"}});
 if(!profile)return NextResponse.json({error:"Save legal publisher profile first"},{status:409});
 const b=await db.book.findUnique({where:{id:parsed.data.bookId},select:{id:true,archivedAt:true}});
 if(!b||b.archivedAt)return NextResponse.json({error:"Book not found"},{status:404});
 const {plannedPublicationYear,...rest}=parsed.data;
 const created=await db.$transaction(async tx=>{
  const app=await tx.isbnApplication.create({data:{...rest,plannedPublicationYear:plannedPublicationYear??null,createdById:actor.id,publisherId:profile.id}});
  await tx.isbnEvent.create({data:{applicationId:app.id,actorId:actor.id,action:"CREATED_DRAFT",detail:{bookId:app.bookId,format:app.format,edition:app.editionNumber}}});
  return app;
 });
 return NextResponse.json({application:created},{status:201,headers:clean});
}
