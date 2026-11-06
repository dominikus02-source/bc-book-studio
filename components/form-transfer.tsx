"use client";
import {useRef,useState} from "react";
import {Download,Upload,FileSpreadsheet,CheckCircle2} from "lucide-react";
import {makeFormWorkbook,parseFormWorkbook} from "../lib/xlsx-transfer";

export type TransferField={key:string;label:string;hint?:string;example?:string;required?:boolean;type?:"text"|"boolean";maxLength?:number;options?:string[]};
export type TransferValue=string|boolean;
export type TransferRecord=Record<string,TransferValue>;
type Props={name:string;fields:readonly TransferField[];values:TransferRecord;onApply:(data:TransferRecord)=>void;disabled?:boolean;hint?:string};
const LIMIT=1024*1024;
function cleanFileName(name:string){return (name.toLowerCase().replace(/[^a-z0-9-]+/g,"-").replace(/^-|-$/g,"").slice(0,45)||"form")};
function cellText(value:unknown):string{
 if(value===null||value===undefined)return "";
 if(typeof value==="string"||typeof value==="number"||typeof value==="boolean")return String(value);
 if(typeof value==="object"&&value!==null){
  if("formula" in value||"sharedFormula" in value||"hyperlink" in value)throw Error("Formula dan hyperlink Excel tidak diizinkan.");
  if("richText" in value)throw Error("Sel rich-text tidak didukung.");
 }
 throw Error("Tipe sel tidak didukung.");
}
export function normalizeTransfer(fields:readonly TransferField[],record:Record<string,unknown>):TransferRecord{
 const known=new Set(fields.map(f=>f.key));
 for(const key of Object.keys(record))if(!known.has(key))throw Error("Kolom tidak dikenal: "+key);
 const result:TransferRecord={};
 for(const field of fields){
  const raw=record[field.key];if(raw===undefined)continue;
  const value=String(raw??"").trim();
  if(field.type==="boolean"){
   const v=value.toLowerCase();
   if(!["ya","tidak","true","false","1","0"].includes(v))throw Error(field.label+": isi Ya atau Tidak.");
   result[field.key]=["ya","true","1"].includes(v);
  }else{
   if(field.required&&!value)throw Error(field.label+" wajib diisi.");
   if(value.length>(field.maxLength??12000))throw Error(field.label+" melebihi batas karakter.");
   if(field.options?.length&&!field.options.includes(value))throw Error(field.label+": nilai tidak terdaftar dalam pilihan.");
   result[field.key]=value;
  }
 }
 if(!Object.keys(result).length)throw Error("File tidak memuat isian yang dikenal.");
 return result;
}
function downloadBlob(name:string,blob:Blob){
 const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
export default function FormTransfer({name,fields,values,onApply,disabled=false,hint}:Props){
 const fileRef=useRef<HTMLInputElement>(null);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [pending,setPending]=useState<TransferRecord|null>(null);
 const base=cleanFileName(name);
 async function xlsxTemplate(){
  setError("");setBusy(true);
  try{
   const bytes=await makeFormWorkbook(fields,values);
   downloadBlob(base+"-template.xlsx",new Blob([new Uint8Array(bytes)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
   setNotice("Template Excel berhasil disiapkan.");
  }catch(e){setError(e instanceof Error?e.message:"Gagal menyiapkan XLSX.")}
  finally{setBusy(false)}
 }
 function markdownTemplate(){
  setError("");
  const lines=["# BC Book Studio — "+name,"","<!-- Edit teks di bawah setiap heading. Jangan ubah field_id. -->",""];
  for(const f of fields){const v=values[f.key];lines.push("## "+f.key+" — "+f.label,"",f.type==="boolean"?(v===true?"Ya":"Tidak"):String(v||f.example||""),"");}
  downloadBlob(base+"-edit.md",new Blob([lines.join("\n")],{type:"text/markdown;charset=utf-8"}));setNotice("Markdown berhasil diunduh.");
 }
 async function processFile(file?:File){
  if(!file)return;setError("");setNotice("");setPending(null);
  try{
   if(file.size>LIMIT||file.size===0)throw Error("File kosong atau melebihi 1 MB.");
   if(!/\.(xlsx|md)$/i.test(file.name))throw Error("Gunakan berkas .xlsx atau .md saja.");
   const raw:Record<string,unknown>=Object.create(null);
   if(file.name.toLowerCase().endsWith(".md")){
    const text=await file.text();if(/<script|<!doctype|<iframe/i.test(text))throw Error("Markup HTML tidak diizinkan.");
    const headings=[...text.matchAll(/^## ([a-zA-Z][\w-]*) — [^\r\n]+\r?$/gm)];
    if(!headings.length)throw Error("Markdown tidak mengikuti template.");
    for(let i=0;i<headings.length;i++){
     const key=headings[i][1];
     if(Object.hasOwn(raw,key))throw Error("field_id ganda: "+key);
     const start=(headings[i].index??0)+headings[i][0].length;
     const end=i+1<headings.length?(headings[i+1].index??text.length):text.length;
     raw[key]=text.slice(start,end).trim();
    }
   }else{
    setBusy(true);
    try{
     const parsed=await parseFormWorkbook(new Uint8Array(await file.arrayBuffer()),fields.length);
     Object.assign(raw,parsed);
    }finally{setBusy(false)}
   }
   const result=normalizeTransfer(fields,raw);
   setPending(result);
   setNotice(Object.keys(result).length+" isian siap ditinjau. Belum disimpan ke server.");
  }catch(e){setError(e instanceof Error?e.message:"Gagal membaca file.");}
  finally{if(fileRef.current)fileRef.current.value="";} // Browser keeps only parsed fields; original file is never stored.
 }
 return <section className="form-transfer" aria-label={"Impor dan ekspor "+name}>
  <div className="form-transfer-header"><strong>Impor / ekspor form — {name}</strong><span>Tanpa menyimpan file sumber di server</span></div>
  <div className="form-transfer-actions">
   <button type="button" className="secondary-button" disabled={disabled||busy} onClick={()=>void xlsxTemplate()}><FileSpreadsheet size={15}/> Unduh XLSX</button>
   <button type="button" className="secondary-button" disabled={disabled||busy} onClick={markdownTemplate}><Download size={15}/> Unduh Markdown</button>
   <label className="secondary-button form-transfer-upload"><Upload size={15}/> Baca XLSX / MD<input ref={fileRef} type="file" accept=".xlsx,.md" disabled={disabled||busy} onChange={e=>void processFile(e.currentTarget.files?.[0])}/></label>
  </div>
  <p className="form-transfer-caption">{hint||"Edit file di luar aplikasi, lalu unggah kembali. Isian dipetakan berdasarkan field_id, bukan posisi kolom."} Maksimal 1 MB. File asli tidak disimpan di server.</p>
  {error&&<p role="alert" className="form-transfer-error">{error}</p>}
  {notice&&<p role="status" className="form-transfer-success">{notice}</p>}
  {pending&&<div className="form-transfer-preview"><strong>Pratinjau perubahan</strong><dl>{fields.filter(f=>pending[f.key]!==undefined).map(f=><div key={f.key}><dt>{f.label}</dt><dd>{String(pending[f.key]).slice(0,200)}</dd></div>)}</dl><div className="form-transfer-actions"><button type="button" className="primary-button" disabled={disabled} onClick={()=>{onApply(pending);setPending(null);setNotice("Isian diterapkan. Gunakan tombol Simpan pada form untuk menyimpan ke database.");}}><CheckCircle2 size={15}/> Terapkan ke form</button><button type="button" className="secondary-button" onClick={()=>{setPending(null);setNotice("Impor dibatalkan.");}}>Batal</button></div></div>}
 </section>;
}
