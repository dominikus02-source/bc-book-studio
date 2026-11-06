import { NextRequest,NextResponse } from "next/server";
import { identity,deny } from "../../../lib/auth";
import { db } from "../../../lib/db";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const userId=await identity(req);
 if(!userId)return deny();
 const limitValue=Number(process.env.STUDIO_DAILY_TOKEN_LIMIT);
 const limit=Number.isInteger(limitValue)&&limitValue>0?Math.min(2_000_000,limitValue):50000;
 const start=new Date();start.setUTCHours(0,0,0,0);
 const [summary,byProvider]=await Promise.all([
  db.usageEvent.aggregate({where:{userId,createdAt:{gte:start}},_sum:{inputTokens:true,outputTokens:true,totalTokens:true},_count:{_all:true}}),
  db.usageEvent.groupBy({by:["credentialId","provider","model"],where:{userId,createdAt:{gte:start}},_sum:{totalTokens:true},_count:{_all:true}})
 ]);
 const used=summary._sum.totalTokens??0;
 return NextResponse.json({
  period:"today",timezone:"UTC",limit,used,remaining:Math.max(0,limit-used),
  inputTokens:summary._sum.inputTokens??0,outputTokens:summary._sum.outputTokens??0,
  requests:summary._count._all,
  estimatedEvents:await db.usageEvent.count({where:{userId,createdAt:{gte:start},estimated:true}}),
  byProvider:byProvider.map(x=>({credentialId:x.credentialId,provider:x.provider,model:x.model,
   tokens:x._sum.totalTokens??0,requests:x._count._all}))
 },{headers:{"Cache-Control":"no-store"}});
}
