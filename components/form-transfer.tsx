"use client";
import {useEffect,useRef,useState} from "react";
import {defaultStageContext,isSensitiveStage,stageAgentFor} from "../lib/stage-agent-context";
import {Download,Upload,FileSpreadsheet,CheckCircle2} from "lucide-react";
import {makeFormWorkbook,parseFormWorkbook} from "../lib/xlsx-transfer";
import {makeStagePrompt,type PromptGoal} from "../lib/ai-prompt-presets";

export type TransferField={key:string;label:string;hint?:string;example?:string;required?:boolean;type?:"text"|"boolean";maxLength?:number;options?:string[]};
export type TransferValue=string|boolean;
export type TransferRecord=Record<string,TransferValue>;
type Props={name:string;fields:readonly TransferField[];values:TransferRecord;onApply:(data:TransferRecord)=>void|Promise<void>;onPersist?:(data:TransferRecord)=>Promise<void>;bookId?:string;disabled?:boolean;hint?:string;autoApply?:boolean;aiContext?:string;autoApplyNotice?:string};
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
export default function FormTransfer({name,fields,values,onApply,disabled=false,hint,autoApply=true,aiContext="",autoApplyNotice,bookId,onPersist}:Props){
 const fileRef=useRef<HTMLInputElement>(null);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [pending,setPending]=useState<TransferRecord|null>(null);
 const [promptSelection,setPromptSelection]=useState<{goal:PromptGoal;fieldKey?:string}|null>({goal:"complete"});
 const [aiBusy,setAiBusy]=useState(false),[aiDraft,setAiDraft]=useState<TransferRecord|null>(null);
 const [provider,setProvider]=useState<{configured:boolean;provider?:{name?:string;provider:string;label:string;model:string}|null}|null>(null);
 const resolvedContext=aiContext||defaultStageContext(name,fields,values);
 const agent=stageAgentFor(name),sensitive=isSensitiveStage(name);
 const shouldAutoApply=autoApply&&!sensitive;
 async function applyRecord(data:TransferRecord){await onApply(data);if(onPersist)await onPersist(data)}
 const base=cleanFileName(name);
 const aiPrompt=promptSelection?makeStagePrompt({name,fields,values,context:resolvedContext,goal:promptSelection.goal,fieldKey:promptSelection.fieldKey}):"";
 useEffect(()=>{setAiDraft(null)},[name,bookId]);
 async function loadProvider(){try{const response=await fetch("/api/studio/ai-form",{cache:"no-store"});const data=await response.json();if(response.ok)setProvider(data);else setProvider({configured:false});}catch{setProvider({configured:false})}}
 async function generateAi(){
  if(sensitive){setError("Persetujuan, penugasan, atau konfigurasi API key tidak dapat diisi otomatis oleh AI.");return}
  setAiBusy(true);setError("");setAiDraft(null);setNotice("");
  try{
   const response=await fetch("/api/studio/ai-form",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bookId,name,fields:fields.map(f=>({key:f.key,label:f.label,type:f.type||"text",options:f.options,maxLength:f.maxLength})),values,context:resolvedContext.slice(0,7000),goal:promptSelection?.goal||"complete",fieldKey:promptSelection?.fieldKey})});
   const result=await response.json();if(!response.ok)throw Error(result.error||"Gagal menghubungi model AI.");
   const draft=normalizeTransfer(fields,result.fields);setAiDraft(draft);setNotice("Saran dari "+result.agent+" ("+result.provider.model+") siap ditinjau. Belum disimpan.");
  }catch(e){setError(e instanceof Error?e.message:"Gagal menggunakan AI");}finally{setAiBusy(false)}
 }
 async function applyAi(){if(!aiDraft)return;try{await applyRecord(aiDraft);setAiDraft(null);setNotice("Isian AI diterapkan. Periksa indikator penyimpanan pada stage ini.");}catch(e){setError(e instanceof Error?e.message:"Gagal menerapkan isian AI")}}
 function choosePrompt(goal:PromptGoal,fieldKey?:string){setPromptSelection({goal,fieldKey});setNotice("Prompt disusun dari isian terbaru. Tinjau dahulu, lalu salin ke AI pilihan Anda.");setError("")}
 async function copyPrompt(){try{await navigator.clipboard.writeText(aiPrompt);setNotice("Prompt AI disalin. Tempelkan ke layanan AI pilihan Anda. Hasilnya perlu ditinjau sebelum diunggah dan disimpan.")}catch{setError("Tidak dapat menyalin otomatis. Pilih teks prompt di bawah dan salin secara manual.")}}

 async function xlsxTemplate(){
  setError("");setBusy(true);
  try{
   const bytes=await makeFormWorkbook(fields,values,resolvedContext);
   downloadBlob(base+"-template.xlsx",new Blob([new Uint8Array(bytes)],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}));
   setNotice("Template Excel berhasil disiapkan.");
  }catch(e){setError(e instanceof Error?e.message:"Gagal menyiapkan XLSX.")}
  finally{setBusy(false)}
 }
 function markdownTemplate(){
  setError("");
  const lines=["# BC Book Studio — "+name,"","<!-- Edit teks di bawah setiap heading. Jangan ubah field_id. -->","<!-- INSTRUKSI UNTUK AI: Perbaiki dan lengkapi isian berdasarkan konteks yang sudah ada. Pertahankan semua heading ##, field_id, pilihan enum, dan format Ya/Tidak. Jangan mengarang sumber, kurikulum, data, atau identitas penulis. Jangan tambahkan field_id baru. Kembalikan file Markdown lengkap agar dapat diimpor ulang. -->",""];
  if(resolvedContext)lines.push("<!-- KONTEKS PROYEK (otomatis dari proses sebelumnya; periksa sebelum dipakai AI):",...resolvedContext.replace(/-->/g,"—>").split("\n"),"-->","");
  if(name==="Checklist editorial")lines.push("<!-- PROMPT AI UNTUK AUDIT EDITORIAL: Tinjau konteks dan naskah yang diberikan pengguna. Untuk setiap checkpoint, jelaskan bukti yang tersedia, kekurangan, dan langkah perbaikan dalam jawaban terpisah. Jangan menganggap checklist telah diverifikasi hanya berdasarkan teks yang dihasilkan AI. Pertahankan nilai Tidak kecuali pengguna telah memberikan bukti verifikasi yang nyata. Kembalikan file Markdown lengkap dengan field_id yang sama, nilai Ya/Tidak saja, tanpa menambah heading ## baru. -->","");
  if(name==="Naskah bab")lines.push("<!-- PROMPT AI KHUSUS NASKAH BAB (salin instruksi ini ke AI bersama brief proyek buku):","Peran: Penulis buku, editor pedagogis, dan pemeriksa fakta. Lengkapi Judul bab dan Isi bab berdasarkan judul proyek, sasaran pembaca, kelas, topik, tujuan pembelajaran, dan naskah awal yang tersedia. Bila konteks kurang, nyatakan asumsi secara jelas dan jangan mengarang data atau referensi.","Susun isi bab yang utuh: (1) pengantar kontekstual; (2) tujuan pembelajaran terukur; (3) konsep dan penjelasan bertahap; (4) contoh beserta pembahasan; (5) aktivitas atau eksperimen aman dengan alat, langkah, dan observasi; (6) miskonsepsi umum; (7) rangkuman; (8) latihan berjenjang dan refleksi; (9) referensi hanya jika terverifikasi. Untuk fiksi, sesuaikan struktur dengan adegan, alur, karakter, dialog, dan kesinambungan cerita.","Gunakan bahasa Indonesia yang sesuai jenjang, orisinal, akurat, mudah dipahami, serta siap diedit. Untuk gambar, sertakan placeholder [ILUSTRASI: deskripsi visual, tujuan, gaya, alt text] di dalam isi bab, bukan gambar palsu.","PENTING: Kembalikan HANYA Markdown dengan tepat dua heading: ## title — Judul bab dan ## content — Isi bab. Jangan mengubah field_id title/content, jangan menambah heading ## lain, dan jangan membungkus output dalam code fence. Semua subbagian isi bab gunakan ### atau teks tebal. Jangan menyertakan instruksi ini pada output akhir.","-->","");
  for(const f of fields){const v=values[f.key];lines.push("## "+f.key+" — "+f.label,"",f.type==="boolean"?(v===true?"Ya":"Tidak"):String(v||f.example||""),"");}
  downloadBlob(base+"-edit.md",new Blob([lines.join("\n")],{type:"text/markdown;charset=utf-8"}));setNotice("Markdown berhasil diunduh.");
 }
 async function processFile(file?:File){
  if(!file)return;setError("");setNotice("");setPending(null);
  let parsedRecord:TransferRecord|null=null;
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
   const result=normalizeTransfer(fields,raw);parsedRecord=result;
   if(shouldAutoApply){await applyRecord(result);setPending(null);setNotice(autoApplyNotice??("Impor berhasil: "+Object.keys(result).length+" isian diterapkan. Periksa indikator penyimpanan pada stage ini."));}
   else{setPending(result);setNotice("Impor berhasil: "+Object.keys(result).length+" isian terbaca. Tinjau pratinjau, terapkan ke form, lalu simpan melalui tombol pada tahap ini.");}
  }catch(e){if(parsedRecord)setPending(parsedRecord);setError((e instanceof Error?e.message:"Gagal membaca file.")+(parsedRecord?" Isian tetap tersedia untuk dicoba lagi.":""));}
  finally{if(fileRef.current)fileRef.current.value="";} // Browser keeps only parsed fields; original file is never stored.
 }
 return <section className="form-transfer" aria-label={"Impor dan ekspor "+name}>
  <div className="form-transfer-header"><strong>Impor / ekspor form — {name}</strong><span>Tanpa menyimpan file sumber di server</span></div>
  <div className="form-transfer-actions">

   <button type="button" className="secondary-button" disabled={disabled||busy} onClick={()=>void xlsxTemplate()}><FileSpreadsheet size={15}/> Unduh XLSX</button>
   <button type="button" className="secondary-button" disabled={disabled||busy} onClick={markdownTemplate}><Download size={15}/> Unduh Markdown</button>
   <label className="secondary-button form-transfer-upload"><Upload size={15}/> Unggah XLSX / MD<input ref={fileRef} type="file" accept=".xlsx,.md" disabled={disabled||busy} onChange={e=>void processFile(e.currentTarget.files?.[0])}/></label>
  </div>
  <p className="form-transfer-caption">{hint||"Edit file di luar aplikasi, lalu unggah kembali. Isian dipetakan berdasarkan field_id, bukan posisi kolom."} Maksimal 1 MB. File asli tidak disimpan di server.</p>
  <details className="ai-prompt-choice" aria-label={"Pilihan prompt AI "+name} onToggle={e=>{if(e.currentTarget.open&&!provider)void loadProvider()}}>
   <summary>Generate prompt dan bantuan AI — {agent.agent}</summary>
   <p className="form-transfer-caption">Konteks default: {agent.stage}. Agent: {agent.agent}. Model berasal dari Pengaturan; API key tidak pernah dibaca oleh browser.</p>
   <p className="form-transfer-caption">Model aktif: {provider?.configured?(provider.provider?.label+" · "+provider.provider?.model):"Belum dikonfigurasi / periksa Pengaturan"}. <a href="/studio?module=Pengaturan">Buka Pengaturan AI</a></p>
   <p className="form-transfer-caption">Pilih bantuan yang Anda perlukan. Setiap prompt menggunakan data formulir saat ini dan konteks proyek. Anda juga dapat mengisi semuanya secara manual. Tidak ada data yang dikirim ke AI secara otomatis.</p>
   <div className="ai-prompt-actions" role="group" aria-label="Alternatif prompt AI">
    {([{goal:"complete",label:"Lengkapi isian"},{goal:"improve",label:"Perbaiki EYD dan gaya"},{goal:"coherence",label:"Periksa koherensi"},{goal:"accessibility",label:"Tingkatkan keterbacaan"}] as const).map(item=><button type="button" key={item.goal} className="secondary-button" disabled={disabled||busy} aria-pressed={promptSelection?.goal===item.goal} onClick={()=>choosePrompt(item.goal)}>{item.label}</button>)}
   </div>
   <p className="form-transfer-caption">Atau buat prompt khusus untuk satu isian:</p>
   <div className="ai-prompt-actions" role="group" aria-label="Prompt AI per isian">
    {fields.map(field=><button type="button" className="secondary-button" key={field.key} disabled={disabled||busy} aria-pressed={promptSelection?.goal==="field"&&promptSelection.fieldKey===field.key} onClick={()=>choosePrompt("field",field.key)}>Bantu: {field.label}</button>)}
   </div>
   {!sensitive&&<button type="button" className="primary-button" disabled={disabled||busy||aiBusy||provider?.configured!==true} onClick={()=>void generateAi()}>{aiBusy?"Menghubungi AI…":"✨ Isi formulir dengan AI aktif"}</button>}
   {aiDraft&&<div className="form-transfer-preview"><strong>Pratinjau hasil AI (belum disimpan)</strong><dl>{fields.filter(f=>aiDraft[f.key]!==undefined).map(f=><div key={f.key}><dt>{f.label}</dt><dd>{String(aiDraft[f.key]).slice(0,300)}</dd></div>)}</dl><div className="form-transfer-actions"><button type="button" className="primary-button" disabled={disabled||busy||aiBusy} onClick={()=>void applyAi()}>Terapkan isian AI ke form</button><button type="button" className="secondary-button" onClick={()=>setAiDraft(null)}>Batalkan</button></div></div>}
   {promptSelection&&<div className="ai-prompt-result"><label className="studio-field"><span>Pratinjau prompt siap disalin</span><textarea readOnly rows={9} value={aiPrompt} aria-label={"Pratinjau prompt AI "+name}/></label><button type="button" className="secondary-button" onClick={()=>void copyPrompt()}>Salin prompt terpilih</button><button type="button" className="secondary-button" onClick={()=>setPromptSelection(null)}>Tutup prompt</button></div>}
  </details>
  {error&&<p role="alert" className="form-transfer-error">{error}</p>}
  {notice&&<p role="status" className="form-transfer-success">{notice}</p>}
  {pending&&<div className="form-transfer-preview"><strong>Pratinjau perubahan</strong><dl>{fields.filter(f=>pending[f.key]!==undefined).map(f=><div key={f.key}><dt>{f.label}</dt><dd>{String(pending[f.key]).slice(0,200)}</dd></div>)}</dl><div className="form-transfer-actions"><button type="button" className="primary-button" disabled={disabled} onClick={()=>{void Promise.resolve(applyRecord(pending)).then(()=>{setPending(null);setNotice("Isian diterapkan. Periksa indikator penyimpanan pada stage ini.");}).catch(e=>setError(e instanceof Error?e.message:"Gagal menerapkan isian"));}}><CheckCircle2 size={15}/> Terapkan ke form</button><button type="button" className="secondary-button" onClick={()=>{setPending(null);setNotice("Impor dibatalkan.");}}>Batal</button></div></div>}
 </section>;
}
