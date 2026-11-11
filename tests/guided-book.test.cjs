const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
require.extensions[".ts"]=function(mod,filename){
 const source=fs.readFileSync(filename,"utf8");
 const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 mod._compile(result.outputText,filename);
};
const {guidedBookInput,starterChapter}=require("../lib/guided-book.ts");
const {briefMissing}=require("../lib/workflow.ts");

test("guided setup fills the brief gate and does not invent an author",()=>{
 const book=guidedBookInput({title:"Cerita Pelabuhan",author:"Sari Wibowo",language:"id",audience:"smp",kind:"fiction",goal:"Mengajak pembaca mengikuti satu musim di pelabuhan."});
 assert.equal(book.language,"id");
 assert.equal(book.bookType,"FICTION");
 assert.equal(book.genre,"NOVEL");
 assert.equal(book.pageSize,"A5");
 assert.equal(book.grade,"8");
 assert.equal(book.author,"Sari Wibowo");
 assert.equal(briefMissing(book).length,0);
 const english=guidedBookInput({title:"Harbour Stories",author:"Sari Wibowo",language:"en",audience:"internasional",kind:"textbook"});
 assert.equal(english.language,"en");
 assert.equal(english.genre,"TEXTBOOK");
 assert.match(english.description,/Harbour Stories/);
 assert.equal(briefMissing(english).length,0);
 assert.throws(()=>guidedBookInput({title:"A",author:"Sari",language:"id",audience:"umum",kind:"nonfiction"}));
});

test("starter chapter is long enough to save and names its purpose",()=>{
 const id=starterChapter("id");
 const en=starterChapter("en");
 assert.ok(id.content.trim().length>=20);
 assert.ok(en.content.trim().length>=20);
 assert.ok(id.outlineObjective.trim().length>=1);
 assert.equal(id.title,"Bab 1");
 assert.equal(en.title,"Chapter 1");
 assert.doesNotMatch(id.content,/ISBN/);
});
