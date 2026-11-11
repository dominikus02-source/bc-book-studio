import {test,expect} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
import {randomBytes,scryptSync} from "node:crypto";
import {mkdir} from "node:fs/promises";

const db=new PrismaClient();
const origin=process.env.TEST_ORIGIN||"http://127.0.0.1:3183";

test("captures light and dark screenshots of key studio pages",async({page,request})=>{
  test.setTimeout(90_000);
  const email="ci-theme-"+randomBytes(6).toString("hex")+"@example.invalid";
  const password="CI-browser-"+randomBytes(12).toString("hex");
  const salt=randomBytes(16).toString("hex");
  const user=await db.studioUser.create({data:{email,name:"CI Theme",role:"EDITOR",active:true,passwordHash:salt+":"+scryptSync(password,salt,64).toString("hex")}});
  const login=await request.post(origin+"/api/auth/login",{data:{email,password}});
  expect(login.ok()).toBeTruthy();
  const cookie=(await request.storageState()).cookies.find(item=>item.name==="bcstudio_session");
  await page.context().addCookies([{name:"bcstudio_session",value:cookie!.value,domain:"127.0.0.1",path:"/",httpOnly:true,sameSite:"Lax",secure:false}]);
  const book=await db.book.create({data:{ownerId:user.id,title:"Buku Tema CI",grade:"9",subject:"Bahasa Indonesia",pageSize:"A5"}});
  await mkdir("test-results/ui-theme",{recursive:true});
  const pages=[
    ["dasbor","/studio?module=Dasbor"],
    ["buat-buku","/studio?module=Buat+Buku"],
    ["pengaturan","/studio?module=Pengaturan&bookId="+book.id],
    ["studio-penulisan","/studio?module=Studio+Penulisan&bookId="+book.id]
  ] as const;
  for(const theme of ["light","dark"] as const){
    await page.addInitScript(value=>{localStorage.setItem("bcstudio-theme",value);document.documentElement.dataset.theme=value;},theme);
    for(const [name,path] of pages){
      await page.goto(origin+path);
      await expect(page.locator(".shell")).toBeVisible();
      await page.screenshot({path:`test-results/ui-theme/${name}-${theme}.png`,fullPage:true});
    }
  }
  await db.book.delete({where:{id:book.id}});
  await db.studioUser.delete({where:{id:user.id}});
});
