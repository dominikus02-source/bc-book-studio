"use client";
import {useState} from "react";
import {audienceChoices,bookKinds,guidedBookInput,type AudienceId,type BookKindId} from "../lib/guided-book";

type Created={id:string;startAt?:"write"|"brief"};
export default function GuidedBookStart({onCreated}:{onCreated:(book:Created)=>void}){
 const [title,setTitle]=useState("");
 const [author,setAuthor]=useState("");
 const [language,setLanguage]=useState<"id"|"en">("id");
 const [audience,setAudience]=useState<AudienceId>("umum");
 const [kind,setKind]=useState<BookKindId>("nonfiction");
 const [subject,setSubject]=useState("");
 const [goal,setGoal]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const en=language==="en";
 async function start(){
  if(busy)return;
  setBusy(true);setError("");setNotice("");
  try{
   const input=guidedBookInput({title,author,language,audience,kind,subject,goal});
   const response=await fetch("/api/books",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...input,startWriting:true})});
   const result=await response.json();
   if(!response.ok||!result.book?.id)throw Error(result.error||(en?"The book could not be saved.":"Buku gagal disimpan."));
   if(result.startedWriting){
    setNotice(en?"Draft saved. Opening the writing studio.":"Draf tersimpan. Membuka studio penulisan.");
    onCreated({id:result.book.id,startAt:"write"});
   }else{
    setNotice(result.error||(en?"The book was saved. Continue from the project page.":"Buku tersimpan. Lanjutkan dari halaman proyek."));
    onCreated({id:result.book.id,startAt:"brief"});
   }
  }catch(e){setError(e instanceof Error?e.message:(en?"The book could not be saved.":"Buku gagal disimpan."));}
  finally{setBusy(false);}
 }
 const ready=title.trim().length>=3&&author.trim().length>=2;
 return <form className="panel guided-book-start" aria-label={en?"Start a book":"Mulai buku"} onSubmit={event=>{event.preventDefault();void start();}}>
  <p className="form-hint">{en?"START HERE":"MULAI DI SINI"}</p>
  <h2>{en?"Start a book and write the first chapter":"Mulai buku dan tulis bab pertama"}</h2>
  <p>{en?"A title, your name, and who the book is for are enough. A first chapter is created so you can write immediately. You can revise the brief later.":"Cukup judul, nama Anda, dan siapa pembacanya. Bab pertama dibuat supaya Anda langsung bisa menulis. Brief dapat dilengkapi kemudian."}</p>
  <label className="studio-field"><span>{en?"Book title *":"Judul buku *"}</span><input required minLength={3} maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder={en?"Example: Stories of the harbour":"Contoh: Cerita dari pelabuhan"}/></label>
  <label className="studio-field"><span>{en?"Author *":"Penulis *"}</span><input required minLength={2} maxLength={180} value={author} onChange={e=>setAuthor(e.target.value)} placeholder={en?"The name that should appear on the book":"Nama yang tercantum pada buku"}/></label>
  <label className="studio-field"><span>{en?"Language":"Bahasa naskah"}</span><select value={language} onChange={e=>setLanguage(e.target.value==="en"?"en":"id")}><option value="id">Indonesia (id)</option><option value="en">English (en)</option></select></label>
  <fieldset style={{border:0,padding:0,margin:0}}><legend>{en?"Who is it for?":"Untuk siapa?"}</legend><div className="studio-workflow-actions" role="group">{audienceChoices.map(item=><button type="button" key={item.id} className={audience===item.id?"primary-button":"secondary-button"} aria-pressed={audience===item.id} onClick={()=>setAudience(item.id)}>{en?item.enLabel:item.idLabel}</button>)}</div></fieldset>
  <fieldset style={{border:0,padding:0,margin:0}}><legend>{en?"Kind of book":"Jenis buku"}</legend><div className="studio-workflow-actions" role="group">{bookKinds.map(item=><button type="button" key={item.id} className={kind===item.id?"primary-button":"secondary-button"} aria-pressed={kind===item.id} onClick={()=>setKind(item.id)}>{en?item.enLabel:item.idLabel}</button>)}</div></fieldset>
  <details>
   <summary>{en?"Optional: category and purpose":"Opsional: kategori dan tujuan"}</summary>
   <label className="studio-field"><span>{en?"Category":"Kategori"}</span><input maxLength={100} value={subject} onChange={e=>setSubject(e.target.value)} placeholder={en?"Filled automatically if left blank":"Diisi otomatis bila dikosongkan"}/></label>
   <label className="studio-field"><span>{en?"Purpose, in one sentence":"Tujuan, satu kalimat"}</span><textarea rows={3} maxLength={1500} value={goal} onChange={e=>setGoal(e.target.value)} placeholder={en?"What should the reader be able to do or feel?":"Apa yang sebaiknya pembaca pahami atau rasakan?"}/></label>
  </details>
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  <button className="primary-button" type="submit" disabled={busy||!ready}>{busy?(en?"Saving…":"Menyimpan…"):(en?"Create the draft and start writing":"Buat draf dan mulai menulis")}</button>
 </form>;
}
