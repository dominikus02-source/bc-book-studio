"use client";
import AiVoiceControls from "../../components/ai-voice-controls";
import ReviewerPromptTemplates from "./reviewer-prompt-templates";
import {useCallback,useEffect,useRef,useState} from "react";
import {checkpointsFor} from "../../lib/editorial";
import ReviewerTransfer from "./reviewer-transfer";
import "./reviewer.css";

type Note={id:string;reviewerId:string;content:string;category:string;severity:string;status:string;chapterId:string|null;createdAt:string;updatedAt:string};
type Book={id:string;isOwner:boolean;canReview:boolean;title:string;grade:string;subject:string;status:string;bookType:string;updatedAt:string;editorialChecks:Record<string,boolean>;reviewSubmissionMissing:string[];chapters:{id:string;title:string;content:string}[];reviewNotes:Note[];archivedNotes:Note[];assignedReviewers:{reviewerId:string;reviewer:{id:string;name:string;active:boolean;role:string}}[];reviews:{id:string;decision:string;note:string;createdAt:string}[]};
type Viewer={id:string;email:string;role:string};
type Assignment={book:Book};
type Draft={content:string;category:string;severity:string;chapterId:string;editId:string;editVersion:string;note:string;proposalId:string};
const emptyDraft:Draft={content:"",category:"CONTENT",severity:"SUGGESTION",chapterId:"",editId:"",editVersion:"",note:"",proposalId:""};
const categories:Record<string,string>={CONTENT:"Isi",FACT:"Fakta",CITATION:"Sitasi",LANGUAGE:"Bahasa",ACCESSIBILITY:"Aksesibilitas",COPYRIGHT:"Hak cipta",PEDAGOGY:"Pedagogi"};
const priorities:Record<string,string>={SUGGESTION:"Saran",MAJOR:"Mayor",CRITICAL:"Kritis"};
const statuses:Record<string,string>={DRAFT:"Persiapan review",REVIEW:"Sedang ditinjau",APPROVED:"Disetujui",OPEN:"Terbuka",RESOLVED:"Selesai",ARCHIVED:"Diarsipkan"};
async function request(path:string,init?:RequestInit){
 let r:Response;try{r=await fetch(path,{...init,credentials:"same-origin",headers:{"Content-Type":"application/json",...init?.headers},cache:"no-store"})}catch{throw Error("Koneksi terputus. Draf catatan tetap tersedia; coba kembali.")}
 const d=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(r.status===401?"Sesi berakhir. Masuk kembali untuk melanjutkan.":r.status===403?"Anda tidak berhak melakukan tindakan ini.":d.error||"Permintaan gagal. Coba kembali.");
 return d;
}
export default function ReviewerWorkspace({initialBookId="",onSelectBook,onNavigate}:{initialBookId?:string;onSelectBook?:(id:string)=>void;onNavigate?:(module:string,bookId:string)=>void}={}){
 const [items,setItems]=useState<Assignment[]>([]),[viewer,setViewer]=useState<Viewer|null>(null),[selected,setSelected]=useState(initialBookId);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [logoutBusy,setLogoutBusy]=useState(false);
 async function logout(){
  setLogoutBusy(true);
  try{await request("/api/auth/logout",{method:"POST"});window.location.assign("/");}
  catch(e){setError(e instanceof Error?e.message:"Gagal keluar. Coba lagi.");setLogoutBusy(false);}
 }
 const requestId=useRef(0);
 useEffect(()=>{setSelected(initialBookId)},[initialBookId]);
 const refresh=useCallback(async(background=false)=>{const id=++requestId.current;if(!background){setLoading(true);setError("");}try{
  const d=await request("/api/reviewer");if(id!==requestId.current)return;
  setViewer(d.viewer);setItems(d.assignments||[]);setSelected(x=>x||initialBookId||d.assignments?.[0]?.book.id||"");
 }catch(e){if(!background&&id===requestId.current)setError(e instanceof Error?e.message:"Gagal memuat")}finally{if(id===requestId.current)setLoading(false)}},[initialBookId]);
 useEffect(()=>{
  void refresh();
  const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void refresh(true);},30000);
  return()=>{window.clearInterval(timer);requestId.current++};
 },[refresh]);
 const book=items.find(x=>x.book.id===selected)?.book;
 const navigate=(module:string,id:string)=>onNavigate?onNavigate(module,id):window.location.assign("/studio?"+new URLSearchParams({module,bookId:id}));
 return <section className={"reviewer-workspace review-v2"+(!onNavigate?" reviewer-standalone":"")} aria-label="Review naskah">
  <header className="review-v2-header"><div><span className="reviewer-eyebrow">TAHAP 4 / REVIEW</span><h1>Review Naskah</h1><p>Periksa naskah, tindak lanjuti temuan, dan siapkan persetujuan.</p></div><button type="button" className="secondary-button" disabled={loading} onClick={()=>void refresh()}>Muat ulang</button></header>
  <div className="review-book-selector"><label htmlFor="review-book">Buku yang ditinjau</label><select id="review-book" value={selected} disabled={loading} onChange={e=>{setSelected(e.target.value);onSelectBook?.(e.target.value)}}>
   <option value="" disabled>Pilih buku</option>{selected&&!book&&<option value={selected}>Buku tidak tersedia</option>}{items.map(({book:b})=><option key={b.id} value={b.id}>{b.title}</option>)}
  </select><span>{viewer?.role==="EDITOR"?"Penulis":viewer?.role==="SUPERADMIN"?"Superadmin":viewer?.role==="ADMIN"?"Pengelola":"Reviewer"}</span>{!onNavigate&&<button type="button" className="secondary-button" disabled={logoutBusy} onClick={()=>void logout()}>{logoutBusy?"Keluar...":"Keluar"}</button>}</div>
  {error&&<p role="alert" className="reviewer-error">{error}</p>}
  {loading&&<p role="status" className="review-save-state">Memuat data terbaru…</p>}
  {!loading&&!book&&<div className="reviewer-panel"><h2>Buku belum tersedia</h2><p>Buka buku milik Anda atau minta pemilik menugaskan akun Anda sebagai reviewer. Buku lain tidak dipilih otomatis.</p></div>}
  {book&&<ReviewProgress book={book}/>}
  {book&&viewer&&<BookReview key={viewer.id+":"+book.id} book={book} viewer={viewer} refresh={refresh} navigate={navigate}/>}
 </section>;
}
function ReviewProgress({book}:{book:Book}){
 const latest=book.reviews.find(entry=>["submit","approve","reject"].includes(entry.decision));
 const open=book.reviewNotes.filter(note=>note.status==="OPEN").length;
 const resolved=book.reviewNotes.filter(note=>note.status==="RESOLVED").length;
 const critical=book.reviewNotes.filter(note=>note.status==="OPEN"&&["MAJOR","CRITICAL"].includes(note.severity)).length;
 const decision=book.status==="APPROVED"?"Review selesai. Naskah disetujui.":book.status==="REVIEW"?"Review sedang berjalan.":latest?.decision==="reject"?"Review selesai. Naskah dikembalikan untuk revisi.":"Naskah belum diajukan untuk review.";
 const note=latest&&latest.decision!=="submit"?latest.note.replace(/\s*\[Reviewer: [^\]]+\]$/,"").trim():"";
 return <section className="reviewer-panel review-progress" aria-label="Laporan progres reviewer">
  <h2>Laporan progres reviewer</h2>
  <div role="status" aria-live="polite">
   <strong>{decision}</strong>
   {latest&&<p><time dateTime={latest.createdAt}>{new Date(latest.createdAt).toLocaleString("id-ID")}</time>{note&&<> · {note}</>}</p>}
   <p>{open} temuan terbuka · {resolved} selesai · {critical} temuan mayor atau kritis terbuka</p>
   {book.isOwner&&book.status==="APPROVED"&&<p>Langkah berikutnya: buka Tata Letak untuk menyiapkan pratinjau.</p>}
   {book.isOwner&&book.status==="DRAFT"&&latest?.decision==="reject"&&<p>Langkah berikutnya: buka Catatan, revisi naskah, lalu ajukan kembali.</p>}
  </div>
 </section>;
}

function BookReview({book,viewer,refresh,navigate}:{book:Book;viewer:Viewer;refresh:()=>Promise<void>;navigate:(module:string,id:string)=>void}){
 const key="bc-review-draft:"+viewer.id+":"+book.id;
 const [draft,setDraft]=useState<Draft>(()=>{try{const d=JSON.parse(sessionStorage.getItem(key)||"null");return d?{...emptyDraft,...Object.fromEntries(Object.entries(d).filter(([k,v])=>k in emptyDraft&&typeof v==="string"))}:emptyDraft}catch{return emptyDraft}});
 const [draftStored,setDraftStored]=useState(false);
 const [panel,setPanel]=useState(book.isOwner&&book.status==="DRAFT"?"Persiapan":"Catatan");
 const [showForm,setShowForm]=useState(Boolean(draft.content)),[busy,setBusy]=useState(false),[error,setError]=useState(""),[info,setInfo]=useState("");
 const [search,setSearch]=useState(""),[filter,setFilter]=useState("ALL"),[chapterFilter,setChapterFilter]=useState("ALL"),[pendingArchive,setPendingArchive]=useState("");
 const [focus,setFocus]=useState("GENERAL"),[aiChapter,setAiChapter]=useState(book.chapters[0]?.id||""),[consent,setConsent]=useState(false);
 const [aiStage,setAiStage]=useState("Ide"),[aiProduct,setAiProduct]=useState("Buku");
 const [voiceInstruction,setVoiceInstruction]=useState("");
 const [ai,setAi]=useState<{suggestion:string;proposalId:string;logicalAgent:string;model:string}|null>(null);
 const formRef=useRef<HTMLTextAreaElement>(null);
 const canEdit=book.canReview&&book.status==="REVIEW";
 const set=(patch:Partial<Draft>)=>setDraft(d=>({...d,...patch}));
 useEffect(()=>{try{if(draft.content||draft.note){sessionStorage.setItem(key,JSON.stringify(draft));setDraftStored(true)}else{sessionStorage.removeItem(key);setDraftStored(false)}}catch{setDraftStored(false)}},[draft,key]);
 useEffect(()=>{if(!draft.content&&!draft.note)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=""};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn)},[draft.content,draft.note]);
 useEffect(()=>{if(showForm)formRef.current?.focus()},[showForm]);
 const reset=()=>{setDraft(d=>({...emptyDraft,note:d.note}));setShowForm(false)};
 const edit=(n:Note)=>{set({content:n.content,category:n.category,severity:n.severity,chapterId:n.chapterId||"",editId:n.id,editVersion:n.updatedAt,proposalId:""});setShowForm(true)};
 async function act(fn:()=>Promise<void>){setBusy(true);setError("");setInfo("");try{await fn();await refresh()}catch(e){setError(e instanceof Error?e.message:"Gagal menyimpan")}finally{setBusy(false)}}
 const open=book.reviewNotes.filter(n=>n.status==="OPEN"),blockers=open.filter(n=>n.severity!=="SUGGESTION");
 const list=(filter==="ARCHIVED"?book.archivedNotes:book.reviewNotes).filter(n=>(filter==="ALL"||filter==="ARCHIVED"||n.status===filter)&&(chapterFilter==="ALL"||n.chapterId===(chapterFilter==="GENERAL"?null:chapterFilter))&&[n.content,categories[n.category],priorities[n.severity]].join(" ").toLowerCase().includes(search.toLowerCase()));
 const name=(id:string)=>book.assignedReviewers.find(r=>r.reviewerId===id)?.reviewer.name||"Reviewer";
 const save=useCallback((automatic=false)=>act(async()=>{const result=await request(draft.editId?"/api/reviewer/notes/"+draft.editId:"/api/reviewer/notes",{method:draft.editId?"PATCH":"POST",body:JSON.stringify({chapterId:draft.chapterId||null,content:draft.content,category:draft.category,severity:draft.severity,...(draft.editId?{expectedVersion:draft.editVersion}:{bookId:book.id,...(draft.proposalId?{proposalId:draft.proposalId}:{})})})});setInfo(automatic?"Catatan tersimpan otomatis.":draft.editId?"Perubahan catatan disimpan.":"Catatan baru disimpan.");if(automatic){setDraft(current=>({...current,editVersion:result.note.updatedAt}));}else reset()}),[draft,book.id,refresh]);
 const storedNote=book.reviewNotes.find(note=>note.id===draft.editId);
 const changed=Boolean(storedNote&&(draft.content.trim()!==storedNote.content||draft.category!==storedNote.category||draft.severity!==storedNote.severity||draft.chapterId!==(storedNote.chapterId??"")));
 useEffect(()=>{
  if(!showForm||!canEdit||busy||error||!changed||draft.content.trim().length<3)return;
  const timer=window.setTimeout(()=>void save(true),1500);
  return ()=>window.clearTimeout(timer);
 },[showForm,canEdit,busy,error,changed,draft.content,save]);
 return <>
 <section className="reviewer-panel review-book-overview"><div><span className={"review-status review-status-"+book.status.toLowerCase()}>{statuses[book.status]}</span><h2>{book.title}</h2><p>{book.chapters.length} bab aktif · {book.assignedReviewers.length} reviewer · {book.isOwner?"Anda pemilik buku":"Anda peninjau independen"}</p></div>
 {book.isOwner&&<div className="review-actions"><button type="button" onClick={()=>navigate("Studio Penulisan",book.id)}>Kembali ke naskah</button><button type="button" disabled={book.status!=="APPROVED"} onClick={()=>navigate("Tata Letak",book.id)}>Lanjut ke Tata Letak</button></div>}
 </section>
 <div className="review-metrics"><div><strong>{open.length}</strong><span>Catatan terbuka</span></div><div><strong>{blockers.length}</strong><span>Temuan penghambat</span></div><div><strong>{book.reviewNotes.filter(n=>n.status==="RESOLVED").length}</strong><span>Sudah selesai</span></div></div>
 <div className="review-section-nav" role="navigation" aria-label="Bagian review">{[...(book.isOwner?["Persiapan"]:[]),"Catatan","Naskah","Riwayat"].map(p=><button key={p} type="button" aria-pressed={panel===p} onClick={()=>setPanel(p)}>{p}{p==="Catatan"?" ("+book.reviewNotes.length+")":""}</button>)}</div>
 {error&&<div role="alert" className="reviewer-error"><p>{error}</p><button type="button" onClick={()=>void refresh()}>Muat versi terbaru</button>{draft.editId&&<button type="button" onClick={()=>{const n=book.reviewNotes.find(n=>n.id===draft.editId);if(n&&confirm("Ganti draf lokal dengan catatan terbaru dari server?"))edit(n)}}>Gunakan versi server</button>}</div>}
 {info&&<p role="status" className="review-feedback">{info}</p>}
 {panel==="Persiapan"&&book.isOwner&&<ReviewPreparation book={book} busy={busy} act={act} setInfo={setInfo}/>}
 {panel==="Naskah"&&<section className="reviewer-panel"><h3>Naskah dan daftar isi</h3>{!book.chapters.length&&<p>Belum ada bab. Lengkapi Ide dan Rancang, lalu tulis isi naskah.</p>}{book.chapters.map((c,i)=><details key={c.id} className="reviewer-chapter"><summary>{i+1}. {c.title}</summary><article className="reviewer-chapter-content">{c.content}</article></details>)}</section>}
 {panel==="Catatan"&&<>
 <ReviewerPromptTemplates onSelection={(stage,product)=>{setAiStage(stage);setAiProduct(product)}}/>
 <section className="reviewer-panel"><div className="reviewer-panel-heading"><h3>Catatan pemeriksaan</h3><button type="button" className="reviewer-primary" disabled={busy||!canEdit} onClick={()=>{if(draft.content&&!confirm("Ganti draf yang belum disimpan?"))return;reset();setShowForm(true)}}>+ Tambah catatan</button></div>
 <p className="reviewer-help">{book.isOwner?"Masukan reviewer tampil di sini. Penulis memperbaiki naskah setelah dikembalikan ke draf; keputusan tetap oleh peninjau independen.":canEdit?"Kelola catatan Anda. Temuan mayor dan kritis yang terbuka menghalangi persetujuan.":"Review belum dibuka atau sudah selesai. Catatan tetap dapat dibaca."}</p>
 <div className="reviewer-filter"><label>Cari catatan<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari temuan"/></label><label>Status<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">Semua aktif</option><option value="OPEN">Terbuka</option><option value="RESOLVED">Selesai</option><option value="ARCHIVED">Arsip ({book.archivedNotes.length})</option></select></label><label>Bab<select value={chapterFilter} onChange={e=>setChapterFilter(e.target.value)}><option value="ALL">Semua bab</option><option value="GENERAL">Seluruh buku</option>{book.chapters.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label></div>
 {list.length===0&&<div className="reviewer-empty"><strong>Belum ada catatan{filter==="ARCHIVED"?" di arsip":""}</strong><p>{canEdit?"Tambahkan temuan beserta lokasi dan saran perbaikannya.":"Catatan akan muncul setelah reviewer melakukan pemeriksaan."}</p></div>}
 {list.map(n=><article key={n.id} className={"reviewer-note-card severity-"+n.severity.toLowerCase()}><div className="review-note-heading"><strong>{categories[n.category]||n.category} · {priorities[n.severity]||n.severity} · {statuses[n.status]}</strong><span>{name(n.reviewerId)}</span></div><small className="reviewer-note-chapter">{n.chapterId?book.chapters.find(c=>c.id===n.chapterId)?.title||"Bab diarsipkan":"Seluruh buku"} · {new Date(n.updatedAt).toLocaleString("id-ID")}</small><p className="review-note-text">{n.content}</p>
 {n.reviewerId===viewer.id&&<div className="review-actions">{n.status==="ARCHIVED"?<button disabled={busy||!canEdit} onClick={()=>void act(async()=>{await request("/api/reviewer/notes/"+n.id,{method:"PATCH",body:JSON.stringify({restore:true,expectedVersion:n.updatedAt})});setInfo("Catatan dipulihkan sebagai temuan terbuka.")})}>Pulihkan catatan</button>:<><button disabled={busy||!canEdit} onClick={()=>edit(n)}>Ubah</button><button disabled={busy||!canEdit} onClick={()=>void act(async()=>{await request("/api/reviewer/notes/"+n.id,{method:"PATCH",body:JSON.stringify({status:n.status==="OPEN"?"RESOLVED":"OPEN",expectedVersion:n.updatedAt})});setInfo(n.status==="OPEN"?"Catatan ditandai selesai.":"Catatan dibuka kembali.")})}>{n.status==="OPEN"?"Tandai selesai":"Buka kembali"}</button><button disabled={busy||!canEdit} onClick={()=>setPendingArchive(n.id)}>Arsipkan</button></>}</div>}
 {pendingArchive===n.id&&<div className="reviewer-confirm-delete"><p>Arsipkan catatan ini? Isi dan riwayat tetap tersimpan dan dapat dipulihkan selama review terbuka.</p><button disabled={busy} onClick={()=>void act(async()=>{await request("/api/reviewer/notes/"+n.id,{method:"DELETE",body:JSON.stringify({expectedVersion:n.updatedAt})});setPendingArchive("");setInfo("Catatan diarsipkan.")})}>Ya, arsipkan</button><button disabled={busy} onClick={()=>setPendingArchive("")}>Batal</button></div>}</article>)}
 </section>
 {showForm&&<form className="reviewer-panel reviewer-edit-form" onSubmit={e=>{e.preventDefault();void save()}}><h3>{draft.editId?"Ubah catatan":"Tambah catatan"}</h3><fieldset disabled={busy||!canEdit} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="review-form-grid"><label>Bab<select value={draft.chapterId} onChange={e=>set({chapterId:e.target.value})}><option value="">Seluruh buku</option>{book.chapters.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Kategori<select value={draft.category} onChange={e=>set({category:e.target.value})}>{Object.entries(categories).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Prioritas<select value={draft.severity} onChange={e=>set({severity:e.target.value})}>{Object.entries(priorities).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div>
 <label className="review-full-field">Isi catatan reviewer<textarea ref={formRef} value={draft.content} maxLength={10000} onChange={e=>set({content:e.target.value})} placeholder="Tuliskan lokasi, temuan, bukti, dan saran perbaikan."/></label><p className="review-save-state" role="status">{busy?"Menyimpan…":draft.editId&&!changed?"Catatan tersimpan di database.":draftStored?"Draf tersimpan di tab ini; belum dikirim ke database.":"Belum ada perubahan tersimpan."} {draft.content.length}/10.000</p>
 <div className="review-actions"><button className="reviewer-primary" disabled={busy||!canEdit||draft.content.trim().length<3}>{draft.editId?"Simpan perubahan":"Tambah catatan"}</button><button type="button" disabled={busy} onClick={()=>{if(!draft.content||confirm("Buang draf catatan yang belum disimpan?"))reset()}}>Batalkan draf</button></div></fieldset></form>}
 {book.canReview&&<details className="reviewer-panel review-assistance"><summary>Bantu saya meninjau</summary><p>Pilih satu bab. AI memberi usulan; Anda memeriksa dan menyimpannya sebagai catatan.</p><div className="review-form-grid"><label>Bab untuk AI<select value={aiChapter} onChange={e=>{setAiChapter(e.target.value);setConsent(false)}}>{book.chapters.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Fokus audit<select value={focus} onChange={e=>setFocus(e.target.value)}>{[["GENERAL","Pemeriksaan umum"],["FACT","Akurasi fakta"],["PEDAGOGY","Pedagogi"],["LANGUAGE","Bahasa"],["ACCESSIBILITY","Aksesibilitas"],["COPYRIGHT","Hak cipta"]].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div>
 <p className="reviewer-help">Peran: {focus==="LANGUAGE"?"Penyunting Bahasa":focus==="PEDAGOGY"?"Penelaah Pedagogis":"Penjamin Mutu"}. Memakai model aktif di Pengaturan; bukan agen yang berjalan terus-menerus.</p>
 <label className="review-check"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Saya setuju mengirim bab terpilih ke provider AI aktif. Pemakaian dapat dikenakan biaya provider.</span></label><button className="reviewer-primary" disabled={busy||!canEdit||!consent||!aiChapter} onClick={()=>void act(async()=>{const d=await request("/api/reviewer/ai",{method:"POST",body:JSON.stringify({bookId:book.id,chapterId:aiChapter,focus,stage:aiStage,product:aiProduct,confirmed:true,instruction:voiceInstruction.trim()})});setAi(d)})}>Analisis dengan AI</button>
 <label>Instruksi tambahan AI<textarea rows={2} maxLength={1000} value={voiceInstruction} onChange={event=>setVoiceInstruction(event.target.value)}/></label>
 <AiVoiceControls disabled={busy||!canEdit} onTranscript={text=>setVoiceInstruction(value=>(value+" "+text).trim().slice(0,1000))} response={ai?.suggestion??""}/>
 {ai&&<div className="review-ai-result"><p>{ai.logicalAgent} · {ai.model} · Usulan, belum menjadi catatan</p><textarea aria-label="Saran AI" readOnly value={ai.suggestion}/><button disabled={busy||!canEdit} onClick={()=>{if(draft.content&&!confirm("Ganti draf catatan dengan usulan AI?"))return;setDraft({...emptyDraft,note:draft.note,content:ai.suggestion.slice(0,10000),chapterId:aiChapter,proposalId:ai.proposalId});setShowForm(true)}}>Gunakan sebagai draf catatan</button></div>}
 <details><summary>Impor atau unduh template review</summary><ReviewerTransfer book={book} draft={draft} onApply={d=>{if(draft.content&&!confirm("Ganti draf catatan dengan hasil impor?"))return;setDraft({...emptyDraft,note:draft.note,...d});setShowForm(true)}}/></details></details>}
 {book.canReview&&<section className="reviewer-panel"><h3>Keputusan editorial</h3><p>{book.status==="APPROVED"?"Naskah telah disetujui. Pemilik buku dapat melanjutkan Tata Letak.":"Keputusan Anda dicatat dalam riwayat dan berlaku untuk buku ini."}</p>{blockers.length>0&&<p className="reviewer-error" role="status">{blockers.length} temuan mayor/kritis masih terbuka, termasuk temuan reviewer lain.</p>}<label className="review-full-field">Catatan keputusan<textarea value={draft.note} maxLength={2000} disabled={!canEdit||busy} onChange={e=>set({note:e.target.value})}/></label><div className="review-actions">{[["approve","Setujui buku"],["reject","Kembalikan untuk revisi"]].map(([action,label])=><button key={action} disabled={busy||!canEdit||!draft.note.trim()||(action==="approve"&&blockers.length>0)} onClick={()=>{if(confirm(label+" setelah pemeriksaan independen?"))void act(async()=>{await request("/api/books/"+book.id+"/review",{method:"POST",body:JSON.stringify({action,note:draft.note})});set({note:""});setInfo(action==="approve"?"Buku disetujui.":"Buku dikembalikan untuk revisi.")})}}>{label}</button>)}</div></section>}
 </>}
 {panel==="Riwayat"&&<section className="reviewer-panel"><h3>Riwayat review</h3><p>Keputusan dan aktivitas tersimpan sebagai jejak audit. Riwayat tidak dapat dihapus.</p>{book.reviews.filter(r=>["submit","approve","reject"].includes(r.decision)||r.decision.startsWith("note:")||r.decision.startsWith("reviewer:")||r.decision.startsWith("ai:")).map(r=><div className="review-history-item" key={r.id}><strong>{({"submit":"Naskah diajukan","approve":"Naskah disetujui","reject":"Dikembalikan untuk revisi","note:create":"Catatan ditambahkan","note:update":"Catatan diperbarui","note:remove":"Catatan diarsipkan","note:restore":"Catatan dipulihkan","reviewer:assign":"Reviewer ditugaskan","reviewer:remove":"Penugasan dicabut","ai:proposal":"Usulan AI dibuat","ai:accepted":"Usulan AI disimpan sebagai catatan"} as Record<string,string>)[r.decision]||"Aktivitas review"}<small>{new Date(r.createdAt).toLocaleString("id-ID")}</small></strong>{["approve","reject"].includes(r.decision)&&<p>{r.note.replace(/ \[Reviewer: [^\]]+\]$/,"")}</p>}</div>)}</section>}
 </>;
}
function ReviewPreparation({book,busy,act,setInfo}:{book:Book;busy:boolean;act:(f:()=>Promise<void>)=>Promise<void>;setInfo:(s:string)=>void}){
 const [reviewers,setReviewers]=useState<{reviewers:{reviewerId:string;name:string;email:string}[];available:{id:string;name:string;email:string;assigned:boolean}[]}|null>(null);
 const [selected,setSelected]=useState(""),[error,setError]=useState("");
 const load=useCallback(async()=>{try{setError("");setReviewers(await request("/api/books/"+book.id+"/reviewers"))}catch(e){setError(e instanceof Error?e.message:"Gagal memuat peninjau")}},[book.id]);
 useEffect(()=>{void load()},[load,book.updatedAt]);
 const editable=book.status==="DRAFT";
 const missing=book.reviewSubmissionMissing;
 return <section className="reviewer-panel review-preparation"><h3>Siapkan peninjauan</h3><p>Periksa checklist berdasarkan naskah nyata, pilih reviewer independen, lalu ajukan.</p>
 <div className="review-preparation-grid"><div><h4>1. Checklist editorial</h4>{checkpointsFor(book.bookType).map(item=><label className="review-check" key={item.key}><input type="checkbox" checked={Boolean(book.editorialChecks?.[item.key])} disabled={busy||!editable} onChange={e=>{const checked=e.target.checked;void act(async()=>{await request("/api/books/"+book.id,{method:"PATCH",body:JSON.stringify({expectedVersion:book.updatedAt,editorialChecks:{...Object.fromEntries(Object.entries(book.editorialChecks||{}).map(([k,v])=>[k,Boolean(v)])),[item.key]:checked}})});setInfo("Checklist tersimpan di database.")})}}/><span>{item.label}</span></label>)}</div>
 <div><h4>2. Reviewer independen</h4>{error&&<p role="alert">{error}<button onClick={()=>void load()}>Coba kembali</button></p>}{!reviewers&&!error&&<p role="status">Memuat peninjau…</p>}{reviewers?.reviewers.map(r=><div className="review-assignee" key={r.reviewerId}><span><strong>{r.name}</strong><small>{r.email}</small></span><button type="button" disabled={busy||!editable} aria-label={"Cabut penugasan "+r.name} onClick={()=>{if(confirm("Cabut penugasan "+r.name+"? Riwayat tetap disimpan."))void act(async()=>{await request("/api/books/"+book.id+"/reviewers",{method:"DELETE",body:JSON.stringify({reviewerId:r.reviewerId})});await load();setInfo("Penugasan dicabut.")})}}>Cabut</button></div>)}
 {editable&&<><label className="review-full-field">Tambah reviewer<select value={selected} disabled={busy||!reviewers} onChange={e=>setSelected(e.target.value)}><option value="">Pilih peninjau aktif</option>{reviewers?.available.filter(r=>!r.assigned).map(r=><option key={r.id} value={r.email}>{r.name} — {r.email}</option>)}</select></label><button type="button" disabled={busy||!selected} onClick={()=>void act(async()=>{await request("/api/books/"+book.id+"/reviewers",{method:"POST",body:JSON.stringify({email:selected})});setSelected("");await load();setInfo("Reviewer berhasil ditugaskan.")})}>Tugaskan reviewer</button></>}
 </div></div>
 <div className="review-readiness"><h4>3. Ajukan naskah</h4>{editable?(missing.length?<><p>Masih perlu dilengkapi:</p><ul>{missing.map((m,i)=><li key={i}>{m}</li>)}</ul></>:<p>Persiapan lengkap. Naskah dapat diajukan untuk pemeriksaan independen.</p>):<p>{book.status==="REVIEW"?"Naskah sedang ditinjau. Checklist dan penugasan terkunci hingga reviewer memberikan keputusan.":"Naskah sudah disetujui; lanjutkan ke Tata Letak."}</p>}
 {editable&&<button type="button" className="reviewer-primary" disabled={busy||missing.length>0} onClick={()=>{if(confirm("Ajukan naskah kepada reviewer? Penyuntingan dikunci selama review."))void act(async()=>{await request("/api/books/"+book.id+"/review",{method:"POST",body:JSON.stringify({action:"submit"})});setInfo("Naskah berhasil diajukan kepada reviewer.")})}}>Ajukan tinjauan</button>}</div>
 </section>;
}
