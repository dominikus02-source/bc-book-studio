"use client";

import FormTransfer, {type TransferField,type TransferRecord} from "./form-transfer";

const sizes=["A4","A5","B5"] as const;
type Settings={pageSize:typeof sizes[number];order:number[]};
type LayoutIdentity={snapshot:string;version:number;chapters:{position:number;title:string}[]};

export default function BookLayoutTransfer({id,layout,settings,disabled,onApply}:{
 id:string;layout:LayoutIdentity;settings:Settings;disabled:boolean;onApply:(settings:Settings)=>void;
}){
 const values:TransferRecord={
  book_id:id,snapshot_id:layout.snapshot,layout_version:String(layout.version),page_size:settings.pageSize,
 };
 const fields:TransferField[]=[
  {key:"book_id",label:"ID buku",required:true,hint:"Pertahankan nilai ini."},
  {key:"snapshot_id",label:"Snapshot Review",required:true,hint:"Pertahankan nilai ini."},
  {key:"layout_version",label:"Versi tata letak",required:true,hint:"Pertahankan nilai ini."},
  {key:"page_size",label:"Ukuran halaman",required:true,options:[...sizes],hint:"A4, A5, atau B5."},
 ];
 const chapters=new Map(layout.chapters.map(chapter=>[chapter.position,chapter]));
 for(const [index,position] of settings.order.entries()){
  const chapter=chapters.get(position);
  if(!chapter)continue;
  const key="chapter-"+position;
  const title=chapter.title.replace(/[<>]/g,"").replace(/\s+/g," ").trim();
  fields.push({key,label:"Urutan: "+title,required:true,maxLength:3,hint:"Nomor urut 1 sampai "+chapters.size+". Setiap nomor dipakai satu kali."});
  values[key]=String(index+1);
 }
 function importLayout(record:TransferRecord){
  if(record.book_id!==id||record.snapshot_id!==layout.snapshot)throw Error("Template berasal dari buku atau snapshot Review yang berbeda.");
  if(record.layout_version!==String(layout.version))throw Error("Versi template sudah berubah. Unduh template terbaru.");
  const pageSize=sizes.find(size=>size===record.page_size);
  if(!pageSize)throw Error("Ukuran halaman wajib diisi dengan A4, A5, atau B5.");
  const ranks=layout.chapters.map(({position,title})=>{
   const raw=record["chapter-"+position];
   if(typeof raw!=="string"||!/^[1-9][0-9]*$/.test(raw)||Number(raw)>chapters.size)throw Error("Urutan bab tidak valid: "+title);
   return {position,rank:Number(raw)};
  });
  if(new Set(ranks.map(item=>item.rank)).size!==chapters.size)throw Error("Nomor urut bab tidak boleh ganda.");
  onApply({pageSize,order:ranks.sort((a,b)=>a.rank-b.rank).map(item=>item.position)});
 }
 return <FormTransfer
  name="Tata letak buku" bookId={id}
  fields={fields}
  values={values}
  autoApply
  disabled={disabled}
  onApply={importLayout}
  aiContext="Isi berasal dari snapshot Review dan urutan editor saat template diunduh. Ubah hanya ukuran halaman atau nomor urut. Jangan ubah ID, versi, atau isi naskah."
  hint="Template mengikuti urutan seret saat ini. Di XLSX, edit kolom C. Di Markdown, edit nilai di bawah heading. Unggah kembali untuk mengisi editor ini."
  autoApplyNotice="Impor diterapkan ke editor. Perubahan disimpan otomatis ke buku."
 />;
}
