"use client";
import {useCallback,useEffect,useRef,useState} from "react";
type Role="EDITOR"|"REVIEWER"|"ADMIN"|"SUPERADMIN";
type User={id:string;email:string;name:string;role:Role;active:boolean};
const roles:Role[]=["EDITOR","REVIEWER","ADMIN"];
export default function AccountManagement(){
 const [users,setUsers]=useState<User[]>([]);
 const [drafts,setDrafts]=useState<Record<string,User>>({});
 const [status,setStatus]=useState<Record<string,string>>({});
 const [error,setError]=useState("");
 const [newUser,setNewUser]=useState({email:"",name:"",role:"EDITOR" as Role});
 const [busy,setBusy]=useState(false);
 const timers=useRef<Record<string,ReturnType<typeof setTimeout>>>({});
 const load=useCallback(async()=>{const r=await fetch("/api/admin/users",{cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.error||"Unable to load users");setUsers(j.users);setDrafts(Object.fromEntries((j.users as User[]).map(u=>[u.id,u])));},[]);
 useEffect(()=>{void load().catch(e=>setError(e.message));return()=>{Object.values(timers.current).forEach(clearTimeout)}},[load]);
 async function save(id:string,next:User){setStatus(s=>({...s,[id]:"Menyimpan..."}));try{const r=await fetch("/api/admin/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,name:next.name,role:next.role,active:next.active})});const j=await r.json();if(!r.ok)throw Error(j.error||"Save failed");setUsers(us=>us.map(u=>u.id===id?{...u,...j.user}:u));setStatus(s=>({...s,[id]:"Tersimpan otomatis"}))}catch(e){setStatus(s=>({...s,[id]:e instanceof Error?e.message:"Gagal menyimpan"}))}}
 function edit(id:string,changes:Partial<User>){const next={...drafts[id],...changes};setDrafts(d=>({...d,[id]:next}));setStatus(s=>({...s,[id]:"Menunggu autosave..."}));clearTimeout(timers.current[id]);timers.current[id]=setTimeout(()=>void save(id,next),700)}
 function reset(id:string){clearTimeout(timers.current[id]);const saved=users.find(u=>u.id===id);if(saved)setDrafts(d=>({...d,[id]:saved}));setStatus(s=>({...s,[id]:"Form dikembalikan ke data terakhir tersimpan"}))}
 async function add(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");try{const r=await fetch("/api/admin/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(newUser)});const j=await r.json();if(!r.ok)throw Error(j.error||"Create failed");setNewUser({email:"",name:"",role:"EDITOR"});await load();if(j.warning)setError(j.warning)}catch(e){setError(e instanceof Error?e.message:"Gagal membuat akun")}finally{setBusy(false)}}
 return <section style={{maxWidth:1100,margin:"0 auto",padding:"clamp(12px,2vw,28px)"}}>
  <h1>Manajemen Akun</h1><p>Superadmin · kelola pengguna dan hak akses. Perubahan akun tersimpan otomatis.</p>
  {error&&<p role="alert" style={{color:"var(--danger,#b42318)"}}>{error}</p>}
  <form onSubmit={add} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,alignItems:"end",margin:"24px 0"}}>
   <label>Nama<input required minLength={2} maxLength={120} style={{width:"100%"}} value={newUser.name} onChange={e=>setNewUser(u=>({...u,name:e.target.value}))}/></label>
   <label>Email<input required type="email" style={{width:"100%"}} value={newUser.email} onChange={e=>setNewUser(u=>({...u,email:e.target.value}))}/></label>
   <label>Hak akses<select style={{width:"100%"}} value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value as Role}))}>{roles.map(role=><option key={role}>{role}</option>)}</select></label>
   <button className="primary-button" disabled={busy} type="submit">{busy?"Menyimpan...":"Tambah akun"}</button>
  </form>
  <div style={{display:"grid",gap:12}}>{users.map(u=>{const d=drafts[u.id]||u;return <article key={u.id} style={{border:"1px solid var(--border,#d9dee8)",borderRadius:14,padding:16,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,alignItems:"end"}}>
   <label>Nama<input style={{width:"100%"}} disabled={u.role==="SUPERADMIN"} value={d.name} onChange={e=>edit(u.id,{name:e.target.value})}/></label>
   <div><small>Email</small><div style={{overflowWrap:"anywhere"}}>{u.email}</div></div>
   <label>Role<select style={{width:"100%"}} disabled={u.role==="SUPERADMIN"} value={d.role} onChange={e=>edit(u.id,{role:e.target.value as Role})}>{u.role==="SUPERADMIN"&&<option>SUPERADMIN</option>}{roles.map(role=><option key={role}>{role}</option>)}</select></label>
   <label>Status<select style={{width:"100%"}} disabled={u.role==="SUPERADMIN"} value={String(d.active)} onChange={e=>edit(u.id,{active:e.target.value==="true"})}><option value="true">Aktif</option><option value="false">Nonaktif</option></select></label>
   <div><button type="button" className="secondary-button" onClick={()=>reset(u.id)}>Reset</button><p role="status" style={{fontSize:12}}>{status[u.id]||"Tersimpan"}</p></div>
  </article>})}</div>
 </section>
}
