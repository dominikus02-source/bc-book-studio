import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../lib/db";
import {sessionUser,deny} from "../../../lib/auth";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const actor=await sessionUser(req);if(!actor)return deny();
 if(!["REVIEWER","ADMIN"].includes(actor.role))return NextResponse.json({error:"Forbidden"},{status:403});
 const assignments=await db.bookReviewer.findMany({where:{reviewerId:actor.id,book:{ownerId:{not:actor.id}}},orderBy:{assignedAt:"desc"},include:{book:{include:{chapters:{orderBy:{position:"asc"}},reviews:{orderBy:{createdAt:"desc"}},reviewNotes:{where:{reviewerId:actor.id},orderBy:{createdAt:"desc"}}}}}});
 return NextResponse.json({viewer:{email:actor.email,role:actor.role},assignments:assignments.map(a=>({assignedAt:a.assignedAt,book:a.book}))},{headers:{"Cache-Control":"no-store"}});
}
