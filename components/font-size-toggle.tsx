"use client";
import {useEffect,useState} from "react";

const key="bcstudio-font-size";
export default function FontSizeToggle(){
 const [size,setSize]=useState<"normal"|"besar">("normal");
 useEffect(()=>{
  const stored=localStorage.getItem(key)==="besar"?"besar":"normal";
  setSize(stored);
  document.documentElement.dataset.font=stored;
 },[]);
 function choose(next:"normal"|"besar"){
  setSize(next);
  localStorage.setItem(key,next);
  document.documentElement.dataset.font=next;
 }
 return <div className="font-size-toggle" role="group" aria-label="Ukuran huruf">
  <button type="button" aria-pressed={size==="normal"} onClick={()=>choose("normal")}>Normal</button>
  <button type="button" aria-pressed={size==="besar"} onClick={()=>choose("besar")}>Besar</button>
 </div>;
}
