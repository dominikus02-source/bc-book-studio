// Usage: STUDIO_INVITE_EMAIL=... STUDIO_INVITE_NAME=... STUDIO_INVITE_ROLE=EDITOR node scripts/invite-user.cjs
// Run only by a trusted operator in the isolated BC Book Studio environment.
const {PrismaClient}=require("@prisma/client");
const db=new PrismaClient();
(async()=>{
 const email=(process.env.STUDIO_INVITE_EMAIL||"").trim().toLowerCase();
 const name=(process.env.STUDIO_INVITE_NAME||"").trim();
 const role=process.env.STUDIO_INVITE_ROLE||"EDITOR";
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||!["EDITOR","REVIEWER","ADMIN"].includes(role))throw new Error("Set valid STUDIO_INVITE_EMAIL, STUDIO_INVITE_NAME and STUDIO_INVITE_ROLE");
 const existing=await db.studioUser.findUnique({where:{email}});
 if(existing&&existing.active)throw new Error("Active user already exists; do not silently modify roles");
 const user=await db.studioUser.upsert({where:{email},create:{email,name,role},update:{name,role}});
 console.log("Invited",user.email,"role:",user.role,"— user should request activation at /activate.");
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
