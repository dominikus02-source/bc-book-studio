const {PrismaClient}=require('@prisma/client');
const db=new PrismaClient();
(async()=>{
 const a='test-owner-A-'+Date.now(), b='test-owner-B-'+Date.now();
 let id;
 try{
  const book=await db.book.create({data:{ownerId:a,title:'Security CRUD Test',grade:'7',subject:'Bahasa Indonesia'}});
  id=book.id;
  if((await db.book.findMany({where:{ownerId:b}})).some(x=>x.id===id))throw Error('B can list A');
  if(await db.book.findFirst({where:{id,ownerId:b}}))throw Error('B can read A');
  if((await db.book.updateMany({where:{id,ownerId:b},data:{title:'Hijack'}})).count!==0)throw Error('B can edit A');
  if((await db.book.deleteMany({where:{id,ownerId:b}})).count!==0)throw Error('B can delete A');
  if((await db.book.updateMany({where:{id,ownerId:a},data:{title:'Edited'}})).count!==1)throw Error('A cannot edit');
  if((await db.book.deleteMany({where:{id,ownerId:a}})).count!==1)throw Error('A cannot delete');
  id=null;
  console.log('DB_OWNERSHIP_CRUD_A_B_PASS');
 }finally{if(id)await db.book.deleteMany({where:{id,ownerId:a}});await db.$disconnect()}
})().catch(e=>{console.error('DB_OWNERSHIP_CRUD_FAIL',e.message);process.exitCode=1});
