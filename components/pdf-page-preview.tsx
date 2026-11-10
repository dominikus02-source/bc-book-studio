"use client";
import {useEffect,useRef,useState} from "react";

export default function PdfPagePreview({blob}:{blob:Blob}){
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const viewerRef=useRef<HTMLDivElement>(null);
 const [page,setPage]=useState(1);
 const [total,setTotal]=useState(0);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(true);
 useEffect(()=>{setPage(1);setTotal(0);setError("");},[blob]);
 useEffect(()=>{
  let disposed=false;
  let renderTask:{cancel:()=>void;promise:Promise<unknown>}|null=null;
  let loadingTask:{destroy:()=>Promise<void>}|null=null;
  let observer:ResizeObserver|null=null;
  async function start(){
   setBusy(true);setError("");
   try{
    const pdfjs=await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc="/pdf.worker.min.mjs";
    const task=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer())});
    loadingTask=task;
    const pdf=await task.promise;
    if(disposed){await task.destroy();return;}
    setTotal(pdf.numPages);
    const render=async()=>{
     const canvas=canvasRef.current,host=viewerRef.current;
     if(!canvas||!host||disposed)return;
     renderTask?.cancel();
     const pdfPage=await pdf.getPage(Math.max(1,Math.min(pdf.numPages,page)));
     if(disposed)return;
     const base=pdfPage.getViewport({scale:1});
     const available=Math.max(240,host.clientWidth-24);
     const scale=Math.min(2,available/base.width);
     const viewport=pdfPage.getViewport({scale});
     const ratio=Math.min(2,window.devicePixelRatio||1);
     canvas.width=Math.ceil(viewport.width*ratio);
     canvas.height=Math.ceil(viewport.height*ratio);
     canvas.style.width=viewport.width+"px";
     canvas.style.height=viewport.height+"px";
     const context=canvas.getContext("2d");
     if(!context)throw Error("Kanvas PDF tidak tersedia.");
     const rendering=pdfPage.render({canvasContext:context,canvas,viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});
     renderTask=rendering;
     try{await rendering.promise}catch(e){if(!(e instanceof Error&&e.name==="RenderingCancelledException"))throw e;}
    };
    await render();
    let lastWidth=viewerRef.current?.clientWidth??0;
    observer=new ResizeObserver(()=>{
     const width=viewerRef.current?.clientWidth??0;
     if(!width||Math.abs(width-lastWidth)<2)return;
     lastWidth=width;
     void render().catch(e=>{if(!disposed)setError(String(e))});
    });
    if(viewerRef.current)observer.observe(viewerRef.current);
   }catch(e){if(!disposed)setError(e instanceof Error?e.message:"PDF tidak dapat ditampilkan.");}
   finally{if(!disposed)setBusy(false)}
  }
  void start();
  return()=>{disposed=true;observer?.disconnect();renderTask?.cancel();void loadingTask?.destroy()};
 },[blob,page]);
 return <div className="pdf-page-preview">
  <div className="pdf-page-toolbar" role="group" aria-label="Navigasi halaman PDF">
   <button type="button" className="secondary-button" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1||busy}>Halaman sebelumnya</button>
   <span role="status">Halaman {total?page:0} dari {total||"…"}</span>
   <button type="button" className="secondary-button" onClick={()=>setPage(p=>Math.min(total,p+1))} disabled={!total||page>=total||busy}>Halaman berikutnya</button>
  </div>
  {error&&<p role="alert">Pratinjau PDF: {error}. Gunakan tombol unduh untuk membuka berkas dengan pembaca PDF.</p>}
  <div ref={viewerRef} className="pdf-page-canvas"><canvas ref={canvasRef} role="img" aria-label={`Pratinjau halaman PDF ${page} dari ${total}`}/></div>
 </div>;
}
