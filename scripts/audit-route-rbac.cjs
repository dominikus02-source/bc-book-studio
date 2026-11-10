"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve("app/api"),rows=[];
function scan(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const abs=path.join(dir,entry.name);
  if(entry.isDirectory())scan(abs);
  else if(entry.name==="route.ts"){
   const code=fs.readFileSync(abs,"utf8"),route="/api/"+path.relative(root,path.dirname(abs)).replace(/\\/g,"/");
   const methods=[...code.matchAll(/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)/g)].map(m=>m[1]);
   const auth=["sessionUser","identity(","authorized(","reviewerAuthorized(","administrator("].filter(x=>code.includes(x));
   const checks=[
    code.includes("ownerId")?"resource-owner":"",
    code.includes("reviewerId")||code.includes("assignedReviewers")?"reviewer-assignment":"",
    code.includes("expectedVersion")?"optimistic-version":"",
    code.includes("z.")?"schema-validator":"",
    code.includes("tx.review.create")||code.includes("revisions")?"audit-or-revision":""
   ].filter(Boolean);
   rows.push({route,methods,auth,checks});
  }
 }
}
scan(root);rows.sort((a,b)=>a.route.localeCompare(b.route));
const lines=["# Inventaris endpoint dan kandidat kontrol RBAC — 2026-11-08","",
"**Metode:** inspeksi statis 33 file route.ts pada integration/unified-book-workflow-20261107. Penanda di tabel adalah kemunculan kode, **bukan pembuktian otorisasi benar atau PASS keamanan**. Bukti izin memerlukan pengujian negatif per peran dan tindakan.","",
"| Endpoint | Metode | Mekanisme autentikasi terdeteksi | Kontrol statis terkait | Status |","|---|---|---|---|---|"];
for(const r of rows)lines.push("| "+r.route.replace(/\|/g,"\\|")+" | "+(r.methods.join(", ")||"Lainnya")+" | "+(r.auth.join(", ")||"Periksa akses publik/manual")+" | "+(r.checks.join(", ")||"Perlu pemeriksaan manual")+" | PERLU UJI TIAP PERAN |");
lines.push("","**Skenario uji:** owner/editor, reviewer ditugaskan, admin ditugaskan independen, admin tidak ditugaskan, editor lain, anonim, serta pembaca publik pada endpoint yang memang publik. Gunakan status DRAFT/REVIEW/APPROVED/arsip, akses ke buku lain, replay/stale version, data berbahaya, dan perubahan setelah approval.","","DILARANG menyimpulkan keamanan dari penamaan route, tombol tersembunyi, atau keberadaan sessionUser saja.");
const dest=path.resolve("docs/ROUTE_RBAC_INVENTORY_20261108.md");
fs.writeFileSync(dest,lines.join("\n")+"\n","utf8");
console.log("STATIC_RBAC_ENDPOINT_INVENTORY_GENERATED",rows.length,dest);
