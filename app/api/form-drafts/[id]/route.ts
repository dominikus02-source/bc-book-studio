import {NextRequest,NextResponse} from "next/server";
import {db} from "@/lib/db";
import {identity,deny} from "@/lib/auth";
import {draftSchema} from "@/lib/form-draft-validation";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
export async function PATCH(req:NextRequest,{params}:Context){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id}=await params;const parsed=draftSchema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Data draf tidak valid"},{status:400});
 const updated=await db.studioFormDraft.updateMany({where:{id,ownerId,module:parsed.data.module},data:{title:parsed.data.title,payload:parsed.data.payload}});
 if(!updated.count)return NextResponse.json({error:"Draf tidak ditemukan"},{status:404});
 return NextResponse.json({draft:await db.studioFormDraft.findFirst({where:{id,ownerId}})});
}
export async function DELETE(req:NextRequest,{params}:Context){
 const ownerId=await identity(req);if(!ownerId)return deny();
 const {id}=await params;
 const deleted=await db.studioFormDraft.deleteMany({where:{id,ownerId,AND:[{module:{notIn:["PRINT_ORDER","PRINT_ORDER_ARCHIVED"]}},{module:{not:{startsWith:"RELEASE_SIMULATION:"}}},{module:{not:{startsWith:"PUBLISHING_PACKAGE:"}}}]}});
 if(!deleted.count)return NextResponse.json({error:"Draf tidak ditemukan"},{status:404});
 return NextResponse.json({deleted:true});
}
