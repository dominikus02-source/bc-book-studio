import { NextRequest,NextResponse } from "next/server";
import { z } from "zod";
import { db } from "../../../../../../lib/db";
import { identity,deny } from "../../../../../../lib/auth";
export async function PATCH(req:NextRequest,{params}:{params:Promise<{id:string}>}){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id}=await params;
 const parsed=z.object({ids:z.array(z.string()).min(1).max(500)}).safeParse(await req.json().catch(()=>null));
 if(!parsed.success||new Set(parsed.data.ids).size!==parsed.data.ids.length)return NextResponse.json({error:"Invalid order"},{status:400});
 return db.$transaction(async tx=>{
  const book=await tx.book.findFirst({where:{id,ownerId},select:{status:true}});
  if(!book)return NextResponse.json({error:"Not found"},{status:404});
  if(book.status!=="DRAFT")return NextResponse.json({error:"Draft only"},{status:409});
  const chapters=await tx.chapter.findMany({where:{bookId:id},select:{id:true}});
  if(chapters.length!==parsed.data.ids.length||chapters.some(c=>!parsed.data.ids.includes(c.id)))return NextResponse.json({error:"Chapter mismatch"},{status:400});
  for(let i=0;i<chapters.length;i++)await tx.chapter.update({where:{id:chapters[i].id},data:{position:-1-i}});
  for(let i=0;i<parsed.data.ids.length;i++)await tx.chapter.update({where:{id:parsed.data.ids[i]},data:{position:i+1}});
  return NextResponse.json({ordered:true});
 });
}
