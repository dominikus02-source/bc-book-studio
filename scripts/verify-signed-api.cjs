// Synthetic RS256 identities + real HTTP handlers and PostgreSQL in an isolated CI container.
// Only the test container has a JWKS fetch interceptor. Production has no test-key option.
const {generateKeyPairSync,sign}=require("node:crypto");
const {execFileSync}=require("node:child_process");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
const publicMode=process.env.TEST_PUBLIC_MODE==="true";
const image=process.env.WEB_IMAGE,db=process.env.TEST_DATABASE_URL;
if(!image||!db||!db.includes("bookstudio_release_ci"))throw Error("Isolated CI image/database required");
const {privateKey,publicKey}=generateKeyPairSync("rsa",{modulusLength:2048});
const jwk={...publicKey.export({format:"jwk"}),kid:"release-test",alg:"RS256",use:"sig"};
const issuer="https://release-fixture.cloudflareaccess.com",audience="release-fixture-audience";
const folder=fs.mkdtempSync(path.join(os.tmpdir(),"bookstudio-jwks-"));
fs.chmodSync(folder,0o755);
fs.writeFileSync(path.join(folder,"jwks.mjs"),"const original=globalThis.fetch;globalThis.fetch=(url,options)=>String(url)==="+JSON.stringify(issuer+"/cdn-cgi/access/certs")+"?Promise.resolve(new Response("+JSON.stringify(JSON.stringify({keys:[jwk]}))+",{headers:{'Content-Type':'application/json'}})):original(url,options);",{mode:0o644});
const name="bookstudio-signed-ci-"+Date.now(),root="http://127.0.0.1:3185",reviewer="ci-only-independent-reviewer-credential";
function token(sub,email,overrides={},omit=[]){
 const payload={iss:issuer,aud:audience,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300,sub,email,type:"app",...overrides};omit.forEach(k=>delete payload[k]);
 const input=Buffer.from(JSON.stringify({alg:"RS256",kid:"release-test"})).toString("base64url")+"."+Buffer.from(JSON.stringify(payload)).toString("base64url");
 return input+"."+sign("RSA-SHA256",Buffer.from(input),privateKey).toString("base64url");
}
const a=token("release-owner-a"+publicMode,"a@example.invalid"),b=token("release-owner-b"+publicMode,"b@example.invalid");
async function call(method,p,who=a,body,expected=200,extra={}){
 const r=await fetch(root+p,{method,headers:{"cf-access-jwt-assertion":who,...(body?{"Content-Type":"application/json"}:{}),...extra},body:body?JSON.stringify(body):undefined});
 if(expected!==null)assert.equal(r.status,expected,method+" "+p+" unexpected HTTP "+r.status);return r;
}
(async()=>{
execFileSync("docker",["run","-d","--name",name,"--network","host","-v",folder+":/test:ro","-e","NODE_OPTIONS=--import=/test/jwks.mjs","-e","PORT=3185","-e","DATABASE_URL="+db,"-e","CF_ACCESS_TEAM_DOMAIN="+issuer,"-e","CF_ACCESS_AUD="+audience,"-e","CF_ACCESS_EDITOR_EMAILS=a@example.invalid,b@example.invalid","-e","STUDIO_REVIEWER_API_KEY="+reviewer,"-e","CF_ACCESS_PUBLIC_SIGNUP="+publicMode,"-e","AI_API_KEY=isolated-test-key","-e","AI_API_URL=https://127.0.0.1:9/chat/completions",image],{stdio:"pipe"});
let ready=false;for(let i=0;i<30;i++){try{if((await fetch(root+"/api/health")).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,1000))}assert(ready,"Signed test runtime failed");
for(const bad of [token("release-owner-a","a@example.invalid",{aud:"wrong"}),token("release-owner-a","a@example.invalid",{iss:"https://wrong.cloudflareaccess.com"}),token("release-owner-a","a@example.invalid",{exp:1}),...(!publicMode?[token("release-owner-a","outsider@example.invalid")]:[]),token("release-owner-a","a@example.invalid",{},["exp"]),token("release-owner-a","a@example.invalid",{type:"service"})]){
 await call("GET","/api/books",bad,undefined,401);
}
console.log("PASS signed JWT validation; public mode="+publicMode);
await call("GET","/api/books",token("new-public-user","new@example.invalid"),undefined,publicMode?200:401);
const book=(await (await call("POST","/api/books",a,{title:"Release API Isolation Test",grade:"7",subject:"Bahasa Indonesia",description:"CI only"},201)).json()).book,id=book.id;
assert((await (await call("GET","/api/books",a)).json()).books.some(x=>x.id===id));
assert(!(await (await call("GET","/api/books",b)).json()).books.some(x=>x.id===id));
await call("GET","/api/books/"+id,b,undefined,404);
await call("PATCH","/api/books/"+id,b,{title:"Hijack"},404);
await call("DELETE","/api/books/"+id,b,undefined,404);
await call("POST","/api/books/"+id+"/chapters",b,{title:"Hijack",content:"This chapter must never be saved to another user's book."},404);
await call("POST","/api/books/"+id+"/generate",b,{topic:"Testing",learningGoals:"Verify isolation across all user books."},404);
await call("POST","/api/books/"+id+"/review",b,{action:"submit"},404);
for(const f of ["pdf","epub","docx"])await call("GET","/api/books/"+id+"/export?format="+f,b,undefined,404);
await call("PATCH","/api/books/"+id,a,{title:"Release API Edited"});
await call("POST","/api/books/"+id+"/chapters",a,{title:"Mengenal Teks",content:"Teks deskripsi menjelaskan ciri objek secara rinci. Latihan: gambarkan ruang kelas Anda."},201);
await call("GET","/api/books/"+id+"/export?format=pdf",a,undefined,409);
await call("POST","/api/books/"+id+"/review",a,{action:"submit"});
await call("POST","/api/books/"+id+"/review",a,{action:"approve",note:"CI test decision"},401);
await call("POST","/api/books/"+id+"/review",a,{action:"approve",note:"CI test only; not a published book"},200,{Authorization:"Bearer "+reviewer});
await call("PATCH","/api/books/"+id,a,{title:"Locked"},409);
await call("DELETE","/api/books/"+id,a,undefined,409);
for(const [format,type,magic] of [["pdf","application/pdf","%PDF"],["epub","application/epub+zip","PK"],["docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document","PK"]]){
 const r=await call("GET","/api/books/"+id+"/export?format="+format);
 assert(r.headers.get("content-type").startsWith(type));
 const bytes=Buffer.from(await r.arrayBuffer());assert(bytes.subarray(0,magic.length).toString()===magic);assert(bytes.length>200);
}
if(publicMode){
 const c=token("quota-user","quota@example.invalid");
 const created=await Promise.all(Array.from({length:25},()=>call("POST","/api/books",c,{title:"Quota concurrency",grade:"7",subject:"Test"},null).catch(e=>{throw e})));
 const codes=created.map(r=>r.status);assert.equal(codes.filter(x=>x===201).length,20);assert.equal(codes.filter(x=>x===429).length,5);
 const qb=(await created.find(r=>r.status===201).json()).book;
 for(let i=0;i<5;i++)await call("POST","/api/books/"+qb.id+"/generate",c,{topic:"Uji limit",learningGoals:"Memastikan pembatasan permintaan AI."},502);
 await call("POST","/api/books/"+qb.id+"/generate",c,{topic:"Uji limit",learningGoals:"Memastikan pembatasan permintaan AI."},429);
 console.log("PASS atomic concurrent book quota and AI failed-attempt quota");
}
const status=await (await call("GET","/api/studio/status")).json();assert.equal(status.database,"connected");assert.deepEqual(status.exports,["pdf","epub","docx"]);
console.log("PASS real HTTP + database: A/B CRUD isolation, chapters/generation/review/export isolation, reviewer gate, locked book and three export formats");
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>{try{execFileSync("docker",["rm","-f",name],{stdio:"pipe"})}catch{}fs.rmSync(folder,{recursive:true,force:true})});
