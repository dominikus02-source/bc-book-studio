"use client";
import {useState} from "react";
import FormTransfer,{type TransferField,type TransferRecord} from "./form-transfer";

const fields:TransferField[]=[
  {key:"languageNotes",label:"Saran bahasa dan EYD",maxLength:4000},
  {key:"coherenceNotes",label:"Saran koherensi dan alur",maxLength:4000},
  {key:"readabilityNotes",label:"Saran keterbacaan",maxLength:4000}
];

export default function EditorialAiAssist({bookId,title,subject,grade,chapterTitles}:{
  bookId:string;title:string;subject:string;grade:string;chapterTitles:string[];
}){
  const [values,setValues]=useState<TransferRecord>({languageNotes:"",coherenceNotes:"",readabilityNotes:""});
  return <section className="panel" aria-label="Bantuan AI penyuntingan">
    <h3 className="panel-title">Generate AI — penyuntingan</h3>
    <p className="form-hint">AI memberi saran suntingan. Checklist bukti, penugasan, dan keputusan persetujuan tetap dilakukan manusia.</p>
    <FormTransfer
      name="Catatan penyuntingan naskah"
      bookId={bookId}
      fields={fields}
      values={values}
      autoApply={false}
      onApply={next=>setValues(current=>({...current,...next}))}
      aiContext={`Judul: ${title}; Mata pelajaran: ${subject}; Kelas: ${grade}; Bab: ${chapterTitles.join("; ")}. Beri catatan suntingan yang konkret. Jangan mengisi checklist atau mengklaim naskah telah disetujui.`}
    />
    <label className="studio-field"><span>Saran bahasa dan EYD</span><textarea rows={4} value={String(values.languageNotes||"")} onChange={e=>setValues(v=>({...v,languageNotes:e.target.value}))} maxLength={4000}/></label>
    <label className="studio-field"><span>Saran koherensi dan alur</span><textarea rows={4} value={String(values.coherenceNotes||"")} onChange={e=>setValues(v=>({...v,coherenceNotes:e.target.value}))} maxLength={4000}/></label>
    <label className="studio-field"><span>Saran keterbacaan</span><textarea rows={4} value={String(values.readabilityNotes||"")} onChange={e=>setValues(v=>({...v,readabilityNotes:e.target.value}))} maxLength={4000}/></label>
  </section>;
}
