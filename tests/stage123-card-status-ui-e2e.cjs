"use strict";
const assert=require("node:assert/strict"),{PrismaClient}=require("@prisma/client"),{randomBytes,createHash}=require("node:crypto"),{chromium}=require("playwright");
const u=new URL(process.env.DATABASE_URL||"");assert.equal(u.host+u.pathname,"127.0.0.1:55999/bookstudio_import_qa");
const db=new PrismaClient(),origin="http://127.0.0.1:32979",ids=[];let user,browser;
async function create(stage,chapter){
 const b=await db.book.create({data:{ownerId:user.id,title:"Status QA "+stage+" "+randomBytes(3).toString("hex"),subject:"IPA",grade:"7",author:"Penulis Uji",bookType:"NONFICTION",genre:"TEXTBOOK",pageSize:"A4",targetAudience:"Siswa SMP",writingGoal:"Memahami pengertian ekologi melalui observasi.",description:"Buku pembelajaran IPA untuk siswa dengan contoh pengamatan yang terukur dan aman.",editorialStage:stage,chapters:chapter?{create:{position:1,title:"Pengantar Ekologi",outlineObjective:chapter==="complete"?"Membandingkan biotik dan abiotik dalam ekosistem.":"",content:chapter==="complete"?"Tumbuhan, hewan, dan bakteri merupakan faktor biotik. Air, cahaya dan tanah termasuk komponen abiotik.":""}}:undefined}});
 ids.push(b.id);return b;
}
async function main(){
 user=await db.studioUser.create({data:{name:"Cards QA",role:"EDITOR",email:randomBytes(12).toString("hex")+"@example.invalid",active:true}});
 const token=randomBytes(32).toString("hex");await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});
 const first=await create("BRIEF"),second=await create("OUTLINE","incomplete"),third=await create("WRITING","complete");
 const response=await fetch(origin+"/api/books",{headers:{cookie:"bcstudio_session="+token}});
 assert.equal(response.status,200);const {books}=await response.json();const byId=id=>books.find(b=>b.id===id);
 assert(byId(first.id)?.stageReadiness.stages.some(x=>x.name==="Ide"));
 assert.equal(byId(second.id).stageReadiness.stages[0].complete,true);
 assert.equal(byId(third.id).stageReadiness.stages[1].complete,true);
 browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:860}});
 await ctx.addCookies([{name:"bcstudio_session",value:token,url:origin}]);const page=await ctx.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin+"/studio?module=Proyek+Buku&bookId="+first.id);
 const library=page.locator(".book-library");
 const card=(b)=>library.locator(".agent-card").filter({hasText:b.title});
 await card(first).waitFor({timeout:25000});
 assert(await card(first).evaluate(e=>e.classList.contains("status-yellow")),"Stage1 active project should be yellow");
 assert(await card(second).evaluate(e=>e.classList.contains("status-yellow")),"Stage2 active project should be yellow");
 assert(await card(third).evaluate(e=>e.classList.contains("status-green")),"Stage3 complete project should be green");
 const nav=page.getByRole("navigation",{name:"Alur menulis buku Stage 1 sampai 3"});
 await nav.waitFor();assert(await nav.getByRole("button",{name:/1. Ide/}).evaluate(e=>e.classList.contains("status-yellow")));
 assert(await nav.getByRole("button",{name:/2. Rancang/}).evaluate(e=>e.classList.contains("status-red")));
 assert.equal(await page.getByLabel("Pembaca sasaran").count(),1,"Stage1 must not duplicate its audience form");
 assert.equal(await page.getByLabel("Tujuan penulisan").count(),1,"Stage1 must not duplicate its goal form");
 assert.equal(await page.getByLabel("Ukuran halaman cetak").isVisible(),false,"Print size belongs to advanced settings");
 console.log("CARDS_BACKEND_UI_PASS: yellow active, red locked, green completed, one input per field");
 // A blocked stage must guide to its unmet prerequisite instead of becoming a dead button.
 const lockedWrite=nav.getByRole("button",{name:/3. Tulis/});
 assert.equal(await lockedWrite.isDisabled(),false);
 await lockedWrite.click();
 await page.getByRole("region",{name:"Petunjuk tahap saat ini"}).getByText(/Tahap yang dipilih belum tersedia/).waitFor();
 assert.equal(new URL(page.url()).searchParams.get("module"),"Proyek Buku");
 await page.waitForFunction(()=>document.activeElement?.textContent?.includes("Lanjut ke Rancang")&&document.activeElement?.tagName==="BUTTON");
 console.log("STAGE_LOCKED_CARD_JUMP_PASS: focus on Stage 1 prerequisite action");
 // A yellow library card must lead directly to the unfinished chapter outline.
 await card(second).click();
 await page.getByRole("region",{name:"Tahap Rancang"}).waitFor({timeout:20000});
 assert.equal(new URL(page.url()).searchParams.get("module"),"Rancang");
 await page.waitForFunction(()=>document.activeElement?.tagName==="TEXTAREA");
 console.log("STAGE_PROGRESS_CARD_JUMP_PASS: route and focus missing chapter objective");
 await library.locator("summary").first().click();
 await card(third).click();
 await nav.getByRole("button",{name:/3. Tulis/}).click();
 const advanced=page.locator("details.stage-advanced-tools").filter({has:page.getByText("Alat tambahan (opsional): AI, ilustrasi dan editor klasik")});
 await advanced.waitFor({timeout:20000});
 assert.equal(await advanced.getAttribute("open"),null,"Legacy tools should be collapsed");
 const canvas=page.getByRole("region",{name:"Kanvas naskah draf"});await canvas.waitFor();
 await canvas.locator(".draft-block-status.status-green").first().waitFor({timeout:12000});
 await canvas.getByRole("button",{name:"Periksa isi blok 1"}).click();
 assert.equal(await page.evaluate(()=>document.activeElement?.tagName),"TEXTAREA");
 console.log("STAGE3_BLOCK_BADGE_FOCUS_PASS");
 assert.equal(await page.getByRole("button",{name:"Pratinjau PDF"}).count(),0,"PDF export must not be offered in Stage 3");
 await page.getByText("Baca naskah tersimpan").waitFor();
 console.log("CARDS_STAGE3_CLEANUP_PASS: canonical editor visible, legacy tools collapsed");
 await nav.getByRole("button",{name:/2. Rancang/}).click();
 const outline=page.getByRole("region",{name:"Tahap Rancang"});await outline.waitFor();
 await outline.locator("li.chapter-status-card.status-green").first().waitFor();
 await outline.getByRole("button",{name:/Buka isian kerangka untuk Pengantar Ekologi/}).click();
 assert.equal(await outline.locator('input[placeholder]').first().inputValue(),"Pengantar Ekologi");
 console.log("STAGE2_CHAPTER_BADGE_EDITOR_PASS");
 console.log("CARDS_STAGE2_CHAPTER_PASS");
 await page.goto(origin+"/studio?module=Proyek+Buku&bookId="+first.id);
 await page.locator(".stage-step-card.status-red").first().waitFor({timeout:15000});
 for(const mode of ["light","dark"]){await page.evaluate(t=>{localStorage.setItem("bcstudio-theme",t);document.documentElement.dataset.theme=t},mode);await page.waitForFunction(t=>document.documentElement.dataset.theme===t,mode);for(const width of [320,375,390,768,1024,1440]){await page.setViewportSize({width,height:860});const s=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1}));assert.equal(s.overflow,false,mode+" "+width);if(mode==="light"){const colors=await page.evaluate(()=>{const value=s=>getComputedStyle(document.querySelector(s)).backgroundColor;return {green:value(".book-library .agent-card.status-green"),yellow:value(".book-library .agent-card.status-yellow"),red:value(".stage-step-card.status-red")}});assert.equal(colors.green,"rgb(188, 236, 205)");assert.equal(colors.yellow,"rgb(255, 229, 160)");assert.equal(colors.red,"rgb(255, 200, 208)");console.log("LIGHT_CARD_COLORS_PASS",width,JSON.stringify(colors))}if(mode==="dark"){const cardColors=await page.evaluate(()=>{const get=selector=>{const el=document.querySelector(selector);if(!el)throw Error("Missing "+selector);const cs=getComputedStyle(el);return {bg:cs.backgroundColor,border:cs.borderTopColor,ink:cs.color}};return {green:get(".book-library .agent-card.status-green"),yellow:get(".book-library .agent-card.status-yellow"),red:get(".stage-step-card.status-red")}});const rgb=x=>(x.match(/\d+/g)||[]).slice(0,3).map(Number);const green=rgb(cardColors.green.bg),yellow=rgb(cardColors.yellow.bg),red=rgb(cardColors.red.bg);assert(green[1]>green[0]*1.5&&green[1]>green[2]*.8,JSON.stringify(cardColors));assert(yellow[0]>yellow[2]*1.5&&yellow[1]>yellow[2]*1.4,JSON.stringify(cardColors));assert(red[0]>red[1]*2&&red[0]>red[2]*1.5,JSON.stringify(cardColors));console.log("DARK_CARD_COLORS_PASS",width,JSON.stringify(cardColors))}}}
 // One visible border, no permanent inset stripe or selected outline; subtle 3D only on hover.
 await page.setViewportSize({width:1024,height:860});
 for(const theme of ["light","dark"]){
  await page.evaluate(t=>{localStorage.setItem("bcstudio-theme",t);document.documentElement.dataset.theme=t},theme);
  await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
  await page.emulateMedia({reducedMotion:"no-preference"});
  const card=page.locator(".book-library .agent-card.status-green").first();
  const selector=".book-library .agent-card.status-green";
  const styles=await page.evaluate(sel=>{const c=getComputedStyle(document.querySelector(sel));return {width:c.borderTopWidth,shadow:c.boxShadow,outline:c.outlineStyle,background:c.backgroundColor}},selector);
  console.log("SINGLE_BORDER_DEBUG",theme,JSON.stringify({styles,css:await page.evaluate(()=>[...document.styleSheets].map(x=>x.href).filter(Boolean).slice(-4))}));
  assert(["1px","1.5px"].includes(styles.width),theme+" card must have one fine perimeter border, got "+styles.width);
  assert.equal(styles.outline,"none",theme+" selected outline must be absent");
  assert(!styles.shadow.includes("inset"),theme+" inset stripe must be absent "+styles.shadow);
  const badge=await page.evaluate(sel=>getComputedStyle(document.querySelector(sel+" .card-status-label")).borderTopWidth,selector);
  assert.equal(badge,"0px",theme+" badge must not have a secondary outline");
  await card.hover();await page.waitForTimeout(440);
  const hovered=await page.evaluate(sel=>{const c=getComputedStyle(document.querySelector(sel));return {transform:c.transform,shadow:c.boxShadow}},selector);
  assert.equal(hovered.transform,"none",theme+" hover must stay static");
  assert(hovered.shadow&&!hovered.shadow.includes("inset"),theme+" hover must retain a single soft shadow");
  const duration=await page.evaluate(sel=>getComputedStyle(document.querySelector(sel)).transitionDuration,selector);
  assert(duration.split(",").every(t=>t.trim()==="0s"),theme+" hover must not animate");
  console.log("SINGLE_BORDER_STATIC_HOVER_PASS",theme,JSON.stringify({styles,hovered}));
  await page.emulateMedia({reducedMotion:"reduce"});await page.waitForTimeout(50);
  const reduced=await page.evaluate(sel=>{const c=getComputedStyle(document.querySelector(sel));return {transform:c.transform,transition:c.transitionDuration}},selector);
  assert.equal(reduced.transform,"none");assert(reduced.transition.split(",").every(t=>t.trim()==="0s"),JSON.stringify(reduced));
  console.log("REDUCED_MOTION_PASS",theme);
 }
 assert.deepEqual(errors,[]);console.log("CARDS_LIGHT_DARK_RESPONSIVE_PASS 12 widths/modes");
}
main().catch(e=>{console.error("CARDS_QA_FAIL",e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();for(const id of ids)await db.book.deleteMany({where:{id}}).catch(()=>{});if(user)await db.studioUser.deleteMany({where:{id:user.id}}).catch(()=>{});await db.$disconnect()});
