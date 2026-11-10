"use client";

import {useEffect,useRef,useState} from "react";

type Recognition={
 lang:string;start():void;abort():void;
 onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;
 onerror:((event:{error:string})=>void)|null;
 onend:(()=>void)|null;
};
type SpeechWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
export default function AiVoiceControls({onTranscript,response,disabled=false}:{onTranscript:(text:string)=>void;response:string;disabled?:boolean}){
 const [enabled,setEnabled]=useState(false),[auto,setAuto]=useState(false),[listening,setListening]=useState(false);
 const [voice,setVoice]=useState(""),[voices,setVoices]=useState<SpeechSynthesisVoice[]>([]),[notice,setNotice]=useState("");
 const recognition=useRef<Recognition|null>(null);
 const last=useRef("");
 useEffect(()=>{
  if(!enabled||!("speechSynthesis" in window))return;
  const synth=window.speechSynthesis;
  const load=()=>setVoices(synth.getVoices());
  load();synth.addEventListener("voiceschanged",load);
  return ()=>{synth.removeEventListener("voiceschanged",load);synth.cancel()};
 },[enabled]);
 useEffect(()=>()=>recognition.current?.abort(),[]);
 useEffect(()=>{
  if(!response){last.current="";return}
  if(!enabled||!auto||last.current===response||!("speechSynthesis" in window))return;
  last.current=response;
  const synth=window.speechSynthesis;
  const selected=voices.find(item=>item.voiceURI===voice)??voices.find(item=>item.lang.toLowerCase().startsWith("id"));
  const utterance=new SpeechSynthesisUtterance(response.slice(0,2500));
  utterance.lang=selected?.lang??"id-ID";utterance.voice=selected??null;
  utterance.onerror=()=>setNotice("Audio tidak dapat diputar. Gunakan tombol Bacakan respons untuk mencoba lagi.");
  synth.cancel();synth.speak(utterance);
 },[enabled,auto,response,voice,voices]);
 function speak(text:string){
  if(!("speechSynthesis" in window)){setNotice("Browser tidak menyediakan pembacaan suara.");return}
  const selected=voices.find(item=>item.voiceURI===voice)??voices.find(item=>item.lang.toLowerCase().startsWith("id"));
  const utterance=new SpeechSynthesisUtterance(text.slice(0,2500));
  utterance.lang=selected?.lang??"id-ID";utterance.voice=selected??null;
  utterance.onerror=()=>setNotice("Audio tidak dapat diputar. Periksa perangkat keluaran.");
  window.speechSynthesis.cancel();window.speechSynthesis.speak(utterance);
 }
 function listen(){
  if(listening){recognition.current?.abort();return}
  const w=window as SpeechWindow,Engine=w.SpeechRecognition??w.webkitSpeechRecognition;
  if(!Engine){setNotice("Dikte tidak tersedia di browser ini. Ketik instruksi secara manual.");return}
  const active=new Engine();recognition.current=active;active.lang="id-ID";
  active.onend=()=>{recognition.current=null;setListening(false)};
  active.onresult=event=>{
   const transcript=event.results[0]?.[0]?.transcript?.trim();
   if(transcript){onTranscript(transcript);setNotice("Dikte ditambahkan. Periksa teks sebelum menjalankan AI.")}
  };
  active.onerror=event=>{
   if(event.error!=="aborted")setNotice(event.error==="not-allowed"?"Izinkan mikrofon di pengaturan browser untuk memakai dikte.":"Dikte gagal. Periksa mikrofon atau gunakan input teks.");
  };
  try{active.start();setListening(true);setNotice("Mendengarkan instruksi...")}catch{setNotice("Mikrofon tidak dapat dimulai.")}
 }
 return <div className="ai-voice-controls" style={{display:"grid",gap:8,minWidth:0}}>
  <label><input type="checkbox" checked={enabled} onChange={event=>{
   const next=event.target.checked;setEnabled(next);
   if(!next){recognition.current?.abort();setAuto(false);setNotice("");}
   else last.current=response;
  }}/> Aktifkan mode suara AI</label>
  {enabled&&<>
   <small>Dikte meminta izin mikrofon dari browser. Browser dapat memproses audio melalui layanan pengenalannya. Periksa keluaran speaker melalui Tes suara.</small>
   <label className="studio-field">Suara pembaca<select value={voice} onChange={event=>setVoice(event.target.value)}><option value="">Suara bawaan</option>{voices.map(item=><option key={item.voiceURI} value={item.voiceURI}>{item.name} ({item.lang})</option>)}</select></label>
   <label><input type="checkbox" checked={auto} onChange={event=>{last.current=response;setAuto(event.target.checked);if(!event.target.checked&&"speechSynthesis" in window)window.speechSynthesis.cancel()}}/> Bacakan respons baru otomatis</label>
   <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
    <button type="button" disabled={disabled&&!listening} onClick={listen}>{listening?"Hentikan mikrofon":"Dikte instruksi"}</button>
    <button type="button" onClick={()=>speak("Ini tes suara BC Book Studio.")}>Tes suara</button>
    <button type="button" disabled={!response} onClick={()=>speak(response)}>Bacakan respons</button>
    <button type="button" onClick={()=>{if("speechSynthesis" in window)window.speechSynthesis.cancel()}}>Hentikan audio</button>
   </div>
   <p role="status" aria-live="polite">{notice}</p>
  </>}
 </div>;
}
