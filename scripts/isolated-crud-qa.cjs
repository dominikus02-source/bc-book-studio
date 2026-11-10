const fs=require("fs"),{spawn,spawnSync}=require("child_process"),{randomBytes}=require("crypto"),path=require("path");
const root=path.resolve(__dirname,"..");process.chdir(root);
const out="artifacts/20261110-snapshot";fs.mkdirSync(out,{recursive:true});
function run(cmd,args,env=process.env){const r=spawnSync(cmd,args,{env,encoding:"utf8",windowsHide:true});if(r.error)throw r.error;return r}
async function main(){
const container="bc-snapshot-crud-qa-20261110";
let password=randomBytes(24).toString("hex");
const existing=run("docker",["inspect",container]);
if(existing.status===0){run("docker",["start",container]);password=run("docker",["exec",container,"printenv","POSTGRES_PASSWORD"]).stdout.trim();}
const created=existing.status===0?{status:0}:run("docker",["run","--name",container,"-d","-p","127.0.0.1:55999:5432","-e","POSTGRES_PASSWORD="+password,"-e","POSTGRES_DB=bookstudio_import_qa","postgres:16"]);
if(created.status!==0)throw Error("Isolated DB creation failed: "+created.stderr);
const env={...process.env,DATABASE_URL:"postgresql://postgres:"+password+"@127.0.0.1:55999/bookstudio_import_qa",QA_ORIGIN:"http://127.0.0.1:32979",QA_BROWSER_CHANNEL:"msedge",NODE_OPTIONS:"--require ./scripts/qa-edge-preload.cjs",BC_QA_NEXT_DIST_DIR:".next-crud-snapshot-qa"};
let ready=false;for(let i=0;i<30;i++){if(run("docker",["exec",container,"pg_isready","-U","postgres"]).status===0){ready=true;break}await new Promise(r=>setTimeout(r,500))}if(!ready)throw Error("DB not ready");
const migrate=run(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy"],env);fs.writeFileSync(out+"/migration.log",migrate.stdout+migrate.stderr);console.log("MIGRATE_EXIT",migrate.status);if(migrate.status!==0)throw Error("Migration failed; see migration.log");
const log=fs.openSync(out+"/crud-server.log","w");const server=spawn(process.execPath,["node_modules/next/dist/bin/next","dev","-p","32979"],{env,stdio:["ignore",log,log],windowsHide:true});
try{
for(let i=0;i<80;i++){try{await fetch("http://127.0.0.1:32979/api/books");ready=true;break}catch{}await new Promise(r=>setTimeout(r,500))}
const files=["stage1-crud-e2e.cjs","stage2-hierarchy-e2e.cjs","stage2-chapter-history-e2e.cjs","stage3-asset-crud-e2e.cjs","stage3-block-crud-e2e.cjs","reviewer-contract-regression.cjs","publishing-package-stage4-e2e.cjs","book-pagination-output.test.cjs"];
const results=[];
for(const file of files){console.log("RUN",file);const r=await new Promise(resolve=>{const c=spawn(process.execPath,["tests/"+file],{env,windowsHide:true});let text="";c.stdout.on("data",b=>text+=b);c.stderr.on("data",b=>text+=b);const timer=setTimeout(()=>c.kill(),180000);c.on("close",code=>{clearTimeout(timer);resolve({code,text})})});fs.writeFileSync(out+"/"+file+".log",r.text);results.push({test:file,exitCode:r.code,status:r.code===0?"PASS":"FAIL"});fs.writeFileSync(out+"/crud-results.json",JSON.stringify(results,null,2));console.log(file,r.code===0?"PASS":"FAIL");}
if(results.some(r=>r.status!=="PASS"))process.exitCode=1;
}finally{server.kill();fs.closeSync(log);run("docker",["stop",container]);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
