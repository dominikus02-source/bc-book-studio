#!/usr/bin/env node
// Run once by an authorized operator with DATABASE_URL pointing to the
// isolated BC Book Studio database after Prisma migrations are applied.
// Creates an INACTIVE account; email activation is required before login.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const email = "srphysics04@gmail.com";
async function main() {
  const existing = await db.studioUser.findUnique({where:{email}});
  if (existing && existing.role !== "SUPERADMIN") {
    throw new Error("Account already exists with a different role; manual identity verification required");
  }
  if (existing) {
    console.log("Superadmin record already exists; no changes made");
    return;
  }
  await db.studioUser.create({data:{email,name:"Superadmin BC Book Studio",role:"SUPERADMIN",active:false}});
  console.log("Inactive superadmin account provisioned; request activation through the verified email flow");
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
