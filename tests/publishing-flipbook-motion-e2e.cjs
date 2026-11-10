"use strict";
const fs=require("fs"),assert=require("node:assert/strict"),{randomBytes,createHash}=require("node:crypto"),{PrismaClient}=require("@prisma/client"),{chromium}=require("playwright");
for(const line of fs.readFileSync(__dirname+"/../.env.local","utf8").split(/\r?\n/)){const m=line.match(/^DATABASE_URL=(.*)$/);if(m)process.env.DATABASE_URL=m[1].replace(/^["']|["']$/g,"");}
assert.equal(new URL(process.env.DATABASE_URL).hostname,"127.0.0.1");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";
(async()=>{
 const id="cmw6gk5gu005wurcoe0dk02jr",book=await db.book.findUniqueOrThrow({where:{id}});
 const token=randomBytes(32).toString("hex"),session=await db.studioSession.create({data:{userId:book.ownerId,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+300000)}});
 let browser;
 try{
  browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:1280,height:880}});
  await ctx.addCookies([{name:"bcstudio_session",value:token,url:origin}]);
  const page=await ctx.newPage(),errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.__audioStarts=[];window.__frequency=[];
   window.AudioContext=class{
    constructor(){this.sampleRate=44100;this.currentTime=0;this.destination={};this.state="running";}
    createBuffer(channels,length){return {getChannelData(){return new Float32Array(length)}};}
    createBufferSource(){return {connect(){},start(){window.__audioStarts.push("start")}};}
    createBiquadFilter(){let f={type:"",Q:{value:0},connect(){}};f.frequency={set value(v){window.__frequency.push(v)},get value(){return window.__frequency.at(-1)}};return f;}
    createGain(){return {gain:{value:0},connect(){}};}
    close(){return Promise.resolve()}
   };
  });
  await page.goto(origin+"/api/books/"+id+"/export?format=flipbook&preview=1&view=1");
  const next=page.getByRole("button",{name:"Balik halaman ke depan"}),prev=page.getByRole("button",{name:"Balik halaman ke belakang"});
  assert.equal(await next.count(),1);assert.equal(await prev.count(),1);
  assert.equal(await prev.isDisabled(),true);
  const mute=page.getByRole("button",{name:"Unmute suara membalik halaman"});await mute.click();
  assert.equal(await page.getByRole("button",{name:"Mute suara membalik halaman"}).getAttribute("aria-pressed"),"true");
  await next.click();
  assert.match(await page.locator("#page-counter").textContent(),/2.*2/);
  assert.equal(await page.locator(".page-turn-ghost.turn-forward").count(),1);
  const first=await page.evaluate(()=>({sounds:window.__audioStarts.length,freqs:window.__frequency.slice()}));
  assert.equal(first.sounds,1);assert.equal(first.freqs.at(-1),1600);
  await prev.click();
  assert.match(await page.locator("#page-counter").textContent(),/1.*1/);
  assert.equal(await page.locator(".page-turn-ghost.turn-backward").count(),1);
  const second=await page.evaluate(()=>({sounds:window.__audioStarts.length,freqs:window.__frequency.slice()}));
  assert.equal(second.sounds,2);assert.equal(second.freqs.at(-1),900);
  await page.getByRole("button",{name:"Mute suara membalik halaman"}).click();
  await next.click();
  const muted=await page.evaluate(()=>window.__audioStarts.length);assert.equal(muted,2);
  assert.equal(await page.locator("#book-view").evaluate(el=>getComputedStyle(el).perspective),"none");
  const paper=await page.locator(".book-page:not([hidden])").first().evaluate(el=>({corner:getComputedStyle(el,"::after").width,color:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));
  assert.notEqual(paper.color,paper.bg);
  assert.equal(await page.getByRole("button",{name:"Unmute suara membalik halaman"}).count(),1);

  const active=page.locator(".book-page:not([hidden])").first();
  const rect=await active.boundingBox();assert(rect&&rect.width>100);
  await page.mouse.move(rect.x+rect.width-24,rect.y+rect.height-24);
  assert.equal(await active.evaluate(el=>el.classList.contains("corner-peek-next")),true);
  await page.mouse.click(rect.x+rect.width-24,rect.y+rect.height-24);
  assert.match(await page.locator("#page-counter").textContent(),/3.*3/);
  const turned=page.locator(".book-page:not([hidden])").first();
  const rect2=await turned.boundingBox();assert(rect2);
  await page.mouse.move(rect2.x+24,rect2.y+rect2.height-24);
  assert.equal(await turned.evaluate(el=>el.classList.contains("corner-peek-prev")),true);
  await page.mouse.click(rect2.x+24,rect2.y+rect2.height-24);
  assert.match(await page.locator("#page-counter").textContent(),/2.*2/);
  console.log("PASS corner hover and click forward/backward");
  assert.deepEqual(errors,[]);
  console.log("PASS directional audio forward 1600Hz vs reverse 900Hz, mute, edge navigation, 3D overlay, paper visual, JS errors 0",JSON.stringify(paper));
 }finally{if(browser)await browser.close();await db.studioSession.delete({where:{id:session.id}})}
})().catch(e=>{console.error("FLIPBOOK_MOTION_QA_FAIL",e.stack);process.exitCode=1}).finally(()=>db.$disconnect());
