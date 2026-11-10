import {NextRequest,NextResponse} from "next/server";
import {identity,deny,administrator} from "../../../../lib/auth";
import {db} from "../../../../lib/db";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 if(!await identity(req))return deny();
 try{
  await db.$queryRaw`SELECT 1`;
  const provider=await db.providerCredential.findFirst({where:{active:true},select:{model:true}});
  return NextResponse.json({database:"connected",authentication:"Studio account",canManageProviders:Boolean(await administrator(req)),agentCount:11,orchestrator:"not_connected",exports:["pdf","epub","docx"],ai:{configured:Boolean(provider),model:provider?.model||null}},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Database unavailable"},{status:503})}
}
