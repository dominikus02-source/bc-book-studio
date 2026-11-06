const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),ts=require("typescript");
const file=path.resolve(__dirname,"../lib/navigation/breadcrumbs.ts"),compiled=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const loaded=new Module(file,module);loaded._compile(compiled,file);
const {studioBreadcrumbs}=loaded.exports;
test("book/chapter hierarchy has useful parent links and excludes secret query values",()=>{
 const items=studioBreadcrumbs("/studio",new URLSearchParams("view=studio-penulisan&book=own&chapter=one&token=secret"),{id:"own",title:"Judul buku",chapter:{id:"one",title:"Judul bab"}});
 assert.deepEqual(items.map(item=>item.label),["Beranda","Studio","Studio Penulisan","Judul buku","Judul bab"]);
 assert.equal(items[2].href,"/studio?view=studio-penulisan");
 assert.equal(items[3].href,"/studio?view=studio-penulisan&book=own");
 assert.equal(items[4].href,undefined);assert.ok(!JSON.stringify(items).includes("secret"));
});
test("stale labels from a different selected book are never shown",()=>{
 const items=studioBreadcrumbs("/studio",new URLSearchParams("view=proyek-buku&book=new"),{id:"old",title:"Nama buku lama"});
 assert.equal(items.at(-1).label,"Detail buku");
});
test("unknown menus cannot inject links and auth breadcrumbs exclude tokens",()=>{
 assert.deepEqual(studioBreadcrumbs("/studio",new URLSearchParams("view=javascript:alert(1)"),null).map(i=>i.label),["Beranda","Studio"]);
 assert.deepEqual(studioBreadcrumbs("/activate",new URLSearchParams("token=secret"),null),[{label:"Beranda",href:"/"},{label:"Aktivasi akun"}]);
});
