import {test,expect} from "@playwright/test";
import {PrismaClient} from "@prisma/client";
import {randomBytes,scryptSync} from "node:crypto";

const db=new PrismaClient();
const origin=process.env.TEST_ORIGIN||"http://127.0.0.1:3183";

async function signIn(request:import("@playwright/test").APIRequestContext){
  const email="ci-print-"+randomBytes(6).toString("hex")+"@example.invalid";
  const password="CI-browser-"+randomBytes(12).toString("hex");
  const salt=randomBytes(16).toString("hex");
  const user=await db.studioUser.create({data:{email,name:"CI Print",role:"EDITOR",active:true,passwordHash:salt+":"+scryptSync(password,salt,64).toString("hex")}});
  const login=await request.post(origin+"/api/auth/login",{data:{email,password}});
  expect(login.ok()).toBeTruthy();
  return {user,email};
}

test.afterEach(async()=>{
  const users=await db.studioUser.findMany({where:{email:{startsWith:"ci-print-"}},select:{id:true}});
  const ids=users.map(user=>user.id);
  if(ids.length){
    await db.printOrder.deleteMany({where:{ownerId:{in:ids}}});
    await db.book.deleteMany({where:{ownerId:{in:ids}}});
    await db.studioUser.deleteMany({where:{id:{in:ids}}});
  }
});

test("printing orders persist through PrintOrder create, update, list, and archive",async({request})=>{
  const {user}=await signIn(request);
  const book=await db.book.create({data:{ownerId:user.id,title:"Buku Cetak CI",grade:"10",subject:"Matematika",pageSize:"A5",author:"Penulis CI"}});
  const created=await request.post(origin+"/api/printing",{data:{
    bookId:book.id,printerName:"Percetakan Melati",contact:"melati@example.invalid",
    quantity:250,paper:"HVS 80 gsm",binding:"Perfect binding",color:"BW",size:"A5",
    unitPrice:18500,dueDate:"2026-12-01",notes:"Proof warna sebelum cetak masal",status:"DRAFT"
  }});
  expect(created.status()).toBe(201);
  const {order}=await created.json();
  expect(order.id).toBeTruthy();
  expect(order.title).toBe("Buku Cetak CI");
  expect(order.unitPrice).toBe(18500);
  const row=await db.printOrder.findUniqueOrThrow({where:{id:order.id}});
  expect(row.ownerId).toBe(user.id);
  expect(row.bookId).toBe(book.id);
  expect(row.quantity).toBe(250);

  const listed=await request.get(origin+"/api/printing?bookId="+book.id);
  expect(listed.ok()).toBeTruthy();
  const body=await listed.json();
  expect(body.orders.some((item:{id:string})=>item.id===order.id)).toBeTruthy();
  expect(body.books.some((item:{id:string})=>item.id===book.id)).toBeTruthy();

  const patched=await request.patch(origin+"/api/printing",{data:{
    id:order.id,expectedUpdatedAt:order.updatedAt,status:"QUOTED",quantity:300
  }});
  expect(patched.ok()).toBeTruthy();
  const updated=(await patched.json()).order;
  expect(updated.status).toBe("QUOTED");
  expect(updated.quantity).toBe(300);
  expect((await db.printOrder.findUniqueOrThrow({where:{id:order.id}})).quantity).toBe(300);

  const stale=await request.patch(origin+"/api/printing",{data:{
    id:order.id,expectedUpdatedAt:order.updatedAt,notes:"seharusnya konflik"
  }});
  expect(stale.status()).toBe(409);

  const archived=await request.delete(origin+"/api/printing?id="+order.id+"&expectedUpdatedAt="+encodeURIComponent(updated.updatedAt));
  expect(archived.ok()).toBeTruthy();
  const after=await db.printOrder.findUniqueOrThrow({where:{id:order.id}});
  expect(after.archivedAt).not.toBeNull();
  const hidden=await request.get(origin+"/api/printing");
  expect((await hidden.json()).orders.some((item:{id:string})=>item.id===order.id)).toBeFalsy();
});

test("printing workspace can create and edit an order from the form",async({page,request})=>{
  const {user}=await signIn(request);
  const book=await db.book.create({data:{ownerId:user.id,title:"Buku UI Percetakan",grade:"7",subject:"IPA",pageSize:"A5",author:"Penulis UI"}});
  const cookie=(await request.storageState()).cookies.find(item=>item.name==="bcstudio_session");
  expect(cookie?.value).toBeTruthy();
  await page.context().addCookies([{name:"bcstudio_session",value:cookie!.value,domain:"127.0.0.1",path:"/",httpOnly:true,sameSite:"Lax",secure:false}]);
  await page.goto(origin+"/studio?module=Percetakan&bookId="+book.id);
  await expect(page.getByRole("heading",{name:"Percetakan"})).toBeVisible();
  await page.getByLabel("Nama percetakan").fill("CV Cetak UI");
  await page.getByLabel("Kontak vendor").fill("ui@example.invalid");
  await page.getByLabel("Jumlah eksemplar").fill("80");
  await page.getByLabel("Harga per eksemplar (Rp)").fill("12000");
  await page.getByRole("button",{name:"Simpan pesanan"}).click();
  await expect(page.getByText("Pesanan tersimpan di database.")).toBeVisible();
  const stored=await db.printOrder.findFirstOrThrow({where:{ownerId:user.id,bookId:book.id,archivedAt:null}});
  expect(stored.printerName).toBe("CV Cetak UI");
  expect(stored.quantity).toBe(80);
  expect(stored.unitPrice).toBe(12000);
  await page.getByRole("button",{name:"Ubah"}).click();
  await page.getByLabel("Jumlah eksemplar").fill("90");
  await page.getByRole("button",{name:"Simpan perubahan"}).click();
  await expect(page.getByText("Pesanan tersimpan di database.")).toBeVisible();
  expect((await db.printOrder.findUniqueOrThrow({where:{id:stored.id}})).quantity).toBe(90);
});
