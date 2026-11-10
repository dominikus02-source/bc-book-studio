"use client";

import { useEffect, useRef } from "react";

export default function LayoutEditorFrame({dark}:{dark:boolean}){
 const frame=useRef<HTMLIFrameElement>(null);
 const observer=useRef<ResizeObserver|null>(null);
 function sync(){
  const current=frame.current;
  const doc=current?.contentDocument;
  if(!current||!doc?.body)return;
  doc.documentElement.dataset.theme=dark?"dark":"light";
  observer.current?.disconnect();
  const resize=()=>{current.style.height=Math.max(400,Math.ceil(doc.body.getBoundingClientRect().height)+2)+"px"};
  observer.current=new ResizeObserver(resize);
  observer.current.observe(doc.body);
  resize();
 }
 useEffect(()=>{
  sync();
  return()=>observer.current?.disconnect();
 },[dark]);
 return <iframe ref={frame} onLoad={sync} className="layout-editor-frame" title="Prototipe Studio Tata Letak" src="/studio/layout-preview?embedded=1"/>;
}
