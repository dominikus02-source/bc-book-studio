const fs=require("fs"),path=require("path"),ts=require("typescript");
require.extensions[".ts"]=function(mod,filename){const src=fs.readFileSync(filename,"utf8");const result=ts.transpileModule(src,{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,moduleResolution:ts.ModuleResolutionKind.Node10,jsx:ts.JsxEmit.ReactJSX}});mod._compile(result.outputText,filename)};
const base=path.resolve(__dirname,"..");
if(!process.env.NODE_ENV)process.env.NODE_ENV="development";
if(process.env.NODE_ENV!=="production"&&!process.env.DATABASE_URL&&fs.existsSync(path.join(base,".env.local")))process.loadEnvFile(path.join(base,".env.local"));
const {db}=require(path.join(base,"lib","db.ts"));
const {runExportJobBatch,expireOldExportArtifacts}=require(path.join(base,"lib","export-job-runner.ts"));
let stopping=false;
process.on("SIGINT",()=>{stopping=true});process.on("SIGTERM",()=>{stopping=true});
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function main(){
 if(process.env.NODE_ENV==="production"){
  if(!process.env.EXPORT_ARTIFACT_DIR||!process.env.QUARTO_WORKER_URL)throw Error("Production worker needs persistent EXPORT_ARTIFACT_DIR and isolated QUARTO_WORKER_URL");
 }
 let total=0,lastCleanup=0;
 do{
  if(Date.now()-lastCleanup>3600000){await expireOldExportArtifacts();lastCleanup=Date.now()}
  const completed=await runExportJobBatch(process.argv.includes("--once")?1:5);
  total+=completed;
  if(process.argv.includes("--once"))break;
  if(!completed)await delay(3000);
 }while(!stopping);
 console.log("Export worker exit, processed",total,"job(s)");
}
main().catch(e=>{console.error("Export worker fatal",e instanceof Error?e.message:e);process.exitCode=1}).finally(async()=>{await db.$disconnect()});
