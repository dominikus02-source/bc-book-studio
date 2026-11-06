const {test,expect}=require("@playwright/test");
const {PrismaClient}=require("@prisma/client");
const {randomBytes,scryptSync}=require("node:crypto");
test.use({baseURL:process.env.HISTORY_TEST_ORIGIN||"http://127.0.0.1:3197"});
test("Back and Forward preserve the session; explicit logout revokes it",async({page,context})=>{
 const db=new PrismaClient();
 const email="history-"+randomBytes(6).toString("hex")+"@example.test";
 const password="QA-history-"+randomBytes(14).toString("hex");
 const salt=randomBytes(16).toString("hex"),passwordHash=salt+":"+scryptSync(password,salt,64).toString("hex");
 let user;
 try{
  user=await db.studioUser.create({data:{email,passwordHash,name:"History regression QA",active:true,role:"EDITOR"}});
  let logouts=0;page.on("request",request=>{if(request.url().endsWith("/api/auth/logout"))logouts++});
  await page.goto("/");await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Masuk ke Studio"}).click();await page.waitForURL("**/studio");
  await expect(page.getByRole("heading",{name:"Selamat datang di ruang penerbitan"})).toBeVisible();
  const initialCookie=(await context.cookies()).find(c=>c.name==="bcstudio_session");
  expect(initialCookie).toBeTruthy();
  const menu=page.getByRole("navigation",{name:"Menu studio"});
  await menu.getByRole("button",{name:"Idea Lab",exact:true}).click();await expect(page).toHaveURL(/view=idea-lab/);
  await menu.getByRole("button",{name:"Pengaturan",exact:true}).click();await expect(page).toHaveURL(/view=pengaturan/);
  await page.goBack();await expect(page.getByRole("heading",{name:"Idea Lab",exact:true})).toBeVisible();
  await page.goForward();await expect(page.getByRole("heading",{name:"Pengaturan",exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole("heading",{name:"Pengaturan",exact:true})).toBeVisible();
  expect((await (await page.request.get("/api/auth/me")).json()).authenticated).toBe(true);
  expect((await context.cookies()).find(c=>c.name==="bcstudio_session").value).toBe(initialCookie.value);
  expect(logouts).toBe(0);
  // An authenticated user opening login must stay signed in.
  await page.goto("/login");await page.waitForURL("**/studio");
  await expect(page.getByRole("heading",{name:"Selamat datang di ruang penerbitan"})).toBeVisible();
  await page.getByRole("button",{name:"Keluar",exact:true}).click();await page.waitForURL("**/login");
  expect(logouts).toBe(1);
  expect((await (await page.request.get("/api/auth/me")).json()).authenticated).toBe(false);
  expect((await page.request.get("/api/books")).status()).toBe(401);
  // Replaying the old cookie cannot restore a revoked session.
  const replay=await context.request.get("/api/auth/me",{headers:{cookie:"bcstudio_session="+initialCookie.value}});
  expect((await replay.json()).authenticated).toBe(false);
  await page.goBack();await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button",{name:"Masuk ke Studio"})).toBeVisible();
  await expect(page.getByRole("navigation",{name:"Menu studio"})).toHaveCount(0);
 }finally{if(user)await db.studioUser.delete({where:{id:user.id}});await db.$disconnect();}
});
