import {test,expect} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
import {randomBytes,scryptSync} from "node:crypto";

const db=new PrismaClient();
const origin=process.env.TEST_ORIGIN||"http://127.0.0.1:3183";

test.afterEach(async()=>{
  const users=await db.studioUser.findMany({where:{email:{startsWith:"ci-pag-"}},select:{id:true}});
  const ids=users.map(user=>user.id);
  if(ids.length){
    await db.book.deleteMany({where:{ownerId:{in:ids}}});
    await db.studioUser.deleteMany({where:{id:{in:ids}}});
  }
});

test("pagination settings live in Tata Letak, not Pengaturan",async({page,request})=>{
  const email="ci-pag-"+randomBytes(6).toString("hex")+"@example.invalid";
  const password="CI-browser-"+randomBytes(12).toString("hex");
  const salt=randomBytes(16).toString("hex");
  const user=await db.studioUser.create({data:{email,name:"CI Pagination",role:"EDITOR",active:true,passwordHash:salt+":"+scryptSync(password,salt,64).toString("hex")}});
  const login=await request.post(origin+"/api/auth/login",{data:{email,password}});
  expect(login.ok()).toBeTruthy();
  const cookie=(await request.storageState()).cookies.find(item=>item.name==="bcstudio_session");
  await page.context().addCookies([{name:"bcstudio_session",value:cookie!.value,domain:"127.0.0.1",path:"/",httpOnly:true,sameSite:"Lax",secure:false}]);
  const book=await db.book.create({data:{ownerId:user.id,title:"Buku Pagination CI",grade:"8",subject:"Bahasa",pageSize:"A5"}});
  await page.goto(origin+"/studio?module=Pengaturan&bookId="+book.id);
  await expect(page.getByRole("region",{name:"Ringkasan Pengaturan dan Observabilitas"})).toBeVisible();
  await expect(page.getByRole("region",{name:"Pengaturan pagination buku"})).toHaveCount(0);
  await expect(page.getByRole("link",{name:"Buka Tata Letak"})).toBeVisible();
  await page.goto(origin+"/studio?module=Tata+Letak&bookId="+book.id);
  const panel=page.getByRole("region",{name:"Pengaturan pagination buku"});
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Riwayat pagination")).toBeVisible();
  await expect(panel.getByText("Pratinjau langsung")).toBeVisible();
});
