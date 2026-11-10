import {NextRequest,NextResponse} from "next/server";
import {db} from "../../../../../lib/db";
import {sessionUser,deny} from "../../../../../lib/auth";
import {readFile,stat} from "node:fs/promises";
import {resolve,dirname,relative,sep,basename} from "node:path";
export const runtime="nodejs";
type Context={params:Promise<{id:string}>};
type Entry={format:string;file?:string;size?:number;sha256?:string;status:string};
type Manifest={books:Array<{id:string;title:string;status:string;chapters:number;files:Entry[]}>};
const root=resolve(process.cwd(),"artifacts","20261108-two-book-draft-previews");
const types=["zip","docx","pdf","epub","html","flipbook"] as const;
const mime:Record<string,string>={zip:"application/zip",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",pdf:"application/pdf",epub:"application/epub+zip",html:"text/html; charset=utf-8",flipbook:"text/html; charset=utf-8"};
function safePath(p:string){const exact=resolve(p),sub=relative(root,exact);return sub&&!sub.startsWith(".."+sep)&&sub!==".."&&!sub.includes(":")?exact:null}
const fail=(error:string,status:number)=>NextResponse.json({error},{status,headers:{"Cache-Control":"no-store"}});
export async function GET(req:NextRequest,{params}:Context){
 const actor=await sessionUser(req);if(!actor)return deny();
 const {id}=await params;
 const book=await db.book.findFirst({where:{id,ownerId:actor.id,archivedAt:null},select:{title:true,status:true}});
 if(!book)return fail("Buku tidak ditemukan atau bukan milik Anda.",404);
 const type=req.nextUrl.searchParams.get("type")||"manifest";
 if(type!=="manifest"&&!types.includes(type as typeof types[number]))return fail("Format tidak dikenal.",400);
 let data:Manifest;
 try{data=JSON.parse(await readFile(resolve(root,"PREVIEW_MANIFEST.json"),"utf8")) as Manifest}catch{return fail("Pratinjau belum dibuat.",404)}
 const entry=data.books.find(row=>row.id===id);
 if(!entry||entry.status!=="DRAFT"||book.status!=="DRAFT")return fail("Berkas pratinjau belum sesuai status buku.",409);
 const all=entry.files.filter(f=>f.status==="GENERATED"&&f.file&&types.includes(f.format as typeof types[number]));
 if(type==="manifest")return NextResponse.json({title:entry.title,chapters:entry.chapters,status:"DRAFT_PREVIEW_ONLY",formats:all.map(f=>({format:f.format,bytes:f.size,sha256:f.sha256})),bundleAvailable:true,warning:"Berkas ini adalah pratinjau draf yang belum disetujui reviewer. Bukan penerbitan final, ISBN, atau sertifikasi."},{headers:{"Cache-Control":"no-store"}});
 const raw=entry.files.find(f=>f.format===(type==="zip"?"docx":type));
 if(!raw?.file)return fail("Artefak tidak ditemukan.",404);
 const source=type==="zip"?resolve(root,basename(dirname(raw.file))+".zip"):raw.file;
 const filepath=safePath(source);
 if(!filepath)return fail("Jalur artefak tidak diizinkan.",403);
 try{
  const info=await stat(filepath);
  if(!info.isFile()||info.size>30000000)return fail("Ukuran/tipe artefak tidak diizinkan.",413);
  const bytes=await readFile(filepath);
  const output=basename(filepath);
  return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":mime[type],"Content-Disposition":'attachment; filename="'+output+'"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'","X-Draft-Preview":"true"}});
 }catch{return fail("Berkas belum tersedia.",404)}
}
