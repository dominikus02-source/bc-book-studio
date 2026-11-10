"use client";
import {useCallback,useEffect,useState} from "react";
type Totals={calls:number;reportedCalls:number;unreportedCalls:number;inputTokens:number;outputTokens:number;totalTokens:number};
type Model={credentialId:string;provider:string;model:string;purpose:string;calls:number;reportedCalls:number;unreportedCalls:number;inputTokens:number;outputTokens:number;totalTokens:number};
type Day={day:string;calls:number;reportedCalls:number;inputTokens:number;outputTokens:number;totalTokens:number};
type Report={days:number;totals:Totals;models:Model[];daily:Day[];balanceAvailable:boolean;disclaimer:string};
const fmt=(x:number)=>new Intl.NumberFormat("id-ID").format(x);
export default function AiTokenDashboard(){
 const [days,setDays]=useState(30),[report,setReport]=useState<Report|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{const response=await fetch("/api/settings/usage?days="+days,{cache:"no-store"});
   const result=await response.json();if(!response.ok)throw Error(result.error||"Gagal memuat data token.");
   setReport(result);
  }catch(e){setError(e instanceof Error?e.message:"Data token tidak tersedia")}
  finally{setLoading(false)}
 },[days]);
 useEffect(()=>{void load();const handler=()=>void load();window.addEventListener("bc-provider-updated",handler);return()=>window.removeEventListener("bc-provider-updated",handler)},[load]);
 const max=Math.max(1,...(report?.daily??[]).map(item=>item.totalTokens));
 return <section className="panel ai-token-dashboard" aria-label="Dashboard penggunaan token AI">
  <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
   <div><h3 className="panel-title">Dashboard penggunaan token AI</h3><p className="panel-desc">Pemakaian yang dilaporkan API, berdasarkan model aktif saat permintaan dilakukan.</p></div>
   <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
    <label className="studio-field">Periode<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>7 hari</option><option value={30}>30 hari</option><option value={90}>90 hari</option></select></label>
    <button type="button" className="secondary-button" disabled={loading} onClick={()=>void load()}>{loading?"Memuat…":"Perbarui data"}</button>
   </div>
  </div>
  {error&&<p role="alert">{error}</p>}
  {report&&<><div className="workspace-stats" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12}}>
   <div><strong>{fmt(report.totals.inputTokens)}</strong><span>Input tokens</span></div>
   <div><strong>{fmt(report.totals.outputTokens)}</strong><span>Output tokens</span></div>
   <div><strong>{fmt(report.totals.totalTokens)}</strong><span>Total dilaporkan</span></div>
   <div><strong>{fmt(report.totals.calls)}</strong><span>Panggilan AI berhasil</span></div>
   <div><strong>{fmt(report.totals.unreportedCalls)}</strong><span>Panggilan tanpa metadata token</span></div>
  </div>
  <p className="form-hint"><strong>Saldo dan sisa kuota: tidak tersedia.</strong> {report.disclaimer}</p>
  <h4>Tren penggunaan harian</h4>
  {!report.daily.length?<p>Belum ada pemakaian tercatat pada periode ini.</p>:<div role="img" aria-label={"Histogram pemakaian token "+days+" hari"} style={{display:"flex",alignItems:"end",gap:5,overflowX:"auto",minHeight:190,padding:"16px 4px"}}>
   {report.daily.map(item=><div key={item.day} title={item.day+" · "+fmt(item.totalTokens)+" token · "+item.calls+" panggilan"} style={{display:"grid",gridTemplateRows:"1fr auto",height:168,minWidth:32,textAlign:"center",gap:4}}>
    <div style={{display:"flex",alignItems:"end",justifyContent:"center"}}><div style={{width:22,minHeight:2,height:Math.max(2,Math.round(item.totalTokens/max*134)),background:"var(--accent, #5670b6)",borderRadius:"4px 4px 0 0"}}/></div>
    <small style={{fontSize:10}}>{item.day.slice(5)}</small>
   </div>)}
  </div>}
  <h4>Rincian per provider, model, dan aktivitas</h4>
  <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><th scope="col">Provider / model</th><th scope="col">Aktivitas</th><th scope="col">Input</th><th scope="col">Output</th><th scope="col">Total</th><th scope="col">Request</th></tr></thead><tbody>{report.models.map((row,i)=><tr key={row.credentialId+"-"+row.purpose+"-"+i}><td>{row.provider}<small style={{display:"block"}}>{row.model}</small></td><td>{row.purpose}</td><td>{fmt(row.inputTokens)}</td><td>{fmt(row.outputTokens)}</td><td>{fmt(row.totalTokens)}</td><td>{fmt(row.calls)}{row.unreportedCalls>0&&<small style={{display:"block"}}>{row.unreportedCalls} tanpa token</small>}</td></tr>)}</tbody></table></div>
  </>}
 </section>
}
