"use strict";
const fs=require("node:fs"),path=require("node:path");
const dirs=["app","components","lib","publishing"];
const extensions=new Set([".tsx",".ts",".jsx",".js",".css",".html"]);
const suspicious=/[\u00c2\u00c3\u00e2\ufffd]/g;
let problems=0,scanned=0;
function visit(dir){
 if(!fs.existsSync(dir))return;
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if([".next","node_modules",".git","artifacts","public"].includes(entry.name))continue;
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){visit(file);continue;}
  if(!extensions.has(path.extname(file)))continue;
  scanned++;
  const source=fs.readFileSync(file,"utf8");
  for(const match of source.matchAll(suspicious)){
   problems++;
   const line=source.slice(0,match.index).split("\n").length;
   console.error("ENCODING_FAIL "+file+":"+line+" "+JSON.stringify(source.slice(match.index,match.index+25).replace(/\s+/g," ")));
  }
 }
}
dirs.forEach(visit);
console.log("ENCODING_AUDIT",JSON.stringify({scanned,problems}));
if(problems)process.exitCode=1;
