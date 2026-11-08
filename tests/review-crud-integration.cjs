
const assert=require('node:assert/strict'),crypto=require('node:crypto'),{PrismaClient}=require('@prisma/client'),{chromium}=require('playwright'),fs=require('fs');
process.loadEnvFile('.env.local');
const target=new URL(process.env.DATABASE_URL);assert.equal(target.host+target.pathname,'127.0.0.1:55999/bookstudio_import_qa');
const db=new PrismaClient(),origin=process.env.REVIEW_QA_ORIGIN||'http://127.0.0.1:3106',users=[],books=[],sessions=[],results=[];
let browser;
const ok=(name)=>{results.push({name,status:'PASS'});console.log('PASS',name)};
async function actor(role){
 const user=await db.studioUser.create({data:{email:'qa-review-'+crypto.randomBytes(6).toString('hex')+'@example.invalid',name:'QA Review '+role,role,active:true}});users.push(user.id);
 const token=crypto.randomBytes(32).toString('hex');
 const session=await db.studioSession.create({data:{userId:user.id,tokenHash:crypto.createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+1800000)}});sessions.push(session.id);
 return {...user,token};
}
async function call(who,path,method='GET',data,expected=200){
 const r=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(who?{Cookie:'bcstudio_session='+who.token}:{})},...(data?{body:JSON.stringify(data)}:{})});
 const text=await r.text();assert.equal(r.status,expected,method+' '+path+' '+text.slice(0,350));return JSON.parse(text);
}
(async()=>{
 const owner=await actor('EDITOR'),reviewer=await actor('REVIEWER'),other=await actor('ADMIN');
 const b=await db.book.create({data:{ownerId:owner.id,title:'QA Review integration',subject:'Bahasa Indonesia',grade:'VII',description:'Buku uji integrasi review dengan naskah dan tahap penerbitan.',targetAudience:'Siswa SMP',writingGoal:'Memahami teks',editorialStage:'WRITING',editorialChecks:{objectives:true,sources:true,assessment:true,expert:true,rights:true},chapters:{create:{position:1,title:'Bab QA',outlineObjective:'Memahami teks deskripsi',content:'Ini adalah naskah uji integrasi yang cukup panjang untuk diuji secara menyeluruh.'}}},include:{chapters:true}});books.push(b.id);
 const another=await db.book.create({data:{ownerId:other.id,title:'Buku asing QA',subject:'QA',grade:'VII'}});books.push(another.id);
 await call(null,'/api/reviewer','GET',null,401);
 assert.equal((await call(reviewer,'/api/reviewer')).assignments.length,0);
 await call(owner,'/api/books/'+b.id+'/reviewers','POST',{email:reviewer.email},201);
 await call(owner,'/api/books/'+b.id+'/review','POST',{action:'submit',note:''});ok('owner assignment and DRAFT -> REVIEW gates');
 const payload={bookId:b.id,chapterId:b.chapters[0].id,category:'CONTENT',severity:'MAJOR',content:'Temuan awal QA'};
 await call(owner,'/api/reviewer/notes','POST',payload,403);
 await call(other,'/api/reviewer/notes','POST',payload,403);
 let n=(await call(reviewer,'/api/reviewer/notes','POST',payload,201)).note;
 assert.equal((await db.reviewerNote.findUnique({where:{id:n.id}})).content,payload.content);ok('create persisted; owner and unassigned admin forbidden');
 let read=await call(owner,'/api/reviewer');
 assert.equal(read.assignments.find(x=>x.book.id===b.id).book.reviewNotes[0].id,n.id);
 assert(!read.assignments.some(x=>x.book.id===another.id));ok('owner reads reviewer feedback; tenant isolation');
 await call(reviewer,'/api/reviewer/notes/'+n.id,'PATCH',{content:'Tanpa versi'},400);
 await call(other,'/api/reviewer/notes/'+n.id,'PATCH',{content:'Tidak boleh',expectedVersion:n.updatedAt},404);
 let updated=(await call(reviewer,'/api/reviewer/notes/'+n.id,'PATCH',{content:'Temuan diperbarui QA',expectedVersion:n.updatedAt})).note;
 await call(reviewer,'/api/reviewer/notes/'+n.id,'PATCH',{content:'Versi lama',expectedVersion:n.updatedAt},409);
 await call(reviewer,'/api/reviewer/notes/'+n.id,'DELETE',{expectedVersion:n.updatedAt},409);ok('update persisted and stale update/delete rejected');
 await call(owner,'/api/books/'+b.id+'/review','POST',{action:'approve',note:'self'},403);
 await call(reviewer,'/api/books/'+b.id+'/review','POST',{action:'approve',note:'Major unresolved'},409);ok('self approval and unresolved major blocked');
 updated=(await call(reviewer,'/api/reviewer/notes/'+n.id,'PATCH',{status:'RESOLVED',expectedVersion:updated.updatedAt})).note;
 await call(reviewer,'/api/reviewer/notes/'+n.id,'DELETE',{expectedVersion:updated.updatedAt});
 assert.equal((await db.reviewerNote.findUnique({where:{id:n.id}})).status,'ARCHIVED');
 assert(!(await call(owner,'/api/reviewer')).assignments.find(x=>x.book.id===b.id).book.reviewNotes.some(x=>x.id===n.id));
 assert(await db.review.count({where:{bookId:b.id,decision:'note:remove'}}));ok('archive retains note and audit; hidden from active list');
 browser=await chromium.launch();
 const context=await browser.newContext();await context.addCookies([{name:'bcstudio_session',value:reviewer.token,url:origin}]);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/studio?'+new URLSearchParams({bookId:b.id,module:'Review Naskah'}),{waitUntil:'domcontentloaded'});
 await page.getByRole('heading',{name:b.title,exact:true}).waitFor({timeout:60000});
 await page.getByRole('button',{name:'+ Tambah catatan',exact:true}).click();
 await page.getByRole('textbox',{name:'Isi catatan reviewer'}).fill('Catatan melalui browser QA');
 await page.getByRole('button',{name:'Tambah catatan',exact:true}).click();
 await page.getByText('Catatan baru disimpan.',{exact:true}).waitFor();
 await page.reload();await page.getByText('Catatan melalui browser QA',{exact:true}).waitFor();
 const card=page.locator('.reviewer-note-card').filter({hasText:'Catatan melalui browser QA'});
 await card.getByRole('button',{name:'Ubah',exact:true}).click();
 await page.getByRole('textbox',{name:'Isi catatan reviewer'}).fill('Catatan browser diperbarui QA');
 await page.getByRole('button',{name:'Simpan perubahan',exact:true}).click();
 await page.getByText('Perubahan catatan disimpan.',{exact:true}).waitFor();
 await page.locator('.reviewer-note-card').filter({hasText:'Catatan browser diperbarui QA'}).getByRole('button',{name:'Tandai selesai',exact:true}).click();
 await page.locator('.reviewer-note-card').filter({hasText:'Catatan browser diperbarui QA'}).getByText('Selesai').waitFor();
 await page.locator('.reviewer-note-card').filter({hasText:'Catatan browser diperbarui QA'}).getByRole('button',{name:'Arsipkan',exact:true}).click();
 await page.getByRole('button',{name:'Ya, arsipkan',exact:true}).click();
 await page.getByText('Catatan diarsipkan.',{exact:true}).waitFor();ok('browser create/read/reload/update/resolve/archive');
 for(const theme of ['light','dark'])for(const width of [320,375,390,768,1024,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  const actual=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert(actual<=width+1,theme+' overflow at '+width+': '+actual);
 }
 assert.deepEqual(errors,[]);ok('reviewer 6 viewport widths light/dark without overflow or JS errors');
 const own=await browser.newContext();await own.addCookies([{name:'bcstudio_session',value:owner.token,url:origin}]);const op=await own.newPage();
 await op.goto(origin+'/studio?'+new URLSearchParams({bookId:b.id,module:'Review Naskah'}),{waitUntil:'domcontentloaded'});
 await op.getByRole('heading',{name:b.title,exact:true}).waitFor();
 assert(await op.getByRole('button',{name:'+ Tambah catatan',exact:true}).isDisabled());
 await op.getByRole('button',{name:'Persiapan'}).click();
 assert.equal(new URL(op.url()).searchParams.get('bookId'),b.id);
 await op.getByRole('heading',{name:'Siapkan peninjauan'}).waitFor(); assert.equal(new URL(op.url()).searchParams.get('module'),'Review Naskah');ok('owner sees selected book and preserved bookId in editorial stage');
 await call(reviewer,'/api/books/'+b.id+'/review','POST',{action:'reject',note:'Perbaiki sebelum terbit'});
 assert.equal((await db.book.findUnique({where:{id:b.id}})).status,'DRAFT');
 await call(owner,'/api/books/'+b.id+'/review','POST',{action:'submit',note:''});
 await call(reviewer,'/api/books/'+b.id+'/review','POST',{action:'approve',note:'QA independent review passed'});
 assert(await db.bookApprovalSnapshot.count({where:{bookId:b.id,reviewerId:reviewer.id}}));
 await call(reviewer,'/api/reviewer/notes','POST',payload,409);
 const workflow=await call(owner,'/api/books/'+b.id+'/workflow');assert.equal(workflow.stages[4].available,true);ok('reject -> draft -> resubmit -> approve snapshot -> layout readiness; closed review locked');
 const target=await db.book.findUnique({where:{id:'cmw7py2k60014urc0fvsh7vgw'},select:{id:true,status:true,editorialStage:true,archivedAt:true,_count:{select:{assignedReviewers:true,reviewNotes:true,chapters:true}}}});
 console.log('REQUESTED_BOOK_READ_ONLY',JSON.stringify(target));
})().catch(e=>{console.error('FAIL',e.stack);results.push({status:'FAIL',error:e.message});process.exitCode=1}).finally(async()=>{
 if(browser)await browser.close();
 await db.studioSession.deleteMany({where:{id:{in:sessions}}});
 await db.book.updateMany({where:{id:{in:books}},data:{archivedAt:new Date()}});
 await db.studioUser.updateMany({where:{id:{in:users}},data:{active:false}});
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/review-crud-integration.json',JSON.stringify(results,null,2));
 await db.$disconnect();
});
