import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deny, sessionUser } from "../../../../../lib/auth";
import { transition, workflowReadiness } from "../../../../../lib/workflow";

type Context = {params:Promise<{id:string}>};
const bodySchema=z.object({to:z.enum(["OUTLINE","WRITING"])}).strict();
const headers={"Cache-Control":"no-store"};

export async function GET(req:NextRequest,{params}:Context){
 const actor=await sessionUser(req);
 if(!actor)return deny();
 const {id}=await params;
 const result=await workflowReadiness(id,actor.id);
 return result ? NextResponse.json(result,{headers}) :
  NextResponse.json({error:"Buku tidak ditemukan."},{status:404,headers});
}

export async function POST(req:NextRequest,{params}:Context){
 const actor=await sessionUser(req);
 if(!actor)return deny();
 const input=bodySchema.safeParse(await req.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:"Tujuan tahap tidak valid."},{status:400,headers});
 const {id}=await params;
 const result=await transition(id,input.data.to,actor);
 return NextResponse.json(result.body,{status:result.status,headers});
}
