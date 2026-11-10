"use client";
import {useEffect,useState} from "react";
type Format={format:string;bytes:number;sha256:string};
type Manifest={title:string;chapters:number;status:string;formats:Format[];bundleAvailable:boolean;warning:string};
const label:Record<string,string>={docx:"Word (DOCX)",pdf:"PDF",epub:"Buku digital (EPUB)",html:"Halaman HTML",flipbook:"Flipbook interaktif"};
export default function DraftArtifactsPanel({bookId}:{bookId:string}){
 const [data,setData]=useState<Manifest|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  setData(null);
  void fetch("/api/books/"+encodeURIComponent(bookId)+"/draft-artifacts?type=manifest",{signal:controller.signal,cache:"no-store"})
   .then(async response=>response.ok?(await response.json()) as Manifest:null)
   .then(result=>{if(!controller.signal.aborted)setData(result)})
   .catch(()=>{if(!controller.signal.aborted)setData(null)});
  return()=>controller.abort();
 },[bookId]);
 if(!data||data.status!=="DRAFT_PREVIEW_ONLY"||data.formats.length!==5)return null;
 const base="/api/books/"+encodeURIComponent(bookId)+"/draft-artifacts?type=";
 return <details className="stage-advanced-tools" aria-label="Lima format pratinjau draf" data-testid="book-preview-artifacts">
  <summary>Unduh lima format pratinjau buku — sudah dibuat</summary>
  <p className="form-hint"><strong>DRAF — BELUM DISETUJUI.</strong> {data.chapters} bab · Lima keluaran asli sudah disimpan. Ini bukan buku final atau bukti ISBN/sertifikasi. Berkas adalah snapshot dari naskah pada saat proses ekspor QA, sehingga perubahan berikutnya perlu diekspor ulang.</p>
  <div className="ai-prompt-actions" role="group" aria-label="Unduh format pratinjau buku">
   {data.formats.map(f=><a className="secondary-button" key={f.format} download href={base+encodeURIComponent(f.format)} title={"Ukuran "+Math.ceil(f.bytes/1024)+" KB; SHA-256 "+f.sha256}>{label[f.format]||f.format.toUpperCase()} — {Math.ceil(f.bytes/1024)} KB</a>)}
  </div>
  <a className="primary-button" download href={base+"zip"}>Unduh semua format (ZIP)</a>
  <p className="form-hint">{data.warning}</p>
 </details>;
}
