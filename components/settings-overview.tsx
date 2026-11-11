"use client";
import {useCallback,useEffect,useState} from "react";
import {Activity,Database,RefreshCw,ShieldCheck,AlertTriangle,Server,Gauge,ArrowUpRight,CheckCircle2,Clock3,BarChart3, Cpu, Info} from "lucide-react";

type Runtime={database:string;ai:{configured:boolean;model:string|null};orchestrator?:string;exports?:string[]};
type Usage={totals:{calls:number;reportedCalls:number;unreportedCalls:number;totalTokens:number;inputTokens:number;outputTokens:number}};
const fmt=(n:number)=>new Intl.NumberFormat("id-ID").format(n);
function SemiGauge({value,hasData}:{value:number;hasData:boolean}){
 const p=Math.max(0,Math.min(100,value)), radius=94, len=Math.PI*radius;
 return <div className="control-gauge" role="img" aria-label={hasData?`Cakupan metadata token AI ${p.toFixed(1)} persen`:"Belum ada panggilan AI tercatat"}>
 <svg viewBox="0 0 280 175" aria-hidden="true" focusable="false">
 <defs><linearGradient id="control-meter-gradient" x1="0" x2="1"><stop stopColor="#ffb867"/><stop offset=".48" stopColor="#60a5fa"/><stop offset="1" stopColor="#35d7ac"/></linearGradient></defs>
 <path className="control-gauge-track" d="M46 138 A94 94 0 0 1 234 138" pathLength="100"/>
 <path className="control-gauge-fill" d="M46 138 A94 94 0 0 1 234 138" pathLength="100" strokeDasharray={`${hasData?p:0} 100`} opacity={hasData&&p>0?1:0}/>
 <text x="140" y="111" className="control-gauge-value" textAnchor="middle">{hasData?`${p.toFixed(1)}%`:"—"}</text>
 <text x="140" y="134" className="control-gauge-sub" textAnchor="middle">{hasData?"CAKUPAN DATA":"BELUM ADA DATA"}</text>
 </svg>
 <div className="control-gauge-ends" aria-hidden="true"><span>0%</span><span>100%</span></div>
 </div>;
}
function Metric({icon,label,value,hint}:{icon:React.ReactNode;label:string;value:string;hint:string}){
 return <div className="control-metric"><span className="control-metric-icon">{icon}</span><div className="control-metric-label">{label}</div><strong className="control-metric-value">{value}</strong><small>{hint}</small></div>;
}
function Service({icon,name,detail,status,tone}:{icon:React.ReactNode;name:string;detail:string;status:string;tone:"ok"|"warn"|"neutral"}){
 return <div className="control-service"><span className="control-service-icon">{icon}</span><div className="control-service-body"><strong>{name}</strong><small>{detail}</small></div><span className={`control-service-pill ${tone}`}><span className="control-dot"/>{status}</span></div>;
}
function PaginationSettingsShortcut(){
 const [href,setHref]=useState("/studio?module="+encodeURIComponent("Tata Letak"));
 useEffect(()=>{const bookId=new URLSearchParams(window.location.search).get("bookId");setHref("/studio?module="+encodeURIComponent("Tata Letak")+(bookId?"&bookId="+encodeURIComponent(bookId):""))},[]);
 return <p className="control-aside-note">Penomoran halaman buku (pagination, pratinjau, dan riwayat) diatur di modul Tata Letak. <a href={href}>Buka Tata Letak</a></p>;
}
export default function SettingsOverview(){
 const [runtime,setRuntime]=useState<Runtime|null>(null),[usage,setUsage]=useState<Usage|null>(null);
 const [runtimeError,setRuntimeError]=useState(""),[usageError,setUsageError]=useState(""),[loading,setLoading]=useState(false),[updated,setUpdated]=useState<string|null>(null);
 const refresh=useCallback(async(signal?:AbortSignal)=>{
 setLoading(true);
 const results=await Promise.allSettled([
 fetch("/api/studio/status",{cache:"no-store",signal}).then(async x=>{if(!x.ok)throw Error("Status layanan belum dapat diakses");return x.json() as Promise<Runtime>}),
 fetch("/api/settings/usage?days=30",{cache:"no-store",signal}).then(async x=>{if(!x.ok)throw Error(x.status===403?"Hanya administrator dapat melihat telemetri AI":"Telemetri penggunaan belum tersedia");return x.json() as Promise<Usage>})
 ]);
 if(signal?.aborted)return;
 const [a,b]=results;
 if(a.status==="fulfilled"){setRuntime(a.value);setRuntimeError("")}else{setRuntime(null);setRuntimeError(a.reason instanceof Error?a.reason.message:"Tidak tersedia")}
 if(b.status==="fulfilled"){setUsage(b.value);setUsageError("")}else{setUsage(null);setUsageError(b.reason instanceof Error?b.reason.message:"Tidak tersedia")}
 setUpdated(new Date().toLocaleTimeString("id-ID"));setLoading(false);
 },[]);
 useEffect(()=>{const c=new AbortController();void refresh(c.signal);const tick=setInterval(()=>void refresh(c.signal),60000);const handler=()=>void refresh(c.signal);window.addEventListener("bc-provider-updated",handler);return()=>{c.abort();clearInterval(tick);window.removeEventListener("bc-provider-updated",handler)}},[refresh]);
 const t=usage?.totals,hasData=!!t&&t.calls>0,coverage=hasData?t!.reportedCalls/t!.calls*100:0;
 return <section className="control-root" aria-label="Ringkasan Pengaturan dan Observabilitas">
  <div className="control-header">
   <div><div className="control-eyebrow"><span className="control-live-dot"/> STUDIO CONTROL CENTER <span className="control-header-separator">/</span> OBSERVABILITAS</div><h2>Semua yang penting, dalam satu tampilan.</h2><p>Ringkasan koneksi, aktivitas AI, dan kesiapan layanan berdasarkan data aplikasi.</p></div>
   <div className="control-update"><span><Clock3 size={14}/>{updated?`Diperiksa ${updated}`:"Menunggu pemeriksaan"} · otomatis 60 dtk</span><button className="control-refresh" type="button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16} className={loading?"control-spin":""}/>{loading?"Memeriksa…":"Perbarui data"}</button></div>
  </div>
  <div className="control-layout">
   <div className="control-primary">
    <div className="control-primary-top"><span className="control-section-label"><Gauge size={18}/> Kualitas data penggunaan AI</span><span className="control-period">30 HARI TERAKHIR</span></div>
    <div className="control-hero-body">
     <div className="control-gauge-wrap"><SemiGauge value={coverage} hasData={hasData}/><div className="control-gauge-note">{usage?hasData?<><CheckCircle2 size={16}/> {fmt(t!.reportedCalls)} dari {fmt(t!.calls)} panggilan memiliki metadata token</>:<><Info size={16}/> Belum ada panggilan AI tercatat</>:<><AlertTriangle size={16}/> {usageError||"Data belum tersedia"}</>}</div></div>
     <div className="control-hero-explain"><span className="control-mini-label">APA YANG DIUKUR?</span><h3>Seberapa lengkap penggunaan AI tercatat?</h3><p>Angka ini menunjukkan proporsi permintaan AI yang memiliki metadata token. <strong>Bukan</strong> indikator kecepatan, saldo akun, atau keberhasilan model.</p><div className="control-data-source"><Database size={15}/> Sumber: tabel AiUsageEvent · API /settings/usage</div></div>
    </div>
    <div className="control-metrics"><Metric icon={<BarChart3 size={18}/>} label="Total token tercatat" value={usage?fmt(t!.totalTokens):"—"} hint="Input + output, saat dilaporkan"/><Metric icon={<ArrowUpRight size={18}/>} label="Permintaan AI" value={usage?fmt(t!.calls):"—"} hint="Panggilan berhasil yang terekam"/><Metric icon={<AlertTriangle size={18}/>} label="Tanpa metadata" value={usage?fmt(t!.unreportedCalls):"—"} hint="Tidak dihitung sebagai token nol"/></div>
   </div>
   <div className="control-aside">
    <div className="control-aside-title"><span><Activity size={18}/> Status layanan</span><small>Pemeriksaan saat ini</small></div>
    <Service icon={<Database size={19}/>} name="Database" detail={runtime?.database==="connected"?"Koneksi query berhasil":"Belum dapat diverifikasi"} status={runtime?.database==="connected"?"Terhubung":"Tidak diketahui"} tone={runtime?.database==="connected"?"ok":"warn"}/>
    <Service icon={<Cpu size={19}/>} name="Provider AI" detail={runtime?.ai?.model?`Model: ${runtime.ai.model}`:"Tidak ada model aktif terdeteksi"} status={runtime?.ai.configured?"Terkonfigurasi":"Belum siap"} tone={runtime?.ai.configured?"ok":"warn"}/>
    <Service icon={<Server size={19}/>} name="Orkestrator" detail="Status koneksi backend" status={runtime?.orchestrator==="not_connected"?"Tidak terhubung":runtime?.orchestrator||"Tidak diketahui"} tone="neutral"/>
    <Service icon={<ShieldCheck size={19}/>} name="Format ekspor" detail={runtime?.exports?.join(" · ")||"Tidak diketahui"} status="Terdaftar" tone="neutral"/>
    <div className="control-aside-note"><Info size={16}/><span>Konfigurasi provider belum berarti tes koneksi berhasil. Format tersedia belum berarti ekspor E2E lulus.</span></div>
    {runtimeError&&<p className="control-error" role="alert">{runtimeError}</p>}
   </div>
  </div>
  <PaginationSettingsShortcut/>
  <div className="control-disclaimer"><ShieldCheck size={17}/><span>Tidak ada nilai simulasi. Saldo AI, uptime, latensi, dan error rate belum ditampilkan karena belum tersedia pengukuran tervalidasi.</span></div>
 </section>;
}
