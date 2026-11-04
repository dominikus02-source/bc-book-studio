import {NextRequest,NextResponse} from "next/server";
import {identity,deny} from "../../../../lib/auth";
import {db} from "../../../../lib/db";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 if(!await identity(req))return deny();
 try{await db.$queryRaw`SELECT 1`;}
 catch{return NextResponse.json({error:"Database unavailable"},{status:503});}
 return NextResponse.json({database:"connected",authentication:"Cloudflare Access",agentCount:11,orchestrator:"not_connected",exports:["pdf","epub","docx"],ai:{configured:Boolean(process.env.AI_API_KEY),model:process.env.AI_API_KEY?(process.env.AI_MODEL||"deepseek-flash"):null}},{headers:{"Cache-Control":"no-store"}});
}
