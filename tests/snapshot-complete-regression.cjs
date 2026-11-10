"use strict";
const fs=require("fs"),path=require("path"),assert=require("node:assert/strict");
const {createHash,randomBytes}=require("crypto"),{PrismaClient}=require("@prisma/client"),JSZip=require("jszip"),{PDFDocument}=require("pdf-lib");
process.loadEnvFile(".env.local");
const uri=new URL(process.env.DATABASE_URL);assert.equal(uri.hostname,"127.0.0.1");assert.equal(uri.pathname,"/bcstudio");
const db=new PrismaClient(),base=process.env.QA_ORIGIN||"http://127.0.0.1:3301",out=path.resolve("artifacts/20261110-snapshot");
fs.mkdirSync(out,{recursive:true});
const results=[],sessions=[],accounts=[];let fixture;
const hash=x=>createHash("sha256").update(x).digest("hex");
async function actor(role){const a=await db.studioUser.create({data:{role,active:true,name:"DUMMY Snapshot Regression",email:"dummy-"+randomBytes(8).toString("hex")+"@example.invalid"}});accounts.push(a.id);const token=randomBytes(32).toString("hex"),tokenHash=hash(token);await db.studioSession.create({data:{userId:a.id,tokenHash,expiresAt:new Date(Date.now()+3600000)}});sessions.push(tokenHash);return {id:a.id,cookie:"bcstudio_session="+token};}
async function call(url,status,a,data,method=data?"POST":"GET"){const r=await fetch(base+url,{method,headers:{...(a?{cookie:a.cookie}:{}),...(data?{"content-type":"application/json"}:{})},body:data?JSON.stringify(data):undefined});const b=await r.text();assert.equal(r.status,status,method+" "+url+" "+b.slice(0,200));return b?JSON.parse(b):null;}
function pass(name,extra={}){results.push({name,status:"PASS",...extra});console.log("PASS",name);}
async function main(){
 const source=await db.book.findUniqueOrThrow({where:{id:"cmw9sb9mm000qulx8fzvieiwp"},include:{chapters:{where:{archivedAt:null},orderBy:{position:"asc"}},assets:true}});
 const owner=await actor("EDITOR"),reviewer=await actor("REVIEWER"),other=await actor("EDITOR"),admin=await actor("ADMIN");
 const created=await call("/api/books",201,owner,{title:"[DUMMY] Work Done and Energy - snapshot regression",grade:source.grade,subject:source.subject,bookType:source.bookType,genre:source.genre});fixture=created.book.id;
 const p="/api/books/"+fixture;
 let b=created.book;
 b=(await call(p,200,owner,{expectedVersion:b.updatedAt,author:source.author,description:source.description,targetAudience:source.targetAudience,writingGoal:source.writingGoal},"PATCH")).book;
 await call(p+"/workflow",200,owner,{to:"OUTLINE"});
 const idMap=new Map();
 for(const a of source.assets){const copy=await db.bookAsset.create({data:{bookId:fixture,name:a.name,mime:a.mime,bytes:a.bytes,size:a.size,width:a.width,height:a.height,altText:a.altText,license:a.license,sourceUrl:a.sourceUrl}});idMap.set(a.id,copy.id);}
 const rewrite=s=>{for(const [a,b] of idMap)s=s.replaceAll("asset:"+a,"asset:"+b);return s};
 for(const c of source.chapters)await call(p+"/chapters",201,owner,{title:c.title,content:rewrite(c.content),outlineObjective:c.outlineObjective});
 await call(p+"/workflow",200,owner,{to:"WRITING"});
 const row=await db.studioFormDraft.findFirstOrThrow({where:{ownerId:source.ownerId,module:"PUBLISHING_PACKAGE:"+source.id},orderBy:{updatedAt:"desc"}});
 const pkg=Object.fromEntries(Object.entries(row.payload).map(([k,v])=>[k,rewrite(v)]));
 const markers=Object.keys(pkg).map((k,i)=>"DUMMY_PACKAGE_"+i+"_"+k);
 Object.keys(pkg).forEach((k,i)=>pkg[k]+="\n\n"+markers[i]);
 b=(await call(p,200,owner)).book;
 await call(p+"/publishing-package",200,owner,{data:pkg,expectedVersion:null,sourceUpdatedAt:b.updatedAt},"PUT");
 await call(p+"/publishing-package",404,other);
 await call(p+"/publishing-package",404,admin);
 await call(p+"/publishing-package",401);
 b=(await call(p,200,owner)).book;
 await call(p,200,owner,{expectedVersion:b.updatedAt,editorialChecks:source.editorialChecks},"PATCH");
 await call(p+"/reviewers",201,owner,{email:(await db.studioUser.findUniqueOrThrow({where:{id:reviewer.id}})).email});
 await call(p+"/review",200,owner,{action:"submit"});
 assert.deepEqual((await call(p+"/publishing-package",200,reviewer)).data,pkg);
 await call(p+"/review",403,owner,{action:"approve",note:"DUMMY self approval forbidden"});
 await call(p+"/review",403,admin,{action:"approve",note:"DUMMY unassigned forbidden"});
 await call(p+"/review",200,reviewer,{action:"approve",note:"DUMMY/SIMULASI OTOMATIS - regression only; no human review or publication consent."});
 b=(await call(p,200,owner)).book;
 const key={bookId_approvedAt:{bookId:fixture,approvedAt:b.approvedAt}};
 const snap=await db.bookApprovalSnapshot.findUniqueOrThrow({where:key}),before=hash(JSON.stringify(snap.manuscript));
 assert.equal(snap.manuscript.schemaVersion,2);assert.deepEqual(snap.manuscript.publishingPackage,pkg);
 await call(p+"/publishing-package",409,owner,{data:pkg,expectedVersion:null},"PUT");
 pass("five-stage API fixture; complete v2 approval; reviewer reads package; self/unassigned/foreign/anonymous denied");
 const draft=await db.studioFormDraft.findFirstOrThrow({where:{ownerId:owner.id,module:"PUBLISHING_PACKAGE:"+fixture}});
 await call("/api/form-drafts/"+draft.id,404,owner,undefined,"DELETE");
 await db.studioFormDraft.update({where:{id:draft.id},data:{payload:{...pkg,preface:"MUTABLE_POISON_MUST_NEVER_EXPORT"}}});
 for(const format of ["html","flipbook","docx","epub","pdf"]){
  const r=await fetch(base+p+"/export?format="+format,{headers:{cookie:owner.cookie}}),bytes=Buffer.from(await r.arrayBuffer());assert.equal(r.status,200,format+" "+bytes.toString("utf8",0,200));
  const name="DUMMY-complete."+({flipbook:"flipbook.html"}[format]||format);fs.writeFileSync(path.join(out,name),bytes);
  let text="";
  if(format==="html"||format==="flipbook")text=bytes.toString("utf8");
  else if(format==="pdf"){const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getTitle(),b.title);assert.equal(pdf.getAuthor(),b.author);const pdfjs=await import("pdfjs-dist/legacy/build/pdf.mjs");const task=pdfjs.getDocument({data:new Uint8Array(bytes),verbosity:0});const doc=await task.promise;for(let i=1;i<=doc.numPages;i++)text+=(await (await doc.getPage(i)).getTextContent()).items.map(x=>x.str||"").join(" ")+" ";await task.destroy();}
  else {const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});const files=Object.values(zip.files).filter(f=>!f.dir&&/\.(xml|xhtml|html|opf)$/.test(f.name));text=(await Promise.all(files.map(f=>f.async("string")))).join(" ");}
  const normalized=text.replace(/<[^>]+>/g,"").replace(/\s+/g,"");
  for(const marker of markers)assert.ok(normalized.includes(marker),format+" missing "+marker);
  assert.ok(!text.includes("MUTABLE_POISON_MUST_NEVER_EXPORT"));
  for(const c of source.chapters)assert.ok(normalized.includes(c.title.replace(/\s+/g,"")),format+" missing chapter "+c.title);
  pass("actual "+format+" contains eleven frozen package sections and five chapters",{file:name,bytes:bytes.length,sha256:hash(bytes)});
 }
 assert.equal(hash(JSON.stringify((await db.bookApprovalSnapshot.findUniqueOrThrow({where:key})).manuscript)),before);
 const legacy=await db.book.create({data:{ownerId:owner.id,title:"[DUMMY] Legacy snapshot regression",grade:"10",subject:"Physics",status:"APPROVED",approvedAt:new Date()}});
 const legacyData={...snap.manuscript};delete legacyData.schemaVersion;delete legacyData.publishingPackage;delete legacyData.language;
 await db.bookApprovalSnapshot.create({data:{bookId:legacy.id,approvedAt:legacy.approvedAt,reviewerId:reviewer.id,manuscript:legacyData}});
 const legacyHash=hash(JSON.stringify(legacyData));
 await call("/api/books/"+legacy.id+"/export?format=html",409,owner);
 assert.equal(hash(JSON.stringify((await db.bookApprovalSnapshot.findUniqueOrThrow({where:{bookId_approvedAt:{bookId:legacy.id,approvedAt:legacy.approvedAt}}})).manuscript)),legacyHash);
 pass("legacy approval rejected without modifying its isolated snapshot",{legacyHash});
 const request={expectedVersion:b.updatedAt,confirmed:true};
 await call(p+"/revision",401,undefined,request);
 await call(p+"/revision",404,reviewer,request);
 await call(p+"/revision",404,admin,request);
 await call(p+"/revision",409,owner,{...request,expectedVersion:new Date(0).toISOString()});
 const rev=await call(p+"/revision",200,owner,request);assert.equal(rev.book.id,fixture);assert.equal(rev.book.status,"DRAFT");
 await call(p+"/export?format=html",409,owner);
 assert.equal(hash(JSON.stringify((await db.bookApprovalSnapshot.findUniqueOrThrow({where:key})).manuscript)),before);
 pass("same-book revision, stale/RBAC protection, old snapshot unchanged, final export locked");
 await db.studioFormDraft.update({where:{id:draft.id},data:{payload:pkg}});
 await db.book.update({where:{id:fixture},data:{editorialChecks:source.editorialChecks}});
 await call(p+"/review",200,owner,{action:"submit"});
 await call(p+"/review",200,reviewer,{action:"approve",note:"DUMMY/SIMULASI OTOMATIS second approval - not human signoff"});
 assert.equal(await db.bookApprovalSnapshot.count({where:{bookId:fixture}}),2);
 pass("new revision requires and receives distinct independent simulated approval");
 fs.writeFileSync(path.join(out,"fixture.json"),JSON.stringify({bookId:fixture,ownerId:owner.id,reviewerId:reviewer.id,sourceBookId:source.id,firstApprovedAt:b.approvedAt,firstSnapshotSha256:before},null,2));
}
main().catch(e=>{results.push({status:"FAIL",error:e.message});console.error(e);process.exitCode=1}).finally(async()=>{fs.writeFileSync(path.join(out,"regression-results.json"),JSON.stringify(results,null,2));await db.studioSession.deleteMany({where:{tokenHash:{in:sessions}}});await db.$disconnect();});
