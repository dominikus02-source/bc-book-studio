const assert=require("node:assert/strict");
const test=require("node:test");
const fs=require("node:fs");
const path=require("node:path");

function stageFor(name){
  const n=name.toLowerCase();
  if(/metadata provider|api key|pengaturan provider/.test(n))return "PENGATURAN";
  if(/catatan penyuntingan|penyuntingan naskah/.test(n))return "EDITORIAL";
  if(/checklist editorial|keputusan editorial|reviewer|peninjau/.test(n))return "EDITORIAL";
  if(/percetakan|spesifikasi cetak|print order/.test(n))return "PERCETAKAN";
  if(/penerbitan|paket penerbitan|hak cipta|isbn|metadata terbit/.test(n))return "PENERBITAN";
  if(/tata letak|layout/.test(n))return "TATA LETAK";
  if(/naskah|stage 3|penulisan/.test(n))return "PENULISAN";
  if(/kerangka|stage 2|subbagian|rancang/.test(n))return "RANCANG";
  if(/visual|ilustrasi|gambar/.test(n))return "VISUAL";
  if(/kurikulum/.test(n))return "KURIKULUM";
  if(/latihan|lkpd|\blks\b/.test(n))return "LATIHAN";
  if(/agen/.test(n))return "AGEN";
  return "IDE";
}
function isSensitive(name){return /provider|api key|checklist editorial|keputusan editorial|penugasan reviewer|reviewer/i.test(name)}

test("coverage table stays aligned with stage routing rules",()=>{
  const src=fs.readFileSync(path.join(process.cwd(),"lib/stage-ai-coverage.ts"),"utf8");
  const router=fs.readFileSync(path.join(process.cwd(),"lib/stage-agent-context.ts"),"utf8");
  const rows=[...src.matchAll(/module:"([^"]+)",formName:"([^"]+)",stage:"([^"]+)",agentId:"([^"]+)",generate:"([^"]+)"/g)];
  assert.ok(rows.length>=16, "coverage rows");
  assert.match(router,/percetakan\|spesifikasi cetak/);
  assert.match(router,/catatan penyuntingan\|penyuntingan naskah/);
  for(const [,moduleName,formName,stage,agentId,generate] of rows){
    assert.equal(stageFor(formName),stage,formName);
    if(generate==="sensitive-human")assert.equal(isSensitive(formName),true,formName);
    else if(generate==="form")assert.equal(isSensitive(formName),false,formName);
    assert.ok(moduleName&&agentId);
  }
  const required=["Buat Buku","Idea Lab","Proyek Buku","Rancang","Kurikulum","Studio Penulisan","Studio Latihan","Studio Visual","Penyuntingan","Review Naskah","Tata Letak","Penerbitan","Percetakan","ISBN & Legalitas"];
  for(const moduleName of required){
    const found=rows.filter(row=>row[1]===moduleName);
    assert.ok(found.length>0,moduleName+" missing");
    assert.ok(found.some(row=>["form","reviewer","isbn"].includes(row[5])),moduleName+" missing generate path");
  }
});
