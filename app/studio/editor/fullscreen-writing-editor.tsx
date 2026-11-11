"use client";
import {useCallback,useEffect,useState} from "react";
import DraftBlockCanvas from "../../../components/draft-block-canvas";
import "./editor.css";

type Chapter={id:string;title:string;content:string;updatedAt:string};
type Book={id:string;title:string;description:string;subject:string;grade:string;status:string;language?:string;editorialStage?:string;isOwner?:boolean;chapters:Chapter[]};
export default function FullscreenWritingEditor({bookId,chapterId}:{bookId:string;chapterId:string}){
 const [book,setBook]=useState<Book|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(true);
 const [showComponents,setShowComponents]=useState(false);
 const refresh=useCallback(async()=>{
  try{
   const response=await fetch("/api/books",{cache:"no-store"});
   if(!response.ok)throw Error(response.status===401?"Sesi berakhir; silakan masuk kembali.":"Tidak dapat memuat buku.");
   const data=await response.json();
   const found=(data.books as Book[]).find(item=>item.id===bookId);
   if(!found)throw Error("Buku tidak ditemukan atau akses tidak diizinkan.");
   setBook(found);setError("");
  }catch(e){setError(e instanceof Error?e.message:"Gagal memuat buku.");}
  finally{setLoading(false)}
 },[bookId]);
 useEffect(()=>{void refresh()},[refresh]);
 return <main className={"fullscreen-writing-editor"+(showComponents?" has-component-library":"")}>
  <header className="fullscreen-writing-header">
   <div><strong>BC Book Studio · Editor layar penuh</strong><p>{book?.title||"Memuat naskah..."}</p></div>
   <nav aria-label="Navigasi editor">
    <button type="button" className="secondary-button" aria-expanded={showComponents} onClick={()=>setShowComponents(value=>!value)}>Komponen buku</button>
    <a className="secondary-button" href={"/studio?bookId="+encodeURIComponent(bookId)+"&module=Studio+Penulisan"}>Kembali ke Studio</a>
    <a className="secondary-button" href={"/studio/live-preview?bookId="+encodeURIComponent(bookId)+"&chapterId="+encodeURIComponent(chapterId)} target="_blank" rel="noopener noreferrer">Buka Live Preview</a>
    <button type="button" className="secondary-button" onClick={()=>{if(!document.fullscreenElement)void document.documentElement.requestFullscreen?.();else void document.exitFullscreen?.()}}>Mode fullscreen</button>
   </nav>
  </header>
  {loading?<p role="status">Memuat naskah dari database...</p>:error?<section role="alert"><p>{error}</p><button className="secondary-button" onClick={()=>void refresh()}>Coba lagi</button></section>:book?.status!=="DRAFT"||book.isOwner===false?<p role="alert">Editor hanya tersedia untuk pemilik buku berstatus draf.</p>:book?
   <div className="fullscreen-writing-content"><DraftBlockCanvas bookId={book.id} chapters={book.chapters} initialChapterId={chapterId} editorialStage={book.editorialStage} language={book.language} bookContext={`Judul buku: ${book.title}; Mata pelajaran: ${book.subject}; Kelas: ${book.grade}; Brief: ${book.description?.slice(0,3500)||""}.`} onChanged={refresh}/></div>:null}
 </main>;
}
