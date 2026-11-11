import {test,expect,type Page} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
import {randomBytes,scryptSync} from "node:crypto";

const db=new PrismaClient();
const origin=process.env.TEST_ORIGIN||"http://127.0.0.1:3183";

async function signIn(page:Page,role:"EDITOR"|"ADMIN"){
  const email=`ci-ai-${role.toLowerCase()}-${randomBytes(5).toString("hex")}@example.invalid`;
  const password="CI-browser-"+randomBytes(12).toString("hex");
  const salt=randomBytes(16).toString("hex");
  await db.studioUser.create({data:{email,name:"CI "+role,role,active:true,passwordHash:salt+":"+scryptSync(password,salt,64).toString("hex")}});
  const login=await page.request.post(origin+"/api/auth/login",{data:{email,password}});
  expect(login.ok()).toBeTruthy();
  const session=(login.headers()["set-cookie"]||"").match(/bcstudio_session=([^;]+)/)?.[1];
  expect(session).toBeTruthy();
  await page.context().addCookies([{name:"bcstudio_session",value:session!,domain:"127.0.0.1",path:"/",httpOnly:true,sameSite:"Lax",secure:false}]);
  return email;
}

test.afterEach(async()=>{
  await db.studioUser.deleteMany({where:{email:{startsWith:"ci-ai-"}}});
});

test("editor sees the active model name without opening the prompt panel and never sees a key",async({page})=>{
  const email=await signIn(page,"EDITOR");
  await page.route("**/api/books",route=>route.fulfill({json:{books:[]}}));
  await page.route("**/api/studio/ai-form",route=>{
    if(route.request().method()!=="GET")return route.fallback();
    return route.fulfill({json:{configured:true,provider:{provider:"deepseek",label:"DeepSeek Flash",model:"deepseek-flash"},mode:"active-provider"}});
  });
  await page.goto(origin+"/studio?module=Buat+Buku");
  const status=page.locator("[data-ai-model-status]").first();
  await expect(status).toContainText("DeepSeek Flash · deepseek-flash");
  await expect(status).not.toContainText("Belum dikonfigurasi");
  await expect(page.getByRole("button",{name:/Isi formulir dengan AI aktif/}).first()).toBeEnabled();
  const body=await page.locator("body").innerText();
  expect(body).not.toMatch(/sk-|encryptedKey|apiKey\s*[:=]/i);
  await db.studioUser.deleteMany({where:{email}});
});

test("a delayed status response shows a loading label instead of unconfigured",async({page})=>{
  await signIn(page,"EDITOR");
  await page.route("**/api/books",route=>route.fulfill({json:{books:[]}}));
  let release:()=>void=()=>{};
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route("**/api/studio/ai-form",async route=>{
    if(route.request().method()!=="GET")return route.fallback();
    await gate;
    return route.fulfill({json:{configured:true,provider:{provider:"deepseek",label:"DeepSeek Flash",model:"deepseek-flash"}}});
  });
  await page.route("**/api/studio/status",async route=>{
    await gate;
    return route.fulfill({json:{database:"connected",ai:{configured:true,label:"DeepSeek Flash",model:"deepseek-flash",provider:"deepseek"}}});
  });
  const pending=page.goto(origin+"/studio?module=Buat+Buku");
  await expect(page.locator("[data-ai-model-status]").first()).toContainText("Memuat model aktif");
  await expect(page.locator("[data-ai-model-status]").first()).not.toContainText("Belum dikonfigurasi");
  release();
  await pending;
  await expect(page.locator("[data-ai-model-status]").first()).toContainText("DeepSeek Flash · deepseek-flash");
});

test("falls back to studio status when the ai-form GET is forbidden",async({page})=>{
  await signIn(page,"EDITOR");
  await page.route("**/api/books",route=>route.fulfill({json:{books:[]}}));
  await page.route("**/api/studio/ai-form",route=>{
    if(route.request().method()!=="GET")return route.fallback();
    return route.fulfill({status:403,json:{error:"Forbidden"}});
  });
  await page.route("**/api/studio/status",route=>route.fulfill({json:{database:"connected",ai:{configured:true,label:"DeepSeek Flash",model:"deepseek-flash",provider:"deepseek"}}}));
  await page.goto(origin+"/studio?module=Buat+Buku");
  await expect(page.locator("[data-ai-model-status]").first()).toContainText("DeepSeek Flash · deepseek-flash");
});
