export type BookDetails={id:string;title:string;chapter?:{id:string;title:string}}|null;
type Item={label:string;href?:string};
const publicLabels:Record<string,string>={"/login":"Masuk","/activate":"Aktivasi akun","/forgot-password":"Lupa kata sandi","/reset-password":"Atur ulang kata sandi"};
const views=["Dasbor","Proyek Buku","Buat Buku","Idea Lab","Kurikulum","Studio Penulisan","Studio Latihan","Studio Visual","Penyuntingan","Tinjauan Pedagogis","Tata Letak","Penerbitan","Pusat Agen","Pengaturan"];
const slug=(value:string)=>value.toLowerCase().replace(/\s+/g,"-");
export function studioBreadcrumbs(pathname:string,params:{get:(key:string)=>string|null},details:BookDetails):Item[]{
 if(pathname==="/")return [{label:"Beranda"}];
 if(pathname!=="/studio")return [{label:"Beranda",href:"/"},{label:publicLabels[pathname]||"Halaman"}];
 const view=views.find(item=>slug(item)===params.get("view"))||"Dasbor";
 const items:Item[]=[{label:"Beranda",href:"/"},{label:"Studio",href:"/studio"}];
 const base=new URLSearchParams();
 if(view!=="Dasbor")base.set("view",slug(view));
 const moduleUrl="/studio"+(base.size?"?"+base.toString():"");
 if(view!=="Dasbor")items.push({label:view,href:moduleUrl});
 const bookId=params.get("book"),chapterId=params.get("chapter");
 if(bookId&&["Proyek Buku","Studio Penulisan","Penyuntingan","Tata Letak","Penerbitan"].includes(view)){
  base.set("book",bookId);
  items.push({label:details?.id===bookId?details.title:"Detail buku",href:"/studio?"+base.toString()});
  if(chapterId)items.push({label:details?.id===bookId&&details.chapter?.id===chapterId?details.chapter.title:"Detail bab"});
 }
 delete items[items.length-1].href;
 return items;
}
