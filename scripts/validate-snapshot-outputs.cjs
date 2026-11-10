const fs=require("fs"),path=require("path"),ts=require("typescript");
process.loadEnvFile(".env.local");
require.extensions[".ts"]=function(mod,file){mod._compile(ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file)};
const {epubcheck,fontPreflight,validatePdfGeometry}=require("../lib/quality-preflight.ts");
(async()=>{const dir="artifacts/20261110-snapshot";const results={EPUBCheck:await epubcheck(fs.readFileSync(dir+"/DUMMY-complete.epub")),fonts:await fontPreflight(fs.readFileSync(dir+"/DUMMY-complete.pdf")),geometry:await validatePdfGeometry(fs.readFileSync(dir+"/DUMMY-complete.pdf"),"a4")};fs.writeFileSync(dir+"/validators.json",JSON.stringify(results,null,2));console.log(JSON.stringify(results));})().catch(e=>{console.error(e.message);process.exitCode=1});
