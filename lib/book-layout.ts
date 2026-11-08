import {z} from "zod";
import type {Prisma} from "@prisma/client";

export const layoutSettings=z.object({
 pageSize:z.enum(["A4","A5","B5"]),
 order:z.array(z.number().int().positive()).min(1).max(500),
}).strict();

type Settings=z.infer<typeof layoutSettings>;
type Chapter={position:number;title:string;content:string};

export function validLayout(settings:Settings,chapters:Chapter[]){
 const positions=new Set(chapters.map(chapter=>chapter.position));
 return settings.order.length===positions.size&&new Set(settings.order).size===positions.size&&settings.order.every(position=>positions.has(position));
}

export async function storedLayout(tx:Prisma.TransactionClient,bookId:string,approvedAt:Date,chapters:Chapter[]){
 const record=await tx.bookLayout.findUnique({where:{bookId_approvedAt:{bookId,approvedAt}}});
 const parsed=layoutSettings.safeParse(record?.settings);
 return {
  version:record?.version??0,
  settings:record&&!record.archivedAt&&parsed.success&&validLayout(parsed.data,chapters)?parsed.data:null,
 };
}

export function applyLayout<T extends {pageSize:string;chapters:Chapter[]}>(book:T,settings:Settings|null):T{
 if(!settings)return book;
 const chapters=new Map(book.chapters.map(chapter=>[chapter.position,chapter]));
 return {...book,pageSize:settings.pageSize,chapters:settings.order.map((position,index)=>({...chapters.get(position)!,position:index+1}))};
}
