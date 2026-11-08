import {NextRequest} from "next/server";
import {sessionUser} from "./auth";
import {db} from "./db";
import type {Prisma} from "@prisma/client";
export async function reviewerAccess(req:NextRequest,bookId:string,client:Prisma.TransactionClient=db){
 const actor=await sessionUser(req);
 if(!actor||!["REVIEWER","ADMIN"].includes(actor.role))return null;
 const assigned=await client.bookReviewer.findUnique({where:{bookId_reviewerId:{bookId,reviewerId:actor.id}}});
 if(!assigned)return null;
 const book=await client.book.findUnique({where:{id:bookId}});
 if(!book||book.ownerId===actor.id)return null;
 return {actor,book};
}
