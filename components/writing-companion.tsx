"use client";
import {useState} from "react";

export default function WritingCompanion({bookId,chapterTitle,disabled,onAccept}:{bookId:string;chapterTitle:string;disabled?:boolean;onAccept:(markdown:string)=>void}){
 const [instruction,setInstruction]=useState("");
 const [draft,setDraft]=useState("");
 const [warning,setWarning]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function ask(){
  if(busy||disabled)return;
  const topic=(instruction.trim()||chapterTitle).slice(0,250);
  const learningGoals=(instruction.trim()||"Lanjutkan bab ini sesuai brief buku. Jangan mengarang sumber, ISBN, atau kutipan.").slice(0,2000);
  if(topic.trim().length<4){setError("Tuliskan judul bab atau instruksi minimal 4 karakter.");return;}
  setBusy(true);setError("");setWarning("");
  try{
   const response=await fetch("/api/books/"+encodeURIComponent(bookId)+"/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({topic,learningGoals})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Usulan AI tidak tersedia.");
   setDraft(String(data.draft?.content||"").slice(0,20000));
   setWarning(String(data.warning||"Usulan AI. Periksa fakta, hak cipta, dan sumber sebelum disimpan."));
  }catch(e){setError(e instanceof Error?e.message:"Usulan AI tidak tersedia. Penulisan manual tetap bisa dilanjutkan.");}
  finally{setBusy(false);}
 }
 return <details className="writing-optional writing-companion">
  <summary>Bantu saya menulis</summary>
  <p className="form-hint">AI menyiapkan usulan untuk bab ini. Naskah Anda tidak berubah sampai Anda memilih Sisipkan. Provider memakai kunci yang sudah diatur pengelola.</p>
  <label className="studio-field"><span>Instruksi singkat</span><textarea rows={3} maxLength={2000} value={instruction} disabled={disabled||busy} onChange={e=>setInstruction(e.target.value)} placeholder="Contoh: lanjutkan dengan satu contoh sehari-hari, atau sederhanakan paragraf pembuka."/></label>
  <button type="button" className="secondary-button" disabled={disabled||busy} onClick={()=>void ask()}>{busy?"Menyusun usulan…":"Minta usulan"}</button>
  {error&&<p role="alert">{error}</p>}
  {draft&&<div>
   <p role="status">{warning}</p>
   <textarea aria-label="Usulan AI" readOnly rows={8} value={draft}/>
   <div className="studio-workflow-actions">
    <button type="button" className="primary-button" disabled={disabled} onClick={()=>{onAccept(draft);setDraft("");}}>Sisipkan di akhir bab</button>
    <button type="button" className="secondary-button" onClick={()=>setDraft("")}>Tolak usulan</button>
   </div>
  </div>}
 </details>;
}
