import { test, expect } from "@playwright/test";
test("dashboard, brief, CRUD, agents and editor survive navigation",async({page})=>{
let books:any[]=[];
await page.route("**/api/books**",async route=>{
const req=route.request(),url=new URL(req.url()),body=req.postDataJSON();
if(url.pathname==="/api/books"&&req.method()==="POST"){books.push({id:"book-1",...body,status:"DRAFT",chapters:[],reviews:[]});return route.fulfill({json:{book:books[0]}})}
if(url.pathname.endsWith("/chapters")){books[0].chapters.push({id:"chapter-1",...body});return route.fulfill({json:{chapter:books[0].chapters[0]}})}
if(req.method()==="PATCH"){Object.assign(books[0],body);return route.fulfill({json:{book:books[0]}})}
if(req.method()==="DELETE"){books=[];return route.fulfill({json:{deleted:true}})}
return route.fulfill({json:{books}});
});
await page.goto("http://127.0.0.1:3183");
await expect(page.getByRole("heading",{name:"Selamat datang di ruang penerbitan"})).toBeVisible();
await page.getByRole("button",{name:"Buat Buku",exact:true}).click();
await page.getByLabel("Judul sementara").fill("Buku Integrasi Bahasa Indonesia");
await page.getByLabel("Apa tujuan utama buku ini?").fill("Membantu siswa memahami struktur teks dan menulis dengan jelas.");
await page.getByLabel("Masalah apa yang ingin diselesaikan?").fill("Siswa membutuhkan latihan memahami teks.");
await page.getByLabel("Topik dan ruang lingkup").fill("Teks deskripsi dan narasi");
await page.getByRole("button",{name:"Susun prompt induk"}).click();
await page.getByRole("button",{name:"Simpan proyek buku"}).click();
await page.getByRole("button",{name:/Buku Integrasi Bahasa Indonesia/}).click();
await page.getByLabel("Judul buku",{exact:true}).fill("Buku Integrasi Revisi");
await page.getByRole("button",{name:"Simpan perubahan"}).click();
await expect(page.getByRole("status")).toContainText("Perubahan tersimpan");
await page.getByRole("button",{name:"Studio Penulisan",exact:true}).click();
await page.getByLabel("Judul bab",{exact:true}).fill("Bab pertama");
await page.getByLabel("Isi bab",{exact:true}).fill("Ini adalah isi bab pengujian integrasi dashboard yang harus tersimpan.");
await page.getByRole("button",{name:"Pusat Agen",exact:true}).click();
await expect(page.locator(".agent-directory .agent-card")).toHaveCount(11);
await page.getByRole("button",{name:"Studio Penulisan",exact:true}).click();
await expect(page.getByRole("textbox",{name:"Isi bab",exact:true})).toHaveValue(/isi bab pengujian/);
await page.getByRole("button",{name:"Simpan bab",exact:true}).click();
await expect(page.getByRole("status")).toContainText("Bab tersimpan");
await page.getByRole("button",{name:"Proyek Buku",exact:true}).click();
page.once("dialog",d=>d.accept());
await page.getByRole("button",{name:"Hapus draf",exact:true}).click();
await expect(page.getByRole("status")).toContainText("Buku dihapus");
});
test("unauthenticated and forged headers fail closed",async({request})=>{
for(const headers of ([{},{"cf-access-authenticated-user-email":"fake@example.com"},{"cf-access-jwt-assertion":"fake.jwt.token"}] as Record<string,string>[])){
const r=await request.get("http://127.0.0.1:3183/api/books",{headers});expect(r.status()).toBe(401);
}
});
test("mobile navigation and overflow",async({page})=>{
await page.setViewportSize({width:390,height:844});
await page.route("**/api/books",r=>r.fulfill({json:{books:[]}}));
await page.goto("http://127.0.0.1:3183");
await page.getByRole("button",{name:"Buka menu"}).click();
await page.getByRole("button",{name:"Pusat Agen",exact:true}).click();
await expect(page.getByRole("heading",{name:"Arsitektur multi-agen hibrida"})).toBeVisible();
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
  return route.fulfill({json:method==="GET"?{providers:safe,canManage:true,encryptionReady:true}:{provider:safe[0],deleted:true}});
 });
 await page.route("**/api/usage",route=>route.fulfill({json:{limit:50000,used:0,remaining:50000,inputTokens:0,outputTokens:0,requests:0,estimatedEvents:0,byProvider:[]}}));
 await page.goto("http://127.0.0.1:3183");
 await page.getByRole("button",{name:"Pengaturan",exact:true}).click();
 await page.getByLabel("Nama konfigurasi").fill("Penulis utama");
 await page.getByLabel("ID model").fill("test-model");
 await page.getByLabel("API key").fill("fixture-private-secret-1234567890");
 await page.getByLabel("Tersedia bagi editor untuk dipilih").check();
 await page.getByRole("button",{name:"Simpan API key",exact:true}).click();
 await expect(page.getByRole("status")).toContainText("Konfigurasi model tersimpan");
 await expect(page.getByLabel("API key")).toHaveValue("");
 await expect(page.getByText("••••7890")).toBeVisible();
 await page.getByRole("button",{name:"Ubah Penulis utama",exact:true}).click();
 await page.getByLabel("API key").fill("fixture-rotated-secret-9876543210");
 await page.getByRole("button",{name:"Simpan perubahan",exact:true}).click();
 await expect(page.getByText("••••3210")).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:"test-results/provider-settings-mobile.png",fullPage:true});
 page.once("dialog",d=>d.accept());
 await page.getByRole("button",{name:"Hapus Penulis utama",exact:true}).click();
 await expect(page.getByRole("status")).toContainText("Konfigurasi provider dihapus");
 await expect(page.getByText("Belum ada konfigurasi provider.",{exact:false})).toBeVisible();
});
