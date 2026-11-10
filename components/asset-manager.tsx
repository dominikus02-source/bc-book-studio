"use client";
import {useCallback,useEffect,useState} from "react";
type Rev={id:string;action:string;metadata:unknown;createdAt:string};
type Asset={id:string;name:string;mime:string;size:number;altText:string;license:string;sourceUrl:string|null;updatedAt:string;archivedAt:string|null;revisions:Rev[]};
const LICENSES=["OWNED","CC0","CC_BY","CC_BY_SA","LICENSED"] as const;
export default function AssetManager({bookId}:{bookId:string}){
 const api="/api/books/"+encodeURIComponent(bookId)+"/assets";
 const [active,setActive]=useState<Asset[]>([]),[archived,setArchived]=useState<Asset[]>([]),[selected,setSelected]=useState<Asset|null>(null);
 const [name,setName]=useState(""),[altText,setAltText]=useState(""),[license,setLicense]=useState("OWNED"),[sourceUrl,setSourceUrl]=useState("");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const refresh=useCallback(async()=>{const [a,b]=await Promise.all([fetch(api,{cache:"no-store"}),fetch(api+"?archived=1",{cache:"no-store"})]);const [one,two]=await Promise.all([a.json(),b.json()]);if(!a.ok||!b.ok)throw Error(one.error||two.error||"Tidak dapat memuat aset");setActive(one.assets||[]);setArchived(two.assets||[])},[api]);
 useEffect(()=>{void refresh().catch(e=>setError(e.message))},[refresh]);
 function edit(a:Asset){setSelected(a);setName(a.name);setAltText(a.altText);setLicense(a.license);setSourceUrl(a.sourceUrl||"");setError("");setNotice("")}
 async function command(asset:Asset,method:string,payload:object){
  setBusy(true);setError("");setNotice("");
  try{const r=await fetch(api+"/"+encodeURIComponent(asset.id),{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedVersion:asset.updatedAt,...payload})});const result=await r.json();if(!r.ok)throw Error(result.error||"Perubahan gagal");await refresh();setSelected(null);setNotice("Metadata dan status aset tersimpan.");return true}
  catch(e){setError(e instanceof Error?e.message:"Perubahan gagal");return false}finally{setBusy(false)}
 }
 return <section className="asset-manager" aria-label="CRUD metadata ilustrasi">
  <h4>Kelola ilustrasi dan lisensi</h4><p className="form-hint">Ubah metadata, arsipkan gambar yang tidak digunakan, atau pulihkan. Aset yang tertaut pada naskah tidak boleh diarsipkan sebelum dilepas dari bab.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <button type="button" className="secondary-button" onClick={()=>void refresh().catch(e=>setError(e.message))} disabled={busy}>Muat ulang daftar ilustrasi</button>
  {!active.length&&<p>Belum ada ilustrasi aktif.</p>}
  <ul>{active.map(a=><li key={a.id}><img alt={a.altText} src={api+"/"+a.id} width={110} height={80}/><div><strong>{a.name}</strong><p>{a.license} · {Math.ceil(a.size/1024)} KB</p><p>{a.altText}</p>
    <div className="outline-actions"><button type="button" className="secondary-button" disabled={busy} onClick={()=>edit(a)}>Ubah metadata</button><button type="button" className="secondary-button" disabled={busy} onClick={()=>{if(confirm("Arsipkan gambar ini?"))void command(a,"DELETE",{})}}>Arsipkan</button></div>
    <details><summary>Riwayat metadata ({a.revisions.length})</summary>{a.revisions.map(r=><pre key={r.id}>{r.action} — {new Date(r.createdAt).toLocaleString("id-ID")}{"\n"}{JSON.stringify(r.metadata,null,2)}</pre>)}</details>
   </div></li>)}</ul>
  {selected&&<form onSubmit={e=>{e.preventDefault();if(!altText.trim()||!name.trim())return;void command(selected,"PATCH",{name,altText,license,sourceUrl:sourceUrl.trim()||null})}}>
   <h5>Ubah metadata — {selected.name}</h5>
   <label className="studio-field"><span>Nama berkas</span><input maxLength={150} required value={name} onChange={e=>setName(e.target.value)}/></label>
   <label className="studio-field"><span>Teks alternatif</span><textarea minLength={5} maxLength={250} required value={altText} onChange={e=>setAltText(e.target.value)}/></label>
   <label className="studio-field"><span>Hak penggunaan</span><select value={license} onChange={e=>setLicense(e.target.value)}>{LICENSES.map(l=><option value={l} key={l}>{l}</option>)}</select></label>
   <label className="studio-field"><span>URL sumber HTTPS (opsional)</span><input type="url" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)}/></label>
   <div className="outline-actions"><button className="primary-button" disabled={busy||altText.trim().length<5||!name.trim()}>Simpan metadata</button><button type="button" className="secondary-button" onClick={()=>setSelected(null)}>Batal</button></div>
  </form>}
  <details><summary>Arsip ilustrasi ({archived.length})</summary>{archived.map(a=><div className="outline-archived" key={a.id}><span>{a.name}</span><button type="button" className="secondary-button" disabled={busy} onClick={()=>void command(a,"PATCH",{restore:true})}>Pulihkan</button></div>)}</details>
 </section>;
}
