import {z} from "zod";
import {marked} from "marked";
import type {Prisma} from "@prisma/client";
export const layoutSettings=z.object({
 pageSize:z.enum(["A4","A5","B5"]),
 order:z.array(z.number().int().positive()).min(1).max(500),
 blocks:z.record(z.string().regex(/^[1-9]\d*$/),z.array(z.number().int().positive()).min(1).max(5000)).optional(),
}).strict();
export type LayoutSettings=z.infer<typeof layoutSettings>;
type Chapter={position:number;title:string;content:string};
export function layoutBlocks(content:string){
 const tokens=marked.lexer(content);
 const parts:{index:number;kind:string;raw:string;excerpt:string}[]=[];
 let prefix="";
 for(const token of tokens){
  if(token.type==="space"){if(parts.length)parts[parts.length-1].raw+=token.raw;else prefix+=token.raw;continue}
  const raw=prefix+token.raw;prefix="";
  const kind=/^\s*!\[/.test(raw)?"gambar":/^\s*[*_]{0,2}(?:Gambar|Caption:)/i.test(raw)?"caption":/^\s*\$\$/.test(raw)?"persamaan":/latihan|exercise/i.test(raw.slice(0,70))?"latihan":/pembahasan|explanation/i.test(raw.slice(0,70))?"pembahasan":token.type;
  parts.push({index:parts.length+1,kind,raw,excerpt:raw.slice(0,200)});
 }
 if(prefix&&parts.length)parts[parts.length-1].raw+=prefix;
 // Never parse/reorder a source that cannot be reconstructed losslessly.
 if(!parts.length||parts.map(p=>p.raw).join("")!==content)return [{index:1,kind:"naskah",raw:content,excerpt:content.slice(0,200)}];
 return parts;
}
const permutation=(order:number[],positions:number[])=>order.length===positions.length&&new Set(order).size===positions.length&&order.every(x=>positions.includes(x));
export function validLayout(settings:LayoutSettings,chapters:Chapter[]){
 if(!permutation(settings.order,chapters.map(c=>c.position)))return false;
 return Object.entries(settings.blocks??{}).every(([key,order])=>{
  const chapter=chapters.find(c=>String(c.position)===key);
  return !!chapter&&permutation(order,layoutBlocks(chapter.content).map(b=>b.index));
 });
}
export async function storedLayout(tx:Prisma.TransactionClient,bookId:string,approvedAt:Date,chapters:Chapter[]){
 const record=await tx.bookLayout.findUnique({where:{bookId_approvedAt:{bookId,approvedAt}}});
 const parsed=layoutSettings.safeParse(record?.settings);
 const storedSettings=parsed.success&&validLayout(parsed.data,chapters)?parsed.data:null;
 return {version:record?.version??0,archivedAt:record?.archivedAt??null,storedSettings,settings:record&&!record.archivedAt?storedSettings:null};
}
export function applyLayout<T extends {pageSize:string;chapters:Chapter[]}>(book:T,settings:LayoutSettings|null):T{
 if(!settings)return book;
 if(!validLayout(settings,book.chapters))throw Error("Invalid snapshot layout");
 const chapters=new Map(book.chapters.map(chapter=>[chapter.position,chapter]));
 return {...book,pageSize:settings.pageSize,chapters:settings.order.map((position,index)=>{
  const chapter=chapters.get(position)!;
  const blocks=layoutBlocks(chapter.content),order=settings.blocks?.[String(position)];
  const changed=order?.some((value,i)=>value!==blocks[i].index);
  const content=changed?order!.map(i=>{const raw=blocks[i-1].raw;return raw.endsWith("\n\n")?raw:raw+"\n\n"}).join(""):chapter.content;
  return {...chapter,position:index+1,content};
 })};
}
