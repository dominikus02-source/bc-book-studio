const {PrismaClient}=require("@prisma/client"),{randomBytes,scryptSync}=require("node:crypto"),assert=require("node:assert/strict");
if(!(process.env.TEST_DATABASE_URL||"").includes("bookstudio_release_ci"))throw Error("Refuse non-isolated CI database");
const db=new PrismaClient({datasources:{db:{url:process.env.TEST_DATABASE_URL}}}),base="http://127.0.0.1:3184",nonce=randomBytes(5).toString("hex"),pw=randomBytes(18).toString("hex"),salt=randomBytes(16).toString("hex");
const accounts=["a","b"].map(k=>({email:"qa-"+k+"-"+nonce+"@example.invalid",name:"QA "+k,role:"EDITOR",active:true,passwordHash:salt+":"+scryptSync(pw,salt,64).toString("hex")}));
const ids=[];
async function call(path,method="GET",body,cookie,expected=200){
 const r=await fetch(base+path,{method,redirect:"manual",headers:{...(cookie?{Cookie:cookie}:{}),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
 const data=await r.json().catch(()=>({}));
 assert.equal(r.status,expected,method+" "+path+" got "+r.status+" expected "+expected+" "+JSON.stringify(data).slice(0,120));
 return {r,data};
}
async function run(){
 try{
  for(const u of accounts)await db.studioUser.create({data:u});
  await call("/api/books","GET",null,null,401);
  await call("/studio","GET",null,null,307);
  const a=await call("/api/auth/login","POST",{email:accounts[0].email,password:pw});
  const b=await call("/api/auth/login","POST",{email:accounts[1].email,password:pw});
  const ca=(a.r.headers.get("set-cookie")||"").split(";")[0],cb=(b.r.headers.get("set-cookie")||"").split(";")[0];
  assert(ca.startsWith("bcstudio_session=")&&cb.startsWith("bcstudio_session="));
  await call("/studio","GET",null,ca);
  await call("/studio","GET",null,cb);
  const aBook=(await call("/api/books","POST",{title:"QA Cerita Nusantara",grade:"Referensi",subject:"Sastra",description:"Sinopsis cerita fiksi untuk pengujian alur penerbitan.",targetAudience:"Pembaca remaja",writingGoal:"Mengembangkan cerita yang runtut",bookType:"FICTION",genre:"NOVEL"},ca,201)).data.book;
  const bBook=(await call("/api/books","POST",{title:"QA Panduan Sains",grade:"7",subject:"IPA",description:"Uji nonfiksi",bookType:"NONFICTION",genre:"TEXTBOOK"},cb,201)).data.book;
  ids.push(aBook.id,bBook.id);
  assert.equal(aBook.bookType,"FICTION");assert.equal(bBook.bookType,"NONFICTION");
  const listing=(await call("/api/books","GET",null,ca)).data.books;
  assert(listing.some(x=>x.id===aBook.id)&&!listing.some(x=>x.id===bBook.id));
  await call("/api/books/"+aBook.id,"GET",null,cb,404);
  await call("/api/books/"+aBook.id,"PATCH",{title:"Hijack",expectedVersion:aBook.updatedAt},cb,404);
  await call("/api/books/"+aBook.id,"DELETE",{expectedVersion:aBook.updatedAt},cb,404);
  await call("/api/books/"+aBook.id+"/workflow","POST",{to:"OUTLINE"},ca);
  const c1=(await call("/api/books/"+aBook.id+"/chapters","POST",{title:"Bab Pertama",content:"Isi cerita sangat panjang untuk pengujian bab pertama."},ca,201)).data.chapter;
  const c2=(await call("/api/books/"+aBook.id+"/chapters","POST",{title:"Bab Kedua",content:"Cerita lanjutan yang juga cukup panjang untuk pengujian."},ca,201)).data.chapter;
  await call("/api/books/"+aBook.id+"/chapters/"+c1.id,"PATCH",{title:"Hijack",content:"Konten yang tidak boleh tersimpan karena pemiliknya berbeda.",expectedVersion:c1.updatedAt},cb,404);
  await call("/api/books/"+aBook.id+"/chapters/"+c1.id,"PATCH",{title:"Bab Direvisi",content:"Konten Unicode Ω dan panah → untuk revisi cerita yang panjang.",expectedVersion:c1.updatedAt},ca);
  const chapter=(await call("/api/books/"+aBook.id+"/chapters/"+c1.id,"GET",null,ca)).data.chapter;
  assert.equal(chapter.revisions.length,1);
  await call("/api/books/"+aBook.id+"/chapters/reorder","PATCH",{ids:[c2.id,c1.id],expectedOrder:[c1.id,c2.id]},ca);
  assert.deepEqual((await call("/api/books/"+aBook.id,"GET",null,ca)).data.book.chapters.map(x=>x.id),[c2.id,c1.id]);
  const latestChapter=(await call("/api/books/"+aBook.id+"/chapters/"+c2.id,"GET",null,ca)).data.chapter;
  await call("/api/books/"+aBook.id+"/chapters/"+c2.id,"DELETE",{expectedVersion:latestChapter.updatedAt},cb,404);
  await call("/api/books/"+aBook.id+"/chapters/"+c2.id,"DELETE",{expectedVersion:latestChapter.updatedAt},ca);
  await call("/api/books/"+aBook.id+"/export?format=pdf","GET",null,ca,409);
  await call("/api/books/"+aBook.id+"/review","POST",{action:"submit",note:""},ca,409);
  await call("/api/auth/logout","POST",{},ca);
  await call("/api/books","GET",null,ca,401);
  await call("/api/books","GET",null,cb);
  console.log("QA_E2E_PASS anonymous401 login studio CRUD chapters reorder revisions owner-isolation logout");
 }finally{
  for(const id of ids)await db.book.deleteMany({where:{id}}).catch(()=>{});
  for(const u of accounts)await db.studioUser.deleteMany({where:{email:u.email}}).catch(()=>{});
  await db.$disconnect();
 }
}
run().catch(e=>{console.error("QA_E2E_FAIL",e.message);process.exitCode=1});
