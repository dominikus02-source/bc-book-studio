"use strict";
const assert=require("node:assert/strict"),JSZip=require("jszip");
const endpoint="http://127.0.0.1:34991",token="qa-only-contract-v2-20261108-key-00000001";
(async()=>{
 const c=await fetch(endpoint+"/capabilities",{headers:{"x-worker-key":token}});assert.equal(c.status,200);
 const contract=await c.json();assert.equal(contract.contractVersion,2);
 console.log("WORKER_CAPABILITIES",contract);
 const book={title:"Validasi Kontrak Penerbitan",subject:"Fisika",author:"BC Studio QA",pageSize:"id-14x21",publishingLayout:true,chapters:[
 {title:"Sampul Depan",content:"Judul Buku Uji dan Identitas Draf"},
 {title:"Halaman Judul",content:"Edisi untuk pengujian rendering."},
 {title:"Bab Satu",content:"Ini adalah isi bab pengujian yang memuat beberapa paragraf dan struktur heading.\n\n## Tujuan\n\nMemastikan ukuran halaman dan urutan sampul."},
 {title:"Sampul Belakang",content:"Penutup buku pengujian."}
 ],assets:[]};
 for(const format of ["pdf","docx","epub"]){
  const r=await fetch(endpoint+"/render",{method:"POST",headers:{"x-worker-key":token,"Content-Type":"application/json"},body:JSON.stringify({contractVersion:2,format,book})});
  const b=Buffer.from(await r.arrayBuffer());
  if(!r.ok)throw Error("Worker "+format+" "+r.status+" "+b.toString().slice(0,350));
  assert(b.length>500);
  if(format==="docx"){const z=await JSZip.loadAsync(b),xml=await z.file("word/document.xml").async("string");assert(xml.includes('w:w="7937"'));assert(xml.includes('w:h="11906"'));assert(xml.includes("Sampul Depan"))}
  if(format==="epub"){const z=await JSZip.loadAsync(b);assert(z.file("mimetype"));const opf=Object.keys(z.files).find(n=>n.endsWith(".opf"));assert(opf)}
  console.log("WORKER_RENDER_PASS",format,b.length);
 }
})().catch(e=>{console.error("WORKER_RENDER_FAIL",e.stack);process.exitCode=1});