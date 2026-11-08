import {NextRequest,NextResponse} from "next/server";
import {administrator} from "../../../../lib/auth";
import {db} from "../../../../lib/db";
export const runtime="nodejs";
const headers={"Cache-Control":"no-store"};
type Row={credentialId:string;provider:string;model:string;purpose:string;calls:number;reportedCalls:number;inputTokens:number;outputTokens:number;totalTokens:number;unreportedCalls:number};
type Daily={day:string;calls:number;reportedCalls:number;inputTokens:number;outputTokens:number;totalTokens:number};
export async function GET(req:NextRequest){
 if(!await administrator(req))return NextResponse.json({error:"Dashboard token hanya untuk administrator."},{status:403,headers});
 const daysRaw=Number(req.nextUrl.searchParams.get("days")||"30"),days=[7,30,90].includes(daysRaw)?daysRaw:30;
 const since=new Date(Date.now()-days*86400000);
 try{
  const rows=await db.$queryRaw<Row[]>`SELECT "credentialId","provider","model","purpose",
   COUNT(*)::int AS calls,COUNT(*) FILTER(WHERE reported)::int AS "reportedCalls",
   COALESCE(SUM("inputTokens"),0)::int AS "inputTokens",
   COALESCE(SUM("outputTokens"),0)::int AS "outputTokens",
   COALESCE(SUM("totalTokens"),0)::int AS "totalTokens",
   COUNT(*) FILTER(WHERE NOT reported)::int AS "unreportedCalls"
   FROM "AiUsageEvent" WHERE "createdAt">=${since}
   GROUP BY "credentialId","provider","model","purpose" ORDER BY calls DESC`;
  const daily=await db.$queryRaw<Daily[]>`SELECT TO_CHAR(DATE_TRUNC('day',"createdAt"),'YYYY-MM-DD') AS day,
   COUNT(*)::int AS calls,COUNT(*) FILTER(WHERE reported)::int AS "reportedCalls",
   COALESCE(SUM("inputTokens"),0)::int AS "inputTokens",
   COALESCE(SUM("outputTokens"),0)::int AS "outputTokens",
   COALESCE(SUM("totalTokens"),0)::int AS "totalTokens"
   FROM "AiUsageEvent" WHERE "createdAt">=${since}
   GROUP BY DATE_TRUNC('day',"createdAt") ORDER BY day ASC`;
  const totals=rows.reduce((a,r)=>({calls:a.calls+r.calls,reportedCalls:a.reportedCalls+r.reportedCalls,unreportedCalls:a.unreportedCalls+r.unreportedCalls,inputTokens:a.inputTokens+r.inputTokens,outputTokens:a.outputTokens+r.outputTokens,totalTokens:a.totalTokens+r.totalTokens}),{calls:0,reportedCalls:0,unreportedCalls:0,inputTokens:0,outputTokens:0,totalTokens:0});
  return NextResponse.json({days,totals,models:rows,daily,source:"provider-reported",balanceAvailable:false,disclaimer:"Angka adalah token yang dilaporkan API, bukan saldo atau sisa kuota. Permintaan tanpa metadata token dihitung terpisah; panggilan sebelum instrumentasi tidak termasuk."},{headers});
 }catch{return NextResponse.json({error:"Data token belum tersedia. Pastikan migrasi telemetri telah diterapkan."},{status:503,headers})}
}
