import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
const db=new PrismaClient();
let activeUser:string|null=null;
test.beforeEach(async({page},info)=>{
 if(info.title==="unauthenticated and forged headers fail closed")return;
 const email="ci-browser-"+randomBytes(6).toString("hex")+"@example.invalid";
 const password="CI-browser-"+randomBytes(12).toString("hex");
 const salt=randomBytes(16).toString("hex");
 await db.studioUser.create({data:{email,name:"CI Browser",role:"ADMIN",active:true,passwordHash:salt+":"+scryptSync(password,salt,64).toString("hex")}});
 activeUser=email;
 const login=await page.request.post((process.env.TEST_ORIGIN||"http://127.0.0.1:3183")+"/api/auth/login",{data:{email,password}});
 expect(login.ok()).toBeTruthy();
 const session=(login.headers()["set-cookie"]||"").match(/bcstudio_session=([^;]+)/)?.[1];
 expect(session).toBeTruthy();
 await page.context().addCookies([{name:"bcstudio_session",value:session!,domain:"127.0.0.1",path:"/",httpOnly:true,sameSite:"Lax",secure:false}]);
});
test.afterEach(async()=>{if(activeUser){await db.studioUser.deleteMany({where:{email:activeUser}});activeUser=null;}});

test("dashboard creates a project through the live API and restores it on reload",async({page})=>{
 const origin=process.env.TEST_ORIGIN||"http://127.0.0.1:3183";
 const title="Buku Integrasi "+randomBytes(5).toString("hex");
 await page.goto(origin+"/studio");
 await expect(page.getByRole("heading",{name:"Lanjutkan naskah"})).toBeVisible();
 await page.getByRole("button",{name:"Buat Buku Baru",exact:true}).click();
 const form=page.getByRole("form",{name:"Formulir proyek buku baru"});
 await form.getByLabel(/Judul buku/).fill(title);
 await form.getByLabel(/Kategori \/ mata pelajaran/).fill("Fisika");
 const saved=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/books"&&r.request().method()==="POST"&&r.status()===201);
 await form.getByRole("button",{name:/Simpan buku/}).click();
 const {book}=await (await saved).json();
 try{
  expect((await db.book.findUniqueOrThrow({where:{id:book.id}})).title).toBe(title);
  await page.reload();
  const response=await page.request.get(origin+"/api/books");
  expect(response.ok()).toBeTruthy();
  expect((await response.json()).books.some((item:{id:string;title:string})=>item.id===book.id&&item.title===title)).toBeTruthy();
 }finally{await page.close();await db.book.delete({where:{id:book.id}});}
});
test("unauthenticated and forged headers fail closed",async({request})=>{
for(const headers of ([{},{"cf-access-authenticated-user-email":"fake@example.com"},{"cf-access-jwt-assertion":"fake.jwt.token"}] as Record<string,string>[])){
const r=await request.get((process.env.TEST_ORIGIN||"http://127.0.0.1:3183")+"/api/books",{headers});expect(r.status()).toBe(401);
}
});
test("mobile navigation and overflow",async({page})=>{
await page.setViewportSize({width:390,height:844});
await page.route("**/api/books",r=>r.fulfill({json:{books:[]}}));
await page.goto((process.env.TEST_ORIGIN||"http://127.0.0.1:3183")+"/studio");
await page.getByRole("button",{name:"Buka menu"}).click();
await page.getByRole("button",{name:"Pengaturan",exact:true}).click();
await expect(page.getByRole("region",{name:"Ringkasan Pengaturan dan Observabilitas"})).toBeVisible();
expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
await page.screenshot({path:"test-results/dashboard-mobile.png",fullPage:true});
});

test("admin provider settings create edit rotate and delete",async({page})=>{
 let providers:any[]=[];
 await page.route("**/api/books",route=>route.fulfill({json:{books:[]}}));
 await page.route("**/api/studio/status",route=>route.fulfill({json:{database:"connected",ai:{configured:false,model:null}}}));
 await page.route("**/api/settings/providers**",route=>{
  const method=route.request().method(),body=route.request().postDataJSON();
  if(method==="POST")providers=[{id:"provider-1",...body,lastFour:body.apiKey.slice(-4)}];
  if(method==="PATCH")providers=[{...providers[0],...body,lastFour:body.apiKey?body.apiKey.slice(-4):providers[0].lastFour}];
  if(method==="DELETE")providers=[];
  const safe=providers.map(({apiKey,...item})=>item);
  return route.fulfill({json:method==="GET"?{providers:safe,encryptionReady:true}:{provider:safe[0],deleted:true}});
 });
 await page.goto((process.env.TEST_ORIGIN||"http://127.0.0.1:3183")+"/studio");
 await page.getByRole("button",{name:"Pengaturan",exact:true}).click();
 await page.getByLabel("Nama konfigurasi").fill("Penulis utama");
 await page.getByLabel("ID model").fill("test-model");
 await page.getByLabel("API key provider").fill("fixture-private-secret-1234567890");
 await page.getByLabel("Jadikan konfigurasi ini sebagai model aktif").check();
 await page.getByRole("button",{name:"Simpan provider",exact:true}).click();
 await expect(page.getByRole("status").filter({hasText:"Konfigurasi provider tersimpan"})).toBeVisible();
 await expect(page.getByLabel("API key provider")).toHaveValue("");
 await expect(page.locator(".provider-row").filter({hasText:"Penulis utama"}).getByText(/7890/)).toBeVisible();
 await page.getByRole("button",{name:"Ubah Penulis utama",exact:true}).click();
 await page.getByLabel("API key provider").fill("fixture-rotated-secret-9876543210");
 await page.getByRole("button",{name:"Simpan provider",exact:true}).click();
 await expect(page.locator(".provider-row").filter({hasText:"Penulis utama"}).getByText(/3210/)).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:"test-results/provider-settings-mobile.png",fullPage:true});
 page.once("dialog",d=>d.accept());
 await page.getByRole("button",{name:"Hapus Penulis utama",exact:true}).click();
 await expect(page.getByRole("status").filter({hasText:"API key dihapus"})).toBeVisible();
 await expect(page.getByText("Belum ada API key.",{exact:false})).toBeVisible();
});
