"use client";

import {useEffect,useState} from "react";
import PdfPagePreview from "./pdf-page-preview";

const formats=["DOCX","PDF","HTML","EPUB","Flipbook"] as const;
type Format=typeof formats[number];
type Book={id:string;title:string;status:string;chapters:{id:string;title:string;content:string}[]};
type Artifact={url:string;lines?:string[];html?:string;pdfBlob?:Blob};

async function inspectPackage(blob:Blob,format:"DOCX"|"EPUB"){
 const {default:JSZip}=await import("jszip");
 const zip=await JSZip.loadAsync(await blob.arrayBuffer());
 const parser=new DOMParser();
 const read=async(path:string)=>{
  const xml=await zip.file(path)?.async("string");
  if(!xml)throw Error("Bagian berkas tidak ditemukan: "+path);
  const doc=parser.parseFromString(xml,"application/xml");
  if(doc.querySelector("parsererror"))throw Error("Struktur XML berkas tidak valid.");
  return doc;
 };
 if(format==="DOCX"){
  const doc=await read("word/document.xml");
  return Array.from(doc.getElementsByTagNameNS("*","p"),p=>
   Array.from(p.getElementsByTagNameNS("*","t"),node=>node.textContent??"").join("")
  ).filter(Boolean);
 }
 const container=await read("META-INF/container.xml");
 const packagePath=container.getElementsByTagNameNS("*","rootfile")[0]?.getAttribute("full-path");
 if(!packagePath)throw Error("Paket EPUB tidak memiliki rootfile.");
 const opf=await read(packagePath);
 const manifest=new Map(Array.from(opf.getElementsByTagNameNS("*","item"),item=>[item.getAttribute("id"),item.getAttribute("href")]));
 const base=new URL(packagePath,"https://preview.invalid/");
 const lines:string[]=[];
 for(const item of Array.from(opf.getElementsByTagNameNS("*","itemref"))){
  const href=manifest.get(item.getAttribute("idref"));
  if(!href)continue;
  const path=decodeURIComponent(new URL(href,base).pathname.slice(1));
  const chapter=await read(path);
  const body=chapter.getElementsByTagNameNS("*","body")[0];
  if(body)lines.push(...Array.from(body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,figcaption"),node=>node.textContent?.trim()??"").filter(Boolean));
 }
 return lines;
}

export default function LayoutFormatPreview({book}:{book:Book}){
 const [format,setFormat]=useState<Format>("HTML");
 const [artifact,setArtifact]=useState<Artifact|null>(null);
 const [error,setError]=useState("");
 const [loading,setLoading]=useState(false);
 const [page,setPage]=useState(0);
 useEffect(()=>{
  if(format==="Flipbook"||!book.chapters.length)return;
  const controller=new AbortController();
  let url="";
  setLoading(true);setError("");setArtifact(null);
  (async()=>{
   try{
    const response=await fetch("/api/books/"+encodeURIComponent(book.id)+"/export?preview=1&layout=1&format="+format.toLowerCase(),{signal:controller.signal,cache:"no-store"});
    if(!response.ok)throw Error((await response.json().catch(()=>null))?.error??"Pratinjau gagal dibuat.");
    const blob=await response.blob();
    const lines=format==="DOCX"||format==="EPUB"?await inspectPackage(blob,format):undefined;
    const html=format==="HTML"?await blob.text():undefined;
    if(controller.signal.aborted)return;
    url=URL.createObjectURL(blob);
    setArtifact({url,lines,html,pdfBlob:format==="PDF"?blob:undefined});
   }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Pratinjau gagal dibuat.")}
   finally{if(!controller.signal.aborted)setLoading(false)}
  })();
  return()=>{controller.abort();if(url)URL.revokeObjectURL(url)};
 },[book.id,book.chapters,format]);
 const [approvedPages,setApprovedPages]=useState<{title:string;content:string}[]>([]);
 useEffect(()=>{
  if(format!=="Flipbook"||book.status!=="APPROVED")return;
  const controller=new AbortController();
  setApprovedPages([]);setLoading(true);setError("");
  (async()=>{
   try{
    const response=await fetch("/api/books/"+encodeURIComponent(book.id)+"/export?preview=1&layout=1&format=html",{signal:controller.signal,cache:"no-store"});
    if(!response.ok)throw Error((await response.json().catch(()=>null))?.error??"Flipbook gagal dibuat.");
    const html=new DOMParser().parseFromString(await response.text(),"text/html");
    const pages=Array.from(html.querySelectorAll("main section[id^=chapter-]"),section=>{
     const heading=section.querySelector("h2");
     const title=heading?.textContent??"";
     heading?.remove();
     return {title,content:Array.from(section.children,node=>node.textContent?.trim()??"").filter(Boolean).join("\n\n")};
    });
    if(!controller.signal.aborted)setApprovedPages(pages);
   }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"Flipbook gagal dibuat.")}
   finally{if(!controller.signal.aborted)setLoading(false)}
  })();
  return()=>controller.abort();
 },[book.id,book.status,format]);
 const flipPages=book.status==="APPROVED"?approvedPages:book.chapters;
 const chapter=flipPages[page];
 return <section className="panel layout-output" aria-labelledby="layout-output-title">
  <h2 id="layout-output-title">Pratinjau keluaran</h2>
  <p className="form-hint">Pratinjau memakai naskah tersimpan. Buku yang disetujui memakai snapshot Review dan tata letak tersimpan.</p>
  <div className="layout-format-tabs"><a className="secondary-button" href={"/studio?module="+encodeURIComponent("Tata Letak")+"&bookId="+encodeURIComponent(book.id)}>Pengaturan pagination buku</a></div>
  <div className="layout-format-tabs" aria-label="Format pratinjau">
   {formats.map(value=><button type="button" key={value} aria-pressed={format===value} className={format===value?"primary-button":"secondary-button"} onClick={()=>{setFormat(value);setPage(0);setError("");setArtifact(null);setLoading(false)}} disabled={format===value}>{value}</button>)}
  </div>
  {!book.chapters.length?<p>Tambahkan bab tersimpan untuk melihat pratinjau.</p>:format==="Flipbook"?<>
   <p className="form-hint">Simulasi baca per bab. Pagination cetak belum diterapkan.</p>
   {loading&&<p role="status">Membuat pratinjau Flipbook…</p>}
   {error&&<p role="alert">{error}</p>}
   {chapter&&<article className="layout-proof"><h3>{chapter.title}</h3><p>{chapter.content}</p></article>}
   <div className="layout-format-tabs">
    <button type="button" className="secondary-button" disabled={page===0} onClick={()=>setPage(value=>value-1)}>Sebelumnya</button>
    <span role="status">{flipPages.length?page+1:0} / {flipPages.length}</span>
    <button type="button" className="secondary-button" disabled={page>=flipPages.length-1} onClick={()=>setPage(value=>value+1)}>Berikutnya</button>
   </div>
  </>:<>
   {loading&&<p role="status">Membuat pratinjau {format}…</p>}
   {error&&<p role="alert">{error}</p>}
   {artifact&&<>
    {artifact.lines?<><p className="form-hint">Teks diekstrak dari berkas {format}. Buka berkas untuk memeriksa tipografi, gambar, dan pagination.</p>
     <article className="layout-proof">{artifact.lines.length?artifact.lines.map((line,index)=><p key={index}>{line}</p>):<p>Berkas tidak memiliki teks yang dapat ditampilkan.</p>}</article>
    </>:format==="PDF"&&artifact.pdfBlob?<PdfPagePreview blob={artifact.pdfBlob}/>:format==="HTML"&&artifact.html?<iframe className="layout-artifact-frame" title="Pratinjau HTML buku" srcDoc={artifact.html} sandbox="allow-same-origin"/>:<p role="status">Berkas tersedia untuk diunduh.</p>}
    {format==="HTML"&&<a className="secondary-button" href={artifact.url} target="_blank" rel="noopener noreferrer">Buka HTML di tab baru</a>}
    <a className="secondary-button" href={artifact.url} download={"pratinjau-draf."+format.toLowerCase()}>Unduh pratinjau {format}</a>
   </>}
  </>}
 </section>;
}
