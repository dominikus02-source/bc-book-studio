"use client";
import {useState} from "react";
import FormTransfer,{type TransferField,type TransferRecord} from "./form-transfer";

const fields:TransferField[]=[
  {key:"typographyNotes",label:"Saran tipografi dan ukuran huruf",maxLength:3000},
  {key:"marginNotes",label:"Saran margin, spasi, dan halaman",maxLength:3000},
  {key:"contentsNotes",label:"Saran daftar isi dan running head",maxLength:3000}
];

export default function LayoutAiAssist({bookId,title,pageSize,status}:{
  bookId:string;title:string;pageSize?:string;status:string;
}){
  const [values,setValues]=useState<TransferRecord>({typographyNotes:"",marginNotes:"",contentsNotes:""});
  return <section className="panel" aria-label="Bantuan AI tata letak">
    <h3 className="panel-title">Generate AI — tata letak</h3>
    <p className="form-hint">Saran ini membantu merencanakan tampilan halaman. Perubahan layout produksi tetap ditinjau dan disimpan terpisah. Status buku saat ini: {status}.</p>
    <FormTransfer
      name="Saran tata letak buku"
      bookId={bookId}
      fields={fields}
      values={values}
      autoApply={false}
      onApply={next=>setValues(current=>({...current,...next}))}
      aiContext={`Judul: ${title}; Ukuran halaman: ${pageSize||"belum diatur"}; Status: ${status}. Usulkan tipografi, margin, dan daftar isi yang sesuai buku Indonesia. Jangan mengubah ID snapshot atau mengaku ekspor final telah diperiksa.`}
    />
    <label className="studio-field"><span>Saran tipografi dan ukuran huruf</span><textarea rows={3} value={String(values.typographyNotes||"")} onChange={e=>setValues(v=>({...v,typographyNotes:e.target.value}))} maxLength={3000}/></label>
    <label className="studio-field"><span>Saran margin, spasi, dan halaman</span><textarea rows={3} value={String(values.marginNotes||"")} onChange={e=>setValues(v=>({...v,marginNotes:e.target.value}))} maxLength={3000}/></label>
    <label className="studio-field"><span>Saran daftar isi dan running head</span><textarea rows={3} value={String(values.contentsNotes||"")} onChange={e=>setValues(v=>({...v,contentsNotes:e.target.value}))} maxLength={3000}/></label>
  </section>;
}
