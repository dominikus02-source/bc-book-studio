const assert=require("assert/strict"),{PrismaClient}=require("@prisma/client"),{createHash,randomBytes}=require("crypto"),fs=require("fs");process.loadEnvFile(".env.local");const db=new PrismaClient(),base="http://127.0.0.1:3000";let th,bookId;
(async()=>{const fixture=JSON.parse(fs.readFileSync("artifacts/20261110-snapshot/fixture.json","utf8")),token=randomBytes(32).toString("hex");th=createHash("sha256").update(token).digest("hex");await db.studioSession.create({data:{userId:fixture.ownerId,tokenHash:th,expiresAt:new Date(Date.now()+600000)}});const headers={cookie:"bcstudio_session="+token,"content-type":"application/json"};
async function api(path,body,method="POST",expected=200){const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined}),o=await r.json();assert.equal(r.status,expected,JSON.stringify(o));return o;}
const created=await api("/api/books",{title:"[DUMMY] Archive tail regression",grade:"10",subject:"Physics"}, "POST",201);bookId=created.book.id;const p="/api/books/"+bookId;
await api(p+"/chapters",{title:"Keep active",content:"DUMMY active content for archive test."},"POST",201);
const tail=(await api(p+"/chapters",{title:"Archive last",content:"DUMMY tail content for archive test."},"POST",201)).chapter;
await api(p+"/chapters/"+tail.id,{expectedVersion:tail.updatedAt},"DELETE");
const next=(await api(p+"/chapters",{title:"Create after archive",content:"DUMMY new content after last was archived."},"POST",201)).chapter;
const archived=await db.chapter.findUniqueOrThrow({where:{id:tail.id}});assert.ok(archived.archivedAt);assert.equal(archived.content,tail.content);assert.notEqual(next.position,archived.position);
const restored=(await api(p+"/chapters/"+tail.id,{restoreArchived:true,expectedVersion:archived.updatedAt.toISOString()},"PATCH")).chapter;assert.equal(restored.content,tail.content);assert.equal(restored.archivedAt,null);assert.notEqual(restored.position,next.position);
console.log("ARCHIVED_TAIL_CREATE_PASS: archive content preserved, new chapter persisted, old chapter restored without position conflict.");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(bookId)await db.book.update({where:{id:bookId},data:{archivedAt:new Date()}});if(th)await db.studioSession.deleteMany({where:{tokenHash:th}});await db.$disconnect()});
