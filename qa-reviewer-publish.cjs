"use strict";
const {PrismaClient}=require("@prisma/client"),{randomBytes,scryptSync}=require("node:crypto"),assert=require("node:assert/strict"),JSZip=require("jszip"),fs=require("node:fs"),path=require("node:path");
if(!/^postgresql:\/\/bookstudio@127\.0\.0\.1:55434\/bookstudio$/.test(process.env.DATABASE_URL||""))throw Error("Refuse non-QA database");
const db=new PrismaClient(),nonce=randomBytes(5).toString("hex"),pw=randomBytes(19).toString("hex"),salt=randomBytes(16).toString("hex"),hash=salt+":"+scryptSync(pw,salt,64).toString("hex");
const users=["owner","reviewer","outsider"].map((n,i)=>({email:"qa-"+n+"-"+nonce+"@example.invalid",name:"QA "+n,role:i?"REVIEWER":"EDITOR",active:true,passwordHash:hash})),base="http://127.0.0.1:3195";
const outdir=path.join(__dirname,"test-results","quarto-api");fs.mkdirSync(outdir,{recursive:true});
const cookies=[];let bookId;
async function request(path,method="GET",body,who,expected=200){
 const r=await fetch(base+path,{method,redirect:"manual",headers:{...(who!==undefined?{Cookie:cookies[who]}:{}),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
 if(r.status!==expected){const reason=await r.text();throw Error(method+" "+path+" expected="+expected+" got="+r.status+" "+reason.slice(0,260))}
 return r;
}
(async()=>{
 try{
  for(const user of users)await db.studioUser.create({data:user});
  for(let i=0;i<users.length;i++){
   const res=await request("/api/auth/login","POST",{email:users[i].email,password:pw});
   cookies[i]=(res.headers.get("set-cookie")||"").split(";")[0];
   assert(cookies[i].startsWith("bcstudio_session="));
  }
  const book=await(await request("/api/books","POST",{title:"QA Naskah Fiksi – Unicode",grade:"Referensi",subject:"Sastra dan Literasi",bookType:"FICTION",genre:"NOVEL",pageSize:"A5",author:"Penulis QA",description:"E2E publication QA"},0,201)).json();
  bookId=book.book.id;
  const png=fs.readFileSync(path.join(__dirname,"test-results","qa-image.png"));
  const image=(await(await request("/api/books/"+bookId+"/assets","POST",{name:"qa-image.png",mime:"image/png",data:png.toString("base64"),altText:"Ilustrasi contoh untuk pembaca",license:"OWNED"},0,201)).json()).asset;
  await request("/api/books/"+bookId+"/assets","GET",null,2,404);
  await request("/api/books/"+bookId+"/assets/"+image.id,"GET",null,2,404);
  await request("/api/books/"+bookId+"/chapters","POST",{title:"Perjalanan Tokoh",content:"Kisah utama dalam cerita dan ilustrasi untuk buku ini.\n\n![Ilustrasi contoh untuk pembaca](asset:"+image.id+")"},0,201);
  await request("/api/books/"+bookId+"/review","POST",{action:"submit",note:"QA"},0,409);
  await request("/api/books/"+bookId+"/reviewers","POST",{email:users[1].email},2,404);
  await request("/api/books/"+bookId,"GET",null,1,404);
  await request("/api/books/"+bookId+"/reviewers","POST",{email:users[1].email},0,201);
  await request("/api/books/"+bookId,"GET",null,1,200);
  await request("/api/books/"+bookId,"GET",null,2,404);
  const reviewerList=(await(await request("/api/books","GET",null,1)).json()).books;
  assert(reviewerList.some(x=>x.id===bookId&&x.isOwner===false));
  const outsiderList=(await(await request("/api/books","GET",null,2)).json()).books;
  assert(!outsiderList.some(x=>x.id===bookId));
  await request("/api/books/"+bookId,"PATCH",{editorialChecks:{premise:true,plot:true,language:true,originality:true,editor:true}},0);
  await request("/api/books/"+bookId+"/review","POST",{action:"approve",note:"Bad early approval"},1,409);
  await request("/api/books/"+bookId+"/review","POST",{action:"submit",note:"Ready"},0);
  await request("/api/books/"+bookId+"/review","POST",{action:"approve",note:"Owner cannot approve"},0,403);
  await request("/api/books/"+bookId+"/review","POST",{action:"approve",note:"Outsider cannot approve"},2,403);
  await request("/api/books/"+bookId+"/review","POST",{action:"approve",note:"Reviewed: language, originality and editorial policy"},1);
  console.log("REVIEWER_E2E_PASS assignment owner-only, reviewer-read, outsider-blocked, approve-by-assigned");
  for(const format of ["docx","epub","pdf"]){
   await request("/api/books/"+bookId+"/export?format="+format,"GET",null,1,404);
   const response=await request("/api/books/"+bookId+"/export?format="+format,"GET",null,0,200);
   assert.equal(response.headers.get("x-renderer"),"Quarto");
   const buffer=Buffer.from(await response.arrayBuffer());
   assert(buffer.length>1000);
   if(format==="pdf")assert.equal(buffer.subarray(0,4).toString(),"%PDF");
   else{
    const zip=await JSZip.loadAsync(buffer);
    assert(format==="epub"?zip.file("META-INF/container.xml"):zip.file("word/document.xml"));
    assert(Object.keys(zip.files).some(n=>n.toLowerCase().endsWith(".png")),"Image missing from "+format);
   }
   fs.writeFileSync(path.join(outdir,"qa-published."+format),buffer);
   console.log("QUARTO_API_PASS",format,buffer.length);
  }
 }finally{
  if(bookId)await db.book.deleteMany({where:{id:bookId}}).catch(()=>{});
  for(const user of users)await db.studioUser.deleteMany({where:{email:user.email}}).catch(()=>{});
  await db.$disconnect();
 }
})().catch(e=>{console.error("QA_PUBLICATION_FAIL",e.message);process.exitCode=1});
