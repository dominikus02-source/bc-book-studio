"use strict";
const assert=require("node:assert/strict"),{randomBytes,createHash,randomUUID}=require("node:crypto"),{PrismaClient}=require("@prisma/client"),{chromium}=require("playwright");
const database=new URL(process.env.DATABASE_URL||"");assert.equal(database.host+database.pathname,"127.0.0.1:55999/bookstudio_import_qa","Only isolated QA");
const db=new PrismaClient(),origin="http://127.0.0.1:32979";let admin,other,browser;
async function actor(role){const user=await db.studioUser.create({data:{name:"Provider QA "+role,role,active:true,email:randomBytes(9).toString("hex")+"@example.invalid"}});const token=randomBytes(32).toString("hex");await db.studioSession.create({data:{userId:user.id,tokenHash:createHash("sha256").update(token).digest("hex"),expiresAt:new Date(Date.now()+600000)}});return {...user,token}}
async function request(actor,path,expected,method="GET",payload){const r=await fetch(origin+path,{method,headers:{cookie:"bcstudio_session="+actor.token,...(method!=="GET"?{"content-type":"application/json"}:{})},body:payload?JSON.stringify(payload):undefined});const body=await r.json().catch(()=>({}));assert.equal(r.status,expected,method+" "+path+" "+JSON.stringify(body).slice(0,500));return body}
(async()=>{
 admin=await actor("ADMIN");other=await actor("EDITOR");
 const before=await db.providerCredential.count();assert.equal(before,0,"No QA credentials should preexist for isolated test");
 await request(other,"/api/settings/providers",403);
 await request(other,"/api/settings/usage",403);
 const secret1="qa_dummy_key_"+randomBytes(20).toString("hex"),secret2="qa_dummy_key_"+randomBytes(20).toString("hex"),secret3="qa_dummy_key_"+randomBytes(20).toString("hex");
 const a=(await request(admin,"/api/settings/providers",201,"POST",{provider:"openai",label:"Model A",model:"gpt-4.1-mini",apiKey:secret1,active:true})).provider;
 assert(!JSON.stringify(a).includes(secret1));assert.equal(a.active,true);
 const b=(await request(admin,"/api/settings/providers",201,"POST",{provider:"openai",label:"Model B",model:"gpt-5.1",apiKey:secret2,active:false})).provider;
 const c=(await request(admin,"/api/settings/providers",201,"POST",{provider:"gemini",label:"Model C",model:"gemini-2.5-flash",apiKey:secret3,active:false})).provider;
 const all=await request(admin,"/api/settings/providers",200);assert.equal(all.providers.length,3);
 assert.equal(all.providers.filter(x=>x.active).length,1);assert(!JSON.stringify(all).includes(secret2));
 console.log("PROVIDER_MULTIPLE_MODELS_SAME_PROVIDER_CREATE_PASS");
 let health=await request(admin,"/api/settings/providers/"+b.id+"/check",200);assert.equal(health.ready,true);assert.equal(health.liveVerified,false);
 assert.equal(health.checks.credentialDecryptable,true);assert(!JSON.stringify(health).includes(secret2));
 await request(other,"/api/settings/providers/"+b.id+"/check",403);
 console.log("OFFLINE_READINESS_CHECK_NO_NETWORK_PASS");
 await request(admin,"/api/settings/providers/"+b.id,200,"PATCH",{active:true});
 let list=(await request(admin,"/api/settings/providers",200)).providers;assert.equal(list.filter(x=>x.active).length,1);assert.equal(list.find(x=>x.active).id,b.id);
 await request(admin,"/api/settings/providers/"+c.id,200,"PATCH",{active:true});
 list=(await request(admin,"/api/settings/providers",200)).providers;assert.equal(list.filter(x=>x.active).length,1);assert.equal(list.find(x=>x.active).id,c.id);
 await request(admin,"/api/settings/providers/"+b.id,200,"PATCH",{model:"gpt-5.1-mini",apiKey:"qa_rotated_key_"+randomBytes(20).toString("hex")});
 const updated=(await request(admin,"/api/settings/providers",200)).providers.find(x=>x.id===b.id);assert.equal(updated.model,"gpt-5.1-mini");
 const audit=await db.credentialAudit.findMany({where:{credentialId:b.id}});assert(audit.some(x=>x.action==="ROTATE"));
 console.log("MODEL_SWITCH_SINGLE_ACTIVE_KEY_ROTATE_AUDIT_PASS");
 await db.$executeRaw`INSERT INTO "AiUsageEvent" ("id","credentialId","provider","model","purpose","actorId","inputTokens","outputTokens","totalTokens","reported") VALUES (${randomUUID()},${b.id},'openai','gpt-5.1-mini','TEST_FIXTURE',${admin.id},120,80,200,true)`;
 await db.$executeRaw`INSERT INTO "AiUsageEvent" ("id","credentialId","provider","model","purpose","actorId","inputTokens","outputTokens","totalTokens","reported") VALUES (${randomUUID()},${c.id},'gemini','gemini-2.5-flash','TEST_FIXTURE',${admin.id},NULL,NULL,NULL,false)`;
 const usage=await request(admin,"/api/settings/usage?days=30",200);
 assert.equal(usage.totals.calls,2);assert.equal(usage.totals.totalTokens,200);assert.equal(usage.totals.inputTokens,120);assert.equal(usage.totals.outputTokens,80);assert.equal(usage.totals.unreportedCalls,1);assert.equal(usage.balanceAvailable,false);
 console.log("TOKEN_USAGE_AGGREGATION_REPORTED_UNREPORTED_PASS");
 browser=await chromium.launch({headless:true});const ctx=await browser.newContext({viewport:{width:1280,height:900}});
 await ctx.addCookies([{name:"bcstudio_session",value:admin.token,url:origin}]);
 const page=await ctx.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin+"/studio?module=Pengaturan");
 const panel=page.getByRole("heading",{name:"API key dan provider AI"});await panel.waitFor({timeout:25000});
 const dashboard=page.getByRole("region",{name:"Dashboard penggunaan token AI"});await dashboard.waitFor();
 await page.getByRole("button",{name:"Cek kesiapan Model A"}).click();
 await page.getByText("Konfigurasi siap",{exact:true}).first().waitFor();
 await page.getByRole("button",{name:"Aktifkan Model B"}).click();
 await page.getByText(/Model aktif diganti ke Model B/).waitFor({timeout:10000});
 await dashboard.getByText("200",{exact:true}).first().waitFor();
 assert.deepEqual(errors,[]);console.log("PROVIDER_SETTINGS_UI_SWITCH_READINESS_DASHBOARD_PASS");
 await request(admin,"/api/settings/providers/"+a.id,200,"DELETE");
 await request(admin,"/api/settings/providers/"+b.id,200,"DELETE");
 await request(admin,"/api/settings/providers/"+c.id,200,"DELETE");
 const none=await request(admin,"/api/settings/providers",200);assert.equal(none.providers.length,0);
 console.log("PROVIDER_DELETE_PASS");
})().catch(e=>{console.error("PROVIDER_QA_FAIL",e.stack||e);process.exitCode=1}).finally(async()=>{
 await browser?.close();
 await db.$executeRaw`DELETE FROM "AiUsageEvent" WHERE "purpose"='TEST_FIXTURE'`.catch(()=>{});
 const ids=await db.providerCredential.findMany({select:{id:true}}).catch(()=>[]);
 if(admin){await db.credentialAudit.deleteMany({where:{actorId:admin.id}}).catch(()=>{});for(const c of ids)await db.providerCredential.delete({where:{id:c.id}}).catch(()=>{});await db.studioSession.deleteMany({where:{userId:admin.id}});await db.studioUser.deleteMany({where:{id:admin.id}})}
 if(other){await db.studioSession.deleteMany({where:{userId:other.id}});await db.studioUser.deleteMany({where:{id:other.id}})}
 await db.$disconnect();
});
