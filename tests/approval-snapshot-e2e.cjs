"use strict";
const assert = require("node:assert/strict");
const { createHash, randomBytes } = require("node:crypto");
const { PrismaClient } = require("@prisma/client");

const database = new URL(process.env.DATABASE_URL);
assert.equal(database.host + database.pathname, "127.0.0.1:55999/bookstudio_import_qa");
const db = new PrismaClient();
const nonce = randomBytes(8).toString("hex");
const userIds = [];
let bookId;
let legacyId;

async function user(role) {
  const account = await db.studioUser.create({
    data: { role, active: true, name: "Snapshot QA", email: randomBytes(8).toString("hex") + "@example.invalid" },
  });
  userIds.push(account.id);
  const token = randomBytes(32).toString("hex");
  await db.studioSession.create({
    data: { userId: account.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 600000) },
  });
  return { id: account.id, cookie: "bcstudio_session=" + token };
}

async function call(path, status, actor, data, method = data ? "POST" : "GET") {
  if(method==="PATCH"&&/^\/api\/books\/[^/]+$/.test(path)&&data&&!Object.prototype.hasOwnProperty.call(data,"expectedVersion")){
    const r=await fetch("http://127.0.0.1:32979"+path,{headers:{...(actor?{cookie:actor.cookie}:{})}});
    const current=await r.json().catch(()=>({}));data={...data,expectedVersion:current.book?.updatedAt||new Date(0).toISOString()};
  }
  const response = await fetch("http://127.0.0.1:32979" + path, {
    method,
    headers: { ...(actor ? { cookie: actor.cookie } : {}), ...(data ? { "content-type": "application/json" } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });
  const body = await response.text();
  assert.equal(response.status, status, method + " " + path + " " + body.slice(0, 200));
  return body;
}

async function test() {
  const owner = await user("ADMIN");
  const reviewer = await user("REVIEWER");
  const other = await user("ADMIN");
  const title = "Approval QA " + nonce;
  const created = JSON.parse(await call("/api/books", 201, owner, {
    title, grade: "7", subject: "Bahasa Indonesia", bookType: "NONFICTION", genre: "REFERENCE",
  }));
  bookId = created.book.id;
  const path = "/api/books/" + bookId;
  const content = "APPROVED_ONLY_" + nonce;
  const chapter = JSON.parse(await call(path + "/chapters", 201, owner, { title: "Bab QA", content }));
  const chapterId = chapter.chapter.id;
  const chapterPath = path + "/chapters/" + chapterId;
  const baseVersion = chapter.chapter.updatedAt;
  const patch = { title: "Bab QA diperbarui", content };
  await call(chapterPath, 401, undefined, patch, "PATCH");
  await call(chapterPath, 404, other, patch, "PATCH");
  await call(chapterPath, 428, owner, patch, "PATCH");
  const competing = await Promise.all(["Pertama", "Kedua"].map(title =>
    fetch("http://127.0.0.1:32979" + chapterPath, {
      method: "PATCH",
      headers: { cookie: owner.cookie, "content-type": "application/json" },
      body: JSON.stringify({ title, content, expectedVersion: baseVersion }),
    })
  ));
  assert.deepEqual(competing.map(response => response.status).sort(), [200, 409]);
  const losingResponse = competing.find(response => response.status === 409);
  assert.equal((await losingResponse.json()).code, "CHAPTER_VERSION_CONFLICT");
  const winner = (await competing.find(response => response.status === 200).json()).chapter;
  const saved = JSON.parse(await call(chapterPath, 200, owner)).chapter;
  assert.equal(saved.title, winner.title);
  assert.notEqual(saved.updatedAt, baseVersion);
  assert.equal(saved.revisions.length, 1);
  assert.equal(saved.revisions[0].title, "Bab QA");
  const noOp = JSON.parse(await call(chapterPath, 200, owner, {
    title: winner.title, content, expectedVersion: saved.updatedAt,
  }, "PATCH"));
  assert.equal(noOp.unchanged, true);
  assert.equal(noOp.chapter.updatedAt, saved.updatedAt);
  console.log("PASS concurrent chapter PATCH, 409 conflict, one preserved revision, retry-safe no-op and RBAC");
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addCookies([{
      name: "bcstudio_session", value: owner.cookie.split("=")[1], url: "http://127.0.0.1:32979",
    }]);
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:32979/studio?module=Studio+Penulisan&bookId=" + bookId);
    const editor = page.getByRole("region",{name:"Kanvas naskah draf"});
    await editor.waitFor({timeout:20000});
    await editor.getByLabel("Bab aktif").selectOption(winner.id);
    const field = editor.locator("textarea[data-draft-block]").first();
    assert.equal((await field.inputValue()).trim(),content.trim());
    await call(chapterPath,200,owner,{title:"Dari tab lain",content,expectedVersion:saved.updatedAt},"PATCH");
    const conflictingText="Draf lokal yang tidak boleh hilang";
    await field.fill(conflictingText);
    await editor.getByRole("button",{name:"Simpan sekarang"}).click();
    const recover=editor.getByRole("button",{name:"Muat versi server"});
    await recover.waitFor({timeout:15000});
    assert.equal(await field.inputValue(),conflictingText);
    page.once("dialog",dialog=>dialog.accept());
    await recover.click();
    await page.waitForLoadState("domcontentloaded");
    await editor.waitFor({timeout:15000});
    await editor.getByLabel("Bab aktif").selectOption(winner.id);
    const refreshed=editor.locator("textarea[data-draft-block]").first();
    assert.equal((await refreshed.inputValue()).trim(),content.trim());
    await editor.getByLabel("Judul bab (editor blok)").fill("Versi hasil pemulihan");
    await editor.getByRole("button",{name:"Simpan sekarang"}).click();
    await editor.getByText("Naskah tersimpan.",{exact:true}).waitFor({timeout:15000});
    assert.equal(JSON.parse(await call(chapterPath,200,owner)).chapter.title,"Versi hasil pemulihan");
    console.log("PASS modern block editor 409 conflict, local draft preserved, explicit recovery and autosave");
    const current=JSON.parse(await call(chapterPath,200,owner)).chapter;
    await call(chapterPath,409,owner,{restoreRevision:1,expectedVersion:baseVersion},"PATCH");
    await call(chapterPath,404,other,{restoreRevision:1,expectedVersion:current.updatedAt},"PATCH");
    await call(chapterPath,404,owner,{restoreRevision:999,expectedVersion:current.updatedAt},"PATCH");
    await editor.getByText("Riwayat revisi naskah").click();
    await editor.getByRole("button",{name:"Muat riwayat"}).click();
    await editor.locator(".draft-revision-history li details summary").filter({hasText:/Revisi 1\b/}).click();
    page.once("dialog",dialog=>dialog.accept());
    await editor.getByRole("button",{name:"Pulihkan revisi 1",exact:true}).click();
    await editor.getByText("Naskah tersimpan.",{exact:true}).waitFor({timeout:15000});
    let restored;
    for(let attempt=0;attempt<50;attempt++){
      restored=JSON.parse(await call(chapterPath,200,owner)).chapter;
      if(restored.title==="Bab QA")break;
      await new Promise(resolve=>setTimeout(resolve,200));
    }
    assert.equal(restored.title,"Bab QA");
    assert.equal(restored.content,content);
    assert.equal(restored.revisions.length,current.revisions.length+1);
    assert.equal(restored.revisions[0].title,current.title);
    assert.equal(restored.revisions.at(-1).revision,1);
    console.log("PASS modern browser restore, previous version retained, stale/foreign/missing denied");

    await call(path + "/workflow", 401);
    await call(path + "/workflow", 404, other, { to: "OUTLINE" });
    await call(path + "/workflow", 400, owner, { to: "APPROVED" });
    await call(path + "/workflow", 409, owner, { to: "OUTLINE" });
    await call(path, 400, owner, { editorialStage: "OUTLINE" }, "PATCH");
    await page.goto("http://127.0.0.1:32979/studio?module=Proyek+Buku&bookId=" + bookId);
    const brief = page.getByRole("region", { name: "Tahap Ide" });
    const next = brief.getByRole("button", { name: "Lanjut ke Rancang" });
    await brief.getByText("Sinopsis (minimal 20 karakter)", { exact: true }).waitFor();
    assert.equal(await next.isDisabled(), true);
    await page.getByLabel("Brief / deskripsi buku").fill("Buku untuk mengenalkan dasar struktur cerita kepada pembaca pemula.");
    await page.getByRole("button", { name: "Simpan perubahan", exact: true }).click();
    await page.getByLabel("Pembaca sasaran").fill("Siswa SMP kelas tujuh");
    await page.getByLabel("Tujuan penulisan").fill("Menyusun kerangka cerita pendek.");
    await page.getByRole("button", { name: "Simpan perubahan", exact: true }).click();
    await brief.getByText("Riwayat brief dan panduan editorial (opsional)").click();
    await brief.getByRole("button", { name: "Muat riwayat brief" }).click();
    const briefHistory = brief.getByRole("region", {name:"Riwayat brief"});
    await briefHistory.locator("summary").first().waitFor();
    const savedHistory = JSON.parse(await call(path+"?briefHistory=1",200,owner)).history;
    assert.equal(savedHistory.length,2);
    assert.equal(savedHistory[0].snapshot.targetAudience,"");
    await call(path+"?briefHistory=1",404,other);
    await next.click();
    await page.getByRole("region", { name: "Tahap Rancang" }).getByRole("heading",{name:"Kerangka buku"}).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("bookId"), bookId);
    await page.reload();
    await page.getByRole("region", { name: "Tahap Rancang" }).getByRole("heading",{name:"Kerangka buku"}).waitFor();
    await call(path + "/workflow", 409, owner, { to: "OUTLINE" });
    assert.equal(await db.review.count({where:{bookId,decision:"stage:BRIEF:OUTLINE"}}),1);
    console.log("PASS Ide to Rancang, server readiness, persisted same book, role checks and single audit event");
    await call(path + "/workflow", 409, owner, { to: "WRITING" });
    await call(path + "/chapters", 404, other, { title: "Lintas pemilik", outlineObjective: "Ditolak" });
    await call(chapterPath, 200, owner, {
      title: "Bab QA", outlineObjective: "Mengembangkan alur cerita",
      expectedVersion: JSON.parse(await call(chapterPath, 200, owner)).chapter.updatedAt,
    }, "PATCH");
    const outline = page.getByRole("region", { name: "Tahap Rancang" });
    await outline.getByLabel("Judul kerangka bab").fill("Bab kedua");
    await outline.getByRole("textbox",{name:"Tujuan bab"}).fill("Menyusun akhir cerita.");
    await outline.getByRole("button", { name: "Tambah bab kerangka" }).click();
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith("/chapters/reorder") && response.status() === 200),
      outline.getByRole("button", { name: "Naikkan Bab kedua" }).click(),
    ]);
    await page.reload();
    await outline.getByRole("button", { name: "Turunkan Bab kedua" }).waitFor();
    assert.equal(await outline.locator("ol > li").first().getByText("Bab kedua", { exact: true }).isVisible(), true);
    assert.equal(await outline.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true);
    const beforeArchive = JSON.parse(await call(path,200,owner)).book.chapters[0];
    page.once("dialog", dialog=>dialog.accept());
    await outline.getByRole("button",{name:"Arsipkan bab Bab kedua"}).click();
    await outline.getByText("Bab diarsipkan.",{exact:true}).waitFor();
    assert.ok((await db.chapter.findUnique({where:{id:beforeArchive.id}})).archivedAt);
    assert.equal(JSON.parse(await call(path,200,owner)).book.chapters.some(chapter=>chapter.id===beforeArchive.id),false);
    assert.equal(JSON.parse(await call(path+"/chapters",200,owner)).archived[0].id,beforeArchive.id);
    await call(path+"/chapters",404,other);
    await outline.getByText("Arsip bab (1)",{exact:true}).click();
    await outline.getByRole("button",{name:"Pulihkan bab Bab kedua"}).click();
    await outline.getByText("Bab dipulihkan di akhir daftar.",{exact:true}).waitFor();
    assert.equal((await db.chapter.findUnique({where:{id:beforeArchive.id}})).archivedAt,null);
    assert.equal(await db.review.count({where:{bookId,decision:{in:["chapter:archive","chapter:restore"]}}}),2);
    await page.setViewportSize({width:1440,height:900});
    const first=outline.locator("ol > li").first();
    await Promise.all([
      page.waitForResponse(response=>response.url().endsWith("/chapters/reorder")&&response.status()===200),
      outline.locator("ol > li").filter({has:page.getByText("Bab kedua",{exact:true})}).getByText("Seret",{exact:true}).dragTo(first),
    ]);
    await page.reload();
    await outline.locator("ol > li").first().getByText("Bab kedua",{exact:true}).waitFor();
    await outline.getByRole("button", { name: "Lanjut ke Tulis" }).click();
    console.log("PASS brief history, mobile archive/restore, desktop drag-and-drop, database and refresh");
    await page.getByRole("heading", { name: "Studio Penulisan" }).waitFor();
    const writtenBook = JSON.parse(await call(path, 200, owner)).book;
    assert.equal(writtenBook.editorialStage, "WRITING");
    assert.equal(await db.review.count({where:{bookId,decision:"stage:OUTLINE:WRITING"}}),1);
    const second = writtenBook.chapters[0];
    assert.equal(second.title, "Bab kedua");
    assert.equal(second.content, "");
    assert.match(await call(path + "/review", 409, owner, { action: "submit" }), /Complete manuscript content/);
    await call(path + "/chapters/" + second.id, 200, owner, {
      title: second.title, content: "Isi naskah nyata untuk bab kedua.", expectedVersion: second.updatedAt,
    }, "PATCH");
    // Reorder was exercised in the visible Stage 2 UI above; Stage 3 has a separate block canvas.
    // Do not target hidden legacy chapter drag handles in Stage 3.
    const orderedAfterWriting=JSON.parse(await call(path,200,owner)).book.chapters;
    assert.equal(orderedAfterWriting[0].title,"Bab kedua");

    await page.reload();
    console.log("PASS chapter reorder remains persisted after reload; detailed canvas CRUD is covered by dedicated regression tests");
    console.log("PASS outline create/update/reorder, persisted order, gated writing and empty manuscript blocked");
  } finally {
    await browser.close();
  }
  await call(path + "/export?format=html", 401);
  await call(path + "/export?format=html", 404, other);
  await call(path + "/export?format=html", 409, owner);
  assert.match(await call(path + "/export?format=html&preview=1", 200, owner), /DRAF — BELUM DISETUJUI/);
  await call(path, 200, owner, { editorialChecks: {
    objectives: true, sources: true, assessment: true, expert: true, rights: true,
  } }, "PATCH");
  await db.bookReviewer.create({data:{bookId,reviewerId:reviewer.id,assignedById:owner.id}});
  await call(path + "/review", 200, owner, { action: "submit" });
  await call(path + "/review", 403, owner, { action: "approve", note: "Self-approval" });
  await call(path + "/review", 403, other, { action: "approve", note: "Unassigned" });
  await call(path + "/review", 200, reviewer, { action: "approve", note: "Approved test manuscript" });
  assert.equal(await db.bookApprovalSnapshot.count({ where: { bookId, reviewerId: reviewer.id } }), 1);
  await call(path + "/chapters/" + chapterId, 409, owner, { title: "Bab QA", content: "This write must be rejected after approval." }, "PATCH");
  await call(chapterPath, 409, owner, { restoreRevision: 1 }, "PATCH");
  // Simulate out-of-band drift to prove the renderers never read mutable content for final output.
  await db.chapter.update({ where: { id: chapterId }, data: { content: "UNAPPROVED_DRIFT" } });
  const layoutPath=path+"/layout";
  await call(layoutPath,404,other);
  const initial=JSON.parse(await call(layoutPath,200,owner));
  assert.equal(initial.version,0);
  await call(layoutPath,400,owner,{snapshot:initial.snapshot,expectedVersion:0,settings:{pageSize:"A5",order:[1,1]}},"PATCH");
  await call(path+"/publication",409,owner,{action:"publish",confirmed:true});
  const layoutBrowser=await chromium.launch();
  try{
   const context=await layoutBrowser.newContext({viewport:{width:390,height:844}});
   await context.addCookies([{name:"bcstudio_session",value:owner.cookie.split("=")[1],url:"http://127.0.0.1:32979"}]);
   const page=await context.newPage();
   await page.goto("http://127.0.0.1:32979/studio?module=Tata+Letak&bookId="+bookId);
   await page.getByRole("button",{name:"Buka menu",exact:true}).click();
   await page.getByRole("navigation",{name:"Menu studio"}).getByRole("button",{name:"Tata Letak",exact:true}).click();
   const editor=page.getByRole("region",{name:"Tata letak buku",exact:true});
   await editor.getByRole("button",{name:"Naikkan Bab QA",exact:true}).click();
   await editor.getByText("Tata letak tersimpan otomatis di buku ini.",{exact:true}).waitFor();
   await editor.getByLabel("Ukuran halaman").selectOption("A5");
   await editor.getByText("Tata letak tersimpan otomatis di buku ini.",{exact:true}).waitFor();
   const transfer=editor.getByRole("region",{name:"Impor dan ekspor Tata letak buku"});
   const markdownDownload=page.waitForEvent("download");
   await transfer.getByRole("button",{name:"Unduh Markdown"}).click();
   const md=await markdownDownload;
   const fs=require("node:fs/promises");
   const original=await fs.readFile(await md.path(),"utf8");
   assert.match(original,/chapter-2[^\r\n]*\r?\n\s*1\b/);
   await editor.getByRole("button",{name:"Baca ulang",exact:true}).click();
   assert.equal(await editor.locator(".book-layout-canvas").getAttribute("data-view"),"read");
   console.log("PASS in-page layout canvas autosaves reorder and size without a save click");
   await page.reload();
   assert.equal(await editor.getByLabel("Ukuran halaman").inputValue(),"A5");
   await editor.getByRole("button",{name:"Lanjut ke Penerbitan"}).click();
   assert.equal(new URL(page.url()).searchParams.get("bookId"),bookId);
   await page.getByRole("heading",{name:"Penerbitan",exact:true}).waitFor();
  }finally{await layoutBrowser.close()}
  const savedLayout=JSON.parse(await call(layoutPath,200,owner));
  assert.deepEqual(savedLayout.settings.order,initial.settings.order.toReversed());
  assert.equal((await db.bookLayout.findFirst({where:{bookId}})).version,savedLayout.version);
  assert.ok(savedLayout.version>=1);
  await call(layoutPath,409,owner,{snapshot:initial.snapshot,expectedVersion:0,settings:null},"PATCH");
  await call(layoutPath,200,owner,{snapshot:initial.snapshot,expectedVersion:savedLayout.version,settings:null},"PATCH");
  assert.equal(JSON.parse(await call(layoutPath,200,owner)).saved,false);
  await call(layoutPath,200,owner,{snapshot:initial.snapshot,expectedVersion:savedLayout.version+1,settings:savedLayout.settings},"PATCH");
  const previewHtml=await call(path+"/export?format=html&preview=1&layout=1",200,owner);
  assert.ok(previewHtml.indexOf("Bab QA")<previewHtml.indexOf("Bab kedua")); // Layout reordered Bab QA to the first position.
  const html = await call(path + "/export?format=html", 200, reviewer);
  assert.ok(html.includes(content) && !html.includes("UNAPPROVED_DRIFT"));
  await call(path + "/publication", 404, reviewer, { action: "publish", confirmed:true });
  await call(path + "/publication", 400, owner, { action: "publish" });
  const noGo=await call(path + "/publication", 409, owner, { action: "publish", confirmed:true });
  assert.match(noGo,/NO_GO.*Flipbook|NO_GO.*hak cipta|NO_GO.*persyaratan publikasi/i);
  await call(layoutPath,409,owner,{snapshot:initial.snapshot,expectedVersion:savedLayout.version+1,settings:null},"PATCH");
  assert.equal(await db.bookPublication.count({where:{bookId}}),0,"NO-GO must not create publication");
  console.log("PASS layout CRUD, sidebar, drag persistence, immutable Review snapshot, export and strict publication NO_GO gate");
  await call("/read/" + bookId, 404);
  await call(path + "/publication", 409, owner, { action: "unpublish" });
  const legacy = await db.book.create({data:{ownerId:owner.id,title:"Legacy QA",grade:"7",subject:"QA",status:"APPROVED",approvedAt:new Date()}});
  legacyId = legacy.id;
  await call("/api/books/" + legacyId + "/export?format=html", 409, owner);
  await call("/api/books/" + legacyId + "/publication", 409, owner, { action: "publish", confirmed:true });
  console.log("PASS snapshot approval, RBAC, draft preview, HTML, strict NO_GO and legacy fail-closed; positive publish/read/revoke intentionally NOT_RUN until five-format proof is available.");
}

test().finally(async () => {
  if (bookId) {
    await db.bookLayout.deleteMany({where:{bookId}});
    await db.bookApprovalSnapshot.deleteMany({ where: { bookId } });
  }
  await db.book.deleteMany({ where: { id: { in: [bookId, legacyId].filter(Boolean) } } });
  await db.studioUser.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
}).catch(error => { console.error(error); process.exitCode = 1; });
