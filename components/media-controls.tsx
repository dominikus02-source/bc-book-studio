"use client";
import {useEffect,useState} from "react";
import {defaultVideoLayout,mediaImageMarkdown,parseMediaImage,parseVideo,safeMediaLink,videoMarkdown,type MediaImage} from "../lib/book-media";
import {prepareImageUpload} from "../lib/client-image-upload";
import "./media-controls.css";

type Asset={id:string;name:string;altText:string};
export function MediaImageEditor({raw,bookId,assets,disabled,onChange,onUploaded}:{raw:string;bookId:string;assets:Asset[];disabled:boolean;onChange:(value:string)=>void;onUploaded:(asset:Asset)=>void}){
 const [form,setForm]=useState(()=>parseMediaImage(raw)!);
 const [file,setFile]=useState<File|null>(null),[license,setLicense]=useState("OWNED");
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[sourceUrl,setSourceUrl]=useState("");
 useEffect(()=>{const next=parseMediaImage(raw);if(next)setForm(next)},[raw]);
 const current=parseMediaImage(raw)!;
 function patch<K extends keyof MediaImage>(key:K,value:MediaImage[K]){setForm(item=>({...item,[key]:value}));setError("")}
 function apply(){try{onChange(mediaImageMarkdown(form));setError("")}catch(e){setError(e instanceof Error?e.message:"Pengaturan gambar tidak valid.")}}
 async function replaceImage(){
  if(!file||busy||disabled)return;
  if(form.alt.trim().length<5){setError("Isi minimal 5 karakter teks alternatif pada pengaturan gambar.");return}
  setBusy(true);setError("");
  try{
   mediaImageMarkdown(form);
   const source=safeMediaLink(sourceUrl);if(sourceUrl.trim()&&(!source||source.length>500))throw Error("URL sumber gambar harus HTTPS dan maksimal 500 karakter.");
   const prepared=await prepareImageUpload(file);
   const response=await fetch("/api/books/"+encodeURIComponent(bookId)+"/assets",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...prepared,altText:form.alt.trim(),license,...(source?{sourceUrl:source}:{})})});
   const result=await response.json();if(!response.ok)throw Error(result.error||"Gambar gagal diunggah.");
   onUploaded(result.asset);onChange(mediaImageMarkdown({...form,assetId:result.asset.id}));setFile(null);setSourceUrl("");
  }catch(e){setError(e instanceof Error?e.message:"Gambar gagal diunggah.")}
  finally{setBusy(false)}
 }
 return <div className="media-block-editor">
  <img className="media-editor-thumbnail" src={"/api/books/"+encodeURIComponent(bookId)+"/assets/"+encodeURIComponent(current.assetId)} alt={current.alt} loading="lazy"/>
  <details className="media-settings"><summary>Atur gambar: ukuran, posisi, padding, sudut, dan hyperlink</summary>
   <fieldset disabled={disabled||busy} className="media-settings-fields">
    <legend className="sr-only">Pengaturan gambar</legend>
    <label className="studio-field"><span>Gambar dari pustaka</span><select value={form.assetId} onChange={e=>{const asset=assets.find(a=>a.id===e.target.value);if(asset)setForm(f=>({...f,assetId:asset.id,alt:asset.altText.slice(0,180)}))}}>{!assets.some(a=>a.id===form.assetId)&&<option value={form.assetId}>Gambar saat ini</option>}{assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label className="studio-field"><span>Teks alternatif gambar</span><input value={form.alt} maxLength={180} onChange={e=>patch("alt",e.target.value)}/></label>
    <div className="media-settings-grid">
     <label className="studio-field"><span>Lebar gambar</span><input type="number" min={1} max={form.unit==="%"?100:2000} value={form.width||""} onChange={e=>patch("width",Number(e.target.value))}/></label>
     <label className="studio-field"><span>Satuan lebar</span><select value={form.unit} onChange={e=>{const unit=e.target.value as "%"|"px";setForm(f=>({...f,unit,width:unit==="%"?Math.min(f.width,100):f.width}))}}><option value="%">% kolom</option><option value="px">px</option></select></label>
     <label className="studio-field"><span>Tinggi gambar (px)</span><input type="number" min={1} max={2000} placeholder="Otomatis" value={form.height??""} onChange={e=>patch("height",e.target.value?Number(e.target.value):null)}/></label>
     <label className="studio-field"><span>Posisi gambar</span><select value={form.align} onChange={e=>patch("align",e.target.value as MediaImage["align"])}><option value="left">Kiri</option><option value="center">Tengah</option><option value="right">Kanan</option></select></label>
     <label className="studio-field"><span>Padding gambar (px)</span><input type="number" min={0} max={96} value={form.padding} onChange={e=>patch("padding",Number(e.target.value))}/></label>
     <label className="studio-field"><span>Radius sudut (px)</span><input type="number" min={0} max={128} value={form.radius} onChange={e=>patch("radius",Number(e.target.value))}/></label>
    </div>
    <label className="studio-field"><span>Hyperlink gambar (HTTPS)</span><input type="url" value={form.href} maxLength={1000} placeholder="https://..." onChange={e=>patch("href",e.target.value)}/></label>
    <p className="form-hint">Kosongkan tinggi untuk mempertahankan rasio gambar. Pengaturan diterapkan ke naskah setelah tombol berikut ditekan.</p>
    <button type="button" className="primary-button" onClick={apply}>Terapkan pengaturan gambar</button>
   </fieldset>
  </details>
  <details className="media-settings"><summary>Unggah gambar pengganti</summary>
   <div className="media-settings-fields">
    <label className="studio-field"><span>File gambar pengganti</span><input type="file" accept="image/png,image/jpeg" disabled={disabled||busy} onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
    <label className="studio-field"><span>Lisensi gambar pengganti</span><select value={license} disabled={disabled||busy} onChange={e=>setLicense(e.target.value)}><option value="OWNED">Karya sendiri</option><option value="CC0">CC0</option><option value="CC_BY">CC BY</option><option value="CC_BY_SA">CC BY-SA</option><option value="LICENSED">Berizin</option></select></label>
    <label className="studio-field"><span>URL sumber gambar pengganti (opsional)</span><input type="url" maxLength={500} placeholder="https://..." value={sourceUrl} disabled={disabled||busy} onChange={e=>setSourceUrl(e.target.value)}/></label>
    <button type="button" className="secondary-button" disabled={disabled||busy||!file} onClick={()=>void replaceImage()}>{busy?"Mengunggah...":"Unggah dan ganti gambar"}</button>
   </div>
  </details>
  {error&&<p role="alert">{error}</p>}
 </div>;
}
function VideoFields({raw,disabled,onApply}:{raw?:string;disabled:boolean;onApply:(value:string)=>void}){
 const parsed=raw?parseVideo(raw):null;
 const [title,setTitle]=useState(parsed?.title||"");
 const [url,setUrl]=useState(parsed?.url||"");
 const [layout,setLayout]=useState(parsed?.layout??defaultVideoLayout);
 const [error,setError]=useState("");
 useEffect(()=>{if(!raw)return;const item=parseVideo(raw);if(item){setTitle(item.title);setUrl(item.url);setLayout(item.layout)}},[raw]);
 return <div className="media-settings-fields">
  <label className="studio-field"><span>Judul video</span><input value={title} maxLength={180} placeholder="Video pembelajaran" disabled={disabled} onChange={e=>setTitle(e.target.value)}/></label>
  <label className="studio-field"><span>URL YouTube</span><input type="url" value={url} maxLength={1000} placeholder="https://youtu.be/..." disabled={disabled} onChange={e=>{setUrl(e.target.value);setError("")}}/></label>
  <div className="media-settings-grid">
   <label className="studio-field"><span>Lebar video</span><input type="number" min={1} max={layout.unit==="%"?100:2000} value={layout.width||""} disabled={disabled} onChange={e=>setLayout({...layout,width:Number(e.target.value)})}/></label>
   <label className="studio-field"><span>Satuan lebar video</span><select value={layout.unit} disabled={disabled} onChange={e=>{const unit=e.target.value as "%"|"px";setLayout({...layout,unit,width:unit==="%"?Math.min(layout.width,100):layout.width})}}><option value="%">% kolom</option><option value="px">px</option></select></label>
   <label className="studio-field"><span>Posisi video</span><select value={layout.align} disabled={disabled} onChange={e=>setLayout({...layout,align:e.target.value as typeof layout.align})}><option value="left">Kiri</option><option value="center">Tengah</option><option value="right">Kanan</option></select></label>
  </div>
  <p className="form-hint">Pemutar tampil di preview, HTML, dan Flipbook. PDF, DOCX, dan EPUB menyertakan tautan video.</p>
  {error&&<p role="alert">{error}</p>}
  <button type="button" className="primary-button" disabled={disabled||!url.trim()} onClick={()=>{try{onApply(videoMarkdown(title,url,layout));setError("");if(!raw){setTitle("");setUrl("");setLayout(defaultVideoLayout)}}catch(e){setError(e instanceof Error?e.message:"Tautan video tidak valid.")}}}>{raw?"Terapkan perubahan video":"Sisipkan video YouTube"}</button>
 </div>;
}
export function MediaVideoEditor({raw,disabled,onChange}:{raw:string;disabled:boolean;onChange:(value:string)=>void}){return <VideoFields raw={raw} disabled={disabled} onApply={onChange}/>}
export function InsertYouTube({disabled,onInsert}:{disabled:boolean;onInsert:(value:string)=>void}){return <details className="writing-optional media-settings"><summary>+ Sisipkan video YouTube</summary><VideoFields disabled={disabled} onApply={onInsert}/></details>}
