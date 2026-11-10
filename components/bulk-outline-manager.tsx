"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {BulkRow} from "../lib/bulk-outline-transfer";
import {markdown,workbook,parseMarkdown,parseWorkbook,SAMPLE_BULK_ROWS} from "../lib/bulk-outline-transfer";
type SavedRow=BulkRow&{id:string;chapterId:string;updatedAt:string};
type ArchivedRow={id:string;chapterId:string;chapterTitle:string;subsectionTitle:string;updatedAt:string};
const genres=["FANTASY","ROMANCE","SCI_FI","NONFICTION","THRILLER"] as const;
const statuses=["PUBLIC","PREMIUM","DRAFT"] as const;
const toName=(s:string)=>({FANTASY:"Fantasi",ROMANCE:"Romansa",SCI_FI:"Sci-Fi",NONFICTION:"Non-Fiksi",THRILLER:"Thriller",PUBLIC:"Public",PREMIUM:"Premium",DRAFT:"Draft"} as Record<string,string>)[s]||s;
const blank=():BulkRow=>({chapterTitle:"Bab Baru",subsectionTitle:"Subbagian Baru",sortOrder:1,content:"Paragraf pertama menjelaskan topik secara jelas serta mencatat fakta pendukung yang dapat diperiksa.\n\nParagraf kedua menguji tanda baca: \"Apa kesimpulannya?\" tanya pembaca. \"Periksa datanya!\" jawab penulis.",genreTarget:"NONFICTION",accessTier:"DRAFT"});
function download(bytes:Uint8Array|string,fileName:string,mime:string){const blob=new Blob([typeof bytes==="string"?bytes:new Uint8Array(bytes)],{type:mime});const object=URL.createObjectURL(blob);const a=document.createElement("a");a.href=object;a.download=fileName;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(object),6000)}
export default function BulkOutlineManager({bookId,bookContext="",onChanged}:{bookId:string;bookContext?:string;onChanged:()=>Promise<void>}){
 const [rows,setRows]=useState<BulkRow[]>([]),[saved,setSaved]=useState<SavedRow[]>([]),[archived,setArchived]=useState<ArchivedRow[]>([]);
 const rowsRef=useRef<BulkRow[]>([]);
 const requestId=useRef(0);
 const [ready,setReady]=useState(false);
 const [bulkPromptGoal,setBulkPromptGoal]=useState<"complete"|"coherence"|"eyd"|"accessibility"|null>(null);
 const [version,setVersion]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [source,setSource]=useState("Belum ada file"),[dirty,setDirty]=useState(false),[showTable,setShowTable]=useState(false);
 const fileRef=useRef<HTMLInputElement>(null);
 const api="/api/books/"+encodeURIComponent(bookId)+"/bulk-outline";
 const promptRows=rows.length?rows:SAMPLE_BULK_ROWS;
 const promptBulk=bulkPromptGoal?[
  "BC Book Studio — Tahap 2 Rancang, impor massal bab dan subbagian.",
  "TUJUAN: "+({complete:"Lengkapi bab dan subbagian yang belum lengkap dengan 2 paragraf per bagian.",coherence:"Evaluasi dan perbaiki koherensi serta urutan bab dan subbagian; hindari duplikasi isi.",eyd:"Perbaiki EYD, kalimat, tanda baca, dan dialog tanpa mengubah fakta atau genre.",accessibility:"Perbaiki keterbacaan untuk pembaca dengan kebutuhan akses berbeda, termasuk paragraf jelas dan teks yang bersahabat bagi pembaca layar."} as const)[bulkPromptGoal],
  "KONTEKS BUKU STAGE 1: "+(bookContext||"Belum tersedia.")+"; Identitas buku saat ini: "+bookId+" (identitas teknis; jangan ditampilkan ke pembaca).",
  "DATA TERKINI (pertahankan inti yang sudah benar):",
  markdown(promptRows).slice(0,30000),
  "FORMAT WAJIB: hanya tabel Markdown 7 kolom yang sama dengan header dan urutan semula: No | Judul Bab (Chapter Title) | Nama Subbagian (Subsection Title) | Urutan (Sort Order / Integer) | Konten Dummy | Genre Target | Peran Akses. Gunakan salah satu genre Fantasi, Romansa, Sci-Fi, Non-Fiksi, Thriller dan akses Public, Premium, Draft. Tidak boleh mengubah nama kolom. Dalam tiap subbagian, pisahkan dua paragraf dengan karakter literal \\n\\n agar dapat diimpor kembali. Judul/urutan dalam satu bab harus unik. Jangan mengarang rujukan, ISBN, atau izin akses pembaca. Kembalikan tidak lebih dari 200 baris tanpa code fence.",
  "Pengguna wajib memeriksa hasilnya. Tidak ada perubahan database hingga pengguna klik Simpan bulk."
 ].join("\n\n"):"";

 const load=useCallback(async()=>{const request=++requestId.current;const response=await fetch(api,{cache:"no-store"});const result=await response.json();if(!response.ok)throw Error(result.error||"Tidak dapat memuat data massal");if(request!==requestId.current)return;setReady(true);setVersion(result.version);setSaved(result.rows);setArchived(result.archivedRows||[]);const values=result.rows.map(({id,chapterId,updatedAt,...value}:SavedRow)=>value);rowsRef.current=values;setRows(values);setDirty(false)},[api]);
 useEffect(()=>{void load().catch(e=>setError(e.message));return()=>{requestId.current++}},[load]);
 function update(index:number,change:Partial<BulkRow>){const next=rowsRef.current.map((r,i)=>i===index?{...r,...change}:r);rowsRef.current=next;setRows(next);setDirty(true);setNotice("")}
 function apply(items:BulkRow[],name:string){if(!ready)return setError("Muat data terbaru dahulu");if(dirty&&!confirm("Ganti perubahan lokal yang belum disimpan dengan data baru?"))return;rowsRef.current=items;setRows(items);setSource(name);setDirty(true);setShowTable(true);setError("");setNotice(items.length+" baris siap ditinjau. Klik Simpan bulk setelah diperiksa; database belum diubah.")}
 async function fileChanged(file?:File){
  if(!file)return;
  setBusy(true);setError("");setNotice("");
  try{
   if(file.size>2*1024*1024)throw Error("Berkas maksimum 2 MB");
   if(!/\.(xlsx|md)$/i.test(file.name))throw Error("Hanya .xlsx dan .md yang didukung");
   const parsed=file.name.toLowerCase().endsWith(".md")?parseMarkdown(await file.text()):await parseWorkbook(new Uint8Array(await file.arrayBuffer()));
   if(!parsed.length)throw Error("File tidak memiliki baris data");
   apply(parsed,file.name);
  }catch(e){setError(e instanceof Error?e.message:"File tidak dapat dibaca")}
  finally{setBusy(false);if(fileRef.current)fileRef.current.value=""}
 }
 function rowCondition(item:BulkRow){
  const complete=item.chapterTitle.trim().length>=2&&item.subsectionTitle.trim().length>=2&&Number.isSafeInteger(item.sortOrder)&&item.sortOrder>0&&item.content.trim().length>=80&&item.content.split(/\n\s*\n/).filter(Boolean).length>=2;
  if(!complete)return {color:"red",label:"Belum lengkap"};
  const persisted=saved.find(s=>s.chapterTitle.trim().toLowerCase()===item.chapterTitle.trim().toLowerCase()&&s.subsectionTitle.trim().toLowerCase()===item.subsectionTitle.trim().toLowerCase());
  return persisted&&persisted.sortOrder===item.sortOrder&&persisted.content===item.content&&persisted.genreTarget===item.genreTarget&&persisted.accessTier===item.accessTier?{color:"green",label:"Lengkap"}:{color:"yellow",label:"Dalam proses"};
 }
 function validate(values:BulkRow[]){
  if(!values.length)throw Error("Tidak ada baris untuk disimpan");
  if(values.length>200)throw Error("Maksimum 200 baris per impor");
  const seen=new Set<string>(),orders=new Set<string>();
  values.forEach((r,i)=>{
   if(r.chapterTitle.trim().length<2||r.subsectionTitle.trim().length<2)throw Error("Nama bab/subbagian tidak valid pada baris "+(i+1));
   if(!Number.isSafeInteger(r.sortOrder)||r.sortOrder<1||r.sortOrder>1000)throw Error("Urutan harus integer positif pada baris "+(i+1));
   if(r.content.trim().length<80||r.content.split(/\n\s*\n/).filter(Boolean).length<2)throw Error("Konten perlu dua paragraf (minimal 80 karakter) pada baris "+(i+1));
   const a=r.chapterTitle.trim().toLocaleLowerCase("id-ID")+"::"+r.subsectionTitle.trim().toLocaleLowerCase("id-ID");
   const b=r.chapterTitle.trim().toLocaleLowerCase("id-ID")+"::"+r.sortOrder;
   if(seen.has(a))throw Error("Subbagian ganda pada baris "+(i+1));
   if(orders.has(b))throw Error("Urutan ganda dalam satu bab pada baris "+(i+1));
   seen.add(a);orders.add(b);
  });
 }
 async function save(){
  if(!version||!ready)return setError("Muat data terbaru sebelum menyimpan");
  setBusy(true);setError("");setNotice("");
  try{
   const values=rowsRef.current;validate(values);
   if(!confirm("Terapkan "+values.length+" baris ke bab dan subbagian buku ini? Data yang sudah ada akan diperbarui berdasarkan judul, tanpa menghapus baris yang tidak tercantum."))return;
   const response=await fetch(api,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedVersion:version,rows:values})});
   const result=await response.json();if(!response.ok)throw Error(result.error||"Bulk import gagal");
   await load();await onChanged();
   setNotice("Berhasil: "+result.createdChapters+" bab baru, "+result.createdSections+" subbagian baru, "+result.updatedSections+" subbagian diubah. Data tersimpan secara atomik.");setShowTable(true);
  }catch(e){setError(e instanceof Error?e.message:"Bulk import gagal; tidak ada perubahan parsial")}finally{setBusy(false)}
 }
 async function restore(row:ArchivedRow){
  if(!confirm("Pulihkan subbagian "+row.subsectionTitle+"?"))return;
  setBusy(true);setError("");setNotice("");
  try{const url="/api/books/"+encodeURIComponent(bookId)+"/chapters/"+encodeURIComponent(row.chapterId)+"/sections/"+encodeURIComponent(row.id);
   const response=await fetch(url,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedVersion:row.updatedAt,restore:true})});const result=await response.json();if(!response.ok)throw Error(result.error||"Gagal memulihkan");await load();await onChanged();setNotice("Subbagian dipulihkan ke kerangka buku.")}
  catch(e){setError(e instanceof Error?e.message:"Pemulihan gagal")}finally{setBusy(false)}
 }
 async function archive(row:SavedRow){
  if(!confirm("Arsipkan "+row.subsectionTitle+"? Data tidak akan dihapus permanen."))return;
  setBusy(true);setError("");setNotice("");
  try{
   const url="/api/books/"+encodeURIComponent(bookId)+"/chapters/"+encodeURIComponent(row.chapterId)+"/sections/"+encodeURIComponent(row.id);
   const response=await fetch(url,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedVersion:row.updatedAt})});
   const result=await response.json();if(!response.ok)throw Error(result.error||"Gagal mengarsipkan");
   await load();await onChanged();setNotice("Subbagian dipindahkan ke arsip.")}
  catch(e){setError(e instanceof Error?e.message:"Gagal mengarsipkan")}
  finally{setBusy(false)}
 }
 return <section className="bulk-outline-manager" aria-label="Bulk CRUD bab dan subbagian">
  <h4>Impor massal bab dan subbagian</h4>
  <p className="form-hint">Template 7 kolom mendukung 25 baris contoh dan hingga 200 baris per impor, untuk satu buku yang sedang dipilih. Genre dan status akses merupakan metadata konten, bukan izin login/RBAC.</p>
  <div className="bulk-actions">
   <button type="button" className="secondary-button" disabled={busy||!ready} onClick={()=>download(markdown(rowsRef.current.length?rowsRef.current:SAMPLE_BULK_ROWS),"bc-studio-bulk-bab.md","text/markdown")}>Unduh MD</button>
   <button type="button" className="secondary-button" disabled={busy||!ready} onClick={()=>void workbook(rowsRef.current.length?rowsRef.current:SAMPLE_BULK_ROWS).then(bytes=>download(bytes,"bc-studio-bulk-bab.xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).catch(e=>setError(e.message))}>Unduh XLSX</button>
   <button type="button" className="secondary-button" disabled={busy||!ready} onClick={()=>apply(SAMPLE_BULK_ROWS.map(r=>({...r})),"25 baris dummy")}>Muat 25 dummy</button>
   <label className="secondary-button bulk-upload">Unggah XLSX / MD<input ref={fileRef} type="file" accept=".xlsx,.md" disabled={busy||!ready} onChange={e=>void fileChanged(e.target.files?.[0])}/></label>

  </div>
  <details className="ai-prompt-choice" aria-label="Pilihan prompt AI bulk">
   <summary>Prompt AI sesuai data bulk — pilih alternatif</summary>
   <p className="form-hint">Prompt ini menggunakan baris yang sedang Anda edit. Pilih tujuan, salin ke AI pilihan Anda, lalu unggah hasil Markdown untuk ditinjau. Pengeditan manual tetap tersedia.</p>
   <div className="ai-prompt-actions">
    {([{goal:"complete",label:"Lengkapi isi"},{goal:"coherence",label:"Selaraskan bab dan subbagian"},{goal:"eyd",label:"Perbaiki EYD"},{goal:"accessibility",label:"Tingkatkan keterbacaan"}] as const).map(item=><button key={item.goal} type="button" className="secondary-button" disabled={busy||!ready} aria-pressed={bulkPromptGoal===item.goal} onClick={()=>setBulkPromptGoal(item.goal)}>{item.label}</button>)}
   </div>
   {bulkPromptGoal&&<div className="ai-prompt-result"><label className="studio-field"><span>Pratinjau prompt bulk</span><textarea rows={9} value={promptBulk} readOnly aria-label="Pratinjau prompt bulk"/></label><button type="button" className="secondary-button" onClick={()=>void navigator.clipboard.writeText(promptBulk).then(()=>setNotice("Prompt bulk disalin. Hasil AI belum menyimpan data.")).catch(()=>setError("Clipboard tidak tersedia; salin teks prompt secara manual."))}>Salin prompt terpilih</button></div>}
  </details>
  <p className="form-hint">Sumber: {source} · {rows.length} baris lokal · {new Set(rows.map(r=>r.chapterTitle.trim())).size} bab · {dirty?"Belum disimpan":"Sinkron dengan database"}. Berkas tidak disimpan di server; hanya isi yang disetujui dikirim setelah klik Simpan bulk.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <div className="bulk-actions">
   <button type="button" className="secondary-button" disabled={busy||!ready} onClick={()=>{if(dirty&&!confirm("Buang perubahan yang belum disimpan?"))return;void load().then(()=>{setNotice("Data diperbarui dari database");setShowTable(true)}).catch(e=>setError(e.message))}}>Muat ulang database</button>
   <button type="button" className="secondary-button" disabled={busy||!ready} onClick={()=>{const next=[...rowsRef.current,blank()];rowsRef.current=next;setRows(next);setDirty(true);setShowTable(true)}}>Tambah baris</button>
   <button type="button" className="secondary-button" onClick={()=>setShowTable(v=>!v)}>{showTable?"Tutup editor":"Tampilkan editor"}</button>
   <button type="button" className="primary-button" disabled={busy||!ready||!dirty||!rows.length} onClick={()=>void save()}>Simpan bulk ({rows.length} baris)</button>
  </div>
  {showTable&&<div className="bulk-outline-scroll" role="region" aria-label="Pratinjau dan editor import massal" tabIndex={0}>
   <table className="bulk-outline-table"><thead><tr><th>No</th><th>Judul bab</th><th>Subbagian</th><th>Urutan</th><th>Konten dua paragraf</th><th>Genre</th><th>Peran akses</th><th>Kelengkapan</th><th>CRUD</th></tr></thead>
    <tbody>{rows.map((r,i)=><tr key={i} className={"bulk-row status-"+rowCondition(r).color}><td>{i+1}</td>
     <td><input aria-label={"Judul bab baris "+(i+1)} maxLength={180} value={r.chapterTitle} onChange={e=>update(i,{chapterTitle:e.target.value})}/></td>
     <td><input aria-label={"Nama subbagian baris "+(i+1)} maxLength={180} value={r.subsectionTitle} onChange={e=>update(i,{subsectionTitle:e.target.value})}/></td>
     <td><input aria-label={"Urutan baris "+(i+1)} type="number" min={1} max={1000} value={r.sortOrder} onChange={e=>update(i,{sortOrder:Number(e.target.value)})}/></td>
     <td><textarea aria-label={"Konten baris "+(i+1)} rows={5} maxLength={12000} value={r.content} onChange={e=>update(i,{content:e.target.value})}/></td>
     <td><select aria-label={"Genre baris "+(i+1)} value={r.genreTarget} onChange={e=>update(i,{genreTarget:e.target.value as BulkRow["genreTarget"]})}>{genres.map(g=><option key={g} value={g}>{toName(g)}</option>)}</select></td>
     <td><select aria-label={"Peran akses baris "+(i+1)} value={r.accessTier} onChange={e=>update(i,{accessTier:e.target.value as BulkRow["accessTier"]})}>{statuses.map(g=><option key={g} value={g}>{toName(g)}</option>)}</select></td>
     <td><button type="button" className={"card-status-label status-action status-"+rowCondition(r).color} aria-label={rowCondition(r).label+" ? Periksa isian baris "+(i+1)} onClick={()=>{const tr=document.querySelectorAll(".bulk-outline-table tbody tr")[i];const field=tr?.querySelector<HTMLElement>("input,textarea,select");field?.focus();field?.scrollIntoView({behavior:"smooth",block:"center"})}}>{rowCondition(r).label}</button></td>
     <td><button type="button" className="secondary-button" disabled={busy||!ready} onClick={()=>{const next=rowsRef.current.filter((_,idx)=>idx!==i);rowsRef.current=next;setRows(next);setDirty(true)}}>Hapus dari impor</button></td>
    </tr>)}</tbody>
   </table></div>}
  <details><summary>Kelola arsip subbagian tersimpan ({archived.length})</summary>
   <p className="form-hint">Arsip bersifat reversibel. Data konten, genre, dan statusnya tetap tersimpan di database.</p>
   <p className="form-hint">Subbagian aktif:</p><ul>{saved.map(s=><li key={s.id} className="bulk-archive-row"><span>{s.chapterTitle} / {s.subsectionTitle}</span><button type="button" className="secondary-button" disabled={busy||!ready||dirty} onClick={()=>void archive(s)}>Arsipkan</button></li>)}</ul>
   <p className="form-hint">Subbagian di arsip:</p><ul>{archived.map(s=><li key={s.id} className="bulk-archive-row"><span>{s.chapterTitle} / {s.subsectionTitle}</span><button type="button" className="secondary-button" disabled={busy||!ready||dirty} onClick={()=>void restore(s)}>Pulihkan</button></li>)}</ul>
  </details>
 </section>;
}
