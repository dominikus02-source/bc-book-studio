const assert=require("node:assert/strict");
const net=require("node:net"),{spawn}=require("node:child_process");
const {randomBytes,scryptSync}=require("node:crypto");
const {PrismaClient}=require("@prisma/client");
const {chromium}=require("@playwright/test");
if(!/\/(bookstudio_admin_qa|bookstudio_release_ci)(\?|$)/.test(process.env.DATABASE_URL||""))throw Error("Isolated QA database required");
const d=new PrismaClient(),origin="http://127.0.0.1:3185",messages=[];let rejectMail=false;
const password="QA-"+randomBytes(12).toString("hex"),nonce=randomBytes(5).toString("hex");
const hash=()=>{const s=randomBytes(16).toString("hex");return s+":"+scryptSync(password,s,64).toString("hex")};
const smtp=net.createServer(socket=>{
 socket.write("220 localhost QA SMTP\r\n");let buf="",data=false,mail="";
 socket.on("data",chunk=>{buf+=chunk;let end;while((end=buf.indexOf("\r\n"))>=0){
  const line=buf.slice(0,end);buf=buf.slice(end+2);
  if(data){if(line==="."){data=false;messages.push(mail);mail="";socket.write(rejectMail?"451 temporary delivery failure\r\n":"250 accepted\r\n");}else mail+=line+"\r\n";continue;}
  if(/^EHLO|^HELO/.test(line))socket.write("250-localhost\r\n250 AUTH PLAIN\r\n");
  else if(/^AUTH/.test(line))socket.write("235 authenticated\r\n");
  else if(/^DATA/.test(line)){data=true;socket.write("354 send data\r\n");}
  else if(/^QUIT/.test(line)){socket.end("221 bye\r\n");}
  else socket.write("250 OK\r\n");
 }});
});
let app,browser;const ids=[];
async function waitReady(){for(let i=0;i<90;i++){try{if((await fetch(origin+"/api/health")).ok)return;}catch{}await new Promise(r=>setTimeout(r,500));}throw Error("App not ready");}
(async()=>{try{
 await new Promise(r=>smtp.listen(2527,"127.0.0.1",r));
 app=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-H","127.0.0.1","-p","3185"],{env:{...process.env,APP_ORIGIN:origin,SMTP_HOST:"127.0.0.1",SMTP_PORT:"2527",SMTP_SECURE:"false",SMTP_USER:"qa",SMTP_APP_PASSWORD:"qa-only",SMTP_FROM:"qa@example.invalid"},stdio:"ignore"});
 await waitReady();
 const superUser=await d.studioUser.create({data:{email:"super-"+nonce+"@example.invalid",name:"QA Super",role:"SUPERADMIN",active:true,passwordHash:hash()}});ids.push(superUser.id);
 const editor=await d.studioUser.create({data:{email:"editor-"+nonce+"@example.invalid",name:"QA Editor",role:"EDITOR",active:true,passwordHash:hash()}});ids.push(editor.id);
 browser=await chromium.launch({headless:true,...(process.platform==="win32"?{executablePath:"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"}:{})});
 const admin=await browser.newContext(),other=await browser.newContext(),anon=await browser.newContext();
 for(const [ctx,user] of [[admin,superUser],[other,editor]])assert.equal((await ctx.request.post(origin+"/api/auth/login",{data:{email:user.email,password}})).status(),200);
 for(const ctx of [other,anon]){assert.equal((await ctx.request.get(origin+"/api/admin/users")).status(),403);assert.equal((await ctx.request.post(origin+"/api/admin/users/recovery",{data:{id:editor.id,action:"reset"}})).status(),403);}
 let r=await admin.request.post(origin+"/api/admin/users",{data:{email:"new-"+nonce+"@example.invalid",name:"QA Invited",role:"EDITOR"}});assert.equal(r.status(),201);let u=(await r.json()).user;ids.push(u.id);assert(!u.active);assert(messages.length===1);
 assert.equal((await admin.request.post(origin+"/api/admin/users/recovery",{data:{id:u.id,action:"reset"}})).status(),409);
 await d.studioAuthToken.deleteMany({where:{userId:u.id}});
 assert.equal((await admin.request.post(origin+"/api/admin/users/recovery",{data:{id:u.id,action:"activate"}})).status(),200);
 r=await admin.request.get(origin+"/api/admin/users");u=(await r.json()).users.find(x=>x.id===u.id);
 r=await admin.request.patch(origin+"/api/admin/users",{data:{id:u.id,name:"QA Updated",email:u.email,active:true,role:"REVIEWER",expectedVersion:u.updatedAt}});assert.equal(r.status(),200);let saved=(await r.json()).user;
 assert.equal((await admin.request.patch(origin+"/api/admin/users",{data:{id:u.id,name:"stale",expectedVersion:u.updatedAt}})).status(),409);
 assert.equal((await admin.request.patch(origin+"/api/admin/users",{data:{id:superUser.id,name:"Protected",expectedVersion:superUser.updatedAt.toISOString()}})).status(),403);
 assert.equal((await admin.request.post(origin+"/api/admin/users/recovery",{headers:{origin:"https://evil.invalid"},data:{id:saved.id,action:"reset"}})).status(),403);
 r=await admin.request.post(origin+"/api/admin/users/recovery",{data:{id:saved.id,action:"reset"}});assert.equal(r.status(),200);assert(!JSON.stringify(await r.json()).includes("token="));
 assert.equal((await admin.request.post(origin+"/api/admin/users/recovery",{data:{id:saved.id,action:"reset"}})).status(),429);
 const decoded=messages.at(-1).replace(/=\r\n/g,"").replace(/=3D/g,"=");
 const token=decoded.match(/token=([a-f0-9]{64})/)?.[1];assert(token,"SMTP reset token captured");
 const userCtx=await browser.newContext();const newPassword=password+"new";
 assert.equal((await anon.request.post(origin+"/api/auth/reset-password",{data:{token,password:newPassword}})).status(),200);
 assert.equal((await anon.request.post(origin+"/api/auth/reset-password",{data:{token,password:newPassword}})).status(),400);
 assert.equal((await userCtx.request.post(origin+"/api/auth/login",{data:{email:saved.email,password:newPassword}})).status(),200);
 const page=await admin.newPage();await page.goto(origin+"/studio?module=Manajemen+Ak un".replace("Ak un","Akun"));await page.getByRole("heading",{name:"Manajemen pengguna",exact:true}).waitFor();
 await page.getByLabel("Cari pengguna",{exact:true}).fill(saved.email);
 const card=page.getByRole("article",{name:saved.email,exact:true});
 await card.getByLabel("Nama",{exact:true}).fill("QA Browser Autosave");
 await card.getByText("Tersimpan otomatis",{exact:true}).waitFor({timeout:15000});await page.reload();await page.getByLabel("Cari pengguna",{exact:true}).fill(saved.email);assert.equal(await page.getByRole("article",{name:saved.email,exact:true}).getByLabel("Nama",{exact:true}).inputValue(),"QA Browser Autosave");
 for(const theme of ["light","dark"]){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);for(const width of [320,375,390,768,1024,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),theme+" overflow "+width);}}
 assert.equal((await admin.request.get(origin+"/admin",{maxRedirects:0})).status(),307);
 assert.equal((await other.request.get(origin+"/admin",{maxRedirects:0})).headers().location,"/studio");
 rejectMail=true;
 assert.equal((await admin.request.post(origin+"/api/admin/users/recovery",{data:{id:editor.id,action:"reset"}})).status(),503);
 assert.equal(await d.studioAuthToken.count({where:{userId:editor.id,purpose:"reset"}}),0);
 rejectMail=false;
 await page.getByLabel("Cari pengguna",{exact:true}).fill(superUser.email);
 page.once("dialog",dialog=>dialog.accept());
 await page.getByRole("article",{name:superUser.email,exact:true}).getByRole("button",{name:"Kirim reset password",exact:true}).click();
 await page.getByText(/Tautan reset password dikirim/).waitFor();
 await page.getByLabel("Cari pengguna",{exact:true}).focus();await page.keyboard.press("Tab");assert.equal(await page.evaluate(()=>document.activeElement?.tagName),"SELECT");
 await page.screenshot({path:require("node:path").join(require("node:os").tmpdir(),"bc-admin-dashboard-qa.png"),fullPage:true});
 r=await admin.request.delete(origin+"/api/admin/users?id="+saved.id);assert.equal(r.status(),200);assert.equal(await d.studioSession.count({where:{userId:saved.id}}),0);assert.equal((await userCtx.request.get(origin+"/api/auth/me")).status(),200);assert.equal((await userCtx.request.get(origin+"/api/auth/me").then(x=>x.json())).authenticated,false);
 const deactivated=(await r.json()).user;r=await admin.request.patch(origin+"/api/admin/users",{data:{id:saved.id,active:true,expectedVersion:deactivated.updatedAt}});assert.equal(r.status(),200);
 console.log("PASS admin CRUD, persistence, conflict, RBAC, protected superadmin, SMTP activation/reset, one-time token, cooldown, origin, session revocation, responsive light/dark 6 widths.");
 }finally{if(browser)await browser.close();if(app)app.kill();smtp.close();if(ids.length)await d.studioUser.deleteMany({where:{id:{in:ids}}});await d.$disconnect();}})().catch(e=>{console.error(e);process.exitCode=1});
