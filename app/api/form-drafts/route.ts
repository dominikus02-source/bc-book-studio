import {NextRequest,NextResponse} from "next/server";
import {db} from "@/lib/db";
import {identity,deny} from "@/lib/auth";
import {draftSchema,moduleName,inputError} from "@/lib/form-draft-validation";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const module=moduleName.safeParse(req.nextUrl.searchParams.get("module"));
 if(!module.success)return NextResponse.json({error:"Modul tidak valid"},{status:400});
 const drafts=await db.studioFormDraft.findMany({where:{ownerId,module:module.data},select:{id:true,title:true,module:true,payload:true,createdAt:true,updatedAt:true},orderBy:{updatedAt:"desc"},take:30});
 return NextResponse.json({drafts},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:NextRequest){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const parsed=draftSchema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Data draf tidak valid",details:parsed.error.issues.map(x=>x.message)},{status:400});
 const count=await db.studioFormDraft.count({where:{ownerId,module:parsed.data.module}});
 if(count>=30)return NextResponse.json({error:"Maksimal 30 draf per modul"},{status:429});
 const draft=await db.studioFormDraft.create({data:{ownerId,...parsed.data}});
 return NextResponse.json({draft},{status:201});
}
