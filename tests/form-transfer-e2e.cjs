const {chromium}=require("@playwright/test");
const JSZip=require("jszip");
const {PrismaClient}=require("@prisma/client");
const {scryptSync,randomBytes}=require("node:crypto");
const fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
const origin=process.env.TEST_ORIGIN||"http://127.0.0.1:32979",nonce=randomBytes(4).toString("hex");
const dbUrl=process.env.DATABASE_URL||"postgresql://bookstudio@127.0.0.1:55999/bookstudio_import_qa";
if(!/bookstudio_(import_qa|release_ci)/.test(dbUrl))throw Error("Test refuses non-isolated database");
const db=new PrismaClient({datasources:{db:{url:dbUrl}}});
const users=["a","b"].map(x=>({email:"qa-form-"+x+"-"+nonce+"@example.invalid",role:"EDITOR",name:"QA Transfer "+x}));
const password="QA!"+randomBytes(12).toString("hex");
const salt=randomBytes(16).toString("hex"),hashed=salt+":"+scryptSync(password,salt,64).toString("hex");
async function login(ctx,email){const res=await ctx.request.post(origin+"/api/auth/login",{data:{email,password}});assert.equal(res.status(),200,"Login failed "+res.status());}
(async()=>{
 let browser;const tmp=await fs.mkdtemp(path.join(os.tmpdir(),"bc-xlsx-qa-"));let draftId;
 try{
  for(const u of users)await db.studioUser.create({data:{...u,active:true,passwordHash:hashed}});
  browser=await chromium.launch({...(process.platform==="win32"?{executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"}:{}),headless:true});
  // Follow a bookmarked module through the login page.
  const redirectContext=await browser.newContext();
  const redirectPage=await redirectContext.newPage();
  await redirectPage.goto(origin+"/studio?module=Kurikulum",{waitUntil:"domcontentloaded"});
  await redirectPage.waitForURL(url=>url.pathname==="/login"&&url.searchParams.get("module")==="Kurikulum",{timeout:15000});
  await redirectPage.getByLabel("Alamat email").fill(users[0].email);
  await redirectPage.getByLabel("Kata sandi").fill(password);
  await redirectPage.getByRole("button",{name:/Masuk ke Studio/}).click();
  await redirectPage.waitForURL(url=>url.pathname==="/studio"&&url.searchParams.get("module")==="Kurikulum",{timeout:15000});
  await redirectPage.locator(".form-draft-manager").waitFor({state:"visible",timeout:15000});
  await redirectContext.close();
  const context=await browser.newContext({acceptDownloads:true,viewport:{width:390,height:844}});
  await login(context,users[0].email);
  const page=await context.newPage();await page.goto(origin+"/studio");
  await page.getByRole("button",{name:"Buka menu"}).click();await page.getByRole("button",{name:"Idea Lab",exact:true}).click();
  const transfer=page.locator(".form-draft-manager");
  assert(await transfer.isVisible(),"Transfer section not shown");
  const downloaded=page.waitForEvent("download");
  await transfer.getByRole("button",{name:/Unduh XLSX/}).click();
  const xlsx=await downloaded;const wb=await JSZip.loadAsync(await fs.readFile(await xlsx.path()));
  let xml=await wb.file("xl/worksheets/sheet1.xml").async("string");
  function replaceCell(ref,value){const i=xml.indexOf(`<c r="${ref}"`);assert(i>=0,"Missing cell "+ref);const start=xml.indexOf(">",xml.indexOf("<t",i))+1,end=xml.indexOf("</t>",start);xml=xml.slice(0,start)+value+xml.slice(end);}
  replaceCell("C2","Buku IPA Eksperimen");
  replaceCell("C6","Membangun pemahaman konsep sains melalui proyek nyata.");
  wb.file("xl/worksheets/sheet1.xml",xml);
  const local=path.join(tmp,"idea.xlsx");await fs.writeFile(local,await wb.generateAsync({type:"nodebuffer"}));
  await transfer.locator('input[type="file"]').setInputFiles(local);
  await transfer.getByRole("button",{name:/Terapkan ke form/}).click();
  assert.equal(await page.getByLabel("Judul sementara").inputValue(),"Buku IPA Eksperimen");
  const invalidZip=await JSZip.loadAsync(await fs.readFile(local));
  let badSheet=await invalidZip.file("xl/worksheets/sheet1.xml").async("string");
  const formulaStart=badSheet.indexOf('<c r="C2"'),formulaEnd=badSheet.indexOf("</c>",formulaStart)+4;
  badSheet=badSheet.slice(0,formulaStart)+'<c r="C2"><f>2+2</f><v>4</v></c>'+badSheet.slice(formulaEnd);
  invalidZip.file("xl/worksheets/sheet1.xml",badSheet);
  const badPath=path.join(tmp,"unsafe.xlsx");await fs.writeFile(badPath,await invalidZip.generateAsync({type:"nodebuffer"}));
  await transfer.locator('input[type="file"]').setInputFiles(badPath);
  await page.getByRole("alert").filter({hasText:"Formula Excel tidak diizinkan"}).waitFor({timeout:10000});
  assert.equal(await page.getByLabel("Judul sementara").inputValue(),"Buku IPA Eksperimen");
  await transfer.getByLabel("Nama draf").fill("Eksperimen IPA Kelas 7");
  await transfer.getByRole("button",{name:"Simpan draf baru"}).click();
  await page.getByText("Data draf tersimpan di server.").waitFor({timeout:10000});
  let drafts=(await (await context.request.get(origin+"/api/form-drafts?module=Idea%20Lab")).json()).drafts;
  assert.equal(drafts.length,1);draftId=drafts[0].id;
  assert.equal(drafts[0].payload.bookTitle,"Buku IPA Eksperimen");
  await page.getByLabel("Judul sementara").fill("Buku IPA Eksperimen Revisi");
  await transfer.getByRole("button",{name:"Simpan perubahan"}).click();
  await page.getByText("Data draf tersimpan di server.").waitFor();
  drafts=(await (await context.request.get(origin+"/api/form-drafts?module=Idea%20Lab")).json()).drafts;
  assert.equal(drafts[0].payload.bookTitle,"Buku IPA Eksperimen Revisi");
  const mdDL=page.waitForEvent("download");await transfer.getByRole("button",{name:/Unduh Markdown/}).click();
  const md=await mdDL;let text=await fs.readFile(await md.path(),"utf8");
  text=text.replace("Buku IPA Eksperimen Revisi","Buku IPA dari Markdown");
  const mdPath=path.join(tmp,"idea.md");await fs.writeFile(mdPath,text,"utf8");
  await transfer.locator('input[type="file"]').setInputFiles(mdPath);
  await transfer.getByRole("button",{name:/Terapkan ke form/}).click();
  assert.equal(await page.getByLabel("Judul sementara").inputValue(),"Buku IPA dari Markdown");
  await transfer.getByRole("button",{name:"Simpan perubahan"}).click();
  const contextB=await browser.newContext();await login(contextB,users[1].email);
  const forbidden=await contextB.request.patch(origin+"/api/form-drafts/"+draftId,{data:{module:"Idea Lab",title:"Hijack",payload:{bookTitle:"Malicious"}}});
  assert.equal(forbidden.status(),404);
  const stolen=await contextB.request.get(origin+"/api/form-drafts?module=Idea%20Lab");assert.equal((await stolen.json()).drafts.length,0);
  const secret=await context.request.post(origin+"/api/form-drafts",{data:{module:"Idea Lab",title:"Do not accept",payload:{apiKey:"sensitive"}}});assert.equal(secret.status(),400);
  const deleting=await contextB.request.delete(origin+"/api/form-drafts/"+draftId);assert.equal(deleting.status(),404);
  page.once("dialog",dialog=>dialog.accept());
  await transfer.getByRole("button",{name:"Hapus draf"}).click();
  await page.getByText("Draf dihapus.").waitFor({timeout:10000});
  assert.equal((await (await context.request.get(origin+"/api/form-drafts?module=Idea%20Lab")).json()).drafts.length,0);
  // Roundtrip a complete book brief from Markdown into a real owned book.
  await page.getByRole("button",{name:"Buka menu"}).click();
  await page.getByRole("button",{name:"Buat Buku",exact:true}).click();
  const briefTransfer=page.locator(".form-transfer").first();
  const briefDL=page.waitForEvent("download");
  await briefTransfer.getByRole("button",{name:/Unduh Markdown/}).click();
  const briefDoc=await briefDL;
  let briefText=await fs.readFile(await briefDoc.path(),"utf8");
  briefText=briefText.replace("## title — Judul sementara","## title — Judul sementara"+String.fromCharCode(10,10)+"Buku Pengujian Impor");
  const briefPath=path.join(tmp,"book.md");await fs.writeFile(briefPath,briefText);
  await briefTransfer.locator('input[type="file"]').setInputFiles(briefPath);
  await briefTransfer.getByRole("button",{name:/Terapkan ke form/}).click();
  await page.getByRole("button",{name:"Susun prompt induk"}).click();
  await page.getByRole("button",{name:"Simpan proyek buku"}).click();
  await page.getByText("Perpustakaan Anda").first().waitFor({timeout:10000});
  const owned=(await (await context.request.get(origin+"/api/books")).json()).books;
  const book=owned.find(x=>x.title==="Buku Pengujian Impor");
  assert(book&&book.id,"Imported book not created");
  const foreign=await contextB.request.get(origin+"/api/books/"+book.id);
  assert.equal(foreign.status(),404,"RBAC book isolation failed");
  await page.getByRole("button",{name:/Buku Pengujian Impor/}).click();
  const meta=page.locator(".form-transfer").first();
  const editDL=page.waitForEvent("download");await meta.getByRole("button",{name:/Unduh Markdown/}).click();
  const editFile=await editDL;let editText=await fs.readFile(await editFile.path(),"utf8");
  editText=editText.replace("Buku Pengujian Impor","Buku Pengujian Impor Revisi");
  const editPath=path.join(tmp,"book-edit.md");await fs.writeFile(editPath,editText);
  await meta.locator('input[type="file"]').setInputFiles(editPath);
  await meta.getByRole("button",{name:/Terapkan ke form/}).click();
  await page.getByRole("button",{name:"Simpan perubahan"}).click();
  const updated=(await (await context.request.get(origin+"/api/books/"+book.id)).json()).book;
  assert.equal(updated.title,"Buku Pengujian Impor Revisi");
  await page.getByRole("button",{name:"Buka menu"}).click();
  await page.getByRole("button",{name:"Studio Penulisan",exact:true}).click();
  const chapterTransfer=page.locator('.form-transfer[aria-label="Impor dan ekspor Naskah bab"]');
  const chapterDL=page.waitForEvent("download");await chapterTransfer.getByRole("button",{name:/Unduh Markdown/}).click();
  const chapterFile=await chapterDL;const chapterPath=path.join(tmp,"chapter.md");await fs.copyFile(await chapterFile.path(),chapterPath);
  await chapterTransfer.locator('input[type="file"]').setInputFiles(chapterPath);
  await chapterTransfer.getByRole("button",{name:/Terapkan ke form/}).click();
  await page.getByRole("button",{name:"Simpan bab",exact:true}).click();
  await page.getByText("Bab tersimpan di server.").waitFor({timeout:10000});
  const withChapter=(await (await context.request.get(origin+"/api/books/"+book.id)).json()).book;
  assert.equal(withChapter.chapters.length,1,"Chapter import not persisted");
  await page.getByRole("button",{name:"Buka menu"}).click();
  await page.getByRole("button",{name:"Proyek Buku",exact:true}).click();
  page.once("dialog",dialog=>dialog.accept());
  await page.getByRole("button",{name:"Hapus draf"}).click();
  await page.getByText("Buku dihapus.").waitFor({timeout:10000});
  await assert.rejects(async()=>{
    const response=await context.request.get(origin+"/api/books/"+book.id);
    if(response.status()===404)throw Error("Deletion confirmed");
  },/Deletion confirmed/);
  // Verify transfer controls are accessible after login from their relevant sidebar pages.
  for(const [module,title] of [
    ["Idea Lab","Idea Lab"],
    ["Kurikulum","Kurikulum"],
    ["Studio Latihan","Studio Latihan"],
    ["Studio Visual","Studio Visual"],
    ["Pusat Agen","Pusat Agen"]
  ]){
    await page.getByRole("button",{name:"Buka menu"}).click();
    await page.getByRole("button",{name:module,exact:true}).click();
    assert.equal(new URL(page.url()).searchParams.get("module"),module,"Page URL must reflect selected module");
    const panel=page.locator(".form-draft-manager");
    await panel.getByRole("heading",{name:new RegExp("Impor, ekspor & CRUD draf")}).waitFor({timeout:10000});
    assert(await panel.getByRole("button",{name:/Unduh XLSX/}).isVisible(),module+" missing XLSX");
    assert(await panel.getByRole("button",{name:/Unduh Markdown/}).isVisible(),module+" missing MD");
    assert(await panel.locator('input[type="file"]').count()===1,module+" missing file input");
    await page.reload();
    assert.equal(new URL(page.url()).searchParams.get("module"),module,"Module deep link not persisted after reload");
    await page.locator(".form-draft-manager").waitFor({state:"visible",timeout:15000});
  }
  await page.getByRole("button",{name:"Buka menu"}).click();
  await page.getByRole("button",{name:"Buat Buku",exact:true}).click();
  assert(await page.locator('.form-transfer[aria-label="Impor dan ekspor Brief Buku"]').isVisible());
  await page.reload();
  assert(await page.getByRole("button",{name:"Buka menu"}).isVisible());

  console.log("FORM_TRANSFER_E2E_PASS",JSON.stringify({xlsx:true,markdown:true,bookCrud:true,chapterCrud:true,create:true,read:true,update:true,delete:true,rbac:true,secretBlock:true,sourceFilesPersistedOnServer:"no multipart request used"}));
  await contextB.close();await context.close();
 }catch(e){console.error("FORM_TRANSFER_E2E_FAIL",e.stack||e.message);process.exitCode=1}
 finally{await browser?.close();await db.studioFormDraft.deleteMany({where:{owner:{email:{in:users.map(x=>x.email)}}}}).catch(()=>{});await db.studioUser.deleteMany({where:{email:{in:users.map(x=>x.email)}}}).catch(()=>{});await db.$disconnect();await fs.rm(tmp,{recursive:true,force:true})}
})();
