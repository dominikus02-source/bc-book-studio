"use client";
import {useCallback,useEffect,useState} from "react";
type Check={kind:string;label:string;status:string;requiredBeforePublish:boolean;satisfied:boolean;reason:string;validator:string|null;expectedProof:string|null;evidenceId:string|null};
type Format={format:string;validator:string;proof:string;implemented:boolean;evidence:Check|undefined};
type Readiness={decision:string;genre:{name:string;type:string}|null;problems:string[];checks:Check[];formats:Format[];suggestions:string[];historicalEvidenceCount:number;approvedAt:string|null;layoutVersion:number};
type Evidence={id:string;kind:string;status:string;actorId:string;approvedAt:string;layoutVersion:number;createdAt:string;note:string;referenceUrl:string|null;isbn:string|null;checksum:string|null;validator:string|null;validatorVersion:string|null;artifactBytes:number|null};
type Result={readiness:Readiness;history:Evidence[];permissions:{canSubmit:boolean;canReview:boolean}};
const base="Simpan catatan bukti yang dapat diperiksa, sesuai genre dan format. Semua isian dapat diubah sebelum diajukan. Jangan menyatakan sertifikasi/ISBN resmi tanpa dokumen terverifikasi.";
export default function PublishingReadinessPanel({bookId,onReadyChange}:{bookId:string;onReadyChange?:(bookId:string,ready:boolean)=>void}){
 const [data,setData]=useState<Result|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [kind,setKind]=useState("RIGHTS"),[status,setStatus]=useState("SUBMITTED"),[referenceUrl,setReferenceUrl]=useState(""),[isbn,setIsbn]=useState(""),[checksum,setChecksum]=useState(""),[validator,setValidator]=useState(""),[validatorVersion,setValidatorVersion]=useState(""),[artifactBytes,setArtifactBytes]=useState(""),[note,setNote]=useState("");
 const [reviewId,setReviewId]=useState("");
 const path="/api/books/"+encodeURIComponent(bookId)+"/publishing-readiness";
 const load=useCallback(async(signal?:AbortSignal)=>{
  const response=await fetch(path,{cache:"no-store",signal});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(body.error||"Kesiapan penerbitan tidak dapat dimuat.");
  return body as Result;
 },[path]);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  setLoading(true);setData(null);onReadyChange?.(bookId,false);
  void load(controller.signal).then(result=>{if(active){setData(result);setLoading(false);onReadyChange?.(bookId,result.readiness.decision!=="NO_GO")}}).catch(e=>{if(active&&e.name!=="AbortError"){setError(e.message);setLoading(false);onReadyChange?.(bookId,false)}});
  return()=>{active=false;controller.abort()};
 },[load,onReadyChange]);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(!data?.readiness.approvedAt)return;
  setError("");setNotice("");setBusy(true);
  const payload={kind,status:data.permissions.canReview?status:"SUBMITTED",snapshot:data.readiness.approvedAt,layoutVersion:data.readiness.layoutVersion,note,
   ...(referenceUrl.trim()?{referenceUrl:referenceUrl.trim()}:{}),...(isbn.trim()?{isbn:isbn.trim()}:{}),
   ...(checksum.trim()?{checksum:checksum.trim()}:{}),...(validator.trim()?{validator:validator.trim()}:{}),
   ...(validatorVersion.trim()?{validatorVersion:validatorVersion.trim()}:{}),...(artifactBytes.trim()?{artifactBytes:Number(artifactBytes)}:{}),
   ...(data.permissions.canReview?{reviewedSubmissionId:reviewId}:{})};
  try{
   const response=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(result.error||"Bukti gagal diajukan.");
   const updated=await load();setData(updated);onReadyChange?.(bookId,updated.readiness.decision!=="NO_GO");
   setNotice("Catatan bukti tercatat. "+(payload.status==="SUBMITTED"?"Menunggu pemeriksaan ADMIN independen.":"Hasil pemeriksaan telah masuk riwayat."));
   setNote("");
  }catch(e){setError(e instanceof Error?e.message:"Tidak dapat menyimpan bukti.");onReadyChange?.(bookId,false)}finally{setBusy(false)}
 }
 const proofSubmissions=data?.history.filter(row=>row.kind===kind&&row.status==="SUBMITTED"&&row.approvedAt===data.readiness.approvedAt&&row.layoutVersion===data.readiness.layoutVersion)??[];
 const requiredChecks=data?.readiness.checks.filter(check=>check.requiredBeforePublish)??[];
 const verifiedChecks=requiredChecks.filter(check=>check.satisfied).length;
 const missingChecks=requiredChecks.filter(check=>!check.satisfied);
 return <section className="publishing-evidence-panel" aria-labelledby="publisher-readiness-title">
  <h4 id="publisher-readiness-title">Pemeriksaan bukti penerbitan</h4>
  <p className="form-hint">Status terikat pada snapshot naskah dan versi tata letak. Nomor ISBN valid secara matematis belum membuktikan penetapan resmi. Pemeriksaan mesin dan persetujuan manusia harus dicatat secara terpisah.</p>
  {loading&&<p role="status">Memuat pemeriksaan penerbitan…</p>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {data&&<>
   <p role="status"><strong>{data.readiness.decision==="NO_GO"?"BELUM SIAP DITERBITKAN (NO-GO)":"Bukti telah ditinjau; tetap memerlukan konfirmasi akhir"}</strong> · Genre: {data.readiness.genre?.name||"Belum valid"} · Versi tata letak {data.readiness.layoutVersion} · Bukti lama yang tidak berlaku: {data.readiness.historicalEvidenceCount}</p>
   <div className="publisher-evidence-progress" role="group" aria-label="Progres bukti penerbitan"><p><strong>{verifiedChecks} dari {requiredChecks.length} gerbang wajib telah ditinjau</strong> — {missingChecks.length} belum lengkap. Angka ini adalah kelengkapan bukti, bukan persentase kesiapan produksi.</p><progress value={verifiedChecks} max={Math.max(requiredChecks.length,1)} aria-label="Gerbang wajib yang telah diverifikasi" /><details><summary>Daftar persyaratan yang masih menghalangi penerbitan ({missingChecks.length})</summary><ul>{missingChecks.map(check=><li key={check.kind}><strong>{check.label}</strong>: {check.reason}</li>)}</ul></details></div>
   {data.readiness.problems.length>0&&<ul aria-label="Masalah dasar penerbitan">{data.readiness.problems.map((problem,i)=><li key={i}>{problem}</li>)}</ul>}
   <div className="publisher-evidence-grid" role="list" aria-label="Matriks bukti dan lima format">
    {data.readiness.checks.map(item=><div className={"publisher-evidence-item "+(item.satisfied?"publisher-evidence-reviewed":"publisher-evidence-missing")} key={item.kind} role="listitem"><strong>{item.label}</strong><span>{item.satisfied?"Bukti ditinjau":item.requiredBeforePublish?"Belum lengkap":"Diperlukan setelah terbit"}</span><small>{item.reason}</small>{item.validator&&<small>Validator: {item.validator}</small>}</div>)}
   </div>
   <details className="stage-advanced-tools"><summary>Saran isian otomatis sesuai genre, standar, dan format</summary><ol>{data.readiness.suggestions.map((suggestion,i)=><li key={i}>{suggestion}</li>)}</ol><p className="form-hint">Sumber resmi: <a href="https://isbn.perpusnas.go.id/landing_page/home" target="_blank" rel="noopener noreferrer">Perpusnas ISBN</a>, <a href="https://www.w3.org/TR/epub-a11y/" target="_blank" rel="noopener noreferrer">EPUB Accessibility</a>, dan <a href="https://github.com/w3c/epubcheck" target="_blank" rel="noopener noreferrer">EPUBCheck</a>.</p></details>
   <details className="stage-advanced-tools"><summary>Persyaratan validator untuk DOCX, PDF, EPUB, HTML, dan Flipbook</summary><ul>{data.readiness.formats.map(format=><li key={format.format}><strong>{format.format}</strong> · {format.implemented?"Implementasi dasar tersedia; validasi akhir belum otomatis dijamin.":"Belum tersedia sebagai keluaran tervalidasi."} {format.proof}</li>)}</ul></details>
   {(data.permissions.canSubmit||data.permissions.canReview)&&<details className="stage-advanced-tools"><summary>{data.permissions.canReview?"Tinjau pengajuan bukti (ADMIN independen)":"Ajukan bukti penerbitan untuk ditinjau"}</summary>
    <form onSubmit={e=>void submit(e)} className="publisher-evidence-form">
     <label className="studio-field"><span>Jenis bukti</span><select value={kind} disabled={busy} onChange={e=>{setKind(e.target.value);setReviewId("")}}>{data.readiness.checks.map(c=><option key={c.kind} value={c.kind}>{c.label}</option>)}</select></label>
     {data.permissions.canReview&&<><label className="studio-field"><span>Keputusan</span><select value={status} disabled={busy} onChange={e=>setStatus(e.target.value)}><option value="VERIFIED">Bukti ditinjau</option><option value="REJECTED">Bukti ditolak</option>{kind==="ISBN"&&<option value="NOT_APPLICABLE">ISBN dinyatakan tidak berlaku untuk edisi ini</option>}</select></label><label className="studio-field"><span>Pengajuan pemilik yang ditinjau</span><select value={reviewId} required disabled={busy} onChange={e=>setReviewId(e.target.value)}><option value="">Pilih pengajuan</option>{proofSubmissions.map(row=><option key={row.id} value={row.id}>{row.id} · {new Date(row.createdAt).toLocaleString("id-ID")}</option>)}</select></label></>}
     <label className="studio-field"><span>URL bukti HTTPS (jika ada)</span><input type="url" value={referenceUrl} disabled={busy} placeholder="https://..." onChange={e=>setReferenceUrl(e.target.value)} maxLength={2000}/></label>
     {kind==="ISBN"&&<label className="studio-field"><span>ISBN-13 yang telah diterbitkan (jika ada)</span><input value={isbn} disabled={busy} onChange={e=>setIsbn(e.target.value)} maxLength={40}/></label>}
     {kind.startsWith("FORMAT_")&&<><label className="studio-field"><span>SHA-256 artefak (64 karakter heksadesimal)</span><input value={checksum} disabled={busy} onChange={e=>setChecksum(e.target.value)} maxLength={64}/></label><label className="studio-field"><span>Nama validator yang dijalankan</span><input value={validator} disabled={busy} onChange={e=>setValidator(e.target.value)} maxLength={120}/></label><label className="studio-field"><span>Versi validator</span><input value={validatorVersion} disabled={busy} onChange={e=>setValidatorVersion(e.target.value)} maxLength={100}/></label><label className="studio-field"><span>Ukuran artefak (byte)</span><input type="number" min="1" value={artifactBytes} disabled={busy} onChange={e=>setArtifactBytes(e.target.value)}/></label></>}
     <label className="studio-field"><span>Uraian bukti dan pemeriksaan manusia</span><textarea value={note} required minLength={12} maxLength={4000} rows={4} disabled={busy} onChange={e=>setNote(e.target.value)} placeholder={base}/></label>
     <button type="submit" className="primary-button" disabled={busy||!data.readiness.approvedAt||!note.trim()||(data.permissions.canReview&&!reviewId)}>{busy?"Menyimpan…":data.permissions.canReview?"Catat hasil pemeriksaan":"Ajukan bukti"}</button>
    </form>
   </details>}
   <details className="stage-advanced-tools"><summary>Riwayat bukti yang tidak dapat ditimpa ({data.history.length})</summary>{data.history.length===0?<p>Belum ada bukti yang diajukan.</p>:<ol>{data.history.slice(0,40).map(row=><li key={row.id}>{row.kind} · {row.status} · {new Date(row.createdAt).toLocaleString("id-ID")} · versi {row.layoutVersion} · {row.note.slice(0,140)}</li>)}</ol>}</details>
  </>}
 </section>;
}
