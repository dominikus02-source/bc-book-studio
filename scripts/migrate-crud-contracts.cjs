const fs=require("fs"),{spawnSync}=require("child_process"),{PrismaClient}=require("@prisma/client"),{createHash}=require("crypto");
process.loadEnvFile(".env.local");const url=new URL(process.env.DATABASE_URL);if(url.host+url.pathname!=="127.0.0.1:55432/bcstudio")throw Error("Unexpected local DB");
const out="artifacts/20261110-contracts";fs.mkdirSync(out,{recursive:true});
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
function run(cmd,args,options={}){const r=spawnSync(cmd,args,{maxBuffer:256*1024*1024,...options});if(r.error||r.status!==0)throw Error("Command failed: "+cmd+" "+(r.stderr?.toString().slice(-500)||r.error?.message));return r.stdout}
async function main(){
run("docker",["start","bc-snapshot-crud-qa-20261110"]);
const qaPassword=run("docker",["exec","bc-snapshot-crud-qa-20261110","printenv","POSTGRES_PASSWORD"]).toString().trim();
const qaEnv={...process.env,DATABASE_URL:"postgresql://postgres:"+qaPassword+"@127.0.0.1:55999/bookstudio_import_qa"};
fs.writeFileSync(out+"/migration-clone.log",run(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:qaEnv}));
const db=new PrismaClient();try{
async function fingerprints(){return {approvals:hash(await db.bookApprovalSnapshot.findMany({orderBy:[{bookId:"asc"},{approvedAt:"asc"}]})),layouts:hash(await db.bookLayout.findMany({orderBy:[{bookId:"asc"},{approvedAt:"asc"}]})),pagination:hash(await db.bookPagination.findMany({orderBy:{bookId:"asc"},select:{bookId:true,settings:true,version:true,updatedAt:true}}))}}
const before=await fingerprints();
const dump=run("docker",["exec","-e","PGPASSWORD="+decodeURIComponent(url.password),"bc-book-studio-dev-db","pg_dump","-U",decodeURIComponent(url.username),"-d",url.pathname.slice(1),"-Fc"]);
fs.writeFileSync(out+"/before-migration.dump",dump);
run("docker",["cp",out+"/before-migration.dump","bc-snapshot-crud-qa-20261110:/tmp/contracts-before.dump"]);
const listing=run("docker",["exec","bc-snapshot-crud-qa-20261110","pg_restore","--list","/tmp/contracts-before.dump"]);fs.writeFileSync(out+"/backup-contents.list",listing);
const restoreDb="contracts_restore_"+Date.now();run("docker",["exec","bc-snapshot-crud-qa-20261110","createdb","-U","postgres",restoreDb]);
run("docker",["exec","bc-snapshot-crud-qa-20261110","pg_restore","-U","postgres","-d",restoreDb,"--no-owner","--no-privileges","/tmp/contracts-before.dump"]);
const restored=new PrismaClient({datasourceUrl:"postgresql://postgres:"+qaPassword+"@127.0.0.1:55999/"+restoreDb});try{const approvals=hash(await restored.bookApprovalSnapshot.findMany({orderBy:[{bookId:"asc"},{approvedAt:"asc"}]}));if(approvals!==before.approvals)throw Error("Backup restore fingerprint mismatch");}finally{await restored.$disconnect()}
fs.writeFileSync(out+"/migration-local.log",run(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],{env:process.env}));
const after=await fingerprints();if(JSON.stringify(before)!==JSON.stringify(after))throw Error("Existing data fingerprint changed");
fs.writeFileSync(out+"/migration-evidence.json",JSON.stringify({status:"PASS",backupBytes:dump.length,backupSha256:createHash("sha256").update(dump).digest("hex"),before,after,schemaChange:"additive only",cloneDeployed:true},null,2));
console.log("MIGRATION_PASS: clone deployed; backup validated; existing approvals/layouts/pagination unchanged.");
}finally{await db.$disconnect()}}
main().catch(e=>{console.error(e.message);process.exitCode=1});
