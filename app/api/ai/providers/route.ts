import { NextRequest,NextResponse } from "next/server";
import { identity,deny } from "../../../../lib/auth";
import { db } from "../../../../lib/db";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const userId=await identity(req);
 if(!userId)return deny();
 const providers=await db.providerCredential.findMany({
  where:{active:true},
  select:{id:true,provider:true,label:true,model:true,active:true,maxTokens:true,temperature:true},
  orderBy:[{provider:"asc"},{label:"asc"}]
 });
 return NextResponse.json({providers},{headers:{"Cache-Control":"no-store"}});
}
