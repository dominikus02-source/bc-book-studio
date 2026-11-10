"use strict";
const assert=require("node:assert/strict"),{PrismaClient}=require("@prisma/client"),{randomBytes,createHash}=require("node:crypto");
const u=new URL(process.env.DATABASE_URL||"");assert.equal(u.host+u.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),origin="http://127.0.0.1:32979",users=[],books=[];
async function user(){const row=await db.studioUser.create({data:{role:"EDITOR",active:true,name:"Asset QA",email:randomBytes(10).toString("hex")+"@example.invalid"}});users.push(row.id);const token=randomBytes(32).toString("hex");await db.studioSession.create({data:{userId:row.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});return {...row,token}}
async function api(path,method,expected,who,body,bytes=false){
 const r=await fetch(origin+path,{method,headers:{...(who?{cookie:"bcstudio_session="+who.token}:{}),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
 if(bytes){assert.equal(r.status,expected);return Buffer.from(await r.arrayBuffer())}
 const data=await r.json().catch(()=>({}));assert.equal(r.status,expected,method+" "+path+" expected "+expected+" got "+r.status+" "+JSON.stringify(data).slice(0,400));return data
}
async function main(){
 const owner=await user(),outsider=await user();
 const book=await db.book.create({data:{ownerId:owner.id,title:"Asset QA",grade:"7",subject:"IPA",chapters:{create:{position:1,title:"Bab QA",content:"Teks bab lengkap sebelum ilustrasi dimasukkan."}}},include:{chapters:true}});books.push(book.id);
 const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jxioAAAAASUVORK5CYII=","base64");
 const root="/api/books/"+book.id+"/assets";
 await api(root,"GET",401);
 await api(root,"GET",404,outsider);
 const {asset}=await api(root,"POST",201,owner,{name:"qa-image.png",mime:"image/png",data:png.toString("base64"),altText:"Gambar percobaan lengkap",license:"OWNED"});
 const path=root+"/"+asset.id;
 assert.equal((await api(root,"GET",200,owner)).assets.length,1);
 assert((await api(path,"GET",200,owner,undefined,true)).length===png.length);
 await api(path,"PATCH",428,owner,{name:"Gambar baru"});
 await api(path,"PATCH",404,outsider,{name:"Tidak sah",expectedVersion:asset.updatedAt});
 const updated=await api(path,"PATCH",200,owner,{name:"Gambar eksperimen",altText:"Ilustrasi eksperimen dengan deskripsi lengkap",license:"CC0",sourceUrl:"https://example.org/licenses",expectedVersion:asset.updatedAt});
 await api(path,"PATCH",409,owner,{name:"Versi basi",expectedVersion:asset.updatedAt});
 const row=(await api(root,"GET",200,owner)).assets[0];assert.equal(row.name,"Gambar eksperimen");assert.equal(row.revisions.length,1);
 await api(path,"DELETE",428,owner);
 let chapter=await db.chapter.findUniqueOrThrow({where:{id:book.chapters[0].id}});
 await db.chapter.update({where:{id:chapter.id},data:{content:"Paragraf mengacu pada ilustrasi berikut.\n\n![Ilustrasi](asset:"+asset.id+")"}});
 await api(path,"DELETE",409,owner,{expectedVersion:row.updatedAt});
 await db.chapter.update({where:{id:chapter.id},data:{content:"Konten naskah setelah ilustrasi dihapus dari bab aktif."}});
 await api(path,"DELETE",200,owner,{expectedVersion:row.updatedAt});
 assert.equal((await api(root,"GET",200,owner)).assets.length,0);
 assert.equal((await api(root+"?archived=1","GET",200,owner)).assets.length,1);
 await api(path,"GET",404,owner);
 const archived=(await api(root+"?archived=1","GET",200,owner)).assets[0];
 await api(path,"PATCH",200,owner,{restore:true,expectedVersion:archived.updatedAt});
 assert.equal((await api(root,"GET",200,owner)).assets.length,1);
 assert((await api(path,"GET",200,owner,undefined,true)).equals(png));
 const latest=(await api(root,"GET",200,owner)).assets[0];
 assert(latest.revisions.some(r=>r.action==="ARCHIVE")&&latest.revisions.some(r=>r.action==="RESTORE"));
 console.log("STAGE3_ASSET_CRUD_PASS: upload, metadata edit, stale 409, RBAC, linked-asset guard, archive, restore, bytes intact, history");
}
main().catch(e=>{console.error("STAGE3_ASSET_FAIL",e);process.exitCode=1}).finally(async()=>{for(const id of books)await db.book.deleteMany({where:{id}}).catch(e=>console.error("Cleanup",e.message));for(const id of users)await db.studioUser.deleteMany({where:{id}}).catch(()=>{});await db.$disconnect()});
