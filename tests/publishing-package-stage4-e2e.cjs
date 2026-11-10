"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),JSZip=require("jszip"),{PrismaClient}=require("@prisma/client"),{chromium}=require("playwright"),{randomBytes,createHash}=require("node:crypto");
const origin="http://127.0.0.1:32979",u=new URL(process.env.DATABASE_URL||"");
assert.equal(u.host+u.pathname,"127.0.0.1:55999/bookstudio_import_qa","REFUSING TO TOUCH NON-QA DATABASE");
const db=new PrismaClient();
let ownerId,otherId,bookId,browser;
const tokens=[];
async function actor(role){
 const user=await db.studioUser.create({data:{name:"Publishing Stage 4 QA "+role,email:randomBytes(15).toString("hex")+"@example.invalid",role,active:true}});
 const token=randomBytes(32).toString("hex"),hash=createHash("sha256").update(token).digest("hex");
 await db.studioSession.create({data:{userId:user.id,tokenHash:hash,expiresAt:new Date(Date.now()+600000)}});
 tokens.push(hash);return {id:user.id,cookie:"bcstudio_session="+token,token};
}
async function req(path,cookie,method="GET",data){
 const r=await fetch(origin+path,{method,headers:{...(cookie?{cookie}:{}),...(data?{"Content-Type":"application/json"}:{})},body:data?JSON.stringify(data):undefined});
 const body=await r.json().catch(()=>({}));return {status:r.status,body};
}
const expect=(result,status,why)=>assert.equal(result.status,status,why+": "+JSON.stringify(result.body).slice(0,500));
async function waitSave(path,cookie,field,value){
 for(let i=0;i<40;i++){
  const r=await req(path,cookie);
  if(r.status===200&&r.body.data[field]===value&&r.body.saved)return r.body;
  await new Promise(resolve=>setTimeout(resolve,180));
 }throw Error("Autosave did not persist "+field+"="+value);
}
async function main(){
 const owner=await actor("EDITOR"),other=await actor("EDITOR");ownerId=owner.id;otherId=other.id;
 const book=await db.book.create({data:{ownerId:owner.id,title:"Biologi Kontekstual Kelas Delapan",author:"Pengajar Ilmu Hayati",grade:"8",subject:"Biologi",bookType:"NONFICTION",genre:"TEXTBOOK",description:"Mempelajari tumbuhan dan ekosistem melalui contoh yang ada di sekitar siswa.",targetAudience:"Siswa SMP kelas delapan",writingGoal:"Memahami struktur tumbuhan dan hubungan dalam ekosistem.",chapters:{create:[{title:"Bab 1 — Struktur Tumbuhan",position:1,outlineObjective:"Membedakan jaringan tumbuhan.",content:"Tumbuhan tersusun atas jaringan meristem, epidermis, parenkim, pengangkut, dan penyokong. Tujuannya untuk menjelaskan fungsi setiap jaringan."},{title:"Bab 2 — Ekosistem",position:2,outlineObjective:"Menjelaskan aliran energi.",content:"Komponen biotik dan abiotik memengaruhi keberlangsungan kehidupan. Organisme saling terhubung dalam jaring-jaring makanan."}]}}});
 bookId=book.id;
 const path="/api/books/"+bookId+"/publishing-package";
 expect(await req(path,undefined),401,"anonymous GET");
 expect(await req(path,other.cookie),404,"other editor GET");
 expect(await req(path,other.cookie,"PUT",{data:{},expectedVersion:null}),404,"other editor PUT");
 const initial=await req(path,owner.cookie);expect(initial,200,"owner GET");
 assert.equal(initial.body.saved,false);
 assert.equal(Object.keys(initial.body.data).length,11);
 assert(initial.body.data.contentsIntro.includes("Struktur Tumbuhan")&&initial.body.data.contentsIntro.includes("Ekosistem"));
 assert(initial.body.data.preface.includes("Siswa SMP kelas delapan"));
 assert(!initial.body.data.preface.includes("gerak, gaya, energi"));
 assert(initial.body.data.bibliography.includes("PERLU"));
 assert(initial.body.data.copyrightPage.includes("BELUM DITETAPKAN"));
 console.log("PUBLISHING_STAGE4_BOOK_CONTEXT_NO_FABRICATED_ISBN_PASS");
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:860},acceptDownloads:true});
 await context.addCookies([{name:"bcstudio_session",value:owner.token,url:origin}]);
 const page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 page.on("dialog",d=>void d.accept());
 await page.goto(origin+"/studio?bookId="+bookId+"&module=Penerbitan");
 const panel=page.getByRole("region",{name:"Paket penerbitan otomatis dan impor"});
 await panel.waitFor({timeout:30000});
 await panel.getByText("Paket penerbitan — dari Stage 1, 2, dan 3").waitFor({timeout:15000});
 await waitSave(path,owner.cookie,"preface",initial.body.data.preface);
 const firstSaved=await req(path,owner.cookie);assert(firstSaved.body.saved);
 console.log("PUBLISHING_STAGE4_AUTO_CREATE_AND_AUTOSAVE_PASS");
 const textarea=panel.getByRole("textbox",{name:"Kata pengantar"});
 await panel.locator("summary").filter({hasText:"Kata pengantar"}).click();
 const original=await textarea.inputValue();
 await textarea.fill(original+"\n\nParagraf tambahan yang disimpan otomatis dari editor.");
 const changed=await waitSave(path,owner.cookie,"preface",original+"\n\nParagraf tambahan yang disimpan otomatis dari editor.");
 assert(changed.updatedAt!==firstSaved.body.updatedAt);
 expect(await req(path,owner.cookie,"PUT",{data:{...changed.data,preface:"Overwrite old version"},expectedVersion:firstSaved.body.updatedAt}),409,"stale version");
 const imported="Referensi dan Sumber\n\n[PERLU DILENGKAPI DAN DIVERIFIKASI] — Tambahkan daftar sumber faktual yang sudah diverifikasi editorial.";
 const transfer=page.getByRole("region",{name:"Impor dan ekspor Paket penerbitan"});
 await transfer.waitFor({timeout:8000});
 let dl=page.waitForEvent("download");await transfer.getByRole("button",{name:"Unduh Markdown"}).click();
 let download=await dl;let md=fs.readFileSync(await download.path(),"utf8");
 assert(md.includes("## references")&&md.includes("## bibliography")&&md.includes("## copyrightPage"));
 const regex=/^(## references[^\r\n]*\r?\n)([\s\S]*?)(?=^## bibliography)/m;
 assert(regex.test(md),"Markdown references field cannot be found");
 md=md.replace(regex,(_whole,start)=>start+"\n"+imported+"\n\n");
 await transfer.locator('input[type="file"]').setInputFiles({name:"publishing-qa.md",mimeType:"text/markdown",buffer:Buffer.from(md,"utf8")});
 await waitSave(path,owner.cookie,"references",imported);
 console.log("PUBLISHING_STAGE4_MD_UPLOAD_FIELD_MAPPING_AUTOSAVE_PASS");
 dl=page.waitForEvent("download");await transfer.getByRole("button",{name:"Unduh XLSX"}).click();download=await dl;
 const zip=await JSZip.loadAsync(fs.readFileSync(await download.path()));
 let xml=await zip.file("xl/worksheets/sheet1.xml").async("string");
 const replacement="Penutup yang diperbarui lewat unggah XLSX, tetap sesuai tujuan pembelajaran.";
 const fieldIdRow=Array.from({length:20},(_,i)=>i+2).find(i=>xml.includes('r="A'+i+'"')&&xml.slice(xml.indexOf('r="A'+i+'"'),xml.indexOf('</c>',xml.indexOf('r="A'+i+'"'))).includes("afterword"));
 assert(fieldIdRow,"afterword not found in XLSX FORM");
 const creg=new RegExp('(<c r="C'+fieldIdRow+'"[^>]*><is><t xml:space="preserve">)[\\s\\S]*?(<\\/t><\\/is><\\/c>)');
 assert(creg.test(xml));
 xml=xml.replace(creg,(_whole,a,b)=>a+replacement+b);
 zip.file("xl/worksheets/sheet1.xml",xml);
 await transfer.locator('input[type="file"]').setInputFiles({name:"publishing-qa.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer:await zip.generateAsync({type:"nodebuffer"})});
 await waitSave(path,owner.cookie,"afterword",replacement);
 console.log("PUBLISHING_STAGE4_XLSX_UPLOAD_FIELD_MAPPING_AUTOSAVE_PASS");
 const storedRow=await db.studioFormDraft.findFirstOrThrow({where:{ownerId:owner.id,module:"PUBLISHING_PACKAGE:"+bookId}});
 const legacyData={...storedRow.payload};delete legacyData.readerGuide;delete legacyData.bibliography;
 await db.studioFormDraft.update({where:{id:storedRow.id},data:{payload:legacyData}});
 const legacyRead=await req(path,owner.cookie);
 assert(legacyRead.body.missingFields.includes("readerGuide")&&legacyRead.body.missingFields.includes("bibliography"));
 await page.reload();
 await waitSave(path,owner.cookie,"bibliography",initial.body.defaults.bibliography);
 await panel.waitFor({timeout:25000});
 console.log("PUBLISHING_STAGE4_LEGACY_9_FIELD_AUTO_BACKFILL_PASS");
await panel.locator("summary").filter({hasText:"Penutup"}).click();
 assert.equal(await panel.getByRole("textbox",{name:"Penutup"}).inputValue(),replacement);
 const prompt=transfer.getByText(/Generate prompt dan bantuan AI/);await prompt.click();
 await transfer.getByRole("button",{name:"Periksa koherensi"}).click();
 const p=await transfer.getByRole("textbox",{name:"Pratinjau prompt AI Paket penerbitan"}).inputValue();
 assert(p.includes("PENERBITAN")&&p.includes("Bab 2")&&p.includes("bibliography")&&p.includes("ISBN"));
 const ai=await req(path+"/generate",owner.cookie,"POST",{field:"copyrightPage"});expect(ai,400,"AI forbidden evidence field");
 expect(await req(path+"/generate",other.cookie,"POST",{field:"preface"}),404,"AI outsider denied");
 if(await db.providerCredential.count({where:{active:true}})===0)expect(await req(path+"/generate",owner.cookie,"POST",{field:"preface"}),503,"AI unconfigured and no fake generation");
 console.log("PUBLISHING_STAGE4_AI_PROMPTS_CONTEXT_AND_SAFETY_PASS");
 for(const format of ["html","flipbook"]){
  const response=await fetch(origin+"/api/books/"+bookId+"/export?format="+format+"&preview=1",{headers:{cookie:owner.cookie}});
  assert.equal(response.status,200,"preview export "+format+" "+(await response.clone().text()).slice(0,200));
  const html=await response.text();
  assert(html.includes("Penutup yang diperbarui lewat unggah XLSX"),"Publishing package is not used in "+format);
  assert(html.includes("Struktur Tumbuhan")&&html.includes("Ekosistem"),"Stage 2 chapter titles missing "+format);
  assert(html.includes("Daftar Pustaka")||html.includes("Bibliografi"),"Bibliography not generated in "+format);
 }
 console.log("PUBLISHING_STAGE4_IMPORTED_CONTENT_USED_IN_HTML_FLIPBOOK_PASS");

 for(const mode of ["light","dark"]){
  await page.evaluate(v=>document.documentElement.dataset.theme=v,mode);
  for(const width of [320,375,390,768,1024,1440]){
   await page.setViewportSize({width,height:860});
   assert.equal(await panel.isVisible(),true);
  }
 }
 assert.deepEqual(errors,[]);
 const rows=await db.studioFormDraft.findMany({where:{ownerId:owner.id,module:"PUBLISHING_PACKAGE:"+bookId}});
 assert.equal(rows.length,1,"one database record per book form");
 assert.equal(rows[0].payload.afterword,replacement);
 console.log("PUBLISHING_STAGE4_12_VIEWPORTS_ONE_RECORD_RBAC_PASS");
}
main().catch(e=>{console.error("PUBLISHING_STAGE4_E2E_FAIL",e);process.exitCode=1}).finally(async()=>{
 if(browser)await browser.close().catch(()=>{});
 if(bookId){await db.studioFormDraft.deleteMany({where:{module:"PUBLISHING_PACKAGE:"+bookId}}).catch(()=>{});await db.book.deleteMany({where:{id:bookId}}).catch(()=>{})}
 for(const id of [ownerId,otherId])if(id)await db.studioUser.deleteMany({where:{id}}).catch(()=>{});
 await db.$disconnect();
});
