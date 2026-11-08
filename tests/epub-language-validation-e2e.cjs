"use strict";
const fs=require("fs"),assert=require("node:assert/strict"),crypto=require("crypto"),JSZip=require("jszip"),{PrismaClient}=require("@prisma/client"),{spawnSync}=require("child_process"),path=require("path");
for(const l of fs.readFileSync(__dirname+"/../.env.local","utf8").split(/\r?\n/)){const m=l.match(/^DATABASE_URL=(.*)$/);if(m)process.env.DATABASE_URL=m[1].replace(/^["']|["']$/g,"");}
const db=new PrismaClient(),id="cmw6gk5gu005wurcoe0dk02jr";
(async()=>{const b=await db.book.findUniqueOrThrow({where:{id}}),token=crypto.randomBytes(32).toString("hex"),session=await db.studioSession.create({data:{userId:b.ownerId,tokenHash:crypto.createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+300000)}});try{
 const r=await fetch("http://127.0.0.1:32979/api/books/"+id+"/export?format=epub&preview=1",{headers:{cookie:"bcstudio_session="+token}});const data=Buffer.from(await r.arrayBuffer());assert.equal(r.status,200,data.toString().slice(0,300));const zip=await JSZip.loadAsync(data);const file=Object.keys(zip.files).find(x=>x.endsWith(".opf"));const opf=await zip.file(file).async("string");console.log("EPUB_DC_LANGUAGE",(opf.match(/<dc:language[^>]*>[^<]+<\/dc:language>/)||[])[0]);assert(/<dc:language[^>]*>id<\/dc:language>/.test(opf));
 const tmp=path.resolve(__dirname,"../tools/validators/latest-fisika-id.epub");fs.writeFileSync(tmp,data);
 const jar=path.resolve(__dirname,"../tools/validators/epubcheck-5.4.0/epubcheck-5.4.0/epubcheck.jar");
 const result=spawnSync("java",["-jar",jar,tmp],{encoding:"utf8",timeout:70000});fs.rmSync(tmp,{force:true});
 console.log("EPUBCHECK",result.status,(result.stdout+result.stderr).split(/\r?\n/).slice(-7).join(" | "));
 assert.equal(result.status,0);console.log("EPUB_INDONESIAN_VALIDATION_PASS");
}finally{await db.studioSession.delete({where:{id:session.id}})}})().catch(e=>{console.error("EPUB_LANG_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());