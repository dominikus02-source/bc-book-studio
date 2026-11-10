import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {db} from "../../../../../lib/db";
import {identity,deny} from "../../../../../lib/auth";
type Ctx={params:Promise<{id:string}>};
const err=(error:string,status:number)=>NextResponse.json({error},{status});
const input=z.object({
 name:z.string().trim().min(1).max(150),
 mime:z.enum(["image/png","image/jpeg"]),
 data:z.string().min(20).max(750000),
 altText:z.string().trim().min(5).max(250),
 license:z.enum(["OWNED","CC0","CC_BY","CC_BY_SA","LICENSED"]),
 sourceUrl:z.string().url().max(500).startsWith("https://").optional()
}).strict();
function dimensions(bytes:Buffer,mime:string):[number,number]{
 if(mime==="image/png"){
  if(bytes.length<24||!bytes.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex"))||bytes.toString("ascii",12,16)!=="IHDR")throw Error("Invalid PNG");
  return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
 }
 if(bytes.length<4||bytes[0]!==255||bytes[1]!==216)throw Error("Invalid JPEG");
 let p=2;
 while(p+9<bytes.length){
  if(bytes[p++]!==255)throw Error("Invalid JPEG segment");
  let marker=bytes[p++];while(marker===255)marker=bytes[p++];
  if(marker===217||marker===218)break;
  const size=bytes.readUInt16BE(p);
  if(size<2||p+size>bytes.length)throw Error("Invalid JPEG segment");
  if([192,193,194,195,198,199,201,202,203,205,206,207].includes(marker))return [bytes.readUInt16BE(p+5),bytes.readUInt16BE(p+3)];
  p+=size;
 }
 throw Error("JPEG dimensions missing");
}
export async function GET(req:NextRequest,{params}:Ctx){
 const userId=await identity(req);if(!userId)return deny();
 const {id}=await params;
 const owner=await db.book.findFirst({where:{id,ownerId:userId,archivedAt:null},select:{id:true}});
 if(!owner)return err("Not found",404);
 const archived=req.nextUrl.searchParams.get("archived")==="1";
 const assets=await db.bookAsset.findMany({where:{bookId:id,...(archived?{archivedAt:{not:null}}:{archivedAt:null})},select:{id:true,name:true,mime:true,size:true,width:true,height:true,altText:true,license:true,sourceUrl:true,createdAt:true,updatedAt:true,archivedAt:true,revisions:{orderBy:{createdAt:"desc"},take:20}},orderBy:{createdAt:"desc"}});
 return NextResponse.json({assets},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:NextRequest,{params}:Ctx){
 const userId=await identity(req);if(!userId)return deny();
 const {id}=await params;
 const body=input.safeParse(await req.json().catch(()=>null));if(!body.success)return err("Invalid image metadata",400);
 const b=body.data;
 if(!/^[a-zA-Z0-9+/]+={0,2}$/.test(b.data))return err("Invalid image encoding",400);
 const bytes=Buffer.from(b.data,"base64");
 if(bytes.length<32||bytes.length>550000)return err("Image must be 32B-550KB",413);
 let width:number,height:number;
 try{[width,height]=dimensions(bytes,b.mime)}catch{return err("Unsupported or damaged image",400)}
 if(width<1||height<1||width>4000||height>4000||width*height>10000000)return err("Image dimensions too large",413);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Book" WHERE id = ${id} AND "ownerId" = ${userId} AND "archivedAt" IS NULL FOR UPDATE`;
  const book=await tx.book.findFirst({where:{id,ownerId:userId,archivedAt:null},select:{status:true}});
  if(!book)return err("Not found",404);
  if(book.status!=="DRAFT")return err("Only draft books can add images",409);
  const count=await tx.bookAsset.count({where:{bookId:id}});
  if(count>=20)return err("Maximum 20 images per book",409);
  const asset=await tx.bookAsset.create({data:{bookId:id,name:b.name,mime:b.mime,bytes,size:bytes.length,width,height,altText:b.altText,license:b.license,sourceUrl:b.sourceUrl}});
  return NextResponse.json({asset:{id:asset.id,name:asset.name,altText:asset.altText,license:asset.license,size:asset.size,width,height,updatedAt:asset.updatedAt}},{status:201});
 });
}
