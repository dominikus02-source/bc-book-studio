import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../../../lib/db";
import {sessionUser,deny} from "../../../../../../lib/auth";
type Ctx={params:Promise<{id:string;assetId:string}>};
const err=(error:string,status:number)=>NextResponse.json({error},{status});
export async function GET(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id,assetId}=await params;
 const where=["REVIEWER","ADMIN"].includes(user.role)?{id,OR:[{ownerId:user.id},{assignedReviewers:{some:{reviewerId:user.id}}}]}:{id,ownerId:user.id};
 const book=await db.book.findFirst({where,select:{id:true}});
 if(!book)return err("Not found",404);
 const a=await db.bookAsset.findFirst({where:{id:assetId,bookId:id}});
 if(!a)return err("Not found",404);
 return new NextResponse(Buffer.from(a.bytes),{headers:{"Content-Type":a.mime,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":"inline"}});
}
export async function DELETE(req:NextRequest,{params}:Ctx){
 const user=await sessionUser(req);if(!user)return deny();
 const {id,assetId}=await params;
 const book=await db.book.findFirst({where:{id,ownerId:user.id},select:{status:true}});
 if(!book)return err("Not found",404);
 if(book.status!=="DRAFT")return err("Only draft assets can be removed",409);
 await db.bookAsset.deleteMany({where:{id:assetId,bookId:id}});
 return NextResponse.json({deleted:true});
}
