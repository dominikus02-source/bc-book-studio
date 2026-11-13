"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {ASSIGNABLE_ROLES, accountDeactivateError, accountMutationError, type AccountActor} from "@/lib/account-admin";
type Role="EDITOR"|"REVIEWER"|"ADMIN"|"SUPERADMIN";
type User={id:string;email:string;name:string;role:Role;active:boolean;updatedAt?:string};
const roles=ASSIGNABLE_ROLES;
async function request(url:string,options?:RequestInit){
 const r=await fetch(url,{cache:"no-store",...options});
 const j=await r.json().catch(()=>({error:"Server mengirim respons tidak valid. Coba lagi."}));
 if(!r.ok)throw Error(j.error||"Permintaan gagal ("+r.status+").");
 return j;
}
export default function AccountManagement(){
 const [me,setMe]=useState<AccountActor|null>(null);
 const [users,setUsers]=useState<User[]>([]),[drafts,setDrafts]=useState<Record<string,User>>({});
 const [status,setStatus]=useState<Record<string,string>>({}),[saving,setSaving]=useState<Record<string,boolean>>({});
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true);
 const [query,setQuery]=useState(""),[roleFilter,setRoleFilter]=useState("ALL"),[activeFilter,setActiveFilter]=useState("ALL");
 const [newUser,setNewUser]=useState({email:"",name:"",role:"EDITOR" as Role}),[busy,setBusy]=useState(false);
 const timers=useRef<Record<string,ReturnType<typeof setTimeout>>>({});
 const pending=useRef(new Set<string>());
 const load=useCallback(async()=>{
  const j=await request("/api/admin/users");
  setMe(j.me);setUsers(j.users);setDrafts(Object.fromEntries((j.users as User[]).map(u=>[u.id,u])));
 },[]);
 useEffect(()=>{void load().catch(e=>setError(e.message)).finally(()=>setLoading(false));
  const warn=(e:BeforeUnloadEvent)=>{if(pending.current.size){e.preventDefault();e.returnValue="";}};
  window.addEventListener("beforeunload",warn);
  return()=>{window.removeEventListener("beforeunload",warn);Object.values(timers.current).forEach(clearTimeout)};
 },[load]);
 async function save(id:string,next:User){
  setSaving(s=>({...s,[id]:true}));setStatus(s=>({...s,[id]:"Menyimpan…"}));
  try{
   const j=await request("/api/admin/users",{method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id,name:next.name,email:next.email,role:next.role,active:next.active,expectedVersion:next.updatedAt})});
   setUsers(us=>us.map(u=>u.id===id?{...u,...j.user}:u));setDrafts(ds=>({...ds,[id]:{...next,...j.user}}));
   pending.current.delete(id);setStatus(s=>({...s,[id]:"Tersimpan otomatis"}));
  }catch(e){setStatus(s=>({...s,[id]:e instanceof Error?e.message:"Gagal menyimpan. Coba lagi."}));}
  finally{setSaving(s=>({...s,[id]:false}));}
 }
 function edit(id:string,changes:Partial<User>){
  const next={...drafts[id],...changes};setDrafts(d=>({...d,[id]:next}));pending.current.add(id);
  setStatus(s=>({...s,[id]:"Menunggu autosave…"}));clearTimeout(timers.current[id]);
  timers.current[id]=setTimeout(()=>void save(id,next),800);
 }
 function restore(id:string){
  clearTimeout(timers.current[id]);pending.current.delete(id);
  const saved=users.find(u=>u.id===id);if(saved)setDrafts(d=>({...d,[id]:saved}));
  setStatus(s=>({...s,[id]:"Perubahan formulir dibatalkan"}));
 }
 async function recovery(u:User){
  const action=u.active?"reset":"activate";
  if(!window.confirm((u.active?"Kirim tautan reset password":"Kirim ulang aktivasi")+" ke "+u.email+"?"))return;
  setSaving(s=>({...s,[u.id]:true}));setError("");setNotice("");
  try{const j=await request("/api/admin/users/recovery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:u.id,action})});setNotice(u.email+": "+j.message);}
  catch(e){setError(e instanceof Error?e.message:"Email gagal dikirim.");}
  finally{setSaving(s=>({...s,[u.id]:false}));}
 }
 async function deactivate(u:User){
  if(!window.confirm("Nonaktifkan "+u.email+"? Semua sesi login akan dicabut. Buku dan riwayat tetap disimpan."))return;
  setSaving(s=>({...s,[u.id]:true}));setError("");
  try{
   const j=await request("/api/admin/users?id="+encodeURIComponent(u.id),{method:"DELETE"});
   const next={...u,...j.user};setUsers(us=>us.map(x=>x.id===u.id?next:x));setDrafts(ds=>({...ds,[u.id]:next}));
   setNotice("Akun dinonaktifkan. Data buku tetap tersimpan.");
  }catch(e){setError(e instanceof Error?e.message:"Gagal menonaktifkan akun.");}
  finally{setSaving(s=>({...s,[u.id]:false}));}
 }
 async function add(e:React.FormEvent){
  e.preventDefault();if(pending.current.size){setError("Selesaikan atau batalkan perubahan akun sebelum menambah pengguna.");return;}
  setBusy(true);setError("");setNotice("");
  try{
   const j=await request("/api/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(newUser)});
   setNewUser({email:"",name:"",role:"EDITOR"});await load();
   if(j.warning)setError(j.warning);else setNotice("Pengguna dibuat. Undangan aktivasi dikirim melalui email.");
  }catch(e){setError(e instanceof Error?e.message:"Gagal membuat pengguna.");}finally{setBusy(false);}
 }
 const filtered=users.filter(u=>(u.name+" "+u.email).toLowerCase().includes(query.toLowerCase())&&(roleFilter==="ALL"||u.role===roleFilter)&&(activeFilter==="ALL"||String(u.active)===activeFilter));
 return <section className="account-admin" aria-label="Manajemen pengguna">
  <header><div><h1 className="page-title">Manajemen pengguna</h1><p className="page-sub">Kelola akun tim, hak akses, dan pemulihan password.</p></div><a className="secondary-button" href="/studio">Kembali ke studio</a></header>
  <div className="account-stats">{[["Total pengguna",users.length],["Aktif",users.filter(u=>u.active).length],["Nonaktif / diundang",users.filter(u=>!u.active).length],["Admin",users.filter(u=>["ADMIN","SUPERADMIN"].includes(u.role)).length]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
  {error&&<p role="alert" className="account-alert">{error}</p>}
  <p role="status" aria-live="polite">{notice}</p>
  <details className="panel" open><summary>Tambah pengguna</summary><form onSubmit={add} className="account-fields">
   <label>Nama lengkap<input required minLength={2} maxLength={120} autoComplete="name" value={newUser.name} onChange={e=>setNewUser(u=>({...u,name:e.target.value}))}/></label>
   <label>Alamat email<input required type="email" maxLength={254} autoComplete="email" value={newUser.email} onChange={e=>setNewUser(u=>({...u,email:e.target.value}))}/></label>
   <label>Peran pengguna<select aria-label="Peran pengguna" value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value as Role}))}>{roles.map(role=><option key={role} value={role}>{role}</option>)}</select></label>
   <button className="primary-button" disabled={busy} type="submit">{busy?"Membuat…":"Tambah & kirim undangan"}</button>
  </form><p className="account-help">Editor menyusun buku; reviewer meninjau naskah; admin menangani penerbitan. Superadmin aktif terakhir dilindungi dari penurunan peran dan penonaktifan.</p></details>
  <div className="account-fields account-filters">
   <label>Cari pengguna<input type="search" placeholder="Nama atau email" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <label>Filter peran<select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="ALL">Semua peran</option>{roles.map(r=><option key={r}>{r}</option>)}</select></label>
   <label>Filter status<select value={activeFilter} onChange={e=>setActiveFilter(e.target.value)}><option value="ALL">Semua status</option><option value="true">Aktif</option><option value="false">Nonaktif / diundang</option></select></label>
  </div>
  {loading?<p role="status">Memuat pengguna…</p>:<p className="account-help">{filtered.length} dari {users.length} pengguna</p>}
  {!loading&&!filtered.length&&<p>Tidak ada pengguna yang cocok dengan pencarian.</p>}
  <div className="account-list">{filtered.map(u=>{const d=drafts[u.id]||u;const count=users.filter(user=>user.role==="SUPERADMIN"&&user.active).length;const roleLocked=!me||!!accountMutationError(me,u,{role:u.role==="SUPERADMIN"?"ADMIN":u.role},count);const deactivateLocked=!me||!!accountDeactivateError(me,u,count);const disabled=!!saving[u.id];return <article className="panel account-user" key={u.id} aria-label={u.email}>
   <div className="account-user-heading"><strong>{u.name}</strong><span>{u.role} · {u.active?"Aktif":"Nonaktif / diundang"}</span></div>
   <div className="account-fields">
    <label>Nama<input disabled={disabled} minLength={2} maxLength={120} value={d.name} onChange={e=>edit(u.id,{name:e.target.value})}/></label>
    <label>Email<input disabled={disabled} type="email" maxLength={254} value={d.email} onChange={e=>edit(u.id,{email:e.target.value})}/></label>
    <label>Hak akses<select disabled={roleLocked||disabled} value={d.role} onChange={e=>edit(u.id,{role:e.target.value as Role})}>{roles.map(role=><option key={role} value={role}>{role}</option>)}</select></label>
    <label>Status akun<select disabled={disabled||(u.active&&deactivateLocked)} value={String(d.active)} onChange={e=>{if(e.target.value==="false"){void deactivate(u);}else edit(u.id,{active:true});}}><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>
   </div>
   <div className="account-actions">
    <button type="button" className="secondary-button" disabled={disabled||pending.current.has(u.id)} onClick={()=>void recovery(u)}>{u.active?"Kirim reset password":"Kirim ulang aktivasi"}</button>
    {<><button type="button" className="secondary-button" disabled={disabled||!pending.current.has(u.id)} onClick={()=>restore(u.id)}>Batalkan perubahan</button>
    {pending.current.has(u.id)&&<button type="button" className="primary-button" disabled={disabled} onClick={()=>{clearTimeout(timers.current[u.id]);void save(u.id,d);}}>Simpan ulang</button>}
    {u.active&&!deactivateLocked&&<button type="button" className="secondary-button" disabled={disabled||pending.current.has(u.id)} onClick={()=>void deactivate(u)}>Nonaktifkan akun</button>}</>}
   </div><p role="status" className="account-help">{status[u.id]||(deactivateLocked?"Penonaktifan akun dilindungi":"Tersimpan")}</p>
  </article>})}</div>
  <p className="account-help">Reset password mengirim tautan sekali pakai, berlaku 30 menit. Password lama tetap berlaku sampai pengguna menyimpan password baru; setelah itu semua sesi login dicabut.</p>
  <style jsx>{`
   .account-admin{max-width:1200px;margin:auto;display:grid;gap:18px;color:var(--ink);min-width:0}
   :global(:root[data-theme="dark"]) .account-admin{--ink:#edf2ff;--muted:#b9c6db;--panel:#202d40;--bg:#142033;--line:#506078}
   h1,p,label{color:var(--ink)}
   header,.account-user-heading,.account-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
   .account-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px}
   .account-stats>div{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}
   .account-stats span,.account-help{font-size:12px;color:var(--muted);line-height:1.6}
   .account-stats strong{display:block;font-size:26px;margin-top:8px}
   .account-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:14px;align-items:end;margin-top:16px}
   label{display:grid;gap:7px;font-size:13px;min-width:0}input,select{width:100%;min-width:0;min-height:44px;border:1px solid var(--line);border-radius:8px;padding:9px 11px;background:var(--bg);color:var(--ink);font:inherit}
   button,a{min-height:44px;text-decoration:none}input:focus-visible,select:focus-visible,button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid var(--blue);outline-offset:3px}
   input:disabled,select:disabled{opacity:.75}summary{font-weight:700;cursor:pointer;padding:5px 0}.account-list{display:grid;gap:14px}
   .account-user-heading strong{overflow-wrap:anywhere}.account-user-heading span{font-size:12px;color:var(--muted)}.account-actions{justify-content:flex-start;margin-top:16px}
   .account-alert{border:1px solid currentColor;border-radius:10px;padding:12px;color:var(--ink);background:var(--panel)}.account-filters{margin-top:0}
   @media(max-width:480px){.account-actions button{width:100%}.panel{padding:14px}.page-title{font-size:22px}}
  `}</style>
 </section>;
}
